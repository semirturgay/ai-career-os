from types import SimpleNamespace

from app.services.memory.prompts import build_system_prompt_with_career_memory


def test_build_system_prompt_strips_career_memory_section_when_empty():
    prompt = build_system_prompt_with_career_memory("resume_optimization", [])
    assert "{career_memory}" not in prompt
    assert "Career memory (user corrections and preferences)" not in prompt


def test_build_system_prompt_injects_career_memory_snippets():
    memories = [
        SimpleNamespace(
            content='User disputes this gap: "Missing AWS". Their note: Globex project',
        )
    ]
    prompt = build_system_prompt_with_career_memory("cover_letter_draft", memories)
    assert "Globex project" in prompt
    assert "Career memory (user corrections and preferences)" in prompt
