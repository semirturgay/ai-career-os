"""The document classifier is an optional extra, and its absence must be harmless.

torch and transformers are ~613MB of a ~930MB environment. They buy one thing: a
pre-capture filter that decides whether a page looks like a job post. Everything
downstream already knows how to proceed without an opinion — `classify_page_text`
returns None when the classifier is disabled, and `job_capture_from_document(None)`
lets the capture through. These tests keep the not-installed path on those same rails,
so a slim deploy degrades instead of breaking.
"""

import tomllib
from pathlib import Path

import pytest

from app.schemas.document_classifier import DocumentLabel
from app.services.document_classifier import classifier as classifier_module
from app.services.document_classifier import page_classifier as page_classifier_module
from app.services.document_classifier.page_classifier import classify_page_text
from app.services.intake_validation import job_capture_from_document

REPO_ROOT = Path(__file__).resolve().parents[1]
OPTIONAL_PACKAGES = ("torch", "transformers")

SAMPLE_PAGE = (
    "Senior Backend Engineer at Acme. We are looking for someone to build and operate "
    "our payments platform. Responsibilities include designing APIs and mentoring."
)


@pytest.fixture
def classifier_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """The autouse conftest fixture turns the classifier off; these tests need it on."""
    monkeypatch.setattr("app.config.settings.document_classifier_enabled", True)


@pytest.fixture
def classifier_not_installed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(classifier_module, "classifier_dependencies_installed", lambda: False)
    # The warn-once latch is module state; reset it so each test sees the real behaviour.
    monkeypatch.setattr(page_classifier_module, "_warned_not_installed", False)


def test_torch_is_not_a_base_dependency():
    """Base install stays slim — this is the whole point of the extra."""
    pyproject = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())
    base = " ".join(pyproject["project"]["dependencies"]).casefold()

    for package in OPTIONAL_PACKAGES:
        assert package not in base, (
            f"{package} is back in the base dependencies. It belongs in the "
            "`classifier` optional extra — see pyproject.toml."
        )


def test_classifier_extra_still_declares_what_it_needs():
    """An extra that installs nothing is worse than no extra: it fails silently."""
    pyproject = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())
    extra = " ".join(pyproject["project"]["optional-dependencies"]["classifier"]).casefold()

    for package in OPTIONAL_PACKAGES:
        assert package in extra, f"the classifier extra must install {package}"


def test_get_document_classifier_returns_none_when_not_installed(classifier_not_installed):
    assert classifier_module.get_document_classifier() is None


def test_classification_is_skipped_when_not_installed(classifier_enabled, classifier_not_installed):
    assert classify_page_text(SAMPLE_PAGE, page_title="Careers") is None


def test_skipped_classification_still_allows_capture(classifier_enabled, classifier_not_installed):
    """Fail open. A missing optional filter must not block the core feature."""
    page_type, capturable, _message = job_capture_from_document(
        classify_page_text(SAMPLE_PAGE, page_title="Careers")
    )

    assert (page_type, capturable) == ("job_detail", True)


def test_missing_extra_is_warned_about_once(classifier_enabled, classifier_not_installed, caplog):
    """Discoverable, but not once per capture for the life of the process."""
    with caplog.at_level("WARNING"):
        for _ in range(3):
            classify_page_text(SAMPLE_PAGE, page_title="Careers")

    warnings = [r for r in caplog.records if "classifier" in r.getMessage()]
    assert len(warnings) == 1
    assert "uv sync --extra classifier" in warnings[0].getMessage()


def test_an_installed_classifier_is_still_used(classifier_enabled, monkeypatch):
    """The slim path must not become the only path."""
    from app.schemas.document_classifier import DocumentClassification

    class StubClassifier:
        model_name = "stub"

        def classify(self, text: str) -> DocumentClassification:
            return DocumentClassification(
                label=DocumentLabel.JOB_POST,
                confidence=0.95,
                scores={
                    DocumentLabel.RESUME: 0.02,
                    DocumentLabel.JOB_POST: 0.95,
                    DocumentLabel.OTHER: 0.03,
                },
            )

    result = classify_page_text(SAMPLE_PAGE, classifier=StubClassifier())

    assert result is not None
    assert result.label == DocumentLabel.JOB_POST
