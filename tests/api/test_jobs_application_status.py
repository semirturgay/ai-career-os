from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import httpx
import pytest

from app.models import FeedbackEvent, Job, Profile


@pytest.mark.asyncio
async def test_list_jobs_filters_by_application_status(
    api_client: httpx.AsyncClient, mock_db_session
):
    from app.db.session import get_db
    from app.main import app

    applied_job = Job(
        id=uuid4(),
        title="Applied role",
        company="Acme",
        description="Desc",
        application_status="applied",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    result = Mock()
    result.scalars.return_value.all.return_value = [applied_job]
    mock_db_session.execute = AsyncMock(return_value=result)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.get("/api/v1/jobs?application_status=applied")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["application_status"] == "applied"
    assert body[0]["title"] == "Applied role"


@pytest.mark.asyncio
async def test_create_application_outcome_syncs_job_status(
    api_client: httpx.AsyncClient,
    mock_db_session,
):
    from app.db.session import get_db
    from app.main import app

    profile_id = uuid4()
    job_id = uuid4()
    event_id = uuid4()
    now = datetime.now(UTC)

    profile = Profile(id=profile_id, name="Jane", resume_text="Resume text long enough.")
    job = Job(
        id=job_id,
        title="Engineer",
        company="Acme",
        description="Job description",
        application_status="saved",
    )

    async def get_side_effect(model, obj_id):
        if model is Profile and obj_id == profile_id:
            return profile
        if model is Job and obj_id == job_id:
            return job
        return None

    mock_db_session.get = AsyncMock(side_effect=get_side_effect)

    async def refresh_side_effect(obj):
        if isinstance(obj, FeedbackEvent):
            obj.id = event_id
            obj.created_at = now

    mock_db_session.refresh = AsyncMock(side_effect=refresh_side_effect)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.post(
            "/api/v1/feedback",
            json={
                "profile_id": str(profile_id),
                "job_id": str(job_id),
                "event_type": "application_outcome",
                "payload": {"status": "rejected", "note": "Not a fit"},
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert job.application_status == "rejected"
