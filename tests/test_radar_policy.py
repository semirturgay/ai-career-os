"""Policy guards for the Radar rewrite.

Radar reads public ATS APIs — endpoints employers publish for syndication. It does
not drive a browser, replay the user's cookies, or maintain per-site scrapers. These
tests make that mechanical, the same way tests/test_extension_extractors.py keeps the
capture path source-agnostic.
"""

import json
import tomllib
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]

BANNED_DEPENDENCIES = ("playwright", "cryptography")


def test_no_browser_automation_dependencies():
    pyproject = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())
    declared = " ".join(pyproject["project"]["dependencies"]).casefold()

    for package in BANNED_DEPENDENCIES:
        assert package not in declared, (
            f"{package} is back in pyproject.toml. Radar reads public ATS JSON APIs; "
            "it must not need a headless browser or a credential store."
        )


def test_extension_does_not_request_cookie_access():
    manifest = json.loads((REPO_ROOT / "extension" / "manifest.json").read_text())

    assert "cookies" not in manifest["permissions"], (
        "The extension must not request the `cookies` permission — exporting the "
        "user's session tokens is exactly what the Radar rewrite removed."
    )

    hosts = " ".join(manifest["host_permissions"]).casefold()
    for site in ("linkedin", "indeed"):
        assert site not in hosts, f"Per-site host permission for {site} should not exist"


def test_background_worker_never_reads_cookies():
    background = (REPO_ROOT / "extension" / "background.js").read_text()

    for banned in ("chrome.cookies", "export-browser-session", "browser-sessions"):
        assert banned not in background, f"{banned!r} should not appear in background.js"


@pytest.mark.parametrize("directory", ["app", "frontend/src"])
def test_no_discovery_modules_survive_the_rename(directory: str):
    """A half-landed rename is how the last one left 424 lines of dead aliases."""
    root = REPO_ROOT / directory
    offenders = [
        path.relative_to(REPO_ROOT).as_posix()
        for path in root.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and ("discover" in path.name.casefold() or "browsersession" in path.name.casefold())
    ]

    assert not offenders, f"Leftover discovery files: {offenders}"


def test_no_imports_of_deleted_packages():
    offenders: list[str] = []
    for path in (REPO_ROOT / "app").rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        text = path.read_text()
        for banned in ("job_discovery", "browser_session"):
            if banned in text:
                offenders.append(f"{path.relative_to(REPO_ROOT)}: {banned}")

    assert not offenders, f"References to deleted packages: {offenders}"


def test_every_eval_suite_is_registered():
    """The README advertises the suite count; the runner must actually run them all."""
    import sys

    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from run_evals import EVAL_SUITES

    on_disk = {path.name for path in (REPO_ROOT / "tests" / "evals").glob("test_*_eval.py")}
    registered = {Path(target).name for target in EVAL_SUITES.values()}

    missing = on_disk - registered
    assert not missing, f"Eval suites exist but are not in EVAL_SUITES: {sorted(missing)}"
