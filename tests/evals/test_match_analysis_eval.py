from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.schemas.match_analysis import MatchResult
from app.services.match import analyze_match, build_match_user_message
from app.services.match_analysis_normalize import normalize_match_payload
from tests.evals.eval_assertions import load_json
from tests.evals.match_eval_assertions import evaluate_match_result

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "match"


def _iter_match_eval_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        if not (case_dir / "expected.json").exists():
            continue
        if not (case_dir / "llm_response.json").exists():
            continue
        if not (case_dir / "job.json").exists():
            continue
        if not (case_dir / "profile.json").exists():
            continue
        cases.append((case_dir.name, case_dir))
    return cases


@pytest.mark.parametrize("case_name,case_dir", _iter_match_eval_cases())
def test_golden_match_response_meets_expectations(case_name: str, case_dir: Path):
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    normalized = normalize_match_payload(llm_response)
    result = MatchResult.model_validate(normalized)

    failures = evaluate_match_result(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_match_eval_cases())
@pytest.mark.asyncio
async def test_analyze_match_pipeline_with_mocked_llm(case_name: str, case_dir: Path):
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    profile = SimpleNamespace(
        structured_data=profile_data,
        resume_text="Jane Doe\nSenior Backend Engineer",
    )
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
    )

    golden = MatchResult.model_validate(normalize_match_payload(llm_response))
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    with patch(
        "app.services.match.analyzer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        result, _rag_chunks = await analyze_match(db=None, profile=profile, job=job)

    mock_client.generate_structured.assert_awaited_once()
    call_kwargs = mock_client.generate_structured.await_args.kwargs
    assert call_kwargs["response_model"] is MatchResult
    user_message = call_kwargs["messages"][-1].content
    assert job.title in user_message
    assert "Retrieved resume evidence" in user_message
    assert profile_data["name"] in user_message

    failures = evaluate_match_result(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.asyncio
async def test_build_match_user_message_uses_structured_profile():
    profile = SimpleNamespace(
        structured_data={"name": "Jane Doe", "skills": ["Python"]},
        resume_text="Plain resume text",
    )
    job = SimpleNamespace(
        title="Backend Engineer",
        company="Acme",
        description="Build APIs",
        location="Remote",
        raw_metadata={},
    )

    message = await build_match_user_message(None, profile, job)
    assert "Jane Doe" in message
    assert "Backend Engineer" in message
    assert "Retrieved resume evidence" in message
    assert "Plain resume text" not in message


@pytest.mark.asyncio
async def test_build_match_user_message_falls_back_to_resume_text():
    profile = SimpleNamespace(structured_data=None, resume_text="Plain resume text")
    job = SimpleNamespace(
        title="Backend Engineer",
        company="Acme",
        description="Build APIs",
        location=None,
        raw_metadata={},
    )

    message = await build_match_user_message(None, profile, job)
    assert "Plain resume text" in message


@pytest.mark.asyncio
async def test_analyze_match_injects_career_memory_fixture():
    case_dir = FIXTURES_DIR / "with_career_memory"
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    llm_response = load_json(case_dir / "llm_response.json")
    memory_rows = load_json(case_dir / "career_memories.json")

    profile_id = uuid4()
    profile = SimpleNamespace(
        id=profile_id,
        structured_data=profile_data,
        resume_text="Jane Doe\nSenior Backend Engineer",
    )
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
    )
    memories = [SimpleNamespace(content=row["content"]) for row in memory_rows]

    golden = MatchResult.model_validate(normalize_match_payload(llm_response))
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    mock_db = AsyncMock()
    result_mock = Mock()
    result_mock.scalars.return_value.all.return_value = memories
    mock_db.execute = AsyncMock(return_value=result_mock)

    with (
        patch(
            "app.services.match.analyzer.get_llm_client",
            new=AsyncMock(return_value=mock_client),
        ),
        patch("app.services.match.analyzer.retrieve_for_match", new=AsyncMock(return_value=[])),
    ):
        await analyze_match(db=mock_db, profile=profile, job=job)

    system_message = mock_client.generate_structured.await_args.kwargs["messages"][0].content
    assert "Career memory (user corrections and preferences)" in system_message
    assert "AWS ECS at Globex Inc" in system_message


@pytest.mark.live_llm
@pytest.mark.asyncio
async def test_live_llm_match_senior_python_backend():
    """Optional live eval — run with: RUN_LIVE_LLM=1 uv run pytest -m live_llm"""
    import os

    if os.getenv("RUN_LIVE_LLM") != "1":
        pytest.skip("Set RUN_LIVE_LLM=1 to run live LLM match evals")

    pytest.importorskip("asyncpg")
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings

    case_dir = FIXTURES_DIR / "senior_python_backend"
    profile_data = load_json(case_dir / "profile.json")
    job_data = load_json(case_dir / "job.json")
    expected = load_json(case_dir / "expected.json")

    profile = SimpleNamespace(
        structured_data=profile_data,
        resume_text=json.dumps(profile_data),
    )
    job = SimpleNamespace(
        title=job_data["title"],
        company=job_data["company"],
        description=job_data["description"],
        location=job_data.get("location"),
        raw_metadata=job_data.get("raw_metadata", {}),
    )

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with session_factory() as db:
            result, _rag_chunks = await analyze_match(db, profile, job)
    finally:
        await engine.dispose()

    failures = evaluate_match_result(result, expected, case_name="live:senior_python_backend")
    assert not failures, "\n".join(failures)
