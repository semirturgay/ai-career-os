from __future__ import annotations

from app.schemas.job_capture import JobCaptureClassification


def evaluate_capture_classification(
    result: JobCaptureClassification,
    expected: dict,
    *,
    case_name: str,
) -> list[str]:
    failures: list[str] = []

    if expected.get("expect_page_type") and result.page_type != expected["expect_page_type"]:
        failures.append(
            f"[{case_name}] page_type expected {expected['expect_page_type']!r}, "
            f"got {result.page_type!r}",
        )

    if "expect_capturable" in expected and result.is_capturable != expected["expect_capturable"]:
        failures.append(
            f"[{case_name}] is_capturable expected {expected['expect_capturable']}, "
            f"got {result.is_capturable}",
        )

    needle = expected.get("user_message_contains")
    if needle and needle.lower() not in result.user_message.lower():
        failures.append(
            f"[{case_name}] user_message should contain {needle!r}, got {result.user_message!r}",
        )

    return failures
