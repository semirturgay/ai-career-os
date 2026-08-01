from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FeedbackEventType(StrEnum):
    MATCH_HELPFUL = "match_helpful"
    GAP_DISPUTE = "gap_dispute"
    STRENGTH_CONFIRM = "strength_confirm"
    PREFERENCE = "preference"
    APPLICATION_OUTCOME = "application_outcome"


class ApplicationOutcomeStatus(StrEnum):
    SAVED = "saved"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    REJECTED = "rejected"
    OFFER = "offer"
    PASSED = "passed"


class MatchHelpfulPayload(BaseModel):
    helpful: bool


class GapDisputePayload(BaseModel):
    gap_evidence: str = Field(min_length=1, max_length=2000)
    user_note: str | None = Field(default=None, max_length=2000)


class StrengthConfirmPayload(BaseModel):
    strength_evidence: str = Field(min_length=1, max_length=2000)


class PreferencePayload(BaseModel):
    key: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=2000)


class ApplicationOutcomePayload(BaseModel):
    status: ApplicationOutcomeStatus
    note: str | None = Field(default=None, max_length=2000)


PAYLOAD_MODELS: dict[FeedbackEventType, type[BaseModel]] = {
    FeedbackEventType.MATCH_HELPFUL: MatchHelpfulPayload,
    FeedbackEventType.GAP_DISPUTE: GapDisputePayload,
    FeedbackEventType.STRENGTH_CONFIRM: StrengthConfirmPayload,
    FeedbackEventType.PREFERENCE: PreferencePayload,
    FeedbackEventType.APPLICATION_OUTCOME: ApplicationOutcomePayload,
}


def validate_feedback_payload(
    event_type: FeedbackEventType,
    payload: dict[str, Any],
) -> dict[str, Any]:
    model = PAYLOAD_MODELS[event_type]
    return model.model_validate(payload).model_dump(mode="json")


class FeedbackEventCreate(BaseModel):
    profile_id: UUID
    event_type: FeedbackEventType
    job_id: UUID | None = None
    match_analysis_id: UUID | None = None
    payload: dict[str, Any]

    @field_validator("event_type", mode="before")
    @classmethod
    def coerce_event_type(cls, value: object) -> FeedbackEventType:
        if isinstance(value, FeedbackEventType):
            return value
        return FeedbackEventType(str(value))

    @model_validator(mode="after")
    def validate_payload_for_type(self) -> "FeedbackEventCreate":
        self.payload = validate_feedback_payload(self.event_type, self.payload)
        if (
            self.event_type
            in {
                FeedbackEventType.MATCH_HELPFUL,
                FeedbackEventType.GAP_DISPUTE,
                FeedbackEventType.STRENGTH_CONFIRM,
                FeedbackEventType.APPLICATION_OUTCOME,
            }
            and not self.job_id
        ):
            raise ValueError(f"job_id is required for {self.event_type}")
        if (
            self.event_type
            in {
                FeedbackEventType.MATCH_HELPFUL,
                FeedbackEventType.GAP_DISPUTE,
                FeedbackEventType.STRENGTH_CONFIRM,
            }
            and not self.match_analysis_id
        ):
            raise ValueError(f"match_analysis_id is required for {self.event_type}")
        return self


class FeedbackEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    job_id: UUID | None
    match_analysis_id: UUID | None
    event_type: FeedbackEventType | str
    payload: dict[str, Any]
    created_at: datetime
