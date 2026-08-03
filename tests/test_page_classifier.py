from app.schemas.document_classifier import DocumentClassification, DocumentLabel
from app.services.document_classifier.chunking import chunk_text_for_classification
from app.services.document_classifier.page_classifier import aggregate_chunk_classifications


def test_chunk_text_returns_single_chunk_for_short_text():
    text = "Senior Backend Engineer\n\nRequirements\n- Python"
    assert chunk_text_for_classification(text, chunk_size=800, overlap=200) == [text]


def test_chunk_text_creates_overlapping_windows():
    text = "a" * 1400
    chunks = chunk_text_for_classification(text, chunk_size=800, overlap=200)
    assert len(chunks) == 2
    assert len(chunks[0]) == 800
    assert len(chunks[1]) == 800
    assert chunks[0][600:] == chunks[1][:200]


def test_aggregate_max_pools_job_post_across_chunks():
    weak_job = DocumentClassification(
        label=DocumentLabel.OTHER,
        confidence=0.55,
        scores={
            DocumentLabel.RESUME: 0.30,
            DocumentLabel.JOB_POST: 0.40,
            DocumentLabel.OTHER: 0.55,
        },
    )
    strong_job = DocumentClassification(
        label=DocumentLabel.JOB_POST,
        confidence=0.82,
        scores={
            DocumentLabel.RESUME: 0.08,
            DocumentLabel.JOB_POST: 0.82,
            DocumentLabel.OTHER: 0.10,
        },
    )
    result = aggregate_chunk_classifications(
        [("chunk-1", weak_job), ("chunk-2", strong_job)],
        min_confidence=0.45,
    )
    assert result.label == DocumentLabel.JOB_POST
    assert result.confidence == 0.82


def test_aggregate_rejects_strong_resume_signal():
    resume = DocumentClassification(
        label=DocumentLabel.RESUME,
        confidence=0.91,
        scores={
            DocumentLabel.RESUME: 0.91,
            DocumentLabel.JOB_POST: 0.05,
            DocumentLabel.OTHER: 0.04,
        },
    )
    jobish = DocumentClassification(
        label=DocumentLabel.JOB_POST,
        confidence=0.70,
        scores={
            DocumentLabel.RESUME: 0.20,
            DocumentLabel.JOB_POST: 0.70,
            DocumentLabel.OTHER: 0.10,
        },
    )
    result = aggregate_chunk_classifications(
        [("chunk-1", jobish), ("chunk-2", resume)],
        min_confidence=0.45,
    )
    assert result.label == DocumentLabel.RESUME


def test_aggregate_job_post_wins_when_mixed_with_resume_chunks():
    """Noisy pages can contain resume-like sidebar chunks; job_post majority should win."""
    resume_noise = DocumentClassification(
        label=DocumentLabel.RESUME,
        confidence=0.88,
        scores={
            DocumentLabel.RESUME: 0.88,
            DocumentLabel.JOB_POST: 0.08,
            DocumentLabel.OTHER: 0.04,
        },
    )
    strong_job = DocumentClassification(
        label=DocumentLabel.JOB_POST,
        confidence=0.92,
        scores={
            DocumentLabel.RESUME: 0.05,
            DocumentLabel.JOB_POST: 0.92,
            DocumentLabel.OTHER: 0.03,
        },
    )
    result = aggregate_chunk_classifications(
        [
            ("sidebar", resume_noise),
            ("sidebar-2", resume_noise),
            ("job-body", strong_job),
            ("job-body-2", strong_job),
            ("job-body-3", strong_job),
        ],
        min_confidence=0.45,
    )
    assert result.label == DocumentLabel.JOB_POST
    assert result.confidence == 0.92


def test_aggregate_job_post_wins_when_majority_despite_higher_resume_peak():
    """Listing noise can score higher on resume; job description chunks still dominate."""
    listing = DocumentClassification(
        label=DocumentLabel.RESUME,
        confidence=0.73,
        scores={
            DocumentLabel.RESUME: 0.73,
            DocumentLabel.JOB_POST: 0.18,
            DocumentLabel.OTHER: 0.09,
        },
    )
    job_body = DocumentClassification(
        label=DocumentLabel.JOB_POST,
        confidence=0.67,
        scores={
            DocumentLabel.RESUME: 0.21,
            DocumentLabel.JOB_POST: 0.67,
            DocumentLabel.OTHER: 0.12,
        },
    )
    chunks: list[tuple[str, DocumentClassification]] = []
    for index in range(6):
        chunks.append((f"listing-{index}", listing))
    for index in range(11):
        chunks.append((f"job-{index}", job_body))

    result = aggregate_chunk_classifications(chunks, min_confidence=0.45)
    assert result.label == DocumentLabel.JOB_POST
    assert result.confidence == 0.67


def test_aggregate_requires_job_post_to_beat_resume_on_winning_chunk():
    ambiguous = DocumentClassification(
        label=DocumentLabel.JOB_POST,
        confidence=0.50,
        scores={
            DocumentLabel.RESUME: 0.49,
            DocumentLabel.JOB_POST: 0.50,
            DocumentLabel.OTHER: 0.01,
        },
    )
    result = aggregate_chunk_classifications(
        [("chunk-1", ambiguous)],
        min_confidence=0.45,
    )
    assert result.label == DocumentLabel.JOB_POST
    assert result.confidence == 0.50

    resume_wins = DocumentClassification(
        label=DocumentLabel.RESUME,
        confidence=0.52,
        scores={
            DocumentLabel.RESUME: 0.52,
            DocumentLabel.JOB_POST: 0.47,
            DocumentLabel.OTHER: 0.01,
        },
    )
    result = aggregate_chunk_classifications(
        [("chunk-1", resume_wins)],
        min_confidence=0.45,
    )
    assert result.label == DocumentLabel.RESUME
