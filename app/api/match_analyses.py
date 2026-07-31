from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_match_analysis_or_404
from app.db.session import get_db
from app.logging_config import get_logger
from app.models import Job, MatchAnalysis, Profile
from app.schemas import (
    CoverLetterResult,
    MatchAnalysisCreate,
    MatchAnalysisRead,
    ResumeOptimizationResult,
)
from app.schemas.enums import MatchDepth
from app.services.application_progress import STEP_COVER_LETTER, STEP_RESUME, mark_application_step
from app.services.cover_letter_generator import generate_cover_letter
from app.services.job_artifacts import (
    ARTIFACT_COVER_LETTER,
    ARTIFACT_RESUME_OPTIMIZATION,
    save_job_artifact,
)
from app.services.match import (
    match_result_for_cover_letter,
    match_result_from_analysis_payload,
    run_match_analysis,
)
from app.services.resume_optimizer import optimize_resume_for_match

logger = get_logger(__name__)

router = APIRouter(tags=["match-analyses"])


@router.post(
    "/match-analyses",
    response_model=MatchAnalysisRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_match_analysis(
    body: MatchAnalysisCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    profile = await db.get(Profile, body.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    job = await db.get(Job, body.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    analysis = MatchAnalysis(
        profile_id=body.profile_id,
        job_id=body.job_id,
        status="pending",
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    background_tasks.add_task(run_match_analysis, analysis.id)
    logger.info("Queued match analysis %s for profile=%s job=%s", analysis.id, profile.id, job.id)
    return analysis


@router.get("/match-analyses", response_model=list[MatchAnalysisRead])
async def list_match_analyses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MatchAnalysis).order_by(MatchAnalysis.created_at.desc()))
    return result.scalars().all()


@router.get("/match-analyses/{analysis_id}", response_model=MatchAnalysisRead)
async def get_match_analysis(analysis: MatchAnalysis = Depends(get_match_analysis_or_404)):
    return analysis


@router.post(
    "/match-analyses/{analysis_id}/resume-optimization",
    response_model=ResumeOptimizationResult,
)
async def create_resume_optimization(
    analysis: MatchAnalysis = Depends(get_match_analysis_or_404),
    db: AsyncSession = Depends(get_db),
):
    if analysis.status != "completed" or not analysis.result:
        raise HTTPException(
            status_code=400,
            detail="Match analysis must be completed before generating resume suggestions",
        )
    if analysis.result.get("depth") == MatchDepth.SCREEN:
        raise HTTPException(
            status_code=400,
            detail="Full match analysis required for resume optimization",
        )

    profile = await db.get(Profile, analysis.profile_id)
    job = await db.get(Job, analysis.job_id)
    if not profile or not job:
        raise HTTPException(status_code=404, detail="Profile or job not found")

    try:
        match_result = match_result_from_analysis_payload(analysis.result)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid match analysis result") from exc

    if not match_result.gaps:
        raise HTTPException(status_code=400, detail="No gaps to optimize against")

    result = await optimize_resume_for_match(db, profile, job, match_result)
    job.raw_metadata = mark_application_step(job.raw_metadata, STEP_RESUME)
    job.raw_metadata = save_job_artifact(
        job.raw_metadata,
        ARTIFACT_RESUME_OPTIMIZATION,
        analysis_id=str(analysis.id),
        result=result.model_dump(),
    )
    await db.commit()
    return result


@router.post(
    "/match-analyses/{analysis_id}/cover-letter",
    response_model=CoverLetterResult,
)
async def create_cover_letter(
    analysis: MatchAnalysis = Depends(get_match_analysis_or_404),
    db: AsyncSession = Depends(get_db),
):
    if analysis.status != "completed" or not analysis.result:
        raise HTTPException(
            status_code=400,
            detail="Match analysis must be completed before generating a cover letter",
        )

    profile = await db.get(Profile, analysis.profile_id)
    job = await db.get(Job, analysis.job_id)
    if not profile or not job:
        raise HTTPException(status_code=404, detail="Profile or job not found")

    try:
        match_result = match_result_for_cover_letter(analysis.result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = await generate_cover_letter(db, profile, job, match_result)
    job.raw_metadata = mark_application_step(job.raw_metadata, STEP_COVER_LETTER)
    job.raw_metadata = save_job_artifact(
        job.raw_metadata,
        ARTIFACT_COVER_LETTER,
        analysis_id=str(analysis.id),
        result=result.model_dump(),
    )
    await db.commit()
    return result
