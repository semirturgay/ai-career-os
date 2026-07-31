"""Unit tests for generic extension page text capture."""

from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures" / "extension"
REPO_ROOT = Path(__file__).resolve().parents[1]


def test_greenhouse_fixture_exists():
    html = (FIXTURES / "greenhouse.html").read_text(encoding="utf-8")
    assert "Senior Backend Engineer" in html
    assert "FinTech Labs" in html


def test_extractors_script_is_provider_agnostic():
    script = (REPO_ROOT / "extension/content/extractors.js").read_text(encoding="utf-8")
    assert "function extractVisiblePageText" in script
    assert "function extractJobPage" in script
    assert "function extractGreenhouse" not in script
    assert "function detectJobSource" not in script
    assert "linkedin.com" not in script.lower()


def test_extractors_prefers_richest_content_root():
    script = (REPO_ROOT / "extension/content/extractors.js").read_text(encoding="utf-8")
    assert "function findContentRoot" in script
    assert "visibleTextLength" in script


def test_extractors_prepends_page_title():
    script = (REPO_ROOT / "extension/content/extractors.js").read_text(encoding="utf-8")
    assert "function prependPageTitle" in script
    assert "Page title:" in script
