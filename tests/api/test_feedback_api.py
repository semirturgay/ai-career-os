from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import httpx
import pytest

from app.models import FeedbackEvent, Job, MatchAnalysis, Profile


@pytest.mark.asyncio
async def test_create_feedback_preference(api_client: httpx.AsyncClient, mock_db_session):
    from app.db.session import get_db
    from app.main import app

    profile_id = uuid4()
    event_id = uuid4()
    now = datetime.now(UTC)

    profile = Profile(
        id=profile_id,
        name="Jane Doe",
        resume_text="Resume text long enough for tests.",
    )

    async def get_side_effect(_model, obj_id):
        if _model is Profile and obj_id == profile_id:
            return profile
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
                "event_type": "preference",
                "payload": {
                    "key": "work_mode",
                    "value": "remote_only",
                    "note": "No relocation",
                },
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == str(event_id)
    assert body["event_type"] == "preference"
    assert body["payload"]["value"] == "remote_only"
    assert body["job_id"] is None


@pytest.mark.asyncio
async def test_create_feedback_profile_not_found(api_client: httpx.AsyncClient, mock_db_session):
    from app.db.session import get_db
    from app.main import app

    mock_db_session.get = AsyncMock(return_value=None)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.post(
            "/api/v1/feedback",
            json={
                "profile_id": str(uuid4()),
                "event_type": "preference",
                "payload": {"key": "work_mode", "value": "remote_only"},
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"


@pytest.mark.asyncio
async def test_create_feedback_rejects_mismatched_analysis(
    api_client: httpx.AsyncClient,
    mock_db_session,
):
    from app.db.session import get_db
    from app.main import app

    profile_id = uuid4()
    job_id = uuid4()
    analysis_id = uuid4()
    other_profile_id = uuid4()

    profile = Profile(id=profile_id, name="Jane", resume_text="Resume text")
    job = Job(id=job_id, title="Engineer", company="Acme", description="Job description")
    analysis = MatchAnalysis(
        id=analysis_id,
        profile_id=other_profile_id,
        job_id=job_id,
        status="completed",
    )

    async def get_side_effect(model, obj_id):
        if model is Profile and obj_id == profile_id:
            return profile
        if model is Job and obj_id == job_id:
            return job
        if model is MatchAnalysis and obj_id == analysis_id:
            return analysis
        return None

    mock_db_session.get = AsyncMock(side_effect=get_side_effect)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.post(
            "/api/v1/feedback",
            json={
                "profile_id": str(profile_id),
                "job_id": str(job_id),
                "match_analysis_id": str(analysis_id),
                "event_type": "gap_dispute",
                "payload": {
                    "gap_evidence": "Missing AWS",
                    "user_note": "I have AWS on Globex project",
                },
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "profile_id" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_feedback_for_profile(api_client: httpx.AsyncClient, mock_db_session):
    from app.db.session import get_db
    from app.main import app

    profile_id = uuid4()
    profile = Profile(id=profile_id, name="Jane", resume_text="Resume text")
    event = FeedbackEvent(
        id=uuid4(),
        profile_id=profile_id,
        job_id=None,
        match_analysis_id=None,
        event_type="preference",
        payload={"key": "work_mode", "value": "remote_only"},
        created_at=datetime.now(UTC),
    )

    mock_db_session.get = AsyncMock(return_value=profile)
    result = Mock()
    result.scalars.return_value.all.return_value = [event]
    mock_db_session.execute = AsyncMock(return_value=result)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.get(f"/api/v1/feedback?profile_id={profile_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["event_type"] == "preference"


@pytest.mark.asyncio
async def test_list_feedback_for_job(api_client: httpx.AsyncClient, mock_db_session):
    from app.db.session import get_db
    from app.main import app

    job_id = uuid4()
    profile_id = uuid4()
    job = Job(id=job_id, title="Engineer", company="Acme", description="Job description")
    event = FeedbackEvent(
        id=uuid4(),
        profile_id=profile_id,
        job_id=job_id,
        match_analysis_id=None,
        event_type="application_outcome",
        payload={"status": "applied"},
        created_at=datetime.now(UTC),
    )

    mock_db_session.get = AsyncMock(return_value=job)
    result = Mock()
    result.scalars.return_value.all.return_value = [event]
    mock_db_session.execute = AsyncMock(return_value=result)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.get(f"/api/v1/jobs/{job_id}/feedback")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["event_type"] == "application_outcome"
