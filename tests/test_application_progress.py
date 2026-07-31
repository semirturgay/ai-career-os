from app.services.application_progress import (
    APPLICATION_PROGRESS_KEY,
    STEP_COVER_LETTER,
    STEP_RESUME,
    is_application_step_done,
    mark_application_step,
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
