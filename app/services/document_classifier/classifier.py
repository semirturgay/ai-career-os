from __future__ import annotations

import threading
from typing import Any, Protocol

from app.config import settings
from app.logging_config import get_logger
from app.schemas.document_classifier import DocumentClassification, DocumentLabel

logger = get_logger(__name__)


class DocumentClassifierProvider(Protocol):
    model_name: str

    def classify(self, text: str) -> DocumentClassification: ...


class HuggingFaceDocumentClassifier:
    """Local transformers pipeline — smr123/resume-job-classifier by default."""

    model_name: str

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.document_classifier_model
        self._pipeline = None
        self._lock = threading.Lock()

    def classify(self, text: str) -> DocumentClassification:
        cleaned = text.strip()
        if not cleaned:
            return DocumentClassification(
                label=DocumentLabel.OTHER,
                confidence=1.0,
                scores={
                    DocumentLabel.RESUME: 0.0,
                    DocumentLabel.JOB_POST: 0.0,
                    DocumentLabel.OTHER: 1.0,
                },
            )

        results = self._get_pipeline()(
            cleaned,
            truncation=True,
            max_length=settings.document_classifier_max_length,
        )
        return _classification_from_pipeline_results(results)

    def _get_pipeline(self):
        if self._pipeline is not None:
            return self._pipeline

        with self._lock:
            if self._pipeline is not None:
                return self._pipeline

            from transformers import pipeline

            logger.info("Loading document classifier %s", self.model_name)
            self._pipeline = pipeline(
                "text-classification",
                model=self.model_name,
                top_k=None,
            )
            return self._pipeline


_default_classifier: DocumentClassifierProvider | None = None


def get_document_classifier() -> DocumentClassifierProvider:
    global _default_classifier
    if _default_classifier is None:
        _default_classifier = HuggingFaceDocumentClassifier()
    return _default_classifier


def _normalize_pipeline_results(results: Any) -> list[dict[str, Any]]:
    if not results:
        return []

    if isinstance(results, dict):
        return [results]

    if not isinstance(results, list):
        raise ValueError(f"Unexpected pipeline output type: {type(results)!r}")

    if results and isinstance(results[0], dict):
        return results

    if results and isinstance(results[0], list):
        first = results[0]
        if first and isinstance(first[0], dict):
            return first

    raise ValueError(f"Unexpected pipeline output shape: {results!r}")


def _classification_from_pipeline_results(results: Any) -> DocumentClassification:
    items = _normalize_pipeline_results(results)
    scores = {DocumentLabel(item["label"]): float(item["score"]) for item in items}
    best = max(items, key=lambda item: item["score"])
    return DocumentClassification(
        label=DocumentLabel(best["label"]),
        confidence=float(best["score"]),
        scores=scores,
    )
