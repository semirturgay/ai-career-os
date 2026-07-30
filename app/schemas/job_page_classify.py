from typing import Literal

from pydantic import BaseModel, Field

PageType = Literal["detail", "list", "careers", "other"]
ClassifyConfidence = Literal["high", "medium", "low"]


class JobPageClassification(BaseModel):
    is_job_post: bool = Field(
        description="True when the page is a single job posting detail view.",
    )
    confidence: ClassifyConfidence
    page_type: PageType = Field(
        description="detail = one job; list = search/results; careers = hub."
    )
    reason: str = Field(min_length=3, max_length=280)


class JobPageClassifyRequest(BaseModel):
    text_sample: str = Field(min_length=50, max_length=4_000)
    url: str | None = Field(default=None, max_length=2048)
    page_title: str | None = Field(default=None, max_length=500)
