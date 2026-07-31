from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.job_capture import JobCaptureClassification
from app.services.job_capture_classifier import classify_job_capture
from tests.evals.eval_assertions import load_json
from tests.evals.job_capture_eval_assertions import evaluate_capture_classification

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "job_capture_classification"


def _iter_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        if not (case_dir / "expected.json").exists():
            continue
        if not (case_dir / "llm_response.json").exists():
            continue
        if not (case_dir / "captured_text.txt").exists():
            continue
        cases.append((case_dir.name, case_dir))
    return cases


@pytest.mark.parametrize("case_name,case_dir", _iter_cases())
def test_golden_capture_classification(case_name: str, case_dir: Path):
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")
    result = JobCaptureClassification.model_validate(llm_response)
    failures = evaluate_capture_classification(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_cases())
@pytest.mark.asyncio
async def test_classify_job_capture_pipeline(case_name: str, case_dir: Path):
    captured_text = (case_dir / "captured_text.txt").read_text(encoding="utf-8").strip()
    llm_response = load_json(case_dir / "llm_response.json")
    expected = load_json(case_dir / "expected.json")

    golden = JobCaptureClassification.model_validate(llm_response)
    mock_client = AsyncMock()
    mock_client.generate_structured.return_value = golden

    with patch(
        "app.services.job_capture_classifier.get_llm_client",
        new=AsyncMock(return_value=mock_client),
    ):
        result = await classify_job_capture(
            None,
            captured_text,
            page_title="Example tab title",
            page_url="https://example.com/jobs/123",
        )

    assert (
        captured_text in mock_client.generate_structured.await_args.kwargs["messages"][-1].content
    )
    failures = evaluate_capture_classification(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)
