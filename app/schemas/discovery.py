from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

DiscoveryRunStatus = Literal["pending", "running", "completed", "failed"]
DiscoveryRemotePreference = Literal["any", "remote", "hybrid", "onsite"]
DiscoveryInterval = Literal["default", "daily", "3d", "weekly"]
DiscoveryDefaultInterval = Literal["daily", "3d", "weekly"]


class DiscoveryCriteria(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    country: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    remote: DiscoveryRemotePreference = "any"
    notes: str | None = Field(default=None, max_length=2000)


class DiscoveryCreate(DiscoveryCriteria):
    interval: DiscoveryInterval = "default"


class DiscoveryUpdate(BaseModel):
    interval: DiscoveryInterval | None = None
    enabled: bool | None = None


class JobDiscoveryCandidateRead(BaseModel):
    id: str
    title: str
    company: str
    url: str
    snippet: str
    source: str | None = None
    fit_score: int | None = None
    fit_reason: str | None = None
    dismissed: bool = False
    first_seen_at: datetime
    last_seen_at: datetime


class JobDiscoveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    criteria: DiscoveryCriteria
    interval: DiscoveryInterval
    enabled: bool
    status: DiscoveryRunStatus
    candidates: list[JobDiscoveryCandidateRead]
    error: str | None
    last_run_at: datetime | None
    next_run_at: datetime | None
    last_viewed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DiscoveryDefaultIntervalRead(BaseModel):
    discovery_default_interval: DiscoveryDefaultInterval


class DiscoveryDefaultIntervalUpdate(BaseModel):
    discovery_default_interval: DiscoveryDefaultInterval


class DiscoveryAgentStep(BaseModel):
    """One step in the bounded job discovery agent loop."""

    action: Literal["search", "synthesize"]
    query: str | None = Field(default=None, max_length=90)
    rationale: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_action_fields(self) -> Self:
        if self.action == "search" and not (self.query and self.query.strip()):
            raise ValueError("query is required when action is search")
        if self.action == "synthesize":
            self.query = None
        return self


class DiscoveryCandidatePick(BaseModel):
    """LLM pick referencing a collected search result by 1-based index."""

    result_index: int = Field(ge=1, le=50)
    company: str = Field(min_length=1, max_length=255)
    fit_score: int | None = Field(default=None, ge=0, le=100)
    fit_reason: str | None = Field(default=None, max_length=500)


class DiscoverySynthesisResult(BaseModel):
    candidates: list[DiscoveryCandidatePick] = Field(default_factory=list, max_length=25)

    @model_validator(mode="after")
    def validate_unique_indices(self) -> Self:
        indices = [item.result_index for item in self.candidates]
        if len(indices) != len(set(indices)):
            raise ValueError("duplicate result_index in discovery candidates")
        return self
