from __future__ import annotations

import csv
import threading
from pathlib import Path

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

_FIELDNAMES = ("job_text", "result_label", "correct_label")
_write_lock = threading.Lock()
_REPO_ROOT = Path(__file__).resolve().parents[3]


def resolve_classifier_tuning_log_path() -> Path:
    path = Path(settings.document_classifier_tuning_log_path)
    if path.is_absolute():
        return path
    return _REPO_ROOT / path


def ensure_classifier_tuning_log_file() -> Path | None:
    if not settings.document_classifier_tuning_log_enabled:
        return None
    path = resolve_classifier_tuning_log_path()
    with _write_lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.stat().st_size == 0:
            with path.open("a", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=_FIELDNAMES)
                writer.writeheader()
                handle.flush()
    return path


def log_classifier_tuning_log_location() -> None:
    if not settings.document_classifier_tuning_log_enabled:
        logger.info("Classifier tuning log disabled")
        return
    path = ensure_classifier_tuning_log_file()
    logger.info("Classifier tuning log path: %s", path)


def log_classifier_prediction(text: str, result_label: str) -> None:
    if not settings.document_classifier_tuning_log_enabled:
        return

    path = resolve_classifier_tuning_log_path()
    row = {
        "job_text": text,
        "result_label": result_label,
        "correct_label": "",
    }

    try:
        with _write_lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            write_header = not path.exists() or path.stat().st_size == 0
            with path.open("a", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=_FIELDNAMES)
                if write_header:
                    writer.writeheader()
                writer.writerow(row)
                handle.flush()
        logger.info(
            "Classifier tuning log appended label=%s chars=%d path=%s",
            result_label,
            len(text),
            path,
        )
    except OSError as exc:
        logger.warning("Failed to write classifier tuning log to %s: %s", path, exc)
