from app.services.application_progress import (
    APPLICATION_PROGRESS_KEY,
    STEP_COVER_LETTER,
    STEP_RESUME,
    is_application_step_done,
    mark_application_step,
    mark_resume_applied,
    record_match_remeasurement,
)


def test_mark_application_step_persists_completion():
    metadata = mark_application_step(None, STEP_RESUME)
    assert is_application_step_done(metadata, STEP_RESUME) is True
    assert APPLICATION_PROGRESS_KEY in metadata


def test_mark_application_step_preserves_existing_metadata():
    metadata = mark_application_step({"requirements": ["Python"]}, STEP_COVER_LETTER)
    assert metadata["requirements"] == ["Python"]
    assert is_application_step_done(metadata, STEP_COVER_LETTER) is True


def test_is_application_step_done_false_when_missing():
    assert is_application_step_done(None, STEP_RESUME) is False
    assert is_application_step_done({"application_progress": {}}, STEP_RESUME) is False


def test_mark_resume_applied_records_baseline():
    metadata = mark_resume_applied(
        None,
        analysis_id="analysis-1",
        score=72.5,
        gap_count=3,
        suggestions_count=2,
    )
    resume = metadata[APPLICATION_PROGRESS_KEY][STEP_RESUME]
    assert resume["baseline_score"] == 72.5
    assert resume["baseline_gap_count"] == 3
    assert resume["awaiting_reanalysis"] is True
    assert resume["suggestions_count"] == 2


def test_record_match_remeasurement_stores_delta():
    metadata = mark_resume_applied(
        None,
        analysis_id="analysis-1",
        score=72.0,
        gap_count=3,
        suggestions_count=2,
    )
    updated = record_match_remeasurement(
        metadata,
        analysis_id="analysis-2",
        score=89.0,
        gap_count=1,
    )
    resume = updated[APPLICATION_PROGRESS_KEY][STEP_RESUME]
    assert resume["awaiting_reanalysis"] is False
    assert resume["remeasured_score"] == 89.0
    assert resume["score_delta"] == 17.0
    assert resume["remeasured_gap_count"] == 1


def test_record_match_remeasurement_ignores_baseline_analysis():
    metadata = mark_resume_applied(
        None,
        analysis_id="analysis-1",
        score=72.0,
        gap_count=3,
        suggestions_count=2,
    )
    unchanged = record_match_remeasurement(
        metadata,
        analysis_id="analysis-1",
        score=72.0,
        gap_count=3,
    )
    resume = unchanged[APPLICATION_PROGRESS_KEY][STEP_RESUME]
    assert resume["awaiting_reanalysis"] is True
    assert "score_delta" not in resume
