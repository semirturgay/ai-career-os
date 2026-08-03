from __future__ import annotations

from app.services.memory.prompts import build_system_prompt_with_career_memory


def build_match_system_prompt(career_memory_block: str) -> str:
    from app.prompts import load_prompt

    template = load_prompt("match_analysis")
    return template.replace("{career_memory}", career_memory_block.strip())


def build_match_system_prompt_from_memories(memories) -> str:
    return build_system_prompt_with_career_memory("match_analysis", memories)
