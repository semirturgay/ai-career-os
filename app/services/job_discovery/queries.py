from __future__ import annotations

import re

from app.schemas.discovery import DiscoveryCriteria

MAX_QUERY_CHARS = 90

# Keep one role phrase — users often paste "Senior X AI Engineer" as one title.
_MULTI_ROLE_SPLIT = re.compile(r"\s+(?:/|\||,|\band\b|\bor\b)\s+", re.I)


def simplify_title(title: str) -> str:
    cleaned = title.strip()
    if not cleaned:
        return "software engineer"
    parts = _MULTI_ROLE_SPLIT.split(cleaned)
    primary = parts[0].strip()
    words = primary.split()
    if len(words) > 6:
        primary = " ".join(words[:6])
    return primary


def _location_phrase(criteria: DiscoveryCriteria) -> str:
    if criteria.city:
        return criteria.city.strip()
    if criteria.country:
        return criteria.country.strip()
    return ""


def build_seed_queries(criteria: DiscoveryCriteria) -> list[str]:
    """Short, broad queries that DuckDuckGo actually returns results for."""
    title = simplify_title(criteria.title)
    location = _location_phrase(criteria)
    queries: list[str] = []

    if location:
        queries.append(_clip(f"{title} jobs {location}"))
        queries.append(_clip(f"{title} hiring {location}"))
        queries.append(_clip(f"{title} careers {location}"))
    else:
        queries.append(_clip(f"{title} jobs"))
        queries.append(_clip(f"{title} hiring"))

    if criteria.remote == "remote":
        if location:
            queries.append(_clip(f"{title} remote {location}"))
        else:
            queries.append(_clip(f"{title} remote jobs"))

    notes = (criteria.notes or "").strip()
    if notes and location:
        # Use first comma-separated note token as extra keyword when short enough.
        keyword = notes.split(",")[0].strip().split()[0:2]
        if keyword:
            extra = " ".join(keyword)
            if len(extra) <= 20:
                queries.append(_clip(f"{title} {extra} jobs {location}"))

    # Dedupe while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for query in queries:
        key = query.casefold()
        if key not in seen:
            seen.add(key)
            unique.append(query)
    return unique[:5]


def _clip(query: str) -> str:
    query = " ".join(query.split())
    if len(query) <= MAX_QUERY_CHARS:
        return query
    return query[: MAX_QUERY_CHARS - 1].rsplit(" ", 1)[0]
