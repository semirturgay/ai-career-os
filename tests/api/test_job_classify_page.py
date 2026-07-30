"""Tests for POST /jobs/classify-page."""

from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.job_page_classify import JobPageClassification


@pytest.mark.asyncio
async def test_classify_page_endpoint(api_client):
    classification = JobPageClassification(
        is_job_post=False,
        confidence="high",
        page_type="list",
        reason="Multiple job cards and search filters visible.",
    )

    with patch(
        "app.api.jobs.classify_job_page",
        new=AsyncMock(return_value=classification),
    ):
        response = await api_client.post(
            "/api/v1/jobs/classify-page",
            json={
                "text_sample": (
                    "Software Engineer · Berlin · Remote\n"
                    "Product Manager · London\n"
                    "Filter by location · 42 results"
                ),
                "url": "https://example.com/careers/search",
                "page_title": "Careers search",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["is_job_post"] is False
    assert body["page_type"] == "list"
    assert body["confidence"] == "high"


@pytest.mark.asyncio
async def test_classify_page_rejects_short_sample(api_client):
    response = await api_client.post(
        "/api/v1/jobs/classify-page",
        json={"text_sample": "too short"},
    )
    assert response.status_code == 422
