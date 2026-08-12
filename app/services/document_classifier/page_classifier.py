from __future__ import annotations

from app.config import settings
from app.logging_config import get_logger
from app.schemas.document_classifier import DocumentClassification, DocumentLabel
from app.services.capture_text_normalization import prepare_capture_text_for_classification
from app.services.document_classifier.chunking import chunk_text_for_classification
from app.services.document_classifier.classifier import (
    CLASSIFIER_EXTRA,
    DocumentClassifierProvider,
    get_document_classifier,
)
from app.services.document_classifier.tuning_log import log_classifier_prediction

logger = get_logger(__name__)

_warned_not_installed = False


def _warn_classifier_not_installed() -> None:
    """Say it once. Every capture would otherwise repeat the same line forever."""
    global _warned_not_installed
    if _warned_not_installed:
        return
    _warned_not_installed = True
    logger.warning(
        "Document classifier is enabled but the optional `%s` extra is not installed — "
        "captures will be accepted without the is-this-a-job-post pre-filter. "
        "Install it with `uv sync --extra %s`, or set DOCUMENT_CLASSIFIER_ENABLED=false "
        "to silence this.",
        CLASSIFIER_EXTRA,
        CLASSIFIER_EXTRA,
    )


def _empty_classification() -> DocumentClassification:
    return DocumentClassification(
        label=DocumentLabel.OTHER,
        confidence=1.0,
        scores={
            DocumentLabel.RESUME: 0.0,
            DocumentLabel.JOB_POST: 0.0,
            DocumentLabel.OTHER: 1.0,
        },
    )


def aggregate_chunk_classifications(
    chunks: list[tuple[str, DocumentClassification]],
    *,
    min_confidence: float,
) -> DocumentClassification:
    """Max-pool scores per label; job_post wins when it dominates qualifying chunks."""
    if not chunks:
        return _empty_classification()

    best_job: DocumentClassification | None = None
    best_job_score = -1.0
    best_resume: DocumentClassification | None = None
    best_resume_score = -1.0
    qualifying_job_count = 0
    qualifying_resume_count = 0

    for _, classification in chunks:
        job_score = classification.scores.get(DocumentLabel.JOB_POST, 0.0)
        resume_score = classification.scores.get(DocumentLabel.RESUME, 0.0)

        if job_score >= min_confidence and job_score > resume_score:
            qualifying_job_count += 1
            if job_score > best_job_score:
                best_job_score = job_score
                best_job = classification

        if resume_score >= min_confidence and resume_score > job_score:
            qualifying_resume_count += 1
            if resume_score > best_resume_score:
                best_resume_score = resume_score
                best_resume = classification

    if best_job is not None and qualifying_job_count > qualifying_resume_count:
        return DocumentClassification(
            label=DocumentLabel.JOB_POST,
            confidence=best_job_score,
            scores=best_job.scores,
        )

    if best_job is not None and qualifying_resume_count == 0:
        return DocumentClassification(
            label=DocumentLabel.JOB_POST,
            confidence=best_job_score,
            scores=best_job.scores,
        )

    if (
        best_job is not None
        and best_resume is not None
        and qualifying_job_count == qualifying_resume_count
        and best_job_score >= best_resume_score
    ):
        return DocumentClassification(
            label=DocumentLabel.JOB_POST,
            confidence=best_job_score,
            scores=best_job.scores,
        )

    if best_resume is not None:
        return DocumentClassification(
            label=DocumentLabel.RESUME,
            confidence=best_resume_score,
            scores=best_resume.scores,
        )

    if best_job is not None:
        return DocumentClassification(
            label=DocumentLabel.JOB_POST,
            confidence=best_job_score,
            scores=best_job.scores,
        )

    _, fallback = max(chunks, key=lambda item: item[1].confidence)
    return fallback


def classify_page_text(
    text: str,
    *,
    page_title: str | None = None,
    classifier: DocumentClassifierProvider | None = None,
) -> DocumentClassification | None:
    normalized = prepare_capture_text_for_classification(text, page_title=page_title)
    if not normalized:
        return None

    if not settings.document_classifier_enabled:
        log_classifier_prediction(normalized, "skipped:disabled")
        return None

    active_classifier = classifier or get_document_classifier()
    if active_classifier is None:
        _warn_classifier_not_installed()
        log_classifier_prediction(normalized, "skipped:not-installed")
        return None

    chunks = chunk_text_for_classification(
        normalized,
        chunk_size=settings.document_classifier_chunk_size,
        overlap=settings.document_classifier_chunk_overlap,
    )

    chunk_results: list[tuple[str, DocumentClassification]] = []
    for chunk in chunks:
        try:
            result = active_classifier.classify(chunk)
        except Exception as exc:
            log_classifier_prediction(chunk, f"error:{exc.__class__.__name__}")
            raise
        log_classifier_prediction(chunk, result.label.value)
        chunk_results.append((chunk, result))

    return aggregate_chunk_classifications(
        chunk_results,
        min_confidence=settings.document_classifier_min_confidence,
    )
