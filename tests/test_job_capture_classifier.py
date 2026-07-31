from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.schemas.job_capture import JobCaptureClassification


@pytest.mark.asyncio
async def test_classify_capture_returns_llm_result(api_client: httpx.AsyncClient):
    classification = JobCaptureClassification(
        page_type="job_detail",
        is_capturable=True,
        user_message="Job posting detected.",
        title_hint="Engineer",
        company_hint="Acme",
    )

    with patch(
        "app.api.jobs.classify_job_capture",
        new=AsyncMock(return_value=classification),
    ):
        response = await api_client.post(
            "/api/v1/jobs/classify-capture",
            json={
                "text": "Senior Backend Engineer at Acme Corp. " + ("Python APIs. " * 20),
                "page_title": "Senior Backend Engineer — Acme",
                "page_url": "https://example.com/jobs/1",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["is_capturable"] is True
    assert body["page_type"] == "job_detail"


@pytest.mark.asyncio
async def test_classify_capture_rejects_short_text(api_client: httpx.AsyncClient):
    response = await api_client.post(
        "/api/v1/jobs/classify-capture",
        json={"text": "too short"},
    )
    assert response.status_code == 422
