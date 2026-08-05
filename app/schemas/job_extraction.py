from typing import Literal

from pydantic import BaseModel, Field

WorkMode = Literal["remote", "hybrid", "on-site", "flexible"]


class JobExtractionFields(BaseModel):
    """Shared job extraction fields — field order is intentional for JSON-schema completions."""

    title: str = Field(min_length=1, max_length=500)
    company: str = Field(min_length=1, max_length=255)
    work_mode: WorkMode | None = Field(
        default=None,
        description=(
            "Workplace arrangement when stated: remote, hybrid, on-site, or flexible. "
            "Do not infer from skill words in the title."
        ),
    )
    location: str | None = Field(
        default=None,
        max_length=255,
        description=(
            "Geographic place only — city, region, state, country, or hiring region "
            "(e.g. Istanbul, Türkiye). Never Remote/Hybrid/On-site."
        ),
    )
    employment_type: str | None = Field(default=None, max_length=100)
    salary_range: str | None = Field(default=None, max_length=255)
    match_summary: str = Field(
        min_length=10,
        max_length=500,
        description="1–2 sentence summary of the role for fast match screening.",
    )
    requirements: list[str] = Field(default_factory=list)


class JobExtractionLLM(JobExtractionFields):
    """LLM structured output — description is a short teaser only."""

    description: str = Field(
        min_length=1,
        max_length=100,
        description="Brief role teaser — max 100 characters, not the full posting.",
    )


class JobExtraction(JobExtractionFields):
    """Full structured job posting used in API responses and storage."""

    description: str = Field(min_length=1)
