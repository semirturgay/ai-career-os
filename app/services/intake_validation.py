from __future__ import annotations

from app.config import settings
from app.schemas.document_classifier import DocumentClassification, DocumentLabel
from app.schemas.job_capture import JobCapturePageType

NOT_A_JOB_POST_MSG = (
    "This page doesn't seem to have a job posting. Open a job description and try again."
)
LOW_CONFIDENCE_JOB_MSG = (
    "Not enough recognizable job content — scroll until the full posting is visible, "
    "then capture again."
)


def job_capture_from_document(
    classification: DocumentClassification | None,
) -> tuple[JobCapturePageType, bool, str]:
    if classification is None:
        return "job_detail", True, "Job posting detected."
    if classification.label in (DocumentLabel.RESUME, DocumentLabel.OTHER):
        return "other", False, NOT_A_JOB_POST_MSG
    if classification.confidence < settings.document_classifier_min_confidence:
        return "other", False, LOW_CONFIDENCE_JOB_MSG
    return "job_detail", True, "Job posting detected."
