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


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def mark_application_step(raw_metadata: dict | None, step: str) -> dict:
    metadata = dict(raw_metadata or {})
    progress = _progress_dict(metadata)
    existing = progress.get(step)
    entry: dict[str, Any] = {
        "completed": True,
        "completed_at": _now_iso(),
    }
    if isinstance(existing, dict):
        entry = {**existing, **entry}
    progress[step] = entry
    metadata[APPLICATION_PROGRESS_KEY] = progress
    return metadata


def mark_resume_applied(
    raw_metadata: dict | None,
    *,
    analysis_id: str,
    score: float,
    gap_count: int,
    suggestions_count: int,
) -> dict:
    metadata = dict(raw_metadata or {})
    progress = _progress_dict(metadata)
    progress[STEP_RESUME] = {
        "completed": True,
        "completed_at": _now_iso(),
        "baseline_analysis_id": analysis_id,
        "baseline_score": round(score, 1),
        "baseline_gap_count": gap_count,
        "suggestions_applied_at": _now_iso(),
        "suggestions_count": suggestions_count,
        "awaiting_reanalysis": True,
    }
    metadata[APPLICATION_PROGRESS_KEY] = progress
    return metadata


def record_match_remeasurement(
    raw_metadata: dict | None,
    *,
    analysis_id: str,
    score: float,
    gap_count: int,
) -> dict:
    metadata = dict(raw_metadata or {})
    progress = _progress_dict(metadata)
    resume = progress.get(STEP_RESUME)
    if not isinstance(resume, dict) or not resume.get("awaiting_reanalysis"):
        return metadata

    baseline_analysis_id = resume.get("baseline_analysis_id")
    baseline_score = resume.get("baseline_score")
    if baseline_analysis_id == analysis_id or baseline_score is None:
        return metadata

    resume = dict(resume)
    resume["awaiting_reanalysis"] = False
    resume["remeasured_at"] = _now_iso()
    resume["remeasured_analysis_id"] = analysis_id
    resume["remeasured_score"] = round(score, 1)
    resume["score_delta"] = round(score - float(baseline_score), 1)
    resume["remeasured_gap_count"] = gap_count
    progress[STEP_RESUME] = resume
    metadata[APPLICATION_PROGRESS_KEY] = progress
    return metadata


def read_resume_progress(raw_metadata: dict | None) -> dict[str, Any] | None:
    progress = _progress_dict(raw_metadata)
    resume = progress.get(STEP_RESUME)
    return dict(resume) if isinstance(resume, dict) else None


def is_application_step_done(raw_metadata: dict | None, step: str) -> bool:
    progress = _progress_dict(raw_metadata)
    entry = progress.get(step)
    if isinstance(entry, dict):
        return bool(entry.get("completed"))
    return bool(entry)
