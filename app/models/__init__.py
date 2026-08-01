import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Profile(Base):
    """A user's career profile — the source of truth for matching."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    headline: Mapped[str | None] = mapped_column(String(500))
    resume_text: Mapped[str] = mapped_column(Text)
    structured_data: Mapped[dict | None] = mapped_column(JSONB, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    match_analyses: Mapped[list["MatchAnalysis"]] = relationship(back_populates="profile")
    feedback_events: Mapped[list["FeedbackEvent"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    chunk_embeddings: Mapped[list["ResumeChunkEmbedding"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
    )


class Job(Base):
    """A job opportunity — manually added or discovered later."""

    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500))
    company: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(2048))
    source: Mapped[str | None] = mapped_column(String(100))
    raw_metadata: Mapped[dict | None] = mapped_column(JSONB, default=None)
    company_brief: Mapped[dict | None] = mapped_column(JSONB, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    match_analyses: Mapped[list["MatchAnalysis"]] = relationship(back_populates="job")
    feedback_events: Mapped[list["FeedbackEvent"]] = relationship(back_populates="job")


class FeedbackEvent(Base):
    """User feedback captured for career memory and downstream prompt context."""

    __tablename__ = "feedback_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), index=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id"), index=True)
    match_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("match_analyses.id"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped["Profile"] = relationship(back_populates="feedback_events")
    job: Mapped["Job | None"] = relationship(back_populates="feedback_events")
    match_analysis: Mapped["MatchAnalysis | None"] = relationship()


class MatchAnalysis(Base):
    """Result of comparing a profile against a job.

    The `result` JSONB column will hold structured LLM output once the AI
    layer is implemented. For now it stores the placeholder response.
    """

    __tablename__ = "match_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), index=True)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    result: Mapped[dict | None] = mapped_column(JSONB, default=None)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped["Profile"] = relationship(back_populates="match_analyses")
    job: Mapped["Job"] = relationship(back_populates="match_analyses")


class AppSettings(Base):
    """Singleton row for local app configuration (LLM provider, API keys).

    Single-user for now — becomes per-user when auth lands.
    """

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    llm_provider: Mapped[str | None] = mapped_column(String(50))
    llm_model: Mapped[str | None] = mapped_column(String(100))
    llm_api_key: Mapped[str | None] = mapped_column(Text)
    llm_base_url: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


from app.models.rag_embeddings import ResumeChunkEmbedding  # noqa: E402

__all__ = [
    "AppSettings",
    "Base",
    "FeedbackEvent",
    "Job",
    "MatchAnalysis",
    "Profile",
    "ResumeChunkEmbedding",
]
