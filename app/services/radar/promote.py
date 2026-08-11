"""Promote a Posting into a real Job.

Purely local: the full description was stored at poll time, so this never touches
the network to read the posting. The job-extraction LLM call happens here rather
than during polling, which keeps a routine poll close to free.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models import Job, MatchAnalysis, Posting, Profile, WatchedCompany
from app.services.job_structurer import structure_job
from app.services.job_url import normalize_job_url
from app.services.screening_card import attach_screening_card_to_metadata

logger = get_logger(__name__)


class PostingAlreadyPromotedError(Exception):
    """The posting already has a Job."""

    def __init__(self, job_id: UUID) -> None:
        super().__init__("This posting is already in your pipeline")
        self.job_id = job_id


async def promote_posting(
    db: AsyncSession,
    posting: Posting,
    profile: Profile,
) -> tuple[Job, UUID | None]:
    """Create a Job from a stored Posting and queue a full match analysis.

    Returns ``(job, match_analysis_id)``. The caller is responsible for scheduling
    ``run_match_analysis`` as a background task once the transaction commits.
    """
    if posting.job_id:
        raise PostingAlreadyPromotedError(posting.job_id)

    company = await db.get(WatchedCompany, posting.watched_company_id)
    company_name = company.name if company else "Unknown"

    normalized_url = normalize_job_url(posting.url) if posting.url else None
    if normalized_url:
        existing = await db.execute(select(Job).where(Job.url == normalized_url).limit(1))
        found = existing.scalar_one_or_none()
        if found:
            posting.job_id = found.id
            posting.state = "promoted"
            await db.commit()
            raise PostingAlreadyPromotedError(found.id)

    extraction = await structure_job(db, posting.description)

    job = Job(
        title=extraction.title or posting.title,
        company=extraction.company or company_name,
        description=posting.description,
        location=extraction.location or posting.location,
        url=normalized_url,
        source=f"radar:{company.ats_provider}" if company else "radar",
        # description lives on the column; keeping it out of raw_metadata avoids storing it twice
        raw_metadata=extraction.model_dump(mode="json", exclude={"description"}),
    )
    db.add(job)
    await db.flush()
    job.raw_metadata = attach_screening_card_to_metadata(job.raw_metadata, job)

    analysis = MatchAnalysis(profile_id=profile.id, job_id=job.id, status="pending")
    db.add(analysis)
    await db.flush()

    posting.job_id = job.id
    posting.state = "promoted"

    await db.commit()
    await db.refresh(job)

    logger.info(
        "Promoted posting %s → job %s (company=%s)",
        posting.id,
        job.id,
        company_name,
    )
    return job, analysis.id
