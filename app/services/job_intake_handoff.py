"""Short-lived handoffs from the browser extension to the web app review flow."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.schemas.job_extraction import JobExtraction

HANDOFF_TTL = timedelta(minutes=30)


@dataclass(frozen=True)
class JobIntakeHandoff:
    id: UUID
    job_text: str
    structured_data: JobExtraction
    url: str | None
    source: str | None
    created_at: datetime


_store: dict[UUID, JobIntakeHandoff] = {}


def _purge_expired(now: datetime | None = None) -> None:
    cutoff = (now or datetime.now(UTC)) - HANDOFF_TTL
    expired = [handoff_id for handoff_id, entry in _store.items() if entry.created_at < cutoff]
    for handoff_id in expired:
        _store.pop(handoff_id, None)


def create_handoff(
    *,
    job_text: str,
    structured_data: JobExtraction,
    url: str | None = None,
    source: str | None = None,
) -> JobIntakeHandoff:
    _purge_expired()
    handoff = JobIntakeHandoff(
        id=uuid4(),
        job_text=job_text,
        structured_data=structured_data,
        url=url,
        source=source,
        created_at=datetime.now(UTC),
    )
    _store[handoff.id] = handoff
    return handoff


def get_handoff(handoff_id: UUID) -> JobIntakeHandoff | None:
    _purge_expired()
    entry = _store.get(handoff_id)
    if entry is None:
        return None
    if entry.created_at < datetime.now(UTC) - HANDOFF_TTL:
        _store.pop(handoff_id, None)
        return None
    return entry


def clear_store_for_tests() -> None:
    _store.clear()
