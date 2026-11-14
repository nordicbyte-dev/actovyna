"""Public API schemas."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator

class Insight(BaseModel):
    kind: Literal["date", "amount", "note"]
    title: str
    detail: str
    evidence: str

class DocumentOut(BaseModel):
    id: str
    filename: str
    filetype: str
    filesize: int
    summary: str
    mode: str
    created_at: datetime
    extracted_chars: int
    preview: str
    insights: list[Insight]

class DocumentDetail(DocumentOut):
    extracted_text: str

class TaskOut(BaseModel):
    id: str
    document_id: str | None
    title: str
    description: str
    due_date: str | None
    evidence: str
    status: str
    origin: str
    created_at: datetime

class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    description: str = Field(default="", max_length=3000)
    due_date: str | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("De titel moet minimaal twee tekens bevatten.")
        return value

    @field_validator("due_date")
    @classmethod
    def validate_due_date(cls, value: str | None):
        if not value:
            return None
        from datetime import date
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Gebruik YYYY-MM-DD als datum.") from exc
        return value

class TaskUpdate(BaseModel):
    status: Literal["open", "done"]

class StatsOut(BaseModel):
    documents: int
    open_tasks: int
    done_tasks: int
    upcoming: int
    overdue: int
    ai_available: bool
    ocr_available: bool
