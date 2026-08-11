"""Discipline triage — decide which of a board's roles are even worth looking at.

A board is mostly roles for other people: the Ashby board carries account executives,
designers, and technical writers alongside its engineering roles. Screening every one
of them would spend the Tier-1 budget before reaching anything relevant.

Keyword matching cannot do this job. `engineer` admits "Sales Engineer" and misses
"Backend Developer", so the decision is semantic and goes to the LLM — but only on
titles, batched, and only for postings we have never seen before.

**This filter fails open.** If the provider is unreachable, every posting passes. A
job the user actually wanted must never disappear because an LLM call timed out.
"""

from __future__ import annotations

from app.logging_config import get_logger
from app.models import Profile
from app.prompts.loader import load_prompt
from app.schemas.radar import PostingTriageResult
from app.services.llm.base import LLMError, Message
from app.services.radar.sources.base import RawPosting

logger = get_logger(__name__)

TRIAGE_BATCH_SIZE = 60
MAX_TRIAGE_BATCHES = 10
TRIAGE_MAX_TOKENS = 512
TRIAGE_ATTEMPTS = 2

DEFAULT_TARGET = "roles matching the candidate's background and seniority"


def resolve_target(profile: Profile) -> str:
    """What the user wants surfaced, most explicit source first."""
    for candidate in (profile.radar_target, profile.headline):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return DEFAULT_TARGET


def build_triage_user_message(target: str, batch: list[RawPosting]) -> str:
    lines = []
    for index, posting in enumerate(batch, start=1):
        location = f" — {posting.location}" if posting.location else ""
        remote = " (remote)" if posting.remote_flag else ""
        lines.append(f"{index}. {posting.title}{location}{remote}")

    return f"CANDIDATE IS LOOKING FOR\n{target}\n\nOPEN ROLES\n" + "\n".join(lines)


def _batches(postings: list[RawPosting]) -> list[list[RawPosting]]:
    return [
        postings[start : start + TRIAGE_BATCH_SIZE]
        for start in range(0, len(postings), TRIAGE_BATCH_SIZE)
    ]


async def _triage_batch(llm, target: str, batch: list[RawPosting]) -> list[RawPosting]:
    result = await llm.generate_structured(
        [
            Message(role="system", content=load_prompt("posting_triage")),
            Message(role="user", content=build_triage_user_message(target, batch)),
        ],
        response_model=PostingTriageResult,
        max_tokens=TRIAGE_MAX_TOKENS,
    )

    kept: list[RawPosting] = []
    seen: set[int] = set()
    for raw_index in result.relevant_indices:
        index = raw_index - 1
        if index < 0 or index >= len(batch) or index in seen:
            continue
        seen.add(index)
        kept.append(batch[index])
    return kept


async def _triage_batch_with_retry(llm, target: str, batch: list[RawPosting]) -> list[RawPosting]:
    """One retry, then fail open.

    Smaller local models answer this schema intermittently — the same prompt returned
    a bare `{}` once and valid indices the next call. Failing open is safe, but the
    postings it lets through are then stored and never re-triaged, so one cheap retry
    is worth it before accepting the noise.
    """
    last_error: Exception | None = None
    for attempt in range(1, TRIAGE_ATTEMPTS + 1):
        try:
            return await _triage_batch(llm, target, batch)
        except (LLMError, ValueError) as exc:
            last_error = exc
            if attempt < TRIAGE_ATTEMPTS:
                logger.info("Triage attempt %s failed, retrying: %s", attempt, exc)

    logger.warning(
        "Triage failed for a batch of %s after %s attempts — passing them through: %s",
        len(batch),
        TRIAGE_ATTEMPTS,
        last_error,
    )
    return batch


async def triage_postings(
    llm,
    profile: Profile,
    postings: list[RawPosting],
) -> list[RawPosting]:
    """Return only the postings worth screening. Fails open on any provider error."""
    if not postings:
        return []

    target = resolve_target(profile)
    batches = _batches(postings)

    if len(batches) > MAX_TRIAGE_BATCHES:
        overflow = batches[MAX_TRIAGE_BATCHES:]
        batches = batches[:MAX_TRIAGE_BATCHES]
        passed_through = [posting for batch in overflow for posting in batch]
        logger.info(
            "Triage cap reached: %s posting(s) passed through untriaged",
            len(passed_through),
        )
    else:
        passed_through = []

    kept: list[RawPosting] = []
    for batch in batches:
        kept.extend(await _triage_batch_with_retry(llm, target, batch))

    kept.extend(passed_through)

    logger.info(
        "Triage kept %s of %s posting(s) for target %r",
        len(kept),
        len(postings),
        target[:60],
    )
    return kept
