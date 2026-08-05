from typing import Any

WORK_MODE_LABELS: dict[str, str] = {
    "remote": "Remote",
    "hybrid": "Hybrid",
    "on-site": "On-site",
    "onsite": "On-site",
    "on_site": "On-site",
    "in-office": "On-site",
    "in office": "On-site",
    "office-based": "On-site",
    "flexible": "Flexible",
    "wfh": "Remote",
    "work from home": "Remote",
    "fully remote": "Remote",
    "distributed": "Remote",
}

WORK_MODE_CANONICAL: dict[str, str] = {
    "remote": "remote",
    "hybrid": "hybrid",
    "on-site": "on-site",
    "onsite": "on-site",
    "on_site": "on-site",
    "in-office": "on-site",
    "in office": "on-site",
    "office-based": "on-site",
    "office based": "on-site",
    "flexible": "flexible",
    "wfh": "remote",
    "work from home": "remote",
    "fully remote": "remote",
    "distributed": "remote",
    "partially remote": "hybrid",
    "mix of remote and office": "hybrid",
}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_requirements(items: list[Any]) -> list[str]:
    requirements: list[str] = []
    seen: set[str] = set()
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        requirements.append(text)
    return requirements


def _canonical_work_mode(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().casefold()
    return WORK_MODE_CANONICAL.get(text)


def _work_mode_label(mode: str | None) -> str | None:
    if not mode:
        return None
    return WORK_MODE_LABELS.get(mode, mode.replace("-", " ").title())


def _is_work_mode_only(text: str) -> bool:
    return text.casefold() in WORK_MODE_CANONICAL or text.casefold() in WORK_MODE_LABELS


def _extract_work_mode(data: dict[str, Any]) -> str | None:
    for key in ("work_mode", "workplace_type", "workplace", "remote_policy", "location_type"):
        mode = _canonical_work_mode(data.get(key))
        if mode:
            return mode

    for key in ("location", "job_location", "office_location"):
        raw = _as_str(data.get(key))
        if raw and _is_work_mode_only(raw):
            return _canonical_work_mode(raw)

    return None


def _extract_geographic_location(data: dict[str, Any]) -> str | None:
    for key in (
        "location",
        "job_location",
        "office_location",
        "city",
        "workplace_location",
        "region",
    ):
        raw = _as_str(data.get(key))
        if raw and not _is_work_mode_only(raw):
            return raw
    return None


def _build_display_location(work_mode: str | None, geographic: str | None) -> str | None:
    mode_label = _work_mode_label(work_mode)
    if mode_label and geographic:
        return f"{mode_label} · {geographic}"
    if mode_label:
        return mode_label
    return geographic


def normalize_job_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Map common model-specific keys onto the JobExtraction schema."""
    requirements = _normalize_requirements(_as_list(data.get("requirements")))
    if not requirements:
        requirements = _normalize_requirements(
            _as_list(data.get("qualifications")) + _as_list(data.get("required_skills"))
        )

    description = _as_str(data.get("description"))
    if not description:
        parts = [
            _as_str(data.get("role_summary")),
            _as_str(data.get("responsibilities")),
            _as_str(data.get("qualifications_text")),
        ]
        description = "\n\n".join(part for part in parts if part)
    if description and len(description) > 100:
        description = description[:100].rstrip()

    work_mode = _extract_work_mode(data)
    geographic = _extract_geographic_location(data)
    display_location = _build_display_location(work_mode, geographic)
    description_text = description or "No description extracted."

    match_summary = (
        _as_str(data.get("match_summary"))
        or _as_str(data.get("role_summary"))
        or _as_str(data.get("summary"))
    )
    if not match_summary:
        trimmed = description_text.strip()
        match_summary = trimmed[:200] if trimmed else "Role summary not extracted."

    return {
        "title": _as_str(data.get("title")) or _as_str(data.get("job_title")) or "Unknown",
        "company": _as_str(data.get("company")) or _as_str(data.get("company_name")) or "Unknown",
        "description": description_text,
        "match_summary": match_summary,
        "work_mode": work_mode,
        "location": display_location,
        "employment_type": _as_str(data.get("employment_type")) or _as_str(data.get("job_type")),
        "salary_range": _as_str(data.get("salary_range")) or _as_str(data.get("compensation")),
        "requirements": requirements,
    }
