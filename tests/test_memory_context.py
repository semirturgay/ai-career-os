from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.models import CareerMemory, FeedbackEvent
from app.services.match.prompts import build_match_system_prompt_from_memories
from app.services.memory.context import (
    format_career_memory_for_prompt,
    sync_career_memory_from_feedback,
)


def test_format_career_memory_for_prompt_empty():
    assert format_career_memory_for_prompt([]) == ""


def test_format_career_memory_for_prompt_joins_lines():
    memory = CareerMemory(
        id=uuid4(),
        profile_id=uuid4(),
        category="preference",
        content="Career preference — work_mode: remote_only.",
        memory_key="pref:abc",
        source_feedback_ids=[],
        active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    text = format_career_memory_for_prompt([memory])
    assert text == "- Career preference — work_mode: remote_only."


def test_build_match_system_prompt_omits_section_without_memories():
    prompt = build_match_system_prompt_from_memories([])
    assert "{career_memory}" not in prompt
    assert "Career memory" not in prompt


def test_build_match_system_prompt_injects_memories():
    memory = CareerMemory(
        id=uuid4(),
        profile_id=uuid4(),
        category="correction",
        content='User disputes this gap: "Missing AWS". Their note: Globex project',
        memory_key="gap:abc",
        source_feedback_ids=[],
        active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    prompt = build_match_system_prompt_from_memories([memory])
    assert "Career memory (user corrections and preferences)" in prompt
    assert "Globex project" in prompt
    assert "{career_memory}" not in prompt


@pytest.mark.asyncio
async def test_sync_career_memory_from_feedback_creates_row():
    profile_id = uuid4()
    event_id = uuid4()
    event = FeedbackEvent(
        id=event_id,
        profile_id=profile_id,
        job_id=None,
        match_analysis_id=None,
        event_type="preference",
        payload={"key": "work_mode", "value": "remote_only"},
        created_at=datetime.now(UTC),
    )

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=Mock())

    memory = await sync_career_memory_from_feedback(mock_db, event)

    assert memory is not None
    assert memory.profile_id == profile_id
    assert memory.category == "preference"
    assert memory.active is True
    assert memory.source_feedback_ids == [str(event_id)]
    mock_db.add.assert_called_once()
    mock_db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_career_memory_skips_non_synthesizable_event():
    event = FeedbackEvent(
        id=uuid4(),
        profile_id=uuid4(),
        job_id=None,
        match_analysis_id=None,
        event_type="match_helpful",
        payload={"helpful": True},
        created_at=datetime.now(UTC),
    )
    mock_db = AsyncMock()
    result = await sync_career_memory_from_feedback(mock_db, event)
    assert result is None
    mock_db.add.assert_not_called()
