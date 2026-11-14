"""Persistent, user-editable data. Raw uploaded binaries are never stored."""
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    filename: Mapped[str] = mapped_column(String(250), nullable=False)
    filetype: Mapped[str] = mapped_column(String(12), nullable=False)
    filesize: Mapped[int] = mapped_column(Integer, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(12), nullable=False, default="local")
    insights_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    document_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    evidence: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="open")
    origin: Mapped[str] = mapped_column(String(12), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    document: Mapped[Document | None] = relationship(back_populates="tasks")
