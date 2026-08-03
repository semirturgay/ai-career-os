from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from app.schemas.cover_letter import CoverLetterCritique, CoverLetterDraft, CoverLetterResult
from app.schemas.match_analysis import MatchGap, MatchResult, MatchStrength
from app.schemas.rag import ResumeChunk, ScoredChunk
from app.services.cover_letter_generator import (
    build_cover_letter_user_message,
    format_company_brief_section,
    generate_cover_letter,
)


@pytest.mark.asyncio
async def test_generate_cover_letter_runs_draft_critique_revise_chain():
    profile = SimpleNamespace(structured_data={"name": "Jane"}, resume_text="Jane")
    job = SimpleNamespace(
        title="Engineer",
        company="Acme",
        description="Python backend",
        location=None,
        raw_metadata={},
        company_brief=None,
    )
    match_result = MatchResult(
        score=85.0,
        recommendation="apply",
        strengths=[MatchStrength(point=9.0, evidence="Python experience.")],
        gaps=[MatchGap(point=4.0, severity="low", evidence="No AWS listed.")],
        summary="Strong match.",
    )

    draft = CoverLetterDraft(
        body="Dear Acme,\n\nI am excited to apply.",
        tone="professional",
        highlights_used=["Python experience"],
    )
    critique = CoverLetterCritique(
        unsupported_claims=[],
        missing_strengths=["FastAPI migration"],
        tone_issues=[],
        revision_notes="Mention FastAPI migration.",
    )
    final = CoverLetterResult(
        body="Dear Acme,\n\nI am excited to apply with FastAPI experience.",
        tone="professional",
        highlights_used=["Python experience", "FastAPI migration"],
        critique_summary="Added missing FastAPI strength.",
    )

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
    assert "FastAPI" in result.body
    assert result.critique_summary == "Added missing FastAPI strength."


@pytest.mark.asyncio
async def test_generate_cover_letter_injects_career_memory_in_system_prompts():
    profile_id = uuid4()
    profile = SimpleNamespace(id=profile_id, structured_data={"name": "Jane"}, resume_text="Jane")
    job = SimpleNamespace(
        title="Engineer",
        company="Acme",
        description="Python backend",
        location=None,
        raw_metadata={},
        company_brief=None,
    )
    match_result = MatchResult(
        score=85.0,
        recommendation="apply",
        strengths=[MatchStrength(point=9.0, evidence="Python experience.")],
        gaps=[MatchGap(point=4.0, severity="low", evidence="No AWS listed.")],
        summary="Strong match.",
    )

    draft = CoverLetterDraft(
        body="Dear Acme,\n\nI am excited to apply.",
        tone="professional",
        highlights_used=["Python experience"],
    )
    critique = CoverLetterCritique(
        unsupported_claims=[],
        missing_strengths=[],
        tone_issues=[],
        revision_notes="Looks good.",
    )
    final = CoverLetterResult(
        body="Dear Acme,\n\nI am excited to apply.",
        tone="professional",
        highlights_used=["Python experience"],
        critique_summary="No changes.",
    )

    mock_client = AsyncMock()
    mock_client.generate_structured = AsyncMock(side_effect=[draft, critique, final])
    memory = SimpleNamespace(
        content='User disputes this gap: "Missing AWS". Their note: Globex project',
    )

    mock_db = AsyncMock()
    result_mock = Mock()
    result_mock.scalars.return_value.all.return_value = [memory]
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
        assert "Globex project" in system_message


def test_build_cover_letter_user_message_includes_company_brief_and_rag_chunks():
    profile = SimpleNamespace(
        structured_data={"name": "Jane Doe", "skills": ["Python"]},
        resume_text="Jane Doe resume",
    )
    job = SimpleNamespace(
        title="Backend Engineer",
        company="FinTech Labs",
        description="Build payment APIs",
        location="Remote",
        company_brief={
            "company": "FinTech Labs",
            "summary": "FinTech Labs builds payment APIs.",
            "culture_signals": ["Remote-first"],
            "recent_news": [],
            "interview_signals": [],
            "red_flags": [],
        },
    )
    match_result = MatchResult(
        score=80.0,
        recommendation="apply",
        strengths=[MatchStrength(point=8.0, evidence="Python backend experience.")],
        gaps=[],
        summary="Good fit.",
    )
    rag_chunks = [
        ScoredChunk(
            chunk=ResumeChunk(id="skill-0", text="Python", section="skill"),
            score=0.95,
        )
    ]

    message = build_cover_letter_user_message(
        profile,
        job,
        match_result,
        rag_chunks=rag_chunks,
    )

    assert "Retrieved resume evidence" in message
    assert "[id: skill-0] Python" in message
    assert "Company research brief" in message
    assert "payment APIs" in message
    assert "Character budget" in message
    assert "400 characters" in message
    assert "FinTech Labs" in message


def test_format_company_brief_section_returns_empty_for_missing_brief():
    assert format_company_brief_section(None) == ""
    assert format_company_brief_section({}) == ""
