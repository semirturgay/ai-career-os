import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_profile_or_404
from app.db.session import get_db
from app.logging_config import get_logger
from app.models import Job, MatchAnalysis, Profile
from app.schemas import (
    ApplyResumeSuggestionsRequest,
    ProfileCreate,
    ProfileRead,
    ProfileUpdate,
    ResumeParseRead,
    ResumeParseRequest,
)
from app.services.application_progress import mark_resume_applied
from app.services.rag.indexing import index_profile_chunks
from app.services.rag.retrieval import get_embedding_provider
from app.services.resume_parser import extract_text_from_pdf
from app.services.resume_paste_parser import prepare_resume_text
from app.services.resume_pdf_export import (
    build_profile_resume_pdf,
    content_disposition_attachment,
    resume_pdf_filename,
)
from app.services.resume_structurer import structure_resume
from app.services.resume_suggestion_apply import apply_suggestions

logger = get_logger(__name__)

router = APIRouter(tags=["profiles"])


@router.post("/profiles", response_model=ProfileRead, status_code=status.HTTP_201_CREATED)
async def create_profile(body: ProfileCreate, db: AsyncSession = Depends(get_db)):
    profile = Profile(**body.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    await index_profile_chunks(db, profile, get_embedding_provider())
    await db.commit()
    return profile


@router.get("/profiles", response_model=list[ProfileRead])
async def list_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).order_by(Profile.created_at.desc()))
    return result.scalars().all()


@router.post("/profiles/parse-resume", response_model=ResumeParseRead)
async def parse_resume(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    filename = file.filename or "upload.pdf"
    content_type = file.content_type or "unknown"
    logger.info("Parsing resume upload: %s (%s)", filename, content_type)

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File must be under 10 MB")

    logger.info("Extracting text from %s (%.1f KB)", filename, len(content) / 1024)
    resume_text = await asyncio.to_thread(extract_text_from_pdf, content)

    logger.info("Structuring resume from %s (%d chars)", filename, len(resume_text))
    extraction = await structure_resume(db, resume_text)

    logger.info(
        "Structured %s — name=%r, skills=%d, experience=%d",
        filename,
        extraction.name,
        len(extraction.skills),
        len(extraction.experience),
    )
    return ResumeParseRead(
        name=extraction.name,
        headline=extraction.headline,
        resume_text=resume_text,
        structured_data=extraction,
    )


@router.post("/profiles/parse-text", response_model=ResumeParseRead)
async def parse_resume_text(body: ResumeParseRequest, db: AsyncSession = Depends(get_db)):
    logger.info("Parsing pasted resume (%d chars)", len(body.text))
    resume_text = await asyncio.to_thread(prepare_resume_text, body.text)

    logger.info("Structuring pasted resume (%d chars after normalize)", len(resume_text))
    extraction = await structure_resume(db, resume_text)

    logger.info(
        "Structured pasted resume — name=%r, skills=%d, experience=%d",
        extraction.name,
        len(extraction.skills),
        len(extraction.experience),
    )
    return ResumeParseRead(
        name=extraction.name,
        headline=extraction.headline,
        resume_text=resume_text,
        structured_data=extraction,
    )


@router.get("/profiles/{profile_id}", response_model=ProfileRead)
async def get_profile(profile: Profile = Depends(get_profile_or_404)):
    return profile


@router.get("/profiles/{profile_id}/resume.pdf")
async def export_profile_resume_pdf(profile: Profile = Depends(get_profile_or_404)):
    pdf_bytes = build_profile_resume_pdf(profile)
    filename = resume_pdf_filename(profile.name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": content_disposition_attachment(filename)},
    )


@router.patch("/profiles/{profile_id}", response_model=ProfileRead)
async def update_profile(
    body: ProfileUpdate,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    await index_profile_chunks(db, profile, get_embedding_provider())
    await db.commit()
    return profile


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    await db.delete(profile)
    await db.commit()


@router.post("/profiles/{profile_id}/apply-resume-suggestions", response_model=ProfileRead)
async def apply_resume_suggestions(
    body: ApplyResumeSuggestionsRequest,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    resume_text, structured_data, headline = apply_suggestions(
        profile.resume_text,
        profile.structured_data,
        profile.headline,
        body.suggestions,
    )
    profile.resume_text = resume_text
    profile.structured_data = structured_data
    if headline is not None:
        profile.headline = headline

    await db.commit()
    await db.refresh(profile)
    await index_profile_chunks(db, profile, get_embedding_provider())
    await db.commit()

    if body.job_id and body.match_analysis_id:
        job = await db.get(Job, body.job_id)
        analysis = await db.get(MatchAnalysis, body.match_analysis_id)
        if (
            job
            and analysis
            and analysis.profile_id == profile.id
            and analysis.status == "completed"
            and analysis.result
            and analysis.result.get("depth") != "screen"
        ):
            score = analysis.result.get("score")
            gaps = analysis.result.get("gaps") or []
            if isinstance(score, (int, float)):
                job.raw_metadata = mark_resume_applied(
                    job.raw_metadata,
                    analysis_id=str(analysis.id),
                    score=float(score),
                    gap_count=len(gaps),
                    suggestions_count=len(body.suggestions),
                )
                await db.commit()

    logger.info(
        "Applied %d resume suggestions to profile %s",
        len(body.suggestions),
        profile.id,
    )
    return profile
