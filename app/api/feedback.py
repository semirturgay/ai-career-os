from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_job_or_404, get_profile_or_404
from app.db.session import get_db
from app.logging_config import get_logger
from app.models import FeedbackEvent, Job, MatchAnalysis, Profile
from app.schemas.feedback import FeedbackEventCreate, FeedbackEventRead
from app.services.memory.context import sync_career_memory_from_feedback

logger = get_logger(__name__)

router = APIRouter(tags=["feedback"])


async def _validate_feedback_references(
    body: FeedbackEventCreate,
    db: AsyncSession,
) -> None:
    profile = await db.get(Profile, body.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.job_id:
        job = await db.get(Job, body.job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

    if body.match_analysis_id:
        analysis = await db.get(MatchAnalysis, body.match_analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Match analysis not found")
        if analysis.profile_id != body.profile_id:
            raise HTTPException(
                status_code=400,
                detail="match_analysis_id does not belong to profile_id",
            )
        if body.job_id and analysis.job_id != body.job_id:
            raise HTTPException(
                status_code=400,
                detail="match_analysis_id does not belong to job_id",
            )


@router.post("/feedback", response_model=FeedbackEventRead, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    body: FeedbackEventCreate,
    db: AsyncSession = Depends(get_db),
):
    await _validate_feedback_references(body, db)

    event = FeedbackEvent(
        profile_id=body.profile_id,
        job_id=body.job_id,
        match_analysis_id=body.match_analysis_id,
        event_type=body.event_type.value,
        payload=body.payload,
    )
    db.add(event)
    await db.flush()
    await sync_career_memory_from_feedback(db, event)
    await db.commit()
    await db.refresh(event)
    logger.info(
        "Recorded feedback %s type=%s profile=%s job=%s",
        event.id,
        event.event_type,
        event.profile_id,
        event.job_id,
    )
    return event


@router.get("/feedback", response_model=list[FeedbackEventRead])
async def list_feedback_for_profile(
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeedbackEvent)
        .where(FeedbackEvent.profile_id == profile.id)
        .order_by(FeedbackEvent.created_at.desc())
    )
    return result.scalars().all()


@router.get("/jobs/{job_id}/feedback", response_model=list[FeedbackEventRead])
async def list_feedback_for_job(
    job: Job = Depends(get_job_or_404),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeedbackEvent)
        .where(FeedbackEvent.job_id == job.id)
        .order_by(FeedbackEvent.created_at.desc())
    )
    return result.scalars().all()
