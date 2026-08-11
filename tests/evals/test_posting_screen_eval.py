from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.models import Posting, Profile
from app.schemas.radar import PostingScreenResult
from app.services.radar.screener import screen_posting
from tests.evals.eval_assertions import load_json
from tests.evals.posting_screen_eval_assertions import evaluate_posting_screen

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "posting_screen"


def _iter_posting_screen_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        required = ("expected.json", "llm_response.json", "posting.json", "profile.json")
        if all((case_dir / name).exists() for name in required):
            cases.append((case_dir.name, case_dir))
    return cases


def _build_profile(data: dict) -> Profile:
    return Profile(
        id=uuid.uuid4(),
        name=data["name"],
        headline=data.get("headline"),
        resume_text=data["resume_text"],
    )


def _build_posting(data: dict) -> Posting:
    return Posting(
        id=uuid.uuid4(),
        watched_company_id=uuid.uuid4(),
        profile_id=uuid.uuid4(),
        external_id="1",
        title=data["title"],
        location=data.get("location"),
        remote_flag=data.get("remote_flag", False),
        description=data["description"],
        state="new",
    )


@pytest.mark.parametrize("case_name,case_dir", _iter_posting_screen_cases())
def test_golden_posting_screen_meets_expectations(case_name: str, case_dir: Path):
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    result = PostingScreenResult.model_validate(llm_response)

    failures = evaluate_posting_screen(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_posting_screen_cases())
@pytest.mark.asyncio
async def test_posting_screen_pipeline_with_mocked_llm(case_name: str, case_dir: Path):
    profile_data = load_json(case_dir / "profile.json")
    posting_data = load_json(case_dir / "posting.json")
    expected = load_json(case_dir / "expected.json")
    golden = PostingScreenResult.model_validate(load_json(case_dir / "llm_response.json"))

    profile = _build_profile(profile_data)
    posting = _build_posting(posting_data)

    llm = AsyncMock()
    llm.generate_structured.return_value = golden

    result = await screen_posting(llm, profile, posting)

    llm.generate_structured.assert_awaited_once()
    call = llm.generate_structured.await_args
    assert call.kwargs["response_model"] is PostingScreenResult

    messages = call.args[0]
    system_message, user_message = messages[0].content, messages[1].content

    # The screen must stay a triage pass — it never gets the full match prompt.
    assert "fast triage pass" in system_message
    assert profile_data["name"] in user_message
    assert posting_data["title"] in user_message

    failures = evaluate_posting_screen(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


def test_screen_prompt_caps_token_cost():
    """Tier 1 runs on every new posting, so the prompt must stay small."""
    from app.services.radar.screener import (
        SCREEN_DESCRIPTION_CHARS,
        SCREEN_MAX_TOKENS,
        SCREEN_PROFILE_CHARS,
        build_screen_user_message,
    )

    profile = _build_profile(
        {"name": "Jane Doe", "headline": "Engineer", "resume_text": "x" * 50_000}
    )
    posting = _build_posting({"title": "Engineer", "description": "y" * 50_000})

    message = build_screen_user_message(profile, posting)

    assert len(message) < SCREEN_DESCRIPTION_CHARS + SCREEN_PROFILE_CHARS + 500
    assert SCREEN_MAX_TOKENS <= 512
