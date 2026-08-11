"""Greenhouse job board API — https://developers.greenhouse.io/job-board.html"""

from __future__ import annotations

import re
from datetime import datetime
from html import unescape
from typing import Any

from app.services.job_paste_parser import html_to_text
from app.services.radar.sources.base import AtsBoardNotFoundError, AtsError, RawPosting
from app.services.radar.sources.transport import ATS_PROBE_TIMEOUT_SECONDS, fetch_json

API_BASE = "https://boards-api.greenhouse.io/v1/boards"

# boards.greenhouse.io/acme, job-boards.greenhouse.io/acme, acme.greenhouse.io
_URL_PATTERNS = (
    re.compile(r"(?:job-)?boards\.greenhouse\.io/(?:embed/job_board\?for=)?([a-z0-9_-]+)", re.I),
    re.compile(r"([a-z0-9_-]+)\.greenhouse\.io", re.I),
)

_REMOTE_PATTERN = re.compile(r"\bremote\b", re.I)


class GreenhouseSource:
    provider = "greenhouse"
    label = "Greenhouse"

    def matches_url(self, url: str) -> str | None:
        for pattern in _URL_PATTERNS:
            match = pattern.search(url)
            if match:
                token = match.group(1).strip().lower()
                if token and token not in {"www", "boards", "job-boards", "api", "boards-api"}:
                    return token
        return None

    def board_url(self, token: str) -> str:
        return f"https://job-boards.greenhouse.io/{token}"

    async def probe(self, token: str) -> bool:
        try:
            payload = await fetch_json(
                provider=self.provider,
                operation="ats_probe",
                url=f"{API_BASE}/{token}/jobs",
                timeout=ATS_PROBE_TIMEOUT_SECONDS,
            )
        except (AtsBoardNotFoundError, AtsError):
            return False
        return isinstance(payload, dict) and "jobs" in payload

    async def fetch(self, token: str) -> list[RawPosting]:
        payload = await fetch_json(
            provider=self.provider,
            operation="ats_fetch",
            url=f"{API_BASE}/{token}/jobs?content=true",
        )
        if not isinstance(payload, dict):
            raise AtsError("Greenhouse board returned an unexpected shape")

        jobs = payload.get("jobs")
        if not isinstance(jobs, list):
            return []

        postings: list[RawPosting] = []
        for job in jobs:
            posting = _to_posting(job)
            if posting:
                postings.append(posting)
        return postings


def _to_posting(job: Any) -> RawPosting | None:
    if not isinstance(job, dict):
        return None

    external_id = str(job.get("id") or "").strip()
    title = str(job.get("title") or "").strip()
    if not external_id or not title:
        return None

    # Greenhouse returns `content` as HTML-escaped HTML ("&lt;p&gt;…"). Unescape first,
    # or the parser sees one long text node and the tags survive as literal characters.
    # Boards that return real HTML are unaffected — unescape is a no-op on raw tags.
    description = html_to_text(unescape(str(job.get("content") or "")))
    if not description:
        return None

    location = None
    raw_location = job.get("location")
    if isinstance(raw_location, dict):
        location = str(raw_location.get("name") or "").strip() or None

    return RawPosting(
        external_id=external_id,
        title=title,
        description=description,
        url=str(job.get("absolute_url") or "").strip() or None,
        location=location,
        remote_flag=bool(location and _REMOTE_PATTERN.search(location)),
        posted_at=_parse_timestamp(job.get("first_published") or job.get("updated_at")),
        raw_payload={k: v for k, v in job.items() if k != "content"},
    )


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
