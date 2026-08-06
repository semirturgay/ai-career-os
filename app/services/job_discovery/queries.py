from __future__ import annotations

import re

from app.schemas.discovery import DiscoveryCriteria
from app.services.job_discovery.job_search import JobSearchRequest

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


def build_refresh_queries(criteria: DiscoveryCriteria) -> list[str]:
    """Alternate phrasing for follow-up runs when seed queries repeat prior results."""
    title = simplify_title(criteria.title)
    location = _location_phrase(criteria)
    seed_keys = {query.casefold() for query in build_seed_queries(criteria)}
    queries: list[str] = []

    if location:
        queries.extend(
            [
                _clip(f"{title} vacancies {location}"),
                _clip(f"{title} openings {location}"),
                _clip(f"{title} job posting {location}"),
                _clip(f"software engineer hiring {location}"),
                _clip(f"developer jobs {location}"),
            ]
        )
    else:
        queries.extend(
            [
                _clip(f"{title} vacancies"),
                _clip(f"{title} openings"),
                _clip(f"{title} job posting"),
                _clip("software engineer hiring"),
            ]
        )

    if criteria.remote == "remote" and location:
        queries.append(_clip(f"remote software engineer {location}"))

    seen: set[str] = set()
    unique: list[str] = []
    for query in queries:
        key = query.casefold()
        if key in seen or key in seed_keys:
            continue
        seen.add(key)
        unique.append(query)
    return unique[:5]


def _clip(query: str) -> str:
    query = " ".join(query.split())
    if len(query) <= MAX_QUERY_CHARS:
        return query
    return query[: MAX_QUERY_CHARS - 1].rsplit(" ", 1)[0]


_COUNTRY_TO_ISO: dict[str, str] = {
    "turkey": "TR",
    "türkiye": "TR",
    "germany": "DE",
    "india": "IN",
    "united states": "US",
    "usa": "US",
    "us": "US",
    "united kingdom": "GB",
    "uk": "GB",
    "canada": "CA",
    "france": "FR",
    "netherlands": "NL",
    "spain": "ES",
    "italy": "IT",
    "poland": "PL",
    "portugal": "PT",
    "ireland": "IE",
    "australia": "AU",
    "singapore": "SG",
}


def resolve_country_code(country: str | None) -> str | None:
    if not country:
        return None
    cleaned = country.strip()
    if len(cleaned) == 2 and cleaned.isalpha():
        return cleaned.upper()
    return _COUNTRY_TO_ISO.get(cleaned.casefold())


def _base_jsearch_request(criteria: DiscoveryCriteria, *, date_posted: str) -> JobSearchRequest:
    return JobSearchRequest(
        query=simplify_title(criteria.title),
        country=resolve_country_code(criteria.country),
        date_posted=date_posted,
        remote_only=criteria.remote == "remote",
    )


def build_jsearch_seed_requests(criteria: DiscoveryCriteria) -> list[JobSearchRequest]:
    """Primary JSearch queries for a discovery monitor."""
    title = simplify_title(criteria.title)
    country = resolve_country_code(criteria.country)
    remote_only = criteria.remote == "remote"
    location = _location_phrase(criteria)
    primary_query = _clip(f"{title} in {location}") if location else title

    requests: list[JobSearchRequest] = [
        JobSearchRequest(
            query=primary_query,
            country=country,
            date_posted="week",
            remote_only=remote_only,
        )
    ]

    if criteria.city and primary_query != title:
        requests.append(
            JobSearchRequest(
                query=title,
                country=country,
                date_posted="week",
                remote_only=remote_only,
            )
        )

    notes = (criteria.notes or "").strip()
    if notes:
        keyword = " ".join(notes.split(",")[0].strip().split()[:2])
        if keyword and len(keyword) <= 24:
            requests.append(
                JobSearchRequest(
                    query=_clip(f"{title} {keyword}"),
                    country=country,
                    date_posted="week",
                    remote_only=remote_only,
                )
            )

    if remote_only and country:
        requests.append(
            JobSearchRequest(
                query=_clip(f"remote {title}"),
                country=country,
                date_posted="week",
                remote_only=True,
            )
        )

    return _dedupe_requests(requests)[:4]


def build_jsearch_broad_fallback_requests(criteria: DiscoveryCriteria) -> list[JobSearchRequest]:
    """When country-scoped JSearch returns nothing, retry without country filter."""
    title = simplify_title(criteria.title)
    location = _location_phrase(criteria)
    query = _clip(f"{title} {location}".strip()) if location else title
    return [
        JobSearchRequest(
            query=query,
            country=None,
            date_posted="month",
            remote_only=criteria.remote == "remote",
        )
    ]


def build_jsearch_refresh_requests(criteria: DiscoveryCriteria) -> list[JobSearchRequest]:
    """Broader follow-up queries when seed results repeat known URLs."""
    title = simplify_title(criteria.title)
    country = resolve_country_code(criteria.country)
    remote_only = criteria.remote == "remote"
    seed_keys = {_request_key(request) for request in build_jsearch_seed_requests(criteria)}
    requests: list[JobSearchRequest] = [
        JobSearchRequest(
            query=_clip(f"{title} software engineer"),
            country=country,
            date_posted="month",
            remote_only=remote_only,
        ),
        JobSearchRequest(
            query=_clip(f"{title} developer"),
            country=country,
            date_posted="month",
            remote_only=remote_only,
        ),
    ]

    if criteria.city:
        requests.append(
            JobSearchRequest(
                query=_clip(f"software engineer {criteria.city}"),
                country=country,
                date_posted="month",
                remote_only=remote_only,
            )
        )

    unique: list[JobSearchRequest] = []
    for request in requests:
        key = _request_key(request)
        if key not in seed_keys:
            unique.append(request)
    return unique[:3]


def jsearch_request_from_query(criteria: DiscoveryCriteria, query: str) -> JobSearchRequest:
    return JobSearchRequest(
        query=_clip(query),
        country=resolve_country_code(criteria.country),
        date_posted="week",
        remote_only=criteria.remote == "remote",
    )


def _request_key(request: JobSearchRequest) -> str:
    return "|".join(
        [
            request.query.casefold(),
            (request.country or "").casefold(),
            request.date_posted,
            "remote" if request.remote_only else "any",
        ]
    )


def _dedupe_requests(requests: list[JobSearchRequest]) -> list[JobSearchRequest]:
    seen: set[str] = set()
    unique: list[JobSearchRequest] = []
    for request in requests:
        key = _request_key(request)
        if key in seen:
            continue
        seen.add(key)
        unique.append(request)
    return unique
