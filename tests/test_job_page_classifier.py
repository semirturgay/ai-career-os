from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.job_page_classify import JobPageClassification
from app.services.job_page_classifier import build_classify_user_message, classify_job_page


def test_build_classify_user_message_includes_metadata():
    message = build_classify_user_message(
        "Senior Engineer at Acme. Python required.",
        url="https://example.com/jobs/1",
        page_title="Engineer | Acme",
    )
    assert "Senior Engineer" in message
    assert "example.com/jobs/1" in message
    assert "Engineer | Acme" in message


@pytest.mark.asyncio
async def test_classify_job_page_calls_llm_client():
    classification = JobPageClassification(
        is_job_post=True,
        confidence="high",
        page_type="detail",
        reason="Single role with title, company, and requirements.",
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = classification

    with patch(
        "app.services.job_page_classifier.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        result = await classify_job_page(
            db=None,
            text_sample="Senior Backend Engineer at FinTech Labs. 5+ years Python.",
            url="https://boards.example/jobs/1",
        )

    assert result.is_job_post is True
    assert result.page_type == "detail"
    mock_client.generate_structured.assert_awaited_once()
    call_kwargs = mock_client.generate_structured.await_args.kwargs
    assert call_kwargs["max_tokens"] == 256
