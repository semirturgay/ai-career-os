from enum import StrEnum

from pydantic import BaseModel, Field


class DocumentLabel(StrEnum):
    RESUME = "resume"
    JOB_POST = "job_post"
    OTHER = "other"


class DocumentClassification(BaseModel):
    label: DocumentLabel
    confidence: float = Field(ge=0.0, le=1.0)
    scores: dict[str, float]
