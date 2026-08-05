from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.job_extraction import JobExtractionLLM
from app.services.job_extraction_normalize import normalize_job_payload
from app.services.job_structurer import structure_job
from tests.evals.eval_assertions import load_json
from tests.evals.job_eval_assertions import evaluate_job_extraction

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "job_extraction"


def _iter_job_extraction_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        if not (case_dir / "expected.json").exists():
            continue
        if not (case_dir / "llm_response.json").exists():
            continue
        if not (case_dir / "job_post.txt").exists():
            continue
        cases.append((case_dir.name, case_dir))
    return cases


@pytest.mark.parametrize("case_name,case_dir", _iter_job_extraction_cases())
def test_golden_job_response_meets_expectations(case_name: str, case_dir: Path):
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    normalized = normalize_job_payload(llm_response)
    extraction = JobExtractionLLM.model_validate(normalized)

    failures = evaluate_job_extraction(extraction, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_job_extraction_cases())
@pytest.mark.asyncio
async def test_structure_job_pipeline_with_mocked_llm(case_name: str, case_dir: Path):
    job_text = (case_dir / "job_post.txt").read_text(encoding="utf-8").strip()
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    golden = JobExtractionLLM.model_validate(normalize_job_payload(llm_response))
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    with patch(
        "app.services.job_structurer.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        extraction = await structure_job(db=None, job_text=job_text)

    mock_client.generate_structured.assert_awaited_once()
    call_kwargs = mock_client.generate_structured.await_args.kwargs
    assert call_kwargs["response_model"] is JobExtractionLLM
    assert "Senior Backend Engineer" in call_kwargs["messages"][-1].content

    failures = evaluate_job_extraction(extraction, expected, case_name=case_name)
    assert not failures, "\n".join(failures)
