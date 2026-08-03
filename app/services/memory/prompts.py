from __future__ import annotations

import re

from app.models import CareerMemory
from app.prompts import load_prompt
from app.services.memory.context import format_career_memory_for_prompt

_CAREER_MEMORY_SECTION = re.compile(
    r"\n-{60}\n\nCareer memory \(user corrections and preferences\)\n\n"
    r".*?\n\n\{career_memory\}\n\n-{60}\n",
    re.DOTALL,
)


def build_system_prompt_with_career_memory(
    prompt_name: str,
    memories: list[CareerMemory],
) -> str:
    template = load_prompt(prompt_name)
    if not memories:
        return _CAREER_MEMORY_SECTION.sub("\n", template)
    block = format_career_memory_for_prompt(memories)
    return template.replace("{career_memory}", block.strip())
