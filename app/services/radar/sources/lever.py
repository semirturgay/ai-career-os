"""Lever postings API — https://github.com/lever/postings-api"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from app.services.job_paste_parser import html_to_text
from app.services.radar.sources.base import AtsBoardNotFoundError, AtsError, RawPosting
from app.services.radar.sources.transport import ATS_PROBE_TIMEOUT_SECONDS, fetch_json

API_BASE = "https://api.lever.co/v0/postings"

_URL_PATTERN = re.compile(r"(?:jobs|hire)\.lever\.co/([a-z0-9_-]+)", re.I)
_REMOTE_PATTERN = re.compile(r"\bremote\b", re.I)

# Joined into `description`; kept out of raw_payload so we don't store the text twice.
_DESCRIPTION_FIELDS = frozenset(
    {"description", "descriptionPlain", "lists", "additional", "additionalPlain"}
)


class LeverSource:
    provider = "lever"
    label = "Lever"

    def matches_url(self, url: str) -> str | None:
        match = _URL_PATTERN.search(url)
        if not match:
            return None
        return match.group(1).strip().lower() or None

    def board_url(self, token: str) -> str:
        return f"https://jobs.lever.co/{token}"

    async def probe(self, token: str) -> bool:
        try:
            payload = await fetch_json(
                provider=self.provider,
                operation="ats_probe",
                url=f"{API_BASE}/{token}?mode=json&limit=1",
                timeout=ATS_PROBE_TIMEOUT_SECONDS,
            )
        except (AtsBoardNotFoundError, AtsError):
            return False
        return isinstance(payload, list)

    async def fetch(self, token: str) -> list[RawPosting]:
        payload = await fetch_json(
            provider=self.provider,
            operation="ats_fetch",
            url=f"{API_BASE}/{token}?mode=json",
        )
        if not isinstance(payload, list):
            raise AtsError("Lever board returned an unexpected shape")

        postings: list[RawPosting] = []
        for job in payload:
            posting = _to_posting(job)
            if posting:
                postings.append(posting)
        return postings


def _to_posting(job: Any) -> RawPosting | None:
    if not isinstance(job, dict):
        return None

    external_id = str(job.get("id") or "").strip()
    title = str(job.get("text") or "").strip()
    if not external_id or not title:
        return None

    description = _full_description(job)
    if not description:
        return None

    categories = job.get("categories") if isinstance(job.get("categories"), dict) else {}
    location = str(categories.get("location") or "").strip() or None
    workplace = str(job.get("workplaceType") or "").strip().lower()

    return RawPosting(
        external_id=external_id,
        title=title,
        description=description,
        url=str(job.get("hostedUrl") or job.get("applyUrl") or "").strip() or None,
        location=location,
        remote_flag=workplace == "remote" or bool(location and _REMOTE_PATTERN.search(location)),
        posted_at=_parse_epoch_ms(job.get("createdAt")),
        raw_payload={k: v for k, v in job.items() if k not in _DESCRIPTION_FIELDS},
    )


def _full_description(job: dict) -> str:
    """Lever splits a posting across description, lists, and additional — join them all."""
    parts: list[str] = []

    body = job.get("descriptionPlain") or job.get("description")
    if isinstance(body, str) and body.strip():
        parts.append(html_to_text(body) if "<" in body else body.strip())

    lists = job.get("lists")
    if isinstance(lists, list):
        for entry in lists:
            if not isinstance(entry, dict):
                continue
            heading = str(entry.get("text") or "").strip()
            content = str(entry.get("content") or "")
            section = html_to_text(content) if content else ""
            if heading and section:
                parts.append(f"{heading}\n{section}")
            elif section:
                parts.append(section)

    extra = job.get("additionalPlain") or job.get("additional")
    if isinstance(extra, str) and extra.strip():
        parts.append(html_to_text(extra) if "<" in extra else extra.strip())

    return "\n\n".join(part for part in parts if part).strip()


def _parse_epoch_ms(value: Any) -> datetime | None:
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    try:
        return datetime.fromtimestamp(value / 1000, tz=UTC)
    except (OverflowError, OSError, ValueError):
        return None
