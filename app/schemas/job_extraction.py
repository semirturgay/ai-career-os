from typing import Literal

from pydantic import BaseModel, Field

WorkMode = Literal["remote", "hybrid", "on-site", "flexible"]


class JobExtraction(BaseModel):
    """Structured job posting extraction.

    Field order is intentional: metadata (work_mode, location) comes before
    description/requirements so JSON-schema completions emit them before long text.
    """

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
    description: str = Field(min_length=1)
