from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.models import FeedbackEvent
from app.schemas.feedback import FeedbackEventType


@dataclass(frozen=True)
class MemoryDraft:
    category: str
    content: str
    memory_key: str | None = None


def _hash_key(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def draft_memory_from_feedback(event: FeedbackEvent) -> MemoryDraft | None:
    event_type = FeedbackEventType(event.event_type)
    payload = event.payload or {}

    if event_type == FeedbackEventType.GAP_DISPUTE:
        gap_evidence = str(payload.get("gap_evidence", "")).strip()
        if not gap_evidence:
            return None
        note = str(payload.get("user_note") or "").strip()
        content = f'User disputes this gap: "{gap_evidence}"'
        if note:
            content += f". Their note: {note}"
        else:
            content += ". They believe their resume already covers this."
        return MemoryDraft(
            category="correction",
            content=content,
            memory_key=_hash_key("gap", gap_evidence),
        )

    if event_type == FeedbackEventType.STRENGTH_CONFIRM:
        strength = str(payload.get("strength_evidence", "")).strip()
        if not strength:
            return None
        return MemoryDraft(
            category="correction",
            content=f'User confirmed this strength is accurate: "{strength}"',
            memory_key=_hash_key("strength", strength),
        )

    if event_type == FeedbackEventType.PREFERENCE:
        key = str(payload.get("key", "")).strip()
        value = str(payload.get("value", "")).strip()
        if not key or not value:
            return None
        note = str(payload.get("note") or "").strip()
        content = f"Career preference — {key}: {value}."
        if note:
            content += f" {note}"
        return MemoryDraft(
            category="preference",
            content=content,
            memory_key=_hash_key("pref", key),
        )

    if event_type == FeedbackEventType.APPLICATION_OUTCOME:
        status = str(payload.get("status", "")).strip()
        if not status or status == "saved":
            return None
        note = str(payload.get("note") or "").strip()
        job_hint = f" for job {event.job_id}" if event.job_id else ""
        content = f"Application outcome{job_hint}: {status.replace('_', ' ')}."
        if note:
            content += f" {note}"
        return MemoryDraft(
            category="outcome_pattern",
            content=content,
            memory_key=_hash_key("outcome", f"{event.job_id}:{status}"),
        )

    return None
