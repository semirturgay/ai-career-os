from __future__ import annotations

import re

from app.schemas.company_research import SearchResult

JOB_URL_PATTERN = re.compile(
    r"(greenhouse\.io|lever\.co|ashbyhq\.com|workday|smartrecruiters|"
    r"linkedin\.com/jobs|indeed\.|wellfound|otta\.com|"
    r"/jobs/|/job/|/careers/|/career/|jobs\.|careers\.)",
    re.I,
)

JOB_TEXT_PATTERN = re.compile(
    r"\b(hiring|job opening|open role|apply now|software engineer|developer|backend|frontend)\b",
    re.I,
)

SPAM_HOST_FRAGMENTS = (
    "wikipedia.org",
    "godirect.co.uk",
    "moneyfacts",
    "immaculateconfections",
    "facebook.com",
    "youtube.com",
    "reddit.com/r/",
)


def is_likely_job_listing(result: SearchResult) -> bool:
    url = result.url.casefold()
    if any(fragment in url for fragment in SPAM_HOST_FRAGMENTS):
        return False

    if JOB_URL_PATTERN.search(result.url):
        return True

    blob = f"{result.title} {result.snippet}"
    return bool(JOB_TEXT_PATTERN.search(blob))


def filter_job_listings(results: list[SearchResult]) -> list[SearchResult]:
    filtered = [item for item in results if is_likely_job_listing(item)]
    # If everything was filtered out, keep originals — LLM synthesis can still try.
    return filtered if filtered else results
