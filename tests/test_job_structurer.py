from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.job_extraction import JobExtraction
from app.services.job_structurer import structure_job


@pytest.mark.asyncio
async def test_structure_job_calls_llm_client():
    extraction = JobExtraction(
        title="Backend Engineer",
        company="Acme",
        description="Build Python APIs.",
        match_summary="Backend role building Python APIs.",
        requirements=["Python"],
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = extraction

    with patch(
        "app.services.job_structurer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        result = await structure_job(db=None, job_text="Backend Engineer at Acme")

    assert result.title == "Backend Engineer"
    mock_client.generate_structured.assert_awaited_once()
    call_kwargs = mock_client.generate_structured.await_args.kwargs
    assert call_kwargs.get("max_tokens") == 8192
