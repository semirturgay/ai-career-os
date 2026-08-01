from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models import FeedbackEvent, Job
from app.schemas.feedback import ApplicationOutcomeStatus, FeedbackEventType

logger = get_logger(__name__)

DEFAULT_APPLICATION_STATUS = ApplicationOutcomeStatus.SAVED.value


async def sync_job_application_status_from_feedback(
    db: AsyncSession,
    event: FeedbackEvent,
) -> Job | None:
    if event.event_type != FeedbackEventType.APPLICATION_OUTCOME.value:
        return None
    if not event.job_id:
        return None

    job = await db.get(Job, event.job_id)
    if not job:
        return None

    raw_status = event.payload.get("status", DEFAULT_APPLICATION_STATUS)
    try:
        status = ApplicationOutcomeStatus(str(raw_status)).value
    except ValueError:
        status = DEFAULT_APPLICATION_STATUS

    job.application_status = status
    await db.flush()
    logger.info(
        "Synced job application_status job=%s status=%s from feedback=%s",
        job.id,
        status,
        event.id,
    )
    return job
