from uuid import UUID

from app.db.session import async_session
from app.logging_config import get_logger
from app.models import Job, MatchAnalysis, Profile
from app.services.application_progress import record_match_remeasurement
from app.services.llm.base import LLMConfigurationError, LLMError
from app.services.match.analyzer import analyze_match
from app.services.match.result import full_result_payload

logger = get_logger(__name__)


async def run_match_analysis(analysis_id: UUID) -> None:
    """Run full explainable match analysis."""
    async with async_session() as db:
        analysis = await db.get(MatchAnalysis, analysis_id)
        if not analysis:
            return

        profile = await db.get(Profile, analysis.profile_id)
        job = await db.get(Job, analysis.job_id)
        if not profile or not job:
            if analysis.status == "pending":
                analysis.status = "failed"
                analysis.error = "Profile or job not found"
                await db.commit()
            return

        try:
            result, rag_chunks = await analyze_match(db, profile, job)
            analysis.status = "completed"
            analysis.result = full_result_payload(result, rag_chunks=rag_chunks)
            analysis.error = None
            job.raw_metadata = record_match_remeasurement(
                job.raw_metadata,
                analysis_id=str(analysis_id),
                score=result.score,
                gap_count=len(result.gaps),
            )
            logger.info(
                "Match analysis completed: id=%s score=%.1f recommendation=%s",
                analysis_id,
                result.score,
                result.recommendation,
            )
        except (LLMConfigurationError, LLMError) as exc:
            analysis.status = "failed"
            analysis.error = str(exc)
            logger.warning("Match analysis failed for %s: %s", analysis_id, exc)
        except Exception as exc:
            analysis.status = "failed"
            analysis.error = str(exc)
            logger.exception("Unexpected match analysis failure for %s", analysis_id)

        await db.commit()
