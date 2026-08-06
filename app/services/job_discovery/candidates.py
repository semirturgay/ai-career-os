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


def normalize_discovery_url(url: str) -> str:
    return _normalize_url(url)


def known_urls_from_existing(existing: list[dict]) -> frozenset[str]:
    urls: set[str] = set()
    for item in existing:
        url = item.get("url")
        if isinstance(url, str) and url.strip():
            urls.add(normalize_discovery_url(url))
    return frozenset(urls)


def guess_company_from_result(result: SearchResult) -> str:
    title = result.title.strip()
    for separator in (" - ", " | ", " at ", " @ "):
        if separator in title:
            tail = title.rsplit(separator, 1)[-1].strip()
            if tail and len(tail) <= 80:
                return tail
    host = hostname_from_url(result.url)
    if host.startswith("boards."):
        host = host.removeprefix("boards.")
    if host.startswith("jobs."):
        host = host.removeprefix("jobs.")
    label = host.split(".")[0]
    return label.replace("-", " ").title() if label else "Unknown"


def fallback_candidates_from_results(
    results: list[SearchResult],
    *,
    known_urls: frozenset[str],
    seen_at: datetime,
    max_candidates: int = 8,
) -> list[dict]:
    from app.services.job_discovery.filters import is_likely_job_listing

    candidates: list[dict] = []
    seen: set[str] = set()

    for result in results:
        key = normalize_discovery_url(result.url)
        if key in known_urls or key in seen:
            continue
        if not is_likely_job_listing(result):
            continue
        seen.add(key)
        candidates.append(
            {
                "id": f"candidate_{uuid.uuid4()}",
                "title": result.title,
                "company": guess_company_from_result(result),
                "url": result.url,
                "snippet": result.snippet,
                "source": hostname_from_url(result.url),
                "fit_score": 55,
                "fit_reason": "Matched discovery search; review posting to confirm fit.",
                "dismissed": False,
                "first_seen_at": seen_at.isoformat(),
                "last_seen_at": seen_at.isoformat(),
            }
        )
        if len(candidates) >= max_candidates:
            break

    return candidates


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
