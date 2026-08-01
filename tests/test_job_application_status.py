from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.models import FeedbackEvent, Job
from app.services.jobs.application_status import sync_job_application_status_from_feedback


@pytest.mark.asyncio
async def test_sync_job_application_status_updates_job():
    job_id = uuid4()
    job = Job(
        id=job_id,
        title="Engineer",
        company="Acme",
        description="Build APIs",
        application_status="saved",
    )
    event = FeedbackEvent(
        id=uuid4(),
        profile_id=uuid4(),
        job_id=job_id,
        match_analysis_id=None,
        event_type="application_outcome",
        payload={"status": "interviewing", "note": "Phone screen"},
        created_at=datetime.now(UTC),
    )

    mock_db = AsyncMock()
    mock_db.get = AsyncMock(return_value=job)

    updated = await sync_job_application_status_from_feedback(mock_db, event)

    assert updated is job
    assert job.application_status == "interviewing"
    mock_db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_job_application_status_skips_non_outcome_event():
    event = FeedbackEvent(
        id=uuid4(),
        profile_id=uuid4(),
        job_id=uuid4(),
        match_analysis_id=uuid4(),
        event_type="gap_dispute",
        payload={"gap_evidence": "Missing AWS"},
        created_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()
    result = await sync_job_application_status_from_feedback(mock_db, event)
    assert result is None
    mock_db.get.assert_not_called()
