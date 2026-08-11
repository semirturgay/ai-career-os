"""Discipline triage — the filter that stops a sales board eating the screen budget."""

import uuid
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.models import Profile
from app.schemas.radar import PostingTriageResult
from app.services.llm.base import LLMConfigurationError, LLMError
from app.services.radar.sources.base import RawPosting
from app.services.radar.triage import (
    DEFAULT_TARGET,
    TRIAGE_ATTEMPTS,
    TRIAGE_BATCH_SIZE,
    build_triage_user_message,
    resolve_target,
    triage_postings,
)

# Real titles from the Ashby board, including the ones keyword matching gets wrong.
BOARD = [
    "Staff Platform Engineer - Americas",
    "Sales Engineer",
    "Senior Backend Developer",
    "Mid Market Account Executive - EMEA",
    "Site Reliability Engineer",
    "Senior Product Designer",
    "Software Architect",
    "Customer Success Engineer",
]
ENGINEERING = [1, 3, 5, 7]  # 1-based, the four genuine engineering roles


def posting(title: str, *, location: str | None = None, remote: bool = False) -> RawPosting:
    return RawPosting(
        external_id=title.lower().replace(" ", "-"),
        title=title,
        description="A description",
        location=location,
        remote_flag=remote,
    )


def board() -> list[RawPosting]:
    return [posting(title) for title in BOARD]


def profile(*, target: str | None = None, headline: str | None = "Backend Engineer") -> Profile:
    return Profile(
        id=uuid.uuid4(),
        name="Ada Lovelace",
        headline=headline,
        resume_text="Python and PostgreSQL.",
        radar_target=target,
    )


# --- target resolution --------------------------------------------------------


def test_explicit_target_wins():
    assert resolve_target(profile(target="Staff platform roles, remote")) == (
        "Staff platform roles, remote"
    )


def test_falls_back_to_headline():
    assert resolve_target(profile(target=None, headline="Backend Engineer")) == "Backend Engineer"


def test_falls_back_again_when_nothing_is_set():
    assert resolve_target(profile(target="   ", headline=None)) == DEFAULT_TARGET


# --- prompt -------------------------------------------------------------------


def test_user_message_numbers_roles_and_carries_location():
    message = build_triage_user_message(
        "Backend roles",
        [posting("Platform Engineer", location="Berlin"), posting("Designer", remote=True)],
    )

    assert "Backend roles" in message
    assert "1. Platform Engineer — Berlin" in message
    assert "2. Designer (remote)" in message


def test_user_message_sends_titles_not_descriptions():
    """Triage must stay cheap — descriptions are for the screen, not this pass."""
    item = RawPosting(
        external_id="1",
        title="Platform Engineer",
        description="SECRET_DESCRIPTION_BODY " * 200,
    )

    assert "SECRET_DESCRIPTION_BODY" not in build_triage_user_message("Backend", [item])


# --- filtering ----------------------------------------------------------------


async def test_keeps_only_the_indices_the_model_returns():
    llm = AsyncMock()
    llm.generate_structured.return_value = PostingTriageResult(relevant_indices=ENGINEERING)

    kept = await triage_postings(llm, profile(), board())

    assert [item.title for item in kept] == [
        "Staff Platform Engineer - Americas",
        "Senior Backend Developer",
        "Site Reliability Engineer",
        "Software Architect",
    ]
    # The trap titles — keyword matching on "engineer" would have kept all three.
    assert "Sales Engineer" not in [item.title for item in kept]
    assert "Customer Success Engineer" not in [item.title for item in kept]


async def test_out_of_range_and_duplicate_indices_are_ignored():
    llm = AsyncMock()
    llm.generate_structured.return_value = PostingTriageResult(
        relevant_indices=[1, 1, 0, -3, 99, 3]
    )

    kept = await triage_postings(llm, profile(), board())

    assert [item.title for item in kept] == [
        "Staff Platform Engineer - Americas",
        "Senior Backend Developer",
    ]


