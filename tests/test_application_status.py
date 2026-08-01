from app.schemas.feedback import (
    ApplicationOutcomeStatus,
    FeedbackEventType,
    validate_feedback_payload,
)


def test_application_outcome_saved_status():
    payload = validate_feedback_payload(
        FeedbackEventType.APPLICATION_OUTCOME,
        {"status": ApplicationOutcomeStatus.SAVED},
    )
    assert payload["status"] == "saved"


def test_application_outcome_with_note():
    payload = validate_feedback_payload(
        FeedbackEventType.APPLICATION_OUTCOME,
        {
            "status": ApplicationOutcomeStatus.INTERVIEWING,
            "note": "Phone screen scheduled for Tuesday",
        },
    )
    assert payload["note"] == "Phone screen scheduled for Tuesday"
