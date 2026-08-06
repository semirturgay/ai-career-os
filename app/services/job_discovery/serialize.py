from __future__ import annotations

from app.models import JobDiscovery
from app.schemas.discovery import (
    DiscoveryCriteria,
    JobDiscoveryRead,
)
from app.services.job_discovery.candidates import serialize_candidates


def criteria_from_model(discovery: JobDiscovery) -> DiscoveryCriteria:
    raw = discovery.criteria if isinstance(discovery.criteria, dict) else {}
    return DiscoveryCriteria.model_validate(raw)


def discovery_to_read(discovery: JobDiscovery) -> JobDiscoveryRead:
    candidates = serialize_candidates(discovery.candidates)
    return JobDiscoveryRead(
        id=discovery.id,
        profile_id=discovery.profile_id,
        criteria=criteria_from_model(discovery),
        interval=discovery.interval,  # type: ignore[arg-type]
        enabled=discovery.enabled,
        status=discovery.status,  # type: ignore[arg-type]
        candidates=candidates,
        error=discovery.error,
        last_run_at=discovery.last_run_at,
        next_run_at=discovery.next_run_at,
        last_viewed_at=discovery.last_viewed_at,
        created_at=discovery.created_at,
        updated_at=discovery.updated_at,
    )


def dismiss_candidate(raw_candidates: list, candidate_id: str) -> list:
    updated: list = []
    for entry in raw_candidates:
        if not isinstance(entry, dict):
            continue
        if entry.get("id") == candidate_id:
            updated.append({**entry, "dismissed": True})
        else:
            updated.append(entry)
    return updated
