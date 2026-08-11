"""Radar — watched companies and the postings their ATS boards advertise."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AtsProvider = Literal["greenhouse", "lever", "ashby"]
RadarPollInterval = Literal["daily", "3d", "weekly"]
WatchedCompanyStatus = Literal["active", "paused", "unresolved", "error"]
PostingState = Literal["new", "screened", "promoted", "dismissed"]
RemotePreference = Literal["any", "remote", "onsite", "hybrid"]

POLL_INTERVAL_DAYS: dict[str, int] = {"daily": 1, "3d": 3, "weekly": 7}


class WatchCriteria(BaseModel):
    """Cheap, non-LLM filter applied to every posting before screening."""

    titles: list[str] = Field(
        default_factory=list,
        description="Keywords; a posting matches if any appears in its title.",
    )
    locations: list[str] = Field(default_factory=list)
    remote: RemotePreference = "any"
    exclude: list[str] = Field(
        default_factory=list,
        description="Title keywords that disqualify a posting outright.",
    )

    @field_validator("titles", "locations", "exclude", mode="before")
    @classmethod
    def drop_blanks(cls, value: list[str] | None) -> list[str]:
        if not value:
            return []
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]


class ResolveRequest(BaseModel):
    """A company name, or a careers URL pasted straight from the browser."""

    query: str = Field(min_length=1, max_length=500)


class ResolvedBoard(BaseModel):
    """A candidate ATS board — always confirmed by the user before it is saved."""

    name: str
    ats_provider: AtsProvider
    ats_token: str
    board_url: str
    open_role_count: int | None = None
    resolved_via: Literal["url", "probe", "search"]


class WatchedCompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    ats_provider: AtsProvider
    ats_token: str = Field(min_length=1, max_length=255)
    board_url: str | None = Field(default=None, max_length=2048)
    criteria: WatchCriteria = Field(default_factory=WatchCriteria)


class WatchedCompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: Literal["active", "paused"] | None = None
    criteria: WatchCriteria | None = None


class WatchedCompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_id: uuid.UUID
    name: str
    ats_provider: str
    ats_token: str
    board_url: str | None
    criteria: WatchCriteria = Field(default_factory=WatchCriteria)
    status: str
    last_polled_at: datetime | None
    last_error: str | None
    last_viewed_at: datetime | None
    created_at: datetime
    posting_count: int = 0
    new_posting_count: int = 0


class PostingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    watched_company_id: uuid.UUID
    company_name: str = ""
    external_id: str
    url: str | None
    title: str
    location: str | None
    remote_flag: bool
    description: str
    posted_at: datetime | None
    screen_score: int | None
    screen_reason: str | None
    state: str
    job_id: uuid.UUID | None
    first_seen_at: datetime
    last_seen_at: datetime


class PostingTriageResult(BaseModel):
    """Which roles in a numbered batch are worth showing this candidate.

    Indices rather than titles, so the model cannot invent a role that was not on
    the board — the same guard the company-research and screening paths use.
    """

    # Deliberately required, with no default. If it defaulted to [], a malformed or
    # unexpected payload would validate cleanly and silently mean "nothing is relevant"
    # — hiding every job on the board. Absent means broken, so it must raise and let
    # triage_postings fail open.
    relevant_indices: list[int] = Field(
        description="1-based positions of the roles that fit. Empty when none do.",
    )


class PostingScreenResult(BaseModel):
    """LLM structured output for the cheap Tier-1 screen."""

    fit_score: int = Field(ge=0, le=100, description="0-100 fit against the candidate profile.")
    reason: str = Field(
        max_length=280,
        description="One sentence naming the strongest signal for or against.",
    )


class PollResult(BaseModel):
    """Outcome of polling a single watched company."""

    watched_company_id: uuid.UUID
    fetched: int = 0
    dropped_by_triage: int = 0
    new_postings: int = 0
    screened: int = 0
    error: str | None = None


class RadarTargetUpdate(BaseModel):
    target: str | None = Field(default=None, max_length=500)


class RadarTargetRead(BaseModel):
    radar_target: str | None
    cleared_postings: int = 0
    repolled_companies: int = 0


class RadarPollIntervalRead(BaseModel):
    radar_poll_interval: RadarPollInterval


class RadarPollIntervalUpdate(BaseModel):
    radar_poll_interval: RadarPollInterval
