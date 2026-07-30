"""Normalize job posting URLs for deduplication."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlparse, urlunparse

LINKEDIN_JOB_PATH = re.compile(r"/jobs/view/(\d+)")
TRACKING_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
        "refid",
        "trackingid",
        "src",
        "gh_src",
        "lever-source",
    }
)


def _linkedin_job_id(url: str) -> str | None:
    parsed = urlparse(url)
    path_match = LINKEDIN_JOB_PATH.search(parsed.path)
    if path_match:
        return path_match.group(1)
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "currentJobId" and value:
            return value
    return None


def normalize_job_url(url: str | None) -> str | None:
    """Return a canonical URL for dedupe lookups, or None when URL is absent."""
    if url is None:
        return None
    raw = url.strip()
    if not raw:
        return None

    linkedin_id = _linkedin_job_id(raw)
    if linkedin_id:
        return f"https://www.linkedin.com/jobs/view/{linkedin_id}/"

    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        return raw

    host = parsed.hostname.lower() if parsed.hostname else ""
    path = parsed.path.rstrip("/") or "/"
    query_pairs = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() not in TRACKING_PARAMS
    ]
    query = "&".join(f"{key}={value}" for key, value in query_pairs) if query_pairs else ""

    return urlunparse((parsed.scheme.lower(), host, path, "", query, ""))
