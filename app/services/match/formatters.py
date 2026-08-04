import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Job, Profile
from app.schemas.rag import ScoredChunk
from app.services.rag.match_context import format_rag_resume_section, retrieve_for_match
from app.services.rag.retrieval import EmbeddingProvider, get_embedding_provider


def format_profile(profile: Profile) -> str:
    if profile.structured_data:
        return json.dumps(profile.structured_data, indent=2, ensure_ascii=False)
    return profile.resume_text.strip()


def candidate_location(profile: Profile) -> str | None:
    data = profile.structured_data
    if not isinstance(data, dict):
        return None
    location = data.get("location")
    if isinstance(location, str) and location.strip():
        return location.strip()
    return None


def format_job(job: Job) -> str:
    metadata = getattr(job, "raw_metadata", None) or {}
    work_mode = metadata.get("work_mode")
    parts = [
        f"Title: {job.title}",
        f"Company: {job.company}",
    ]
    if job.location:
        parts.append(f"Location: {job.location}")
    if isinstance(work_mode, str) and work_mode.strip():
        parts.append(f"Work arrangement: {work_mode.strip()}")
    parts.extend(["", "Description:", job.description.strip()])
    return "\n".join(parts)


def format_job_for_match(job: Job) -> str:
    """Compact job block for match prompts — requirements only when available."""
    if not settings.match_compact_job_prompt:
        return format_job(job)

    metadata = getattr(job, "raw_metadata", None) or {}
    requirements = metadata.get("requirements")
    work_mode = metadata.get("work_mode")
    parts = [
        f"Title: {job.title}",
        f"Company: {job.company}",
    ]
    if job.location:
        parts.append(f"Location: {job.location}")
    if isinstance(work_mode, str) and work_mode.strip():
        parts.append(f"Work arrangement: {work_mode.strip()}")

    if isinstance(requirements, list):
        cleaned = [str(item).strip() for item in requirements if str(item).strip()]
        if cleaned:
            parts.extend(["", "Requirements:"])
            parts.extend(f"- {item}" for item in cleaned)
            summary = metadata.get("match_summary")
            if isinstance(summary, str) and summary.strip():
                parts.extend(["", f"Role summary: {summary.strip()}"])
            return "\n".join(parts)

    return format_job(job)


async def build_match_user_message(
    db: AsyncSession | None,
    profile: Profile,
    job: Job,
    *,
    use_rag: bool | None = None,
    embedder: EmbeddingProvider | None = None,
    top_k: int | None = None,
    scored: list[ScoredChunk] | None = None,
) -> str:
    job_block = format_job_for_match(job)
    rag_enabled = settings.match_rag_enabled if use_rag is None else use_rag
    limit = settings.match_rag_top_k if top_k is None else top_k

    if rag_enabled:
        provider = embedder or get_embedding_provider()
        retrieved = scored
        if retrieved is None:
            retrieved = await retrieve_for_match(db, profile, job, provider, top_k=limit)
        if retrieved:
            resume_block = format_rag_resume_section(profile, retrieved)
        else:
            resume_block = f"Structured resume:\n\n{format_profile(profile)}"
    else:
        resume_block = f"Structured resume:\n\n{format_profile(profile)}"

    location = candidate_location(profile)
    if location:
        resume_block = f"Candidate location: {location}\n\n{resume_block}"

    return f"{resume_block}\n\nJob description:\n\n{job_block}"
