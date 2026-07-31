from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

APPLICATION_PROGRESS_KEY = "application_progress"

STEP_RESUME = "resume"
STEP_COVER_LETTER = "cover_letter"


def _progress_dict(raw_metadata: dict | None) -> dict[str, Any]:
    if not raw_metadata:
        return {}
    value = raw_metadata.get(APPLICATION_PROGRESS_KEY)
    return dict(value) if isinstance(value, dict) else {}


def mark_application_step(raw_metadata: dict | None, step: str) -> dict:
    metadata = dict(raw_metadata or {})
    progress = _progress_dict(metadata)
    progress[step] = {
        "completed": True,
        "completed_at": datetime.now(UTC).isoformat(),
    }
    metadata[APPLICATION_PROGRESS_KEY] = progress
    return metadata


def is_application_step_done(raw_metadata: dict | None, step: str) -> bool:
    progress = _progress_dict(raw_metadata)
    entry = progress.get(step)
    if isinstance(entry, dict):
        return bool(entry.get("completed"))
    return bool(entry)
