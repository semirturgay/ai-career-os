from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest


@pytest.mark.asyncio
async def test_create_profile_returns_read_model(api_client: httpx.AsyncClient):
    from unittest.mock import AsyncMock, MagicMock

    from app.db.session import get_db
    from app.main import app
    from app.models import Profile

    profile_id = uuid4()
    now = datetime.now(UTC)

    session = AsyncMock()

    async def refresh_side_effect(obj):
        if isinstance(obj, Profile):
            obj.id = profile_id
            obj.created_at = now
            obj.updated_at = now

    session.refresh = AsyncMock(side_effect=refresh_side_effect)
    session.commit = AsyncMock()
    session.add = MagicMock()

    async def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await api_client.post(
            "/api/v1/profiles",
            json={
                "name": "Jane Doe",
                "headline": "Engineer",
                "resume_text": "Jane Doe resume text",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Jane Doe"
    assert body["id"] == str(profile_id)


@pytest.mark.asyncio
async def test_parse_resume_text_returns_structured_fields(api_client: httpx.AsyncClient):
    from unittest.mock import AsyncMock, patch

    from app.schemas.resume_extraction import ResumeExtraction

    extraction = ResumeExtraction(
        name="Jane Doe",
        headline="Senior Backend Engineer",
        email="jane@example.com",
        skills=["Python", "FastAPI"],
        experience=[
            {
                "title": "Engineer",
                "company": "Acme",
                "duration": "2020 - Present",
                "highlights": ["Built APIs"],
            }
        ],
        education=[],
    )

    pasted = "<p>Jane Doe</p><p>Senior Backend Engineer</p>" + ("Python FastAPI experience. " * 8)

    with patch(
        "app.api.profiles.structure_resume",
        new=AsyncMock(return_value=extraction),
    ):
        response = await api_client.post(
            "/api/v1/profiles/parse-text",
            json={"text": pasted},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Jane Doe"
    assert body["headline"] == "Senior Backend Engineer"
    assert "Jane Doe" in body["resume_text"]
    assert body["structured_data"]["skills"] == ["Python", "FastAPI"]


@pytest.mark.asyncio
async def test_parse_resume_text_rejects_short_input(api_client: httpx.AsyncClient):
    response = await api_client.post(
        "/api/v1/profiles/parse-text",
        json={"text": "too short"},
    )
    assert response.status_code == 422
