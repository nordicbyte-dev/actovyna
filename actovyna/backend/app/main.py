"""ACTOVYNA API — privacy-minded, local-first personal document workspace.

This starter has NO authentication. Run locally only until an auth layer is added.
"""
from __future__ import annotations
import json
import os
import uuid
from datetime import date, timedelta
from pathlib import Path
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# backend/.env is loaded when running from either the repo or the backend directory.
load_dotenv(Path(__file__).resolve().parents[1] / '.env')
from .db import Base, engine, get_db  # noqa: E402
from .models import Document, Task  # noqa: E402
from .schemas import DocumentOut, DocumentDetail, Insight, TaskOut, TaskCreate, TaskUpdate, StatsOut  # noqa: E402
from .analyzer import extract_text, local_analysis, ai_analysis, can_ocr  # noqa: E402

Base.metadata.create_all(bind=engine)
app = FastAPI(title='ACTOVYNA API', version='1.0.0', docs_url='/api/docs', openapi_url='/api/openapi.json')

ALLOWED = {'.pdf', '.docx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'}
MAX_UPLOAD = 8 * 1024 * 1024


def serialize_document(doc: Document, detail: bool = False) -> dict:
    obj = {
        'id': doc.id, 'filename': doc.filename, 'filetype': doc.filetype,
        'filesize': doc.filesize, 'summary': doc.summary, 'mode': doc.mode,
        'created_at': doc.created_at, 'extracted_chars': len(doc.extracted_text),
        'preview': doc.extracted_text[:380],
        'insights': json.loads(doc.insights_json),
    }
    if detail:
        obj['extracted_text'] = doc.extracted_text
    return obj


def serialize_task(task: Task) -> dict:
    return {
        'id': task.id, 'document_id': task.document_id,
        'title': task.title, 'description': task.description,
        'due_date': task.due_date, 'evidence': task.evidence,
        'status': task.status, 'origin': task.origin,
        'created_at': task.created_at,
    }


@app.get('/api/health')
def health():
    return {'status': 'ok', 'ai_available': bool(os.getenv('OPENAI_API_KEY')), 'ocr_available': can_ocr()}


@app.get('/api/documents', response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    docs = db.scalars(select(Document).order_by(Document.created_at.desc())).all()
    return [serialize_document(doc) for doc in docs]


@app.get('/api/documents/{document_id}', response_model=DocumentDetail)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, 'Document niet gevonden.')
    return serialize_document(doc, detail=True)


@app.post('/api/documents', response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...), use_ai: bool = False,
    db: Session = Depends(get_db),
):
    name = Path(file.filename or 'document').name[:250]
    extension = Path(name).suffix.lower()
    if extension not in ALLOWED:
        raise HTTPException(415, 'Gebruik PDF, DOCX, TXT, MD, PNG, JPG of WEBP.')
    # Read at most max+1 to avoid unbounded memory usage.
    content = await file.read(MAX_UPLOAD + 1)
    await file.close()
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, 'Het bestand mag maximaal 8 MB zijn.')
    if not content:
        raise HTTPException(422, 'Het bestand is leeg.')
    try:
        extracted = extract_text(name, content)
        analysis = ai_analysis(extracted) if use_ai else local_analysis(extracted)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        # Never leak secrets / request traces to the client.
        raise HTTPException(502, 'AI-analyse is mislukt. Probeer lokale analyse zonder AI.') from exc

    doc = Document(
        id=str(uuid.uuid4()), filename=name, filetype=extension.lstrip('.'),
        filesize=len(content), extracted_text=extracted,
        summary=analysis.summary, mode=analysis.mode,
        insights_json=json.dumps(analysis.insights, ensure_ascii=False),
    )
    db.add(doc)
    for suggestion in analysis.tasks:
        db.add(Task(id=str(uuid.uuid4()), document_id=doc.id, **suggestion))
    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@app.delete('/api/documents/{document_id}', status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, 'Document niet gevonden.')
    db.delete(doc)
    db.commit()


@app.get('/api/tasks', response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    tasks = db.scalars(select(Task).order_by(Task.created_at.desc())).all()
    return [serialize_task(task) for task in tasks]


@app.post('/api/tasks', response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        id=str(uuid.uuid4()), title=payload.title,
        description=payload.description, due_date=payload.due_date,
        origin='manual', status='open', evidence='',
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@app.patch('/api/tasks/{task_id}', response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, 'Taak niet gevonden.')
    task.status = payload.status
    db.commit()
    db.refresh(task)
    return serialize_task(task)


@app.delete('/api/tasks/{task_id}', status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, 'Taak niet gevonden.')
    db.delete(task)
    db.commit()


@app.get('/api/stats', response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    return {
        'documents': db.scalar(select(func.count(Document.id))) or 0,
        'open_tasks': db.scalar(select(func.count(Task.id)).where(Task.status == 'open')) or 0,
        'done_tasks': db.scalar(select(func.count(Task.id)).where(Task.status == 'done')) or 0,
        'upcoming': db.scalar(select(func.count(Task.id)).where(
            Task.status == 'open', Task.due_date >= today, Task.due_date <= next_week,
        )) or 0,
        'overdue': db.scalar(select(func.count(Task.id)).where(
            Task.status == 'open', Task.due_date < today,
        )) or 0,
        'ai_available': bool(os.getenv('OPENAI_API_KEY')),
        'ocr_available': can_ocr(),
    }


@app.get('/api/export')
def export_all(db: Session = Depends(get_db)):
    docs = [serialize_document(doc, detail=True) for doc in db.scalars(select(Document)).all()]
    tasks = [serialize_task(task) for task in db.scalars(select(Task)).all()]
    payload = json.dumps({'version': 1, 'documents': docs, 'tasks': tasks}, default=str, ensure_ascii=False, indent=2)
    return JSONResponse(
        content=json.loads(payload),
        headers={'Content-Disposition': 'attachment; filename="actovyna-export.json"'},
    )
