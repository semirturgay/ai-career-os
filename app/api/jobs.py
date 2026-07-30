import asyncio
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_job_or_404
from app.db.session import get_db
from app.logging_config import get_logger
from app.models import Job, MatchAnalysis, Profile
from app.schemas import (
    CompanyBrief,
    JobByUrlRead,
    JobCreate,
    JobCreateRead,
    JobIntakeHandoffCreate,
    JobIntakeHandoffRead,
    JobParseRead,
    JobParseRequest,
    JobRead,
    JobUpdate,
)
from app.services.company_research import company_brief_to_storage, research_company
from app.services.job_intake_handoff import create_handoff, get_handoff
from app.services.job_paste_parser import prepare_job_post_text
from app.services.job_structurer import structure_job
from app.services.job_url import normalize_job_url
from app.services.match import run_match_analysis
from app.services.screening_card import attach_screening_card_to_metadata

logger = get_logger(__name__)

router = APIRouter(tags=["jobs"])


async def _find_job_by_url(db: AsyncSession, url: str) -> Job | None:
    normalized = normalize_job_url(url)
    if not normalized:
        return None
    result = await db.execute(select(Job).where(Job.url == normalized).limit(1))
    return result.scalar_one_or_none()


@router.post("/jobs", response_model=JobCreateRead, status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    profile_id = body.profile_id
    payload = body.model_dump(exclude={"profile_id"})
    if payload.get("url"):
        payload["url"] = normalize_job_url(payload["url"])
        existing = await _find_job_by_url(db, payload["url"])
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "A job with this URL is already in your pipeline",
                    "job_id": str(existing.id),
                    "title": existing.title,
                    "company": existing.company,
                },
            )

    job = Job(**payload)
    db.add(job)
    await db.flush()
    job.raw_metadata = attach_screening_card_to_metadata(job.raw_metadata, job)

    match_analysis_id: UUID | None = None
    if profile_id:
        profile = await db.get(Profile, profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        analysis = MatchAnalysis(
            profile_id=profile_id,
            job_id=job.id,
            status="pending",
        )
        db.add(analysis)
        await db.flush()
        match_analysis_id = analysis.id

    await db.commit()
    await db.refresh(job)

    if match_analysis_id:
        background_tasks.add_task(run_match_analysis, match_analysis_id)
        logger.info(
            "Queued match analysis %s for new job %s profile=%s",
            match_analysis_id,
            job.id,
            profile_id,
        )

    return JobCreateRead(
        **JobRead.model_validate(job).model_dump(),
        match_analysis_id=match_analysis_id,
    )


@router.get("/jobs", response_model=list[JobRead])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    return result.scalars().all()


@router.post("/jobs/parse-text", response_model=JobParseRead)
async def parse_job_text(body: JobParseRequest, db: AsyncSession = Depends(get_db)):
    logger.info("Parsing pasted job posting (%d chars)", len(body.text))
    job_text = await asyncio.to_thread(prepare_job_post_text, body.text)

    logger.info("Structuring job posting (%d chars after normalize)", len(job_text))
    extraction = await structure_job(db, job_text)

    logger.info(
        "Structured job posting — title=%r, company=%r, requirements=%d",
        extraction.title,
        extraction.company,
        len(extraction.requirements),
    )
    return JobParseRead(job_text=job_text, structured_data=extraction)


@router.get("/jobs/by-url", response_model=JobByUrlRead)
async def get_job_by_url(
    url: str = Query(min_length=1, max_length=2048),
    db: AsyncSession = Depends(get_db),
):
    job = await _find_job_by_url(db, url)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found for this URL")
    return JobByUrlRead(job=JobRead.model_validate(job))


@router.post(
    "/jobs/intake-handoff",
    response_model=JobIntakeHandoffRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_job_intake_handoff(body: JobIntakeHandoffCreate):
    handoff = create_handoff(
        job_text=body.job_text,
        structured_data=body.structured_data,
        url=body.url,
        source=body.source,
    )
    return JobIntakeHandoffRead(
        id=handoff.id,
        job_text=handoff.job_text,
        structured_data=handoff.structured_data,
        url=handoff.url,
        source=handoff.source,
    )


@router.get("/jobs/intake-handoff/{handoff_id}", response_model=JobIntakeHandoffRead)
async def read_job_intake_handoff(handoff_id: UUID):
    handoff = get_handoff(handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Intake handoff not found or expired")
    return JobIntakeHandoffRead(
        id=handoff.id,
        job_text=handoff.job_text,
        structured_data=handoff.structured_data,
        url=handoff.url,
        source=handoff.source,
    )


@router.get("/jobs/{job_id}", response_model=JobRead)
async def get_job(job: Job = Depends(get_job_or_404)):
    return job


@router.patch("/jobs/{job_id}", response_model=JobRead)
async def update_job(
    body: JobUpdate,
    job: Job = Depends(get_job_or_404),
    db: AsyncSession = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)

    job.raw_metadata = attach_screening_card_to_metadata(job.raw_metadata, job)
    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job: Job = Depends(get_job_or_404),
    db: AsyncSession = Depends(get_db),
):
    await db.delete(job)
    await db.commit()


@router.post("/jobs/{job_id}/company-research", response_model=CompanyBrief)
async def create_company_research(
    job: Job = Depends(get_job_or_404),
    db: AsyncSession = Depends(get_db),
):
    brief = await research_company(db, job)
    job.company_brief = company_brief_to_storage(brief)
    await db.commit()
    await db.refresh(job)
    logger.info("Company research completed: job=%s company=%r", job.id, job.company)
    return brief
