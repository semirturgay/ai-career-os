from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.feedback import (
    ApplicationOutcomeStatus,
    FeedbackEventCreate,
    FeedbackEventType,
    validate_feedback_payload,
)


def test_match_helpful_payload_validates():
    payload = validate_feedback_payload(FeedbackEventType.MATCH_HELPFUL, {"helpful": True})
    assert payload == {"helpful": True}


def test_gap_dispute_payload_requires_evidence():
    with pytest.raises(ValidationError):
        validate_feedback_payload(FeedbackEventType.GAP_DISPUTE, {"user_note": "I have AWS"})


def test_feedback_create_requires_job_and_analysis_for_gap_dispute():
    with pytest.raises(ValidationError, match="job_id is required"):
        FeedbackEventCreate(
            profile_id=uuid4(),
            event_type=FeedbackEventType.GAP_DISPUTE,
            match_analysis_id=uuid4(),
            payload={"gap_evidence": "Missing AWS", "user_note": "Listed in Globex project"},
        )


def test_feedback_create_gap_dispute_ok():
    event = FeedbackEventCreate(
        profile_id=uuid4(),
        job_id=uuid4(),
        match_analysis_id=uuid4(),
        event_type=FeedbackEventType.GAP_DISPUTE,
        payload={"gap_evidence": "Missing AWS", "user_note": "Listed in Globex project"},
    )
    assert event.payload["user_note"] == "Listed in Globex project"


def test_preference_does_not_require_job():
    event = FeedbackEventCreate(
        profile_id=uuid4(),
        event_type=FeedbackEventType.PREFERENCE,
        payload={"key": "work_mode", "value": "remote_only", "note": "No relocation"},
    )
    assert event.job_id is None


def test_application_outcome_payload():
    event = FeedbackEventCreate(
        profile_id=uuid4(),
        job_id=uuid4(),
        event_type=FeedbackEventType.APPLICATION_OUTCOME,
        payload={"status": ApplicationOutcomeStatus.APPLIED, "note": "Submitted via careers page"},
    )
    assert event.payload["status"] == "applied"
