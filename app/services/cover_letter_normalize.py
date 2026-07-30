import re

from app.config import settings

_SENTENCE_END = re.compile(r"[.!?][\"')\]]*(?:\s|$)")


def cover_letter_body_limit() -> int:
    return settings.cover_letter_max_body_chars


def cap_cover_letter_body(body: str, *, max_chars: int | None = None) -> str:
    """Trim overlong bodies without leaving a mid-sentence cliffhanger."""
    limit = cover_letter_body_limit() if max_chars is None else max_chars
    body = body.strip()
    if len(body) <= limit:
        return body

    truncated = body[:limit].rstrip()

    best_end = -1
    for match in _SENTENCE_END.finditer(truncated):
        best_end = match.end()

    if best_end > limit * 0.4:
        return truncated[:best_end].strip()

    if " " in truncated:
        truncated = truncated.rsplit(" ", 1)[0].rstrip(".,;:")
    return truncated


def normalize_cover_letter_draft_payload(payload: dict) -> dict:
    if isinstance(payload.get("body"), str):
        payload = {**payload, "body": cap_cover_letter_body(payload["body"])}
    return payload


def normalize_cover_letter_result_payload(payload: dict) -> dict:
    if isinstance(payload.get("body"), str):
        payload = {**payload, "body": cap_cover_letter_body(payload["body"])}
    return payload
