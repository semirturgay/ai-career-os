from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.schemas.match_analysis import MatchGap, MatchResult
from app.schemas.resume_optimization import ResumeOptimizationResult, ResumeSuggestion
from app.services.match import match_result_from_analysis_payload
from app.services.resume_optimizer import (
    build_resume_optimization_user_message,
    optimize_resume_for_match,
)
from app.services.resume_suggestion_apply import apply_suggestions


def test_match_result_from_analysis_payload_ignores_extras():
    result = match_result_from_analysis_payload(
        {
            "depth": "full",
            "score": 80.0,
            "recommendation": "apply",
            "strengths": [],
            "gaps": [{"point": 5.0, "severity": "low", "evidence": "No AWS."}],
            "summary": "Good fit.",
        }
    )
    assert result.score == 80.0
    assert len(result.gaps) == 1


def test_build_resume_optimization_user_message_includes_gaps():
    profile = SimpleNamespace(
        structured_data={"name": "Jane"},
        resume_text="Jane Doe resume",
    )
    job = SimpleNamespace(
        title="Backend Engineer",
        company="Acme",
        description="Python and AWS",
        location=None,
    )
    match_result = MatchResult(
        score=75.0,
        recommendation="maybe apply",
        strengths=[],
        gaps=[MatchGap(point=6.0, severity="medium", evidence="No AWS listed.")],
        summary="Decent match.",
    )

    message = build_resume_optimization_user_message(profile, job, match_result)

    assert "No AWS listed." in message
    assert "Python and AWS" in message
    assert "Jane Doe resume" in message


@pytest.mark.asyncio
async def test_optimize_resume_for_match_calls_llm():
    optimization = ResumeOptimizationResult(
        summary="Reframe cloud bullets.",
        suggestions=[
            ResumeSuggestion(
                gap_evidence="No AWS listed.",
                section="experience",
                action="rewrite",
                target_label="Acme — Engineer, bullet 1",
                current_text="Built APIs with Python.",
                suggested_text="Built APIs with Python on AWS.",
                rationale="Highlights existing cloud work.",
            )
        ],
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = optimization

    profile = SimpleNamespace(structured_data={"name": "Jane"}, resume_text="Jane")
    job = SimpleNamespace(
        title="Backend Engineer",
        company="Acme",
        description="AWS required",
        location=None,
    )
    match_result = MatchResult(
        score=70.0,
        recommendation="maybe apply",
        strengths=[],
        gaps=[MatchGap(point=6.0, severity="medium", evidence="No AWS listed.")],
        summary="Decent match.",
    )

    with patch(
        "app.services.resume_optimizer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        output = await optimize_resume_for_match(
            db=None, profile=profile, job=job, match_result=match_result
        )

    assert output.summary == "Reframe cloud bullets."
    assert len(output.suggestions) == 1


@pytest.mark.asyncio
async def test_optimize_resume_injects_career_memory_in_system_prompt():
    optimization = ResumeOptimizationResult(
        summary="Reframe cloud bullets.",
        suggestions=[
            ResumeSuggestion(
                gap_evidence="No AWS listed.",
                section="experience",
                action="rewrite",
                target_label="Acme — Engineer, bullet 1",
                current_text="Built APIs with Python.",
                suggested_text="Built APIs with Python on AWS.",
                rationale="Highlights existing cloud work.",
            )
        ],
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = optimization

    profile_id = uuid4()
    profile = SimpleNamespace(id=profile_id, structured_data={"name": "Jane"}, resume_text="Jane")
    job = SimpleNamespace(
        title="Backend Engineer",
        company="Acme",
        description="AWS required",
        location=None,
    )
    match_result = MatchResult(
        score=70.0,
        recommendation="maybe apply",
        strengths=[],
        gaps=[MatchGap(point=6.0, severity="medium", evidence="No AWS listed.")],
        summary="Decent match.",
    )
    memory = SimpleNamespace(
        content='User disputes this gap: "Missing AWS". Their note: Globex project',
    )

    mock_db = AsyncMock()
    result_mock = Mock()
    result_mock.scalars.return_value.all.return_value = [memory]
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
    assert "Globex project" in system_message


def test_apply_suggestions_rewrites_experience_highlight():
    structured = {
        "name": "Jane",
        "skills": ["Python"],
        "experience": [
            {
                "title": "Engineer",
                "company": "Acme",
                "highlights": ["Built APIs with Python."],
            }
        ],
        "education": [],
        "projects": [],
    }
    suggestions = [
        ResumeSuggestion(
            gap_evidence="No AWS.",
            section="experience",
            action="rewrite",
            target_label="Acme — Engineer, bullet 1",
            current_text="Built APIs with Python.",
            suggested_text="Built APIs with Python on AWS.",
            rationale="Reframe.",
        )
    ]

    resume_text, updated_structured, headline = apply_suggestions(
        "Built APIs with Python.",
        structured,
        "Backend Engineer",
        suggestions,
    )

    assert "AWS" in resume_text
    assert updated_structured is not None
    assert updated_structured["experience"][0]["highlights"][0] == "Built APIs with Python on AWS."


def test_apply_suggestions_adds_skill():
    structured = {
        "name": "Jane",
        "skills": ["Python"],
        "experience": [],
        "education": [],
        "projects": [],
    }
    suggestions = [
        ResumeSuggestion(
            gap_evidence="Missing Docker.",
            section="skills",
            action="add",
            target_label="Skills list",
            suggested_text="Docker",
            rationale="Adjacent tooling.",
        )
    ]

    _, updated_structured, _ = apply_suggestions("Resume", structured, None, suggestions)

    assert updated_structured is not None
    assert "Docker" in updated_structured["skills"]
