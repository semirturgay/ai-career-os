"""Company name or careers URL → a public ATS board.

Three tiers, first hit wins, cheapest first:

1. **URL** — the user pasted a board URL; parse provider + token deterministically.
2. **Probe** — slugify the name and ask each provider's API whether that board exists.
3. **Search** — fall back to the shared web-search layer, then parse board URLs out of
   the results. This is a plain web search, the same category company research already
   uses (docs/intake-policy.md).

The result is always shown to the user for confirmation before anything is saved.
"""

from __future__ import annotations

import asyncio
import re

from app.logging_config import get_logger
from app.schemas.radar import ResolvedBoard
from app.services.radar.sources import AtsError, all_sources
from app.services.radar.sources.base import AtsSource
from app.services.search.base import SearchError
from app.services.search.factory import create_search_client

logger = get_logger(__name__)

MAX_SLUG_CANDIDATES = 3
MAX_SEARCH_RESULTS = 8

_LEGAL_SUFFIXES = re.compile(
    r"\b(inc|inc\.|llc|ltd|ltd\.|limited|corp|corp\.|corporation|gmbh|bv|ab|oy|as|sa|plc|co)\b",
    re.I,
)
_NON_SLUG = re.compile(r"[^a-z0-9]+")


class BoardNotFoundError(Exception):
    """No ATS board could be resolved for this company."""


def looks_like_url(query: str) -> bool:
    text = query.strip()
    return text.startswith(("http://", "https://")) or bool(
        re.match(r"^[a-z0-9.-]+\.[a-z]{2,}(/|$)", text, re.I)
    )


def slug_candidates(name: str) -> list[str]:
    """Company name → plausible ATS board tokens, most likely first."""
    cleaned = _LEGAL_SUFFIXES.sub(" ", name.strip().casefold())
    compact = _NON_SLUG.sub("", cleaned)
    hyphenated = _NON_SLUG.sub("-", cleaned).strip("-")

    candidates: list[str] = []
    for candidate in (compact, hyphenated):
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    # "Acme Labs" also commonly boards as just "acme"
    first_word = cleaned.split()
    if first_word:
        head = _NON_SLUG.sub("", first_word[0])
        if head and head not in candidates:
            candidates.append(head)

    return candidates[:MAX_SLUG_CANDIDATES]


def board_from_url(url: str) -> tuple[AtsSource, str] | None:
    for source in all_sources():
        token = source.matches_url(url)
        if token:
            return source, token
    return None


async def resolve_board(query: str, *, db=None) -> ResolvedBoard:
    """Resolve a company name or careers URL to a single candidate board."""
    text = query.strip()
    if not text:
        raise BoardNotFoundError("Enter a company name or a careers page URL.")

    if looks_like_url(text):
        resolved = await _resolve_from_url(text)
        if resolved:
            return resolved

    resolved = await _resolve_by_probe(text)
    if resolved:
        return resolved

    resolved = await _resolve_by_search(text, db=db)
    if resolved:
        return resolved

    raise BoardNotFoundError(
        f"Couldn't find a Greenhouse, Lever, or Ashby board for “{text}”. "
        "Paste the careers page URL instead."
    )


async def _resolve_from_url(url: str) -> ResolvedBoard | None:
    match = board_from_url(url)
    if not match:
        return None
    source, token = match
    count = await _open_role_count(source, token)
    if count is None:
        return None
    return ResolvedBoard(
        name=_display_name(token),
        ats_provider=source.provider,  # type: ignore[arg-type]
        ats_token=token,
        board_url=source.board_url(token),
        open_role_count=count,
        resolved_via="url",
    )


async def _resolve_by_probe(name: str) -> ResolvedBoard | None:
    candidates = slug_candidates(name)
    if not candidates:
        return None

    for token in candidates:
        probes = await asyncio.gather(
            *(_safe_probe(source, token) for source in all_sources()),
            return_exceptions=False,
        )
        for source, ok in zip(all_sources(), probes, strict=True):
            if not ok:
                continue
            count = await _open_role_count(source, token)
            if not count:
                # An empty board is usually a wrong-slug collision, not a real match.
                continue
            return ResolvedBoard(
                name=name.strip(),
                ats_provider=source.provider,  # type: ignore[arg-type]
                ats_token=token,
                board_url=source.board_url(token),
                open_role_count=count,
                resolved_via="probe",
            )
    return None


async def _resolve_by_search(name: str, *, db=None) -> ResolvedBoard | None:
    try:
        client = create_search_client()
        results = await client.search(
            f'"{name}" careers greenhouse OR lever OR ashby',
            max_results=MAX_SEARCH_RESULTS,
        )
    except SearchError as exc:
        logger.info("Radar board search fallback failed for %s: %s", name, exc)
        return None

    for result in results:
        match = board_from_url(result.url)
        if not match:
            continue
        source, token = match
        count = await _open_role_count(source, token)
        if not count:
            continue
        return ResolvedBoard(
            name=name.strip(),
            ats_provider=source.provider,  # type: ignore[arg-type]
            ats_token=token,
            board_url=source.board_url(token),
            open_role_count=count,
            resolved_via="search",
        )
    return None


async def _safe_probe(source: AtsSource, token: str) -> bool:
    try:
        return await source.probe(token)
    except Exception:  # probing is best-effort and must never raise
        return False


async def _open_role_count(source: AtsSource, token: str) -> int | None:
    try:
        return len(await source.fetch(token))
    except AtsError:
        return None


def _display_name(token: str) -> str:
    return token.replace("-", " ").replace("_", " ").title()
