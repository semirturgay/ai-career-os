"""Unit tests for extension page extractors (loaded as plain JS)."""

from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures" / "extension"
REPO_ROOT = Path(__file__).resolve().parents[1]


def test_greenhouse_fixture_exists():
    html = (FIXTURES / "greenhouse.html").read_text(encoding="utf-8")
    assert "Senior Backend Engineer" in html
    assert "FinTech Labs" in html


def test_extractors_script_defines_detect_job_source():
    script = (REPO_ROOT / "extension/content/extractors.js").read_text(encoding="utf-8")
    assert "function detectJobSource" in script
    assert "function extractJobPage" in script
    assert 'source === "greenhouse"' in script
    assert "function extractLinkedIn" in script
    assert "function resolveCaptureUrl" in script