async def test_empty_result_drops_everything():
    llm = AsyncMock()
    llm.generate_structured.return_value = PostingTriageResult(relevant_indices=[])

    assert await triage_postings(llm, profile(), board()) == []


async def test_no_postings_makes_no_call():
    llm = AsyncMock()
    assert await triage_postings(llm, profile(), []) == []
    llm.generate_structured.assert_not_awaited()


# --- batching -----------------------------------------------------------------


async def test_large_board_is_batched():
    items = [posting(f"Engineer {n}") for n in range(TRIAGE_BATCH_SIZE * 2 + 5)]
    llm = AsyncMock()
    llm.generate_structured.return_value = PostingTriageResult(relevant_indices=[1])

    kept = await triage_postings(llm, profile(), items)

    assert llm.generate_structured.await_count == 3
    assert len(kept) == 3  # one kept per batch


# --- fail open ----------------------------------------------------------------


async def test_provider_failure_keeps_everything():
    """A dead provider must never hide a real job — this filter fails open."""
    llm = AsyncMock()
    llm.generate_structured.side_effect = LLMError("Could not connect")

    kept = await triage_postings(llm, profile(), board())

    assert len(kept) == len(BOARD)
    assert llm.generate_structured.await_count == TRIAGE_ATTEMPTS


async def test_a_flaky_batch_is_retried_before_giving_up():
    """The same prompt returned a bare {} once and valid indices the next call."""
    llm = AsyncMock()
    llm.generate_structured.side_effect = [
        ValueError("bare {} from the model"),
        PostingTriageResult(relevant_indices=ENGINEERING),
    ]

    kept = await triage_postings(llm, profile(), board())

    assert llm.generate_structured.await_count == 2
    assert len(kept) == 4  # the retry succeeded, so we filtered rather than failed open


async def test_one_bad_batch_does_not_lose_the_others():
    items = [posting(f"Engineer {n}") for n in range(TRIAGE_BATCH_SIZE + 3)]
    llm = AsyncMock()
    llm.generate_structured.side_effect = [
        LLMError("blip"),
        LLMError("blip again"),
        PostingTriageResult(relevant_indices=[1]),
    ]

    kept = await triage_postings(llm, profile(), items)

    # First batch exhausts its retry and passes through whole; second filters normally.
    assert len(kept) == TRIAGE_BATCH_SIZE + 1


@pytest.mark.parametrize("error", [LLMError("down"), ValueError("bad json")])
async def test_all_provider_error_shapes_fail_open(error):
    llm = AsyncMock()
    llm.generate_structured.side_effect = error

    assert len(await triage_postings(llm, profile(), board())) == len(BOARD)


def test_missing_indices_is_a_validation_error_not_an_empty_result():
    """A payload without the field must raise, not quietly mean "nothing fits".

    Caught live: the schema name goes over the wire lowercased, a stub answered the
    wrong shape, and a defaulted list turned that into all 59 postings dropped.
    """
    with pytest.raises(ValidationError):
        PostingTriageResult.model_validate({"error": "no stub for this schema"})

    with pytest.raises(ValidationError):
        PostingTriageResult.model_validate({})

    # An explicit empty list is still a legitimate "nothing on this board fits".
    assert PostingTriageResult.model_validate({"relevant_indices": []}).relevant_indices == []


async def test_malformed_payload_fails_open_end_to_end():
    llm = AsyncMock()
    llm.generate_structured.side_effect = ValidationError.from_exception_data(
        "PostingTriageResult", []
    )

    assert len(await triage_postings(llm, profile(), board())) == len(BOARD)


async def test_unconfigured_llm_keeps_everything_via_poller():
    """The poller's wrapper must fail open too, not just the batch loop."""
    from unittest.mock import patch

    from app.services.radar.poller import _triage

    items = board()
    with patch(
        "app.services.radar.poller.get_llm_client",
        AsyncMock(side_effect=LLMConfigurationError("no provider configured")),
    ):
        kept = await _triage(AsyncMock(), profile(), items)

    assert kept == items
