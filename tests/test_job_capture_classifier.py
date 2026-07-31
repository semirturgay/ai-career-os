from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.schemas.job_capture import JobCaptureClassification
from app.services.job_capture_classifier import build_capture_classification_message


def test_build_capture_classification_message_puts_metadata_first():
    message = build_capture_classification_message(
        "Senior Backend Engineer\n\nRequirements\n- Python",
        page_title="Senior Backend Engineer — FinTech Labs",
        page_url="https://boards.greenhouse.io/acme/jobs/123",
    )
    title_index = message.index("Browser tab title:")
    url_index = message.index("Page URL")
    text_index = message.index("Captured visible page text:")
    assert title_index < url_index < text_index
    assert "FinTech Labs" in message


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
