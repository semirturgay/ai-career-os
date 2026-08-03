from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from app.schemas.document_classifier import DocumentClassification, DocumentLabel
from app.schemas.job_capture import JobCaptureClassification
from app.services.intake_validation import job_capture_from_document
from app.services.job_capture_classifier import classify_job_capture
from tests.evals.eval_assertions import load_json
from tests.evals.job_capture_eval_assertions import evaluate_capture_classification

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "job_capture_classification"

DOCUMENT_LABEL_BY_EXPECTATION = {
    ("job_detail", True): DocumentLabel.JOB_POST,
    ("other", False): DocumentLabel.OTHER,
}


def _document_classification_for_expected(expected: dict) -> DocumentClassification:
    page_type = expected["expect_page_type"]
    capturable = expected["expect_capturable"]
    label = DOCUMENT_LABEL_BY_EXPECTATION.get((page_type, capturable), DocumentLabel.OTHER)
    if label == DocumentLabel.JOB_POST:
        scores = {
            DocumentLabel.RESUME: 0.03,
            DocumentLabel.JOB_POST: 0.91,
            DocumentLabel.OTHER: 0.06,
        }
        confidence = 0.91
    elif label == DocumentLabel.RESUME:
        scores = {
            DocumentLabel.RESUME: 0.93,
            DocumentLabel.JOB_POST: 0.04,
            DocumentLabel.OTHER: 0.03,
        }
        confidence = 0.93
    else:
        scores = {
            DocumentLabel.RESUME: 0.08,
            DocumentLabel.JOB_POST: 0.07,
            DocumentLabel.OTHER: 0.85,
        }
        confidence = 0.85

    return DocumentClassification(label=label, confidence=confidence, scores=scores)


def _iter_cases() -> list[tuple[str, Path]]:
    cases: list[tuple[str, Path]] = []
    for case_dir in sorted(FIXTURES_DIR.iterdir()):
        if not case_dir.is_dir():
            continue
        if not (case_dir / "expected.json").exists():
            continue
        if not (case_dir / "captured_text.txt").exists():
            continue
        cases.append((case_dir.name, case_dir))
    return cases


@pytest.mark.parametrize("case_name,case_dir", _iter_cases())
def test_golden_capture_classification_mapping(case_name: str, case_dir: Path):
    expected = load_json(case_dir / "expected.json")
    classification = _document_classification_for_expected(expected)
    page_type, is_capturable, user_message = job_capture_from_document(classification)
    result = JobCaptureClassification(
        page_type=page_type,
        is_capturable=is_capturable,
        user_message=user_message,
    )
    failures = evaluate_capture_classification(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)


@pytest.mark.parametrize("case_name,case_dir", _iter_cases())
def test_classify_job_capture_pipeline(case_name: str, case_dir: Path):
    captured_text = (case_dir / "captured_text.txt").read_text(encoding="utf-8").strip()
    expected = load_json(case_dir / "expected.json")
    classification = _document_classification_for_expected(expected)

    with patch(
        "app.services.job_capture_classifier.classify_page_text",
        return_value=classification,
    ):
        result = classify_job_capture(
            captured_text,
            page_title=(
                "Senior Backend Engineer — FinTech Labs"
                if case_name == "job_detail_tab_title_company"
                else "Example tab title"
            ),
            page_url="https://example.com/jobs/123",
        )

    failures = evaluate_capture_classification(result, expected, case_name=case_name)
    assert not failures, "\n".join(failures)
