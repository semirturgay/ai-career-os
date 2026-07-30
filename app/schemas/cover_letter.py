from typing import Literal

from pydantic import BaseModel, Field

# Short application note — models often overshoot; prompts + schema enforce the cap.
COVER_LETTER_MAX_BODY_CHARS = 400


class CoverLetterDraft(BaseModel):
    body: str = Field(
        min_length=1,
        max_length=COVER_LETTER_MAX_BODY_CHARS,
        description=(
            "Complete short cover letter. At most 400 characters total "
            "(spaces and punctuation count). Must end with . ! or ?"
        ),
    )
    tone: Literal["professional", "warm", "concise"] = "professional"
    highlights_used: list[str] = Field(default_factory=list)


class CoverLetterCritique(BaseModel):
    unsupported_claims: list[str] = Field(default_factory=list)
    missing_strengths: list[str] = Field(default_factory=list)
    tone_issues: list[str] = Field(default_factory=list)
    revision_notes: str = Field(min_length=1)


class CoverLetterResult(BaseModel):
    body: str = Field(
        min_length=1,
        max_length=COVER_LETTER_MAX_BODY_CHARS,
        description=(
            "Final short cover letter. At most 400 characters total "
            "(spaces and punctuation count). Must end with . ! or ?"
        ),
    )
    tone: Literal["professional", "warm", "concise"]
    highlights_used: list[str] = Field(default_factory=list)
    critique_summary: str = Field(min_length=1)
