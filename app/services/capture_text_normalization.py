"""Normalize extension-captured job page text before classification."""

from __future__ import annotations

import re

JOB_SECTION_HEADING_RE = re.compile(
    r"^(about the job|job description|description|what you'll do|what you will do|"
    r"what you’ll do|responsibilities|requirements|the role|role overview|"
    r"position overview|about this role|about the role|overview|the opportunity|job summary)$",
    re.IGNORECASE,
)

SECTION_STOP_HEADING_RE = re.compile(
    r"^(similar jobs|people also viewed|more jobs|recommended jobs|set alert|see who|"
    r"candidate|benefits|company|about the company|how you match|tailor|meet the team|"
    r"interview process|job alerts|connect with|posted on|share job|report job|"
    r"more opportunities|startups hiring|featured jobs|people you can reach out to|"
    r"determine your fit|exclusive job seeker insights|see how you compare|meet the hiring team|"
    r"candidate education level|candidate seniority level|candidates who clicked apply|"
    r"the latest hiring trend)$",
    re.IGNORECASE,
)

INLINE_JOB_SECTION_MARKERS = (
    "about the job",
    "job description",
    "what you'll do",
    "what you will do",
    "what you\u2019ll do",
    "responsibilities",
    "requirements",
    "the role",
    "role overview",
    "position overview",
    "about this role",
    "about the role",
    "overview",
    "the opportunity",
    "job summary",
)

INLINE_SECTION_STOP_MARKERS = (
    "similar jobs",
    "people also viewed",
    "more jobs",
    "recommended jobs",
    "set alert",
    "see who you know",
    "how you match",
    "tailor my resume",
    "meet the hiring team",
    "people you can reach out to",
    "determine your fit",
)

SECTION_BREAK_MARKERS = (
    "About the job",
    "Job description",
    "Responsibilities",
    "Requirements",
    "Nice to Have",
    "Similar jobs",
    "People also viewed",
    "Determine your fit",
    "Meet the hiring team",
    "People you can reach out to",
)

UI_LINE_PATTERNS = [
    re.compile(r"^tailor my resume\b", re.I),
    re.compile(r"^create cover letter\b", re.I),
    re.compile(r"^easy apply\b", re.I),
    re.compile(r"^candidate seniority\b", re.I),
    re.compile(r"^determine your fit\b", re.I),
    re.compile(r"^people you can reach out to\b", re.I),
    re.compile(r"^meet the hiring team\b", re.I),
    re.compile(r"^promoted by hirer\b", re.I),
    re.compile(r"^over \d+ people clicked apply\b", re.I),
    re.compile(r"^scanning visible page\b", re.I),
    re.compile(r"^harvesting job details\b", re.I),
    re.compile(r"^pulling text into career os\b", re.I),
    re.compile(r"^structuring fields\b", re.I),
    re.compile(r"^one more step before you proceed\b", re.I),
    re.compile(r"^could not capture this page\b", re.I),
]

PAGE_TITLE_PREFIX_RE = re.compile(r"^Page title:\s*.+(?:\n\n|\n|$)", re.I)


def _split_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def _collapse_whitespace(text: str) -> str:
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def _is_ui_noise_line(line: str) -> bool:
    return any(pattern.search(line) for pattern in UI_LINE_PATTERNS)


def _find_first_marker(text: str, markers: tuple[str, ...]) -> tuple[int, str] | None:
    lowered = text.lower()
    best_idx = -1
    best_marker = ""
    for marker in markers:
        idx = lowered.find(marker)
        if idx != -1 and (best_idx == -1 or idx < best_idx):
            best_idx = idx
            best_marker = text[idx : idx + len(marker)]
    if best_idx == -1:
        return None
    return best_idx, best_marker


def _find_first_stop(text: str, markers: tuple[str, ...]) -> int | None:
    lowered = text.lower()
    best_idx = None
    for marker in markers:
        idx = lowered.find(marker)
        if idx != -1 and (best_idx is None or idx < best_idx):
            best_idx = idx
    return best_idx


def normalize_flattened_job_text(text: str) -> str:
    if len(_split_lines(text)) > 3:
        return text

    result = text
    for marker in SECTION_BREAK_MARKERS:
        lowered = result.lower()
        marker_lower = marker.lower()
        idx = lowered.find(marker_lower)
        while idx != -1:
            if idx > 0 and result[idx - 1] != "\n":
                result = f"{result[:idx]}\n{result[idx:]}"
                idx += 1
            after = idx + len(marker)
            if after < len(result) and result[after] not in {"\n", " "}:
                result = f"{result[:after]}\n{result[after:]}"
            lowered = result.lower()
            idx = lowered.find(marker_lower, after + 1)
    return result


def _extract_job_description_from_lines(text: str) -> str | None:
    lines = _split_lines(text)
    start_idx = next((i for i, line in enumerate(lines) if JOB_SECTION_HEADING_RE.match(line)), -1)
    if start_idx == -1:
        return None

    heading = lines[start_idx].lower()
    skip_prefix = heading in {"about the job", "job description"}
    prefix = []
    if not skip_prefix:
        prefix = [
            lines[i]
            for i in range(max(0, start_idx - 4), start_idx)
            if len(lines[i]) <= 120
            and not _is_ui_noise_line(lines[i])
            and not SECTION_STOP_HEADING_RE.match(lines[i])
        ]
    section = [lines[start_idx]]
    for line in lines[start_idx + 1 :]:
        if SECTION_STOP_HEADING_RE.match(line) or _is_ui_noise_line(line):
            break
        section.append(line)
    return "\n".join([*prefix, *section])


def _extract_job_description_inline(text: str) -> str | None:
    found = _find_first_marker(text, INLINE_JOB_SECTION_MARKERS)
    if not found:
        return None

    start_idx, heading = found
    body = text[start_idx + len(heading) :]
    stop_idx = _find_first_stop(body, INLINE_SECTION_STOP_MARKERS)
    if stop_idx is not None:
        body = body[:stop_idx]
    return _collapse_whitespace(f"{heading}\n{body}".strip())


def extract_job_description_section(text: str) -> str | None:
    normalized = normalize_flattened_job_text(text)
    line_based = _extract_job_description_from_lines(normalized)
    if line_based:
        return line_based
    return _extract_job_description_inline(normalized)


def filter_ui_noise_lines(text: str) -> str:
    return "\n".join(line for line in _split_lines(text) if not _is_ui_noise_line(line))


def preprocess_captured_text(raw_text: str) -> str:
    text = raw_text
    anchored = extract_job_description_section(text)
    if anchored and len(anchored) >= 120:
        text = anchored
    text = filter_ui_noise_lines(text)
    return _collapse_whitespace(text)


def strip_duplicate_page_title(text: str, page_title: str | None) -> str:
    cleaned = PAGE_TITLE_PREFIX_RE.sub("", text.strip(), count=1)
    title = (page_title or "").strip()
    if not title:
        return cleaned.strip()
    if cleaned.startswith(title):
        cleaned = cleaned[len(title) :].lstrip("\n")
    return cleaned.strip()


def prepare_capture_text_for_classification(text: str, *, page_title: str | None = None) -> str:
    text = strip_duplicate_page_title(text, page_title)
    return preprocess_captured_text(text)
