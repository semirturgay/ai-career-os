"""Tests for browser extension intake handoff endpoints."""

from uuid import uuid4

import pytest

from app.schemas.job_extraction import JobExtraction
from app.services.job_intake_handoff import clear_store_for_tests, create_handoff, get_handoff


@pytest.fixture(autouse=True)
def _clear_handoffs():
    clear_store_for_tests()
    yield
    clear_store_for_tests()


def _sample_extraction() -> JobExtraction:
    return JobExtraction(
        title="Senior Backend Engineer",
        company="FinTech Labs",
        description="Build payment APIs with Python and FastAPI.",
        match_summary="Senior Python backend role focused on payment APIs.",
        requirements=["Python", "FastAPI"],
    )


@pytest.mark.asyncio
async def test_create_and_read_intake_handoff(api_client):
    extraction = _sample_extraction()
    create_response = await api_client.post(
        "/api/v1/jobs/intake-handoff",
        json={
            "job_text": "Senior Backend Engineer at FinTech Labs",
            "structured_data": extraction.model_dump(),
            "url": "https://boards.greenhouse.io/example/jobs/123",
            "source": "greenhouse",
        },
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["structured_data"]["title"] == "Senior Backend Engineer"
    assert payload["source"] == "greenhouse"

    read_response = await api_client.get(f"/api/v1/jobs/intake-handoff/{payload['id']}")
    assert read_response.status_code == 200
    assert read_response.json()["url"] == "https://boards.greenhouse.io/example/jobs/123"


@pytest.mark.asyncio
async def test_read_missing_handoff_returns_404(api_client):
    response = await api_client.get(f"/api/v1/jobs/intake-handoff/{uuid4()}")
    assert response.status_code == 404


def test_handoff_store_roundtrip():
    extraction = _sample_extraction()
    handoff = create_handoff(
        job_text="Example job text",
        structured_data=extraction,
        url="https://example.com/jobs/1",
        source="generic",
    )
    loaded = get_handoff(handoff.id)
    assert loaded is not None
    assert loaded.structured_data.title == extraction.title
