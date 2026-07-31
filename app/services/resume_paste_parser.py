"""Normalize pasted resume text (plain or copied HTML). No network access."""

from app.services.job_paste_parser import JobPasteParseError, prepare_job_post_text

ResumePasteParseError = JobPasteParseError


def prepare_resume_text(raw: str) -> str:
    return prepare_job_post_text(raw)
