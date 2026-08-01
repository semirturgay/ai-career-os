import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.logging_config import get_logger
from app.models import Job, Profile
from app.schemas.match_analysis import MatchResult
from app.schemas.rag import ScoredChunk
from app.services.llm import Message, get_llm_client
from app.services.match.formatters import build_match_user_message
from app.services.match.prompts import build_match_system_prompt_from_memories
from app.services.match_analysis_normalize import normalize_match_payload
from app.services.memory.context import load_active_memories
from app.services.rag.job_queries import job_retrieval_queries
from app.services.rag.match_context import retrieve_for_match
from app.services.rag.retrieval import get_embedding_provider

logger = get_logger(__name__)


async def analyze_match(
    db: AsyncSession | None,
    profile: Profile,
    job: Job,
) -> tuple[MatchResult, list[ScoredChunk]]:
    rag_chunks: list[ScoredChunk] = []
    rag_ms = 0.0
    if settings.match_rag_enabled:
        rag_started = time.perf_counter()
        rag_chunks = await retrieve_for_match(
            db,
            profile,
            job,
            get_embedding_provider(),
            top_k=settings.match_rag_top_k,
        )
        rag_ms = (time.perf_counter() - rag_started) * 1000
        logger.info(
            "Match RAG retrieval: profile=%s chunks=%d queries=%d latency_ms=%.0f",
            getattr(profile, "id", "unknown"),
            len(rag_chunks),
            len(job_retrieval_queries(job)),
            rag_ms,
        )

    user_message = await build_match_user_message(
        db,
        profile,
        job,
        scored=rag_chunks,
    )

    if db is not None:
        memories = await load_active_memories(db, profile.id)
    else:
        memories = []
    system_prompt = build_match_system_prompt_from_memories(memories)
    if memories:
        logger.info(
            "Match career memory: profile=%s snippets=%d",
            profile.id,
            len(memories),
        )

    client = await get_llm_client(db)
    result = await client.generate_structured(
        messages=[
            Message(role="system", content=system_prompt),
            Message(role="user", content=user_message),
        ],
        response_model=MatchResult,
        transform_payload=normalize_match_payload,
        max_tokens=settings.match_llm_max_tokens,
    )
    return result, rag_chunks
