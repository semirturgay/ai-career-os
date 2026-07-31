from typing import Literal

from pydantic import BaseModel, Field


class ResumeSuggestion(BaseModel):
    gap_evidence: str = Field(min_length=1)
    section: Literal["headline", "skills", "experience", "projects"]
    action: Literal["rewrite", "add", "emphasize"]
    target_label: str = Field(min_length=1)
    current_text: str | None = None
    suggested_text: str = Field(min_length=1)
    rationale: str = Field(min_length=1)


class ResumeOptimizationResult(BaseModel):
    summary: str = Field(min_length=1)
    suggestions: list[ResumeSuggestion] = Field(default_factory=list)


class ApplyResumeSuggestionsRequest(BaseModel):
    suggestions: list[ResumeSuggestion] = Field(min_length=1)
    job_id: str | None = None
    match_analysis_id: str | None = None
