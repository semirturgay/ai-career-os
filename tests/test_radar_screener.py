"""Tier-0 criteria filtering and Tier-1 LLM screening."""

import uuid
from unittest.mock import AsyncMock

import pytest

from app.models import Posting, Profile
from app.schemas.radar import PostingScreenResult, WatchCriteria
from app.services.llm.base import LLMError
from app.services.radar.screener import (
    build_screen_user_message,
    matches_criteria,
    screen_postings,
)
from app.services.radar.sources.base import RawPosting


def raw(title, *, location=None, remote=False):
    return RawPosting(
        external_id="1",
        title=title,
        description="A description",
        location=location,
        remote_flag=remote,
    )


def posting(title="Senior Backend Engineer", description="Build payment systems in Python."):
    return Posting(
        id=uuid.uuid4(),
        watched_company_id=uuid.uuid4(),
        profile_id=uuid.uuid4(),
        external_id="1",
        title=title,
        description=description,
        remote_flag=False,
        state="new",
    )


def profile():
    return Profile(
        id=uuid.uuid4(),
        name="Ada Lovelace",
        headline="Backend Engineer",
        resume_text="Ten years of Python and PostgreSQL.",
    )


# --- Tier 0 -------------------------------------------------------------------


def test_empty_criteria_matches_everything():
    assert matches_criteria(raw("Anything At All"), WatchCriteria()) is True


def test_title_keyword_must_match_when_given():
    criteria = WatchCriteria(titles=["engineer"])
    assert matches_criteria(raw("Backend Engineer"), criteria) is True
    assert matches_criteria(raw("Product Designer"), criteria) is False


def test_exclude_wins_over_title_match():
    criteria = WatchCriteria(titles=["engineer"], exclude=["intern"])
    assert matches_criteria(raw("Engineering Intern"), criteria) is False


def test_location_matches_against_title_and_location():
    criteria = WatchCriteria(locations=["berlin"])
    assert matches_criteria(raw("Engineer", location="Berlin, Germany"), criteria) is True
    assert matches_criteria(raw("Engineer", location="Lisbon"), criteria) is False


def test_remote_posting_satisfies_location_filter():
    """A remote role is location-agnostic, so a city filter shouldn't drop it."""
    criteria = WatchCriteria(locations=["berlin"], remote="any")
    assert matches_criteria(raw("Engineer", location="Remote", remote=True), criteria) is True


def test_remote_preference_filters_onsite_roles():
    criteria = WatchCriteria(remote="remote")
    assert matches_criteria(raw("Engineer", location="Remote - EU", remote=True), criteria) is True
    assert matches_criteria(raw("Engineer", location="Berlin"), criteria) is False


def test_onsite_preference_rejects_remote_roles():
    criteria = WatchCriteria(remote="onsite")
    assert matches_criteria(raw("Engineer", location="Berlin"), criteria) is True
    assert matches_criteria(raw("Engineer", location="Remote", remote=True), criteria) is False


def test_blank_criteria_entries_are_dropped():
    criteria = WatchCriteria(titles=["  ", "engineer", ""])
    assert criteria.titles == ["engineer"]


# --- prompt -------------------------------------------------------------------


def test_screen_message_carries_profile_and_posting():
    message = build_screen_user_message(profile(), posting())

    assert "Ada Lovelace" in message
    assert "Senior Backend Engineer" in message
    assert "Build payment systems in Python." in message


def test_screen_message_truncates_long_description():
    long_posting = posting(description="x" * 10_000)
    message = build_screen_user_message(profile(), long_posting)

    assert len(message) < 4_000


# --- Tier 1 -------------------------------------------------------------------


async def test_screen_postings_scores_and_marks_state():
    llm = AsyncMock()
    llm.generate_structured.return_value = PostingScreenResult(
        fit_score=82,
        reason="Ten years of Python matches the core requirement.",
    )
    items = [posting(), posting()]

    scored = await screen_postings(llm, profile(), items)

    assert scored == 2
    assert all(item.screen_score == 82 for item in items)
    assert all(item.state == "screened" for item in items)


async def test_screen_postings_respects_cap():
    llm = AsyncMock()
    llm.generate_structured.return_value = PostingScreenResult(fit_score=50, reason="Maybe.")
    items = [posting() for _ in range(10)]

    scored = await screen_postings(llm, profile(), items, limit=3)

    assert scored == 3
    assert llm.generate_structured.await_count == 3
    # Uncapped postings stay `new` so the next poll can pick them up.
    assert [item.state for item in items[3:]] == ["new"] * 7


async def test_one_failed_screen_does_not_stop_the_batch():
    llm = AsyncMock()
    llm.generate_structured.side_effect = [
        LLMError("provider hiccup"),
        PostingScreenResult(fit_score=71, reason="Strong overlap on infrastructure."),
    ]
    items = [posting(), posting()]

    scored = await screen_postings(llm, profile(), items)

    assert scored == 1
    assert items[0].state == "new"
    assert items[0].screen_score is None
    assert items[1].state == "screened"
    assert items[1].screen_score == 71


@pytest.mark.parametrize("bad_score", [-1, 101])
def test_screen_result_rejects_out_of_range_scores(bad_score):
    with pytest.raises(ValueError):
        PostingScreenResult(fit_score=bad_score, reason="nope")
