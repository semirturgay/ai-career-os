from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models import CareerMemory, FeedbackEvent
from app.services.memory.synthesizer import draft_memory_from_feedback

logger = get_logger(__name__)

MAX_ACTIVE_MEMORIES = 12


async def sync_career_memory_from_feedback(
    db: AsyncSession, event: FeedbackEvent
) -> CareerMemory | None:
    draft = draft_memory_from_feedback(event)
    if not draft:
        return None

    if draft.memory_key:
        await db.execute(
            update(CareerMemory)
            .where(
                CareerMemory.profile_id == event.profile_id,
                CareerMemory.memory_key == draft.memory_key,
                CareerMemory.active.is_(True),
            )
            .values(active=False)
        )

    memory = CareerMemory(
        profile_id=event.profile_id,
        category=draft.category,
        content=draft.content,
        memory_key=draft.memory_key,
        source_feedback_ids=[str(event.id)],
        active=True,
    )
    db.add(memory)
    await db.flush()
    logger.info(
        "Career memory %s synced from feedback %s category=%s profile=%s",
        memory.id,
        event.id,
        memory.category,
        event.profile_id,
    )
    return memory


async def load_active_memories(
    db: AsyncSession | None,
    profile_id: UUID,
    *,
    limit: int = MAX_ACTIVE_MEMORIES,
) -> list[CareerMemory]:
    if db is None:
        return []

    result = await db.execute(
        select(CareerMemory)
        .where(
            CareerMemory.profile_id == profile_id,
            CareerMemory.active.is_(True),
        )
        .order_by(CareerMemory.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


def format_career_memory_for_prompt(memories: list[CareerMemory]) -> str:
    if not memories:
        return ""

    lines = [f"- {memory.content}" for memory in memories]
    return "\n".join(lines)
