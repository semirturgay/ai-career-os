from typing import Literal

from pydantic import BaseModel, Field

JobCapturePageType = Literal["job_detail", "job_list", "other"]


class JobCaptureClassification(BaseModel):
    """Document-classifier assessment of browser-captured visible text."""

    page_type: JobCapturePageType = Field(
        description=(
            "job_detail = one posting with description; "
            "job_list = search/results; other = not a job page"
        ),
    )
    is_capturable: bool = Field(
        description=(
            "True when the text is a single job posting with enough detail "
            "to extract title, company, and requirements."
        ),
    )
    user_message: str = Field(
        min_length=1,
        max_length=500,
        description="Short message for the user. When not capturable, explain what to do next.",
    )
    title_hint: str | None = Field(default=None, max_length=500)
    company_hint: str | None = Field(default=None, max_length=255)
