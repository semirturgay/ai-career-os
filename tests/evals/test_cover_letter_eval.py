from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.schemas.cover_letter import CoverLetterCritique, CoverLetterDraft, CoverLetterResult
from app.schemas.match_analysis import MatchResult
from app.services.cover_letter_generator import (
    generate_cover_letter,
)
from app.services.cover_letter_normalize import (
    normalize_cover_letter_draft_payload,
    normalize_cover_letter_result_payload,
)
from tests.evals.cover_letter_eval_assertions import evaluate_cover_letter
from tests.evals.eval_assertions import load_json

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "cover_letter"


def _iter_cover_letter_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        required = (
            "expected.json",
            "llm_response.json",
            "match_result.json",
            "profile.json",
            "job.json",
        )
        if all((case_dir / name).exists() for name in required):
            cases.append((case_dir.name, case_dir))
    return cases


@pytest.mark.parametrize("case_name,case_dir", _iter_cover_letter_cases())
def test_golden_cover_letter_meets_expectations(case_name: str, case_dir: Path):
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    normalized = normalize_cover_letter_result_payload(llm_response)
    result = CoverLetterResult.model_validate(normalized)

    failures = evaluate_cover_letter(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_cover_letter_cases())
@pytest.mark.asyncio
async def test_generate_cover_letter_pipeline_with_mocked_llm(case_name: str, case_dir: Path):
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    match_data = load_json(case_dir / "match_result.json")
    draft_response = load_json(case_dir / "llm_response_draft.json")
    critique_response = load_json(case_dir / "llm_response_critique.json")
    final_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    profile = SimpleNamespace(
        structured_data=profile_data,
        resume_text="Jane Doe resume text",
        headline=profile_data.get("headline"),
    )
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
        company_brief=load_json(case_dir / "company_brief.json")
        if (case_dir / "company_brief.json").exists()
        else None,
    )
    match_result = MatchResult.model_validate(match_data)

    draft = CoverLetterDraft.model_validate(normalize_cover_letter_draft_payload(draft_response))
    critique = CoverLetterCritique.model_validate(critique_response)
    final = CoverLetterResult.model_validate(normalize_cover_letter_result_payload(final_response))

    mock_client = AsyncMock()
    mock_client.generate_structured = AsyncMock(side_effect=[draft, critique, final])

    with (
        patch(
            "app.services.cover_letter_generator.get_llm_client",
            new=AsyncMock(return_value=mock_client),
        ),
        patch(
            "app.services.cover_letter_generator._retrieve_cover_letter_chunks",
            new=AsyncMock(return_value=[]),
        ),
    ):
        result = await generate_cover_letter(
            db=None,
            profile=profile,
            job=job,
            match_result=match_result,
        )

    assert mock_client.generate_structured.await_count == 3
    call_models = [
        call.kwargs["response_model"] for call in mock_client.generate_structured.await_args_list
    ]
    assert call_models == [CoverLetterDraft, CoverLetterCritique, CoverLetterResult]

    user_message = mock_client.generate_structured.await_args_list[0].kwargs["messages"][-1].content
    assert job_data["company"] in user_message
    assert profile_data["name"] in user_message
    if job.company_brief:
        assert "Company research brief" in user_message
        assert "payment APIs" in user_message

    failures = evaluate_cover_letter(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.asyncio
async def test_generate_cover_letter_injects_career_memory_fixture():
    case_dir = FIXTURES_DIR / "with_career_memory"
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    match_data = load_json(case_dir / "match_result.json")
    draft_response = load_json(case_dir / "llm_response_draft.json")
    critique_response = load_json(case_dir / "llm_response_critique.json")
    final_response = load_json(case_dir / "llm_response.json")
    memory_rows = load_json(case_dir / "career_memories.json")

    profile_id = uuid4()
    profile = SimpleNamespace(
        id=profile_id,
        structured_data=profile_data,
        resume_text="Jane Doe resume text",
        headline=profile_data.get("headline"),
    )
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
        company_brief=load_json(case_dir / "company_brief.json")
        if (case_dir / "company_brief.json").exists()
        else None,
    )
    match_result = MatchResult.model_validate(match_data)
    memories = [SimpleNamespace(content=row["content"]) for row in memory_rows]

    draft = CoverLetterDraft.model_validate(normalize_cover_letter_draft_payload(draft_response))
    critique = CoverLetterCritique.model_validate(critique_response)
    final = CoverLetterResult.model_validate(normalize_cover_letter_result_payload(final_response))

    mock_client = AsyncMock()
    mock_client.generate_structured = AsyncMock(side_effect=[draft, critique, final])

    mock_db = AsyncMock()
    result_mock = Mock()
    result_mock.scalars.return_value.all.return_value = memories
    mock_db.execute = AsyncMock(return_value=result_mock)

    with (
        patch(
            "app.services.cover_letter_generator.get_llm_client",
            new=AsyncMock(return_value=mock_client),
        ),
        patch(
            "app.services.cover_letter_generator._retrieve_cover_letter_chunks",
            new=AsyncMock(return_value=[]),
        ),
    ):
        await generate_cover_letter(
            db=mock_db,
            profile=profile,
            job=job,
            match_result=match_result,
        )

    for call in mock_client.generate_structured.await_args_list:
        system_message = call.kwargs["messages"][0].content
        assert "Career memory (user corrections and preferences)" in system_message
        assert "AWS ECS at Globex Inc" in system_message
