from datetime import UTC, datetime
from uuid import uuid4

from app.models import FeedbackEvent
from app.schemas.feedback import FeedbackEventType
from app.services.memory.synthesizer import draft_memory_from_feedback


def _event(event_type: str, payload: dict, *, job_id=None) -> FeedbackEvent:
    return FeedbackEvent(
        id=uuid4(),
        profile_id=uuid4(),
        job_id=job_id,
        match_analysis_id=None,
        event_type=event_type,
        payload=payload,
        created_at=datetime.now(UTC),
    )


def test_draft_memory_gap_dispute_with_note():
    event = _event(
        FeedbackEventType.GAP_DISPUTE.value,
        {"gap_evidence": "Missing AWS", "user_note": "Used AWS at Globex"},
    )
    draft = draft_memory_from_feedback(event)
    assert draft is not None
    assert draft.category == "correction"
    assert "Missing AWS" in draft.content
    assert "Globex" in draft.content
    assert draft.memory_key.startswith("gap:")


def test_draft_memory_gap_dispute_without_note():
    event = _event(
        FeedbackEventType.GAP_DISPUTE.value,
        {"gap_evidence": "Missing Kubernetes"},
    )
    draft = draft_memory_from_feedback(event)
    assert draft is not None
    assert "resume already covers" in draft.content


def test_draft_memory_strength_confirm():
    event = _event(
        FeedbackEventType.STRENGTH_CONFIRM.value,
        {"strength_evidence": "13+ years backend experience"},
    )
    draft = draft_memory_from_feedback(event)
    assert draft is not None
    assert draft.category == "correction"
    assert "confirmed this strength" in draft.content


def test_draft_memory_preference():
    event = _event(
        FeedbackEventType.PREFERENCE.value,
        {"key": "work_mode", "value": "remote_only", "note": "No relocation"},
    )
    draft = draft_memory_from_feedback(event)
    assert draft is not None
    assert draft.category == "preference"
    assert "work_mode: remote_only" in draft.content
    assert "No relocation" in draft.content


def test_draft_memory_application_outcome():
    job_id = uuid4()
    event = _event(
        FeedbackEventType.APPLICATION_OUTCOME.value,
        {"status": "interviewing", "note": "Phone screen scheduled"},
        job_id=job_id,
    )
    draft = draft_memory_from_feedback(event)
    assert draft is not None
    assert draft.category == "outcome_pattern"
    assert "interviewing" in draft.content
    assert str(job_id) in draft.content


def test_draft_memory_skips_saved_outcome():
    event = _event(
        FeedbackEventType.APPLICATION_OUTCOME.value,
        {"status": "saved"},
    )
    assert draft_memory_from_feedback(event) is None


def test_draft_memory_skips_match_helpful():
    event = _event(FeedbackEventType.MATCH_HELPFUL.value, {"helpful": True})
    assert draft_memory_from_feedback(event) is None


def test_draft_memory_skips_empty_payload():
    event = _event(FeedbackEventType.GAP_DISPUTE.value, {})
    assert draft_memory_from_feedback(event) is None
