"""Screening must degrade gracefully when the LLM provider is unreachable.

Found in end-to-end testing: with LM Studio down, every screen call paid a 75s
connect timeout, so a 20-posting cap turned one poll into a 25-minute hang.
"""

import uuid
from unittest.mock import AsyncMock

from app.models import Posting, Profile
from app.schemas.radar import PostingScreenResult
from app.services.llm.base import LLMError
from app.services.radar.screener import MAX_CONSECUTIVE_FAILURES, screen_postings


def posting() -> Posting:
    return Posting(
        id=uuid.uuid4(),
        watched_company_id=uuid.uuid4(),
        profile_id=uuid.uuid4(),
        external_id=str(uuid.uuid4()),
        title="Senior Backend Engineer",
        description="Build payment systems.",
        remote_flag=False,
        state="new",
    )


def profile() -> Profile:
    return Profile(
        id=uuid.uuid4(),
        name="Ada Lovelace",
        headline="Backend Engineer",
        resume_text="Python and PostgreSQL.",
    )


async def test_unreachable_provider_aborts_the_batch_early():
    llm = AsyncMock()
    llm.generate_structured.side_effect = LLMError(
        "Could not connect to http://127.0.0.1:1234/v1. Is the server running?"
    )
    items = [posting() for _ in range(20)]

    scored = await screen_postings(llm, profile(), items)

    assert scored == 0
    # Crucially, it stops early rather than paying the timeout twenty times over.
    assert llm.generate_structured.await_count == MAX_CONSECUTIVE_FAILURES
    assert all(item.state == "new" for item in items)


async def test_intermittent_failures_do_not_abort_the_batch():
    """One bad response between good ones must not look like an outage."""
    ok = PostingScreenResult(fit_score=70, reason="Solid overlap on Python services.")
    llm = AsyncMock()
    llm.generate_structured.side_effect = [ok, LLMError("blip"), ok, LLMError("blip"), ok]
    items = [posting() for _ in range(5)]

    scored = await screen_postings(llm, profile(), items)

    assert scored == 3
    assert llm.generate_structured.await_count == 5


async def test_failure_counter_resets_after_a_success():
    ok = PostingScreenResult(fit_score=65, reason="Adjacent domain, transferable skills.")
    llm = AsyncMock()
    llm.generate_structured.side_effect = [LLMError("blip"), ok, LLMError("blip"), ok]
    items = [posting() for _ in range(4)]

    scored = await screen_postings(llm, profile(), items)

    assert scored == 2
    assert llm.generate_structured.await_count == 4
