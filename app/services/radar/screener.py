"""Two-tier posting triage.

Tier 0 is a free structural filter. Tier 1 is a deliberately small LLM call —
capped per poll and run sequentially, because comparative batch matching was built
and removed once already for timing out (docs/milestones/m3-batch-matching.md).

Tier 2 (the full RAG-backed MatchAnalysis) only ever runs on promotion.
"""

from __future__ import annotations

import re

from app.config import settings
from app.logging_config import get_logger
from app.models import Posting, Profile
from app.prompts.loader import load_prompt
from app.schemas.radar import PostingScreenResult, WatchCriteria
from app.services.llm.base import LLMError, Message
from app.services.radar.sources.base import RawPosting

logger = get_logger(__name__)

SCREEN_DESCRIPTION_CHARS = 1_500
SCREEN_PROFILE_CHARS = 1_200
SCREEN_MAX_TOKENS = 256

# An unreachable provider fails the same way for every posting, and each attempt pays
# the full connect timeout. Give up on the batch rather than burn minutes proving it.
MAX_CONSECUTIVE_FAILURES = 2

_REMOTE_PATTERN = re.compile(r"\bremote\b|\bwork from home\b|\banywhere\b", re.I)
_ONSITE_PATTERN = re.compile(r"\bon-?site\b|\bin-?office\b", re.I)
_HYBRID_PATTERN = re.compile(r"\bhybrid\b", re.I)


def matches_criteria(posting: RawPosting, criteria: WatchCriteria) -> bool:
    """Tier 0 — free structural filter. No LLM, no network."""
    title = posting.title.casefold()

    for term in criteria.exclude:
        if term.casefold() in title:
            return False

    if criteria.titles and not any(term.casefold() in title for term in criteria.titles):
        return False

    if criteria.locations:
        haystack = f"{posting.location or ''} {posting.title}".casefold()
        remote_ok = posting.remote_flag and criteria.remote in {"any", "remote"}
        if not remote_ok and not any(term.casefold() in haystack for term in criteria.locations):
            return False

    if criteria.remote != "any":
        blob = f"{posting.title} {posting.location or ''}"
        if criteria.remote == "remote":
            if not posting.remote_flag and not _REMOTE_PATTERN.search(blob):
                return False
        elif criteria.remote == "onsite":
            if posting.remote_flag or _REMOTE_PATTERN.search(blob):
                return False
        elif criteria.remote == "hybrid":
            if not _HYBRID_PATTERN.search(blob) and not _ONSITE_PATTERN.search(blob):
                return False

    return True


def build_screen_user_message(profile: Profile, posting: Posting) -> str:
    summary = (profile.resume_text or "").strip()[:SCREEN_PROFILE_CHARS]
    description = (posting.description or "").strip()[:SCREEN_DESCRIPTION_CHARS]
    location = posting.location or "Not stated"

    return (
        f"CANDIDATE PROFILE\n"
        f"Name: {profile.name}\n"
        f"Headline: {profile.headline or 'Not stated'}\n"
        f"Resume excerpt:\n{summary}\n\n"
        f"JOB POSTING\n"
        f"Title: {posting.title}\n"
        f"Location: {location}{' (remote)' if posting.remote_flag else ''}\n"
        f"Description excerpt:\n{description}"
    )


async def screen_posting(llm, profile: Profile, posting: Posting) -> PostingScreenResult:
    return await llm.generate_structured(
        [
            Message(role="system", content=load_prompt("posting_screen")),
            Message(role="user", content=build_screen_user_message(profile, posting)),
        ],
        response_model=PostingScreenResult,
        max_tokens=SCREEN_MAX_TOKENS,
    )


async def screen_postings(
    llm,
    profile: Profile,
    postings: list[Posting],
    *,
    limit: int | None = None,
) -> int:
    """Screen up to ``limit`` postings in place. Returns how many were scored.

    Sequential and capped on purpose. A single posting failing to score is never
    fatal — it stays `new` and gets picked up on the next poll.
    """
    cap = limit if limit is not None else settings.radar_screen_limit_per_poll
    batch = postings[:cap]
    if len(postings) > len(batch):
        logger.info(
            "Radar screening capped: %s of %s postings scored this poll",
            len(batch),
            len(postings),
        )

    scored = 0
    consecutive_failures = 0

    for posting in batch:
        try:
            result = await screen_posting(llm, profile, posting)
        except (LLMError, ValueError) as exc:
            consecutive_failures += 1
            logger.info("Screening failed for posting %s: %s", posting.id, exc)
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                logger.warning(
                    "Abandoning screening after %s consecutive failures — "
                    "%s posting(s) left unscored for the next poll",
                    consecutive_failures,
                    len(batch) - scored - consecutive_failures,
                )
                break
            continue

        consecutive_failures = 0
        posting.screen_score = result.fit_score
        posting.screen_reason = result.reason
        posting.state = "screened"
        scored += 1

    return scored
