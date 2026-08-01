from __future__ import annotations

import re

from app.prompts import load_prompt
from app.services.memory.context import format_career_memory_for_prompt

_CAREER_MEMORY_SECTION = re.compile(
    r"\n-{60}\n\nCareer memory \(user corrections and preferences\)\n\n"
    r".*?\n\n\{career_memory\}\n\n-{60}\n",
    re.DOTALL,
)


def build_match_system_prompt(career_memory_block: str) -> str:
    template = load_prompt("match_analysis")
    return template.replace("{career_memory}", career_memory_block.strip())


def build_match_system_prompt_from_memories(memories) -> str:
    template = load_prompt("match_analysis")
    if not memories:
        return _CAREER_MEMORY_SECTION.sub("\n", template)
    return build_match_system_prompt(format_career_memory_for_prompt(memories))
