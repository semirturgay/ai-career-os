from typing import Any


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_experience(items: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "title": _as_str(item.get("title")) or "Unknown",
                "company": _as_str(item.get("company")) or "Unknown",
                "duration": _as_str(item.get("duration")),
                "highlights": [
                    str(highlight).strip()
                    for highlight in _as_list(item.get("highlights"))
                    if str(highlight).strip()
                ],
            }
        )
    return normalized


def _normalize_education(items: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "degree": _as_str(item.get("degree")) or "Unknown",
                "school": _as_str(item.get("school")) or "Unknown",
                "duration": _as_str(item.get("duration")),
                "highlights": [
                    str(highlight).strip()
                    for highlight in _as_list(item.get("highlights"))
                    if str(highlight).strip()
                ],
            }
        )
    return normalized


def _normalize_projects(items: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "name": _as_str(item.get("name")) or "Unknown",
                "description": _as_str(item.get("description")),
                "highlights": [
                    str(highlight).strip()
                    for highlight in _as_list(item.get("highlights"))
                    if str(highlight).strip()
                ],
            }
        )
    return normalized


def _merge_skills(data: dict[str, Any]) -> list[str]:
    skill_lists = [
        _as_list(data.get("skills")),
        _as_list(data.get("skills_top")),
        _as_list(data.get("skills_general")),
        _as_list(data.get("top_skills")),
        _as_list(data.get("technical_skills")),
    ]
    merged: list[str] = []
    seen: set[str] = set()
    for skill_list in skill_lists:
        for skill in skill_list:
            text = str(skill).strip()
            if not text:
                continue
            key = text.casefold()
            if key in seen:
                continue
            seen.add(key)
            merged.append(text)
    return merged


def normalize_resume_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Map common model-specific keys onto the ResumeExtraction schema."""
    contact = data.get("contact")
    email = _as_str(data.get("email"))
    phone = _as_str(data.get("phone"))
    if isinstance(contact, dict):
        email = email or _as_str(contact.get("email"))
        phone = phone or _as_str(contact.get("phone"))

    experience = _as_list(data.get("experience"))
    if not experience:
        experience = _normalize_experience(_as_list(data.get("experience_items")))
    else:
        experience = _normalize_experience(experience)

    education = _as_list(data.get("education"))
    if not education:
        education = _normalize_education(_as_list(data.get("education_items")))
    else:
        education = _normalize_education(education)

    projects = _as_list(data.get("projects"))
    if not projects:
        projects = _normalize_projects(_as_list(data.get("projects_items")))
    else:
        projects = _normalize_projects(projects)

    headline = _as_str(data.get("headline"))
    if not headline:
        headline = _as_str(data.get("title")) or _as_str(data.get("professional_headline"))

    return {
        "name": _as_str(data.get("name")) or "Unknown",
        "headline": headline,
        "location": _as_str(data.get("location"))
        or _as_str(data.get("city"))
        or _as_str(data.get("address")),
        "email": email,
        "phone": phone,
        "skills": _merge_skills(data),
        "experience": experience,
        "education": education,
        "projects": projects,
    }
