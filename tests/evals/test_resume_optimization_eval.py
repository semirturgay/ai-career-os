from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.schemas.match_analysis import MatchResult
from app.schemas.resume_optimization import ResumeOptimizationResult
from app.services.resume_optimization_normalize import normalize_resume_optimization_payload
from app.services.resume_optimizer import optimize_resume_for_match
from tests.evals.eval_assertions import load_json
from tests.evals.resume_optimization_eval_assertions import evaluate_resume_optimization

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "resume_optimization"


def _iter_resume_optimization_cases() -> list[tuple[str, Path]]:
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


@pytest.mark.parametrize("case_name,case_dir", _iter_resume_optimization_cases())
def test_golden_resume_optimization_meets_expectations(case_name: str, case_dir: Path):
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    normalized = normalize_resume_optimization_payload(llm_response)
    result = ResumeOptimizationResult.model_validate(normalized)

    failures = evaluate_resume_optimization(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_resume_optimization_cases())
@pytest.mark.asyncio
async def test_optimize_resume_pipeline_with_mocked_llm(case_name: str, case_dir: Path):
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    match_data = load_json(case_dir / "match_result.json")
    llm_response = load_json(case_dir / "llm_response.json")
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
    )
    match_result = MatchResult.model_validate(match_data)

    golden = ResumeOptimizationResult.model_validate(
        normalize_resume_optimization_payload(llm_response)
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    with patch(
        "app.services.resume_optimizer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        result = await optimize_resume_for_match(
            db=None,
            profile=profile,
            job=job,
            match_result=match_result,
        )

    mock_client.generate_structured.assert_awaited_once()
    call_kwargs = mock_client.generate_structured.await_args.kwargs
    assert call_kwargs["response_model"] is ResumeOptimizationResult
    user_message = call_kwargs["messages"][-1].content
    assert "AWS" in user_message
    assert profile_data["name"] in user_message

    failures = evaluate_resume_optimization(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.asyncio
async def test_optimize_resume_injects_career_memory_fixture():
    case_dir = FIXTURES_DIR / "with_career_memory"
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    match_data = load_json(case_dir / "match_result.json")
    llm_response = load_json(case_dir / "llm_response.json")
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
    )
    match_result = MatchResult.model_validate(match_data)
    memories = [SimpleNamespace(content=row["content"]) for row in memory_rows]

    golden = ResumeOptimizationResult.model_validate(
        normalize_resume_optimization_payload(llm_response)
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    mock_db = AsyncMock()
    result_mock = Mock()
    result_mock.scalars.return_value.all.return_value = memories
    mock_db.execute = AsyncMock(return_value=result_mock)

    with patch(
        "app.services.resume_optimizer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        await optimize_resume_for_match(
            db=mock_db,
            profile=profile,
            job=job,
            match_result=match_result,
        )

    system_message = mock_client.generate_structured.await_args.kwargs["messages"][0].content
    assert "Career memory (user corrections and preferences)" in system_message
    assert "AWS ECS at Globex Inc" in system_message
