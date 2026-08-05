from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.job_extraction import JobExtractionLLM
from app.services.job_structurer import structure_job


@pytest.mark.asyncio
async def test_structure_job_calls_llm_client():
    llm_extraction = JobExtractionLLM(
        title="Backend Engineer",
        company="Acme",
        description="Build Python APIs at Acme.",
        match_summary="Backend role building Python APIs.",
        requirements=["Python"],
    )
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = llm_extraction

    job_text = "Backend Engineer at Acme\n\nBuild Python APIs for payments."
    with patch(
        "app.services.job_structurer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        result = await structure_job(db=None, job_text=job_text)

    assert result.title == "Backend Engineer"
    assert result.description == job_text
    mock_client.generate_structured.assert_awaited_once()
    call_kwargs = mock_client.generate_structured.await_args.kwargs
    assert call_kwargs.get("max_tokens") == 2048
