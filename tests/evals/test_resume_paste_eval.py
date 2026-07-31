from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.resume_extraction import ResumeExtraction
from app.services.resume_paste_parser import prepare_resume_text
from app.services.resume_structurer import structure_resume
from tests.evals.eval_assertions import evaluate_extraction, load_json

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "pasted_backend_engineer"


@pytest.mark.asyncio
async def test_parse_text_pipeline_normalizes_html_before_structuring():
    raw = (FIXTURES_DIR / "resume.txt").read_text(encoding="utf-8")
    llm_response = load_json(FIXTURES_DIR / "llm_response.json")
    expected = load_json(FIXTURES_DIR / "expected.json")

    resume_text = prepare_resume_text(raw)
    assert len(resume_text) >= 100
    assert "<div" not in resume_text
    assert "Jane Doe" in resume_text

    golden = ResumeExtraction.model_validate(llm_response)
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    with patch(
        "app.services.resume_structurer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        extraction = await structure_resume(db=None, resume_text=resume_text)

    assert resume_text in mock_client.generate_structured.await_args.kwargs["messages"][-1].content

    failures = evaluate_extraction(extraction, expected, case_name="pasted_backend_engineer")
    assert not failures, "\n".join(failures)
