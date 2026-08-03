import json

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.logging_config import get_logger
from app.models import Job, Profile
from app.schemas.company_research import CompanyBrief, CompanyBriefContent
from app.schemas.cover_letter import CoverLetterCritique, CoverLetterDraft, CoverLetterResult
from app.schemas.match_analysis import MatchResult
from app.schemas.rag import ScoredChunk
from app.services.cover_letter_normalize import (
    cover_letter_body_limit,
    normalize_cover_letter_draft_payload,
    normalize_cover_letter_result_payload,
)
from app.services.llm import Message, get_llm_client
from app.services.match.formatters import format_job, format_profile
from app.services.memory.context import load_active_memories
from app.services.memory.prompts import build_system_prompt_with_career_memory
from app.services.rag.match_context import format_rag_resume_section, retrieve_for_match
from app.services.rag.retrieval import get_embedding_provider

logger = get_logger(__name__)


def _parse_company_brief(value: object) -> CompanyBriefContent | None:
    if not value:
        return None
    if isinstance(value, CompanyBriefContent):
        return value
    if not isinstance(value, dict):
        return None
    try:
        return CompanyBrief.model_validate(value)
    except ValidationError:
        try:
            return CompanyBriefContent.model_validate(value)
        except ValidationError:
            return None


def format_company_brief_section(company_brief: object) -> str:
    """Format stored company research for cover letter context."""
    brief = _parse_company_brief(company_brief)
    if brief is None:
        return ""

    lines = [
        "Company research brief:",
        "",
        f"Summary: {brief.summary.strip()}",
    ]
    if brief.culture_signals:
        lines.append(f"Culture signals: {', '.join(brief.culture_signals)}")
    if brief.recent_news:
        lines.append(f"Recent news: {', '.join(brief.recent_news)}")
    if brief.interview_signals:
        lines.append(f"Interview signals: {', '.join(brief.interview_signals)}")
    return "\n".join(lines)


def build_cover_letter_user_message(
    profile: Profile,
    job: Job,
    match_result: MatchResult,
    *,
    draft: CoverLetterDraft | None = None,
    critique: CoverLetterCritique | None = None,
    rag_chunks: list[ScoredChunk] | None = None,
) -> str:
    if rag_chunks:
        resume_block = format_rag_resume_section(profile, rag_chunks)
    else:
        resume_block = f"Structured resume:\n\n{format_profile(profile)}"

    parts = [
        resume_block,
        "\n\nTarget job:\n\n",
        format_job(job),
    ]

    company_brief_block = format_company_brief_section(getattr(job, "company_brief", None))
    if company_brief_block:
        parts.extend(["\n\n", company_brief_block])

    parts.extend(
        [
            "\n\nMatch analysis:\n\n",
            json.dumps(match_result.model_dump(), indent=2, ensure_ascii=False),
        ]
    )
    if draft:
        parts.extend(
            [
                "\n\nDraft cover letter:\n\n",
                draft.body,
                "\n\nDraft tone: ",
                draft.tone,
            ]
        )
    if critique:
        parts.extend(
            [
                "\n\nEditor critique:\n\n",
                json.dumps(critique.model_dump(), indent=2, ensure_ascii=False),
            ]
        )

    limit = cover_letter_body_limit()
    parts.extend(
        [
            f"\n\nCharacter budget: body must be at most {limit} characters "
            "(including spaces and punctuation) and must end with a complete sentence.",
        ]
    )
    if draft:
        parts.append(f"\nDraft body length: {len(draft.body)} characters.")
    return "".join(parts)


async def _retrieve_cover_letter_chunks(
    db: AsyncSession | None,
    profile: Profile,
    job: Job,
) -> list[ScoredChunk]:
    if not settings.match_rag_enabled:
        return []
    embedder = get_embedding_provider()
    return await retrieve_for_match(
        db,
        profile,
        job,
        embedder,
        top_k=settings.match_rag_top_k,
    )


async def generate_cover_letter(
    db: AsyncSession,
    profile: Profile,
    job: Job,
    match_result: MatchResult,
) -> CoverLetterResult:
    client = await get_llm_client(db)
    rag_chunks = await _retrieve_cover_letter_chunks(db, profile, job)
    memories: list = []
    profile_id = getattr(profile, "id", None)
    if db is not None and profile_id is not None:
        memories = await load_active_memories(db, profile_id)
    if memories:
        logger.info(
            "Cover letter career memory: profile=%s snippets=%d",
            profile_id,
            len(memories),
        )

    draft_prompt = build_system_prompt_with_career_memory("cover_letter_draft", memories)
    critique_prompt = build_system_prompt_with_career_memory("cover_letter_critique", memories)
    revise_prompt = build_system_prompt_with_career_memory("cover_letter_revise", memories)

    context = build_cover_letter_user_message(
        profile,
        job,
        match_result,
        rag_chunks=rag_chunks or None,
    )

    draft = await client.generate_structured(
        messages=[
            Message(role="system", content=draft_prompt),
            Message(role="user", content=context),
        ],
        response_model=CoverLetterDraft,
        transform_payload=normalize_cover_letter_draft_payload,
        max_tokens=settings.cover_letter_llm_max_tokens,
    )

    critique = await client.generate_structured(
        messages=[
            Message(role="system", content=critique_prompt),
            Message(
                role="user",
                content=build_cover_letter_user_message(
                    profile,
                    job,
                    match_result,
                    draft=draft,
                    rag_chunks=rag_chunks or None,
                ),
            ),
        ],
        response_model=CoverLetterCritique,
        max_tokens=settings.cover_letter_llm_max_tokens,
    )

    final = await client.generate_structured(
        messages=[
            Message(role="system", content=revise_prompt),
            Message(
                role="user",
                content=build_cover_letter_user_message(
                    profile,
                    job,
                    match_result,
                    draft=draft,
                    critique=critique,
                    rag_chunks=rag_chunks or None,
                ),
            ),
        ],
        response_model=CoverLetterResult,
        transform_payload=normalize_cover_letter_result_payload,
        max_tokens=settings.cover_letter_llm_max_tokens,
    )
    return final
