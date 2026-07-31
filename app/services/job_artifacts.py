from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

ARTIFACTS_KEY = "artifacts"

ARTIFACT_RESUME_OPTIMIZATION = "resume_optimization"
ARTIFACT_COVER_LETTER = "cover_letter"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _artifacts_dict(raw_metadata: dict | None) -> dict[str, Any]:
    if not raw_metadata:
        return {}
    value = raw_metadata.get(ARTIFACTS_KEY)
    return dict(value) if isinstance(value, dict) else {}


def save_job_artifact(
    raw_metadata: dict | None,
    artifact_type: str,
    *,
    analysis_id: str,
    result: dict[str, Any],
) -> dict:
    metadata = dict(raw_metadata or {})
    artifacts = _artifacts_dict(metadata)
    artifacts[artifact_type] = {
        "analysis_id": analysis_id,
        "result": result,
        "generated_at": _now_iso(),
    }
    metadata[ARTIFACTS_KEY] = artifacts
    return metadata


def read_job_artifact(
    raw_metadata: dict | None,
    artifact_type: str,
    *,
    analysis_id: str | None = None,
) -> dict[str, Any] | None:
    entry = _artifacts_dict(raw_metadata).get(artifact_type)
    if not isinstance(entry, dict):
        return None
    if analysis_id and entry.get("analysis_id") != analysis_id:
        return None
    result = entry.get("result")
    return result if isinstance(result, dict) else None
