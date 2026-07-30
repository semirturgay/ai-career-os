"""Tests for job URL normalization."""

from app.services.job_url import normalize_job_url


def test_linkedin_path_canonicalized():
    url = "https://www.linkedin.com/jobs/view/1234567890/?refId=abc"
    assert normalize_job_url(url) == "https://www.linkedin.com/jobs/view/1234567890/"


def test_linkedin_query_job_id_canonicalized():
    url = "https://www.linkedin.com/jobs/search/?currentJobId=9876543210"
    assert normalize_job_url(url) == "https://www.linkedin.com/jobs/view/9876543210/"


def test_strips_tracking_params():
    url = "https://boards.greenhouse.io/acme/jobs/123?utm_source=linkedin&ref=home"
    assert normalize_job_url(url) == "https://boards.greenhouse.io/acme/jobs/123"


def test_trailing_slash_removed():
    assert (
        normalize_job_url("https://jobs.lever.co/acme/uuid-123/")
        == "https://jobs.lever.co/acme/uuid-123"
    )


def test_empty_url_returns_none():
    assert normalize_job_url(None) is None
    assert normalize_job_url("   ") is None
