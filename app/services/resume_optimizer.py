from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models import Job, Profile
from app.schemas.match_analysis import MatchResult
from app.schemas.resume_optimization import ResumeOptimizationResult
from app.services.llm import Message, get_llm_client
from app.services.match.formatters import format_job, format_profile
from app.services.memory.context import load_active_memories
from app.services.memory.prompts import build_system_prompt_with_career_memory
from app.services.resume_optimization_normalize import normalize_resume_optimization_payload

logger = get_logger(__name__)


def build_resume_optimization_user_message(
    profile: Profile,
    job: Job,
    match_result: MatchResult,
) -> str:
    gaps_block = "\n".join(f"- [{g.severity}] {g.evidence}" for g in match_result.gaps)
    return (
        "Structured resume:\n\n"
        f"{format_profile(profile)}\n\n"
        "Raw resume text:\n\n"
        f"{profile.resume_text.strip()}\n\n"
        "Target job:\n\n"
        f"{format_job(job)}\n\n"
        "Match analysis summary:\n\n"
        f"{match_result.summary}\n\n"
        "Gaps to address:\n\n"
        f"{gaps_block}"
    )


async def optimize_resume_for_match(
    db: AsyncSession,
    profile: Profile,
    job: Job,
    match_result: MatchResult,
) -> ResumeOptimizationResult:
    if not match_result.gaps:
        raise ValueError("Match analysis has no gaps to optimize against")

    memories: list = []
    profile_id = getattr(profile, "id", None)
    if db is not None and profile_id is not None:
        memories = await load_active_memories(db, profile_id)
    system_prompt = build_system_prompt_with_career_memory("resume_optimization", memories)
    if memories:
        logger.info(
            "Resume optimization career memory: profile=%s snippets=%d",
            profile_id,
            len(memories),
        )

    client = await get_llm_client(db)
    return await client.generate_structured(
        messages=[
            Message(role="system", content=system_prompt),
            Message(
                role="user",
                content=build_resume_optimization_user_message(profile, job, match_result),
            ),
        ],
        response_model=ResumeOptimizationResult,
        transform_payload=normalize_resume_optimization_payload,
    )
