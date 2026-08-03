from unittest.mock import patch

import httpx
import pytest

from app.schemas.document_classifier import DocumentClassification, DocumentLabel


@pytest.mark.asyncio
async def test_classify_capture_returns_document_classifier_result(api_client: httpx.AsyncClient):
    classification = DocumentClassification(
        label=DocumentLabel.JOB_POST,
        confidence=0.91,
        scores={
            DocumentLabel.RESUME: 0.03,
            DocumentLabel.JOB_POST: 0.91,
            DocumentLabel.OTHER: 0.06,
        },
    )

    with patch(
        "app.services.job_capture_classifier.classify_page_text",
        return_value=classification,
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
