from __future__ import annotations

import uuid
from datetime import datetime
from urllib.parse import urlparse, urlunparse

from app.schemas.company_research import SearchResult
from app.schemas.discovery import DiscoveryCandidatePick, JobDiscoveryCandidateRead
from app.services.job_discovery.intervals import hostname_from_url


def _normalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", "")).casefold()


def merge_candidates(
    existing: list[dict],
    incoming: list[dict],
) -> list[dict]:
    by_url: dict[str, dict] = {}
    for item in existing:
        url = item.get("url")
        if isinstance(url, str) and url.strip():
            by_url[_normalize_url(url)] = item

    for item in incoming:
        url = item.get("url")
        if not isinstance(url, str) or not url.strip():
            continue
        key = _normalize_url(url)
        prior = by_url.get(key)
        if prior:
            by_url[key] = {
                **prior,
                "title": item.get("title", prior.get("title")),
                "company": item.get("company", prior.get("company")),
                "snippet": item.get("snippet", prior.get("snippet")),
                "source": item.get("source", prior.get("source")),
                "fit_score": item.get("fit_score", prior.get("fit_score")),
                "fit_reason": item.get("fit_reason", prior.get("fit_reason")),
                "last_seen_at": item.get("last_seen_at", prior.get("last_seen_at")),
            }
        else:
            by_url[key] = item

    merged = list(by_url.values())
    merged.sort(
        key=lambda item: item.get("first_seen_at") or "",
        reverse=True,
    )
    return merged


def picks_to_candidates(
    picks: list[DiscoveryCandidatePick],
    search_results: list[SearchResult],
    *,
    seen_at: datetime,
) -> list[dict]:
    candidates: list[dict] = []
    for pick in picks:
        index = pick.result_index - 1
        if index < 0 or index >= len(search_results):
            continue
        result = search_results[index]
        candidates.append(
            {
                "id": f"candidate_{uuid.uuid4()}",
                "title": result.title,
                "company": pick.company,
                "url": result.url,
                "snippet": result.snippet,
                "source": hostname_from_url(result.url),
                "fit_score": pick.fit_score,
                "fit_reason": pick.fit_reason,
                "dismissed": False,
                "first_seen_at": seen_at.isoformat(),
                "last_seen_at": seen_at.isoformat(),
            }
        )
    return candidates


def serialize_candidates(raw: list | None) -> list[JobDiscoveryCandidateRead]:
    if not raw:
        return []

    items: list[JobDiscoveryCandidateRead] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        try:
            items.append(JobDiscoveryCandidateRead.model_validate(entry))
        except Exception:
            continue
    return items
