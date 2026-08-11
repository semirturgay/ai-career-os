"""ATS source parsing, driven by recorded board payloads.

Every provider must normalize to the same RawPosting shape, drop rows it cannot
use, and never let a malformed entry take out the whole board.
"""

import json
from pathlib import Path

import pytest

from app.services.radar.sources import get_source, supported_providers
from app.services.radar.sources.ashby import AshbySource
from app.services.radar.sources.greenhouse import GreenhouseSource
from app.services.radar.sources.lever import LeverSource

FIXTURES = Path(__file__).parent / "fixtures" / "ats"


def load_fixture(name: str):
    return json.loads((FIXTURES / f"{name}.json").read_text())


def patch_fetch(monkeypatch, module_path: str, payload):
    async def fake_fetch_json(**_kwargs):
        return payload

    monkeypatch.setattr(f"{module_path}.fetch_json", fake_fetch_json)


# --- Greenhouse ---------------------------------------------------------------


async def test_greenhouse_fetch_parses_postings(monkeypatch):
    patch_fetch(
        monkeypatch,
        "app.services.radar.sources.greenhouse",
        load_fixture("greenhouse"),
    )

    postings = await GreenhouseSource().fetch("fintechlabs")

    # The third fixture row has empty content and must be dropped.
    assert len(postings) == 2

    first = postings[0]
    assert first.external_id == "4012345"
    assert first.title == "Senior Backend Engineer"
    assert first.location == "Remote - United States"
    assert first.remote_flag is True
    assert first.url == "https://job-boards.greenhouse.io/fintechlabs/jobs/4012345"
    assert first.posted_at is not None


async def test_greenhouse_unescapes_double_encoded_html(monkeypatch):
    """Greenhouse returns HTML-escaped HTML — no tags or entities may survive."""
    patch_fetch(
        monkeypatch,
        "app.services.radar.sources.greenhouse",
        load_fixture("greenhouse"),
    )

    postings = await GreenhouseSource().fetch("fintechlabs")
    description = postings[0].description

    assert "5+ years with Python" in description
    assert "FastAPI" in description
    assert "&lt;" not in description
    assert "<p>" not in description


def test_greenhouse_description_excluded_from_raw_payload(monkeypatch):
    job = load_fixture("greenhouse")["jobs"][0]
    from app.services.radar.sources.greenhouse import _to_posting

    posting = _to_posting(job)

    assert posting is not None
    assert "content" not in posting.raw_payload
    assert posting.raw_payload["departments"][0]["name"] == "Engineering"


# --- Lever --------------------------------------------------------------------


async def test_lever_joins_description_lists_and_additional(monkeypatch):
    patch_fetch(monkeypatch, "app.services.radar.sources.lever", load_fixture("lever"))

    postings = await LeverSource().fetch("northwind")
    assert len(postings) == 2

    staff = postings[0]
    assert staff.title == "Staff Frontend Engineer"
    assert staff.location == "Berlin, Germany"
    assert staff.remote_flag is False
    # Lever splits a posting across three fields; all three must be present.
    assert "next generation of our design system" in staff.description
    assert "Lead frontend architecture" in staff.description
    assert "7+ years with React" in staff.description
    assert "relocation support" in staff.description
    assert "<ul>" not in staff.description


async def test_lever_marks_remote_from_workplace_type(monkeypatch):
    patch_fetch(monkeypatch, "app.services.radar.sources.lever", load_fixture("lever"))

    postings = await LeverSource().fetch("northwind")
    sre = postings[1]

    assert sre.remote_flag is True
    assert "Keep our platform online" in sre.description


# --- Ashby --------------------------------------------------------------------


async def test_ashby_prefers_plain_description(monkeypatch):
    patch_fetch(monkeypatch, "app.services.radar.sources.ashby", load_fixture("ashby"))

    postings = await AshbySource().fetch("orbital")
    assert len(postings) == 2

    ml = postings[0]
    assert ml.title == "Machine Learning Engineer"
    assert ml.remote_flag is False
    assert "own evaluation end to end" in ml.description


async def test_ashby_falls_back_to_html_description(monkeypatch):
    patch_fetch(monkeypatch, "app.services.radar.sources.ashby", load_fixture("ashby"))

    postings = await AshbySource().fetch("orbital")
    writer = postings[1]

    assert writer.remote_flag is True
    assert "developer documentation" in writer.description
    assert "3+ years writing for engineers" in writer.description
    assert "<ul>" not in writer.description


# --- URL matching -------------------------------------------------------------


@pytest.mark.parametrize(
    ("url", "provider", "token"),
    [
        ("https://boards.greenhouse.io/anthropic", "greenhouse", "anthropic"),
        ("https://job-boards.greenhouse.io/acme-labs/jobs/123", "greenhouse", "acme-labs"),
        ("https://jobs.lever.co/northwind", "lever", "northwind"),
        ("https://jobs.lever.co/northwind/abc-def", "lever", "northwind"),
        ("https://jobs.ashbyhq.com/orbital", "ashby", "orbital"),
    ],
)
def test_matches_url_extracts_board_token(url, provider, token):
    source = get_source(provider)
    assert source.matches_url(url) == token


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/careers",
        "https://www.linkedin.com/jobs/view/12345",
        "https://indeed.com/viewjob?jk=abc",
    ],
)
def test_matches_url_rejects_non_ats_urls(url):
    for provider in supported_providers():
        assert get_source(provider).matches_url(url) is None


def test_get_source_rejects_unknown_provider():
    with pytest.raises(KeyError):
        get_source("workday")
