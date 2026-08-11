"""Ashby job board posting API — https://developers.ashbyhq.com/docs/public-job-posting-api"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from app.services.job_paste_parser import html_to_text
from app.services.radar.sources.base import AtsBoardNotFoundError, AtsError, RawPosting
from app.services.radar.sources.transport import ATS_PROBE_TIMEOUT_SECONDS, fetch_json

API_BASE = "https://api.ashbyhq.com/posting-api/job-board"

# Only board URLs. A bare `ashbyhq.com/<anything>` also matches Ashby's own marketing
# pages (/compare, /pricing), which sends the resolver probing nonsense tokens.
_URL_PATTERN = re.compile(
    r"(?:jobs\.ashbyhq\.com|ashbyhq\.com/job-board)/([a-z0-9_.-]+)",
    re.I,
)
_REMOTE_PATTERN = re.compile(r"\bremote\b", re.I)


class AshbySource:
    provider = "ashby"
    label = "Ashby"

    def matches_url(self, url: str) -> str | None:
        match = _URL_PATTERN.search(url)
        if not match:
            return None
        token = match.group(1).strip().lower()
        if not token or token in {"www", "api", "posting-api"}:
            return None
        return token

    def board_url(self, token: str) -> str:
        return f"https://jobs.ashbyhq.com/{token}"

    async def probe(self, token: str) -> bool:
        try:
            payload = await fetch_json(
                provider=self.provider,
                operation="ats_probe",
                url=f"{API_BASE}/{token}",
                timeout=ATS_PROBE_TIMEOUT_SECONDS,
            )
        except (AtsBoardNotFoundError, AtsError):
            return False
        return isinstance(payload, dict) and isinstance(payload.get("jobs"), list)

    async def fetch(self, token: str) -> list[RawPosting]:
        payload = await fetch_json(
            provider=self.provider,
            operation="ats_fetch",
            url=f"{API_BASE}/{token}?includeCompensation=true",
        )
        if not isinstance(payload, dict):
            raise AtsError("Ashby board returned an unexpected shape")

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

    plain = job.get("descriptionPlain")
    if isinstance(plain, str) and plain.strip():
        description = plain.strip()
    else:
        description = html_to_text(str(job.get("descriptionHtml") or ""))
    if not description:
        return None

    location = str(job.get("location") or "").strip() or None

    return RawPosting(
        external_id=external_id,
        title=title,
        description=description,
        url=str(job.get("jobUrl") or job.get("applyUrl") or "").strip() or None,
        location=location,
        remote_flag=bool(job.get("isRemote"))
        or bool(location and _REMOTE_PATTERN.search(location)),
        posted_at=_parse_timestamp(job.get("publishedAt") or job.get("updatedAt")),
        raw_payload={
            k: v for k, v in job.items() if k not in {"descriptionHtml", "descriptionPlain"}
        },
    )


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
