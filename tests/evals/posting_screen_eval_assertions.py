from __future__ import annotations

from typing import Any

from app.schemas.radar import PostingScreenResult

PLACEHOLDER_REASONS = {
    "good match",
    "good fit",
    "not a fit",
    "no",
    "yes",
    "n/a",
    "maybe",
}


def evaluate_posting_screen(
    result: PostingScreenResult,
    expected: dict[str, Any],
    *,
    case_name: str,
) -> list[str]:
    failures: list[str] = []

    min_score = expected.get("min_score")
    if min_score is not None and result.fit_score < min_score:
        failures.append(f"[{case_name}] expected fit_score >= {min_score}, got {result.fit_score}")

    max_score = expected.get("max_score")
    if max_score is not None and result.fit_score > max_score:
        failures.append(f"[{case_name}] expected fit_score <= {max_score}, got {result.fit_score}")

    reason = result.reason.strip()
    if not reason:
        failures.append(f"[{case_name}] reason is empty")

    if reason.casefold().rstrip(".") in PLACEHOLDER_REASONS:
        failures.append(
            f"[{case_name}] reason {reason!r} is a placeholder — it must name a concrete signal"
        )

    reason_max = expected.get("reason_max_chars")
    if reason_max is not None and len(reason) > reason_max:
        failures.append(f"[{case_name}] reason is {len(reason)} chars, expected <= {reason_max}")

    lowered = reason.casefold()
    for term in expected.get("must_include_reason_terms", []):
        if term.casefold() not in lowered:
            failures.append(f"[{case_name}] expected reason to reference {term!r}")

    return failures
