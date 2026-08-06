from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from app.db.session import async_session
from app.logging_config import get_logger
from app.models import JobDiscovery, Profile
from app.schemas.discovery import DiscoveryCriteria
from app.services.job_discovery.agent import discover_job_candidates
from app.services.job_discovery.candidates import known_urls_from_existing, merge_candidates
from app.services.job_discovery.intervals import compute_next_run_at
from app.services.llm.base import LLMConfigurationError, LLMError
from app.services.search.base import SearchError
from app.services.settings_service import get_discovery_default_interval

logger = get_logger(__name__)

SCHEDULER_POLL_SECONDS = 60


async def run_discovery(discovery_id: UUID) -> None:
    async with async_session() as db:
        discovery = await db.get(JobDiscovery, discovery_id)
        if not discovery:
            return

        if discovery.status == "running":
            logger.info("Discovery %s already running — skipping", discovery_id)
            return

        profile = await db.get(Profile, discovery.profile_id)
        if not profile:
            discovery.status = "failed"
            discovery.error = "Profile not found"
            await db.commit()
            return

        discovery.status = "running"
        discovery.error = None
        await db.commit()

    async with async_session() as db:
        discovery = await db.get(JobDiscovery, discovery_id)
        profile = await db.get(Profile, discovery.profile_id) if discovery else None
        if not discovery or not profile:
            return

        try:
            criteria = DiscoveryCriteria.model_validate(discovery.criteria)
            existing_urls = known_urls_from_existing(discovery.candidates or [])
            incoming = await discover_job_candidates(
                db,
                profile,
                criteria,
                existing_urls=existing_urls,
            )
            completed_at = datetime.now(UTC)
            discovery.candidates = merge_candidates(discovery.candidates or [], incoming)
            discovery.status = "completed"
            discovery.error = None
            discovery.last_run_at = completed_at
            default_interval = await get_discovery_default_interval(db)
            discovery.next_run_at = (
                compute_next_run_at(
                    interval=discovery.interval,  # type: ignore[arg-type]
                    default_interval=default_interval,  # type: ignore[arg-type]
                    from_time=completed_at,
                )
                if discovery.enabled
                else None
            )
            logger.info(
                "Discovery completed: id=%s profile=%s new_candidates=%s total=%s",
                discovery_id,
                profile.id,
                len(incoming),
                len(discovery.candidates or []),
            )
        except (LLMConfigurationError, LLMError, SearchError) as exc:
            discovery.status = "failed"
            discovery.error = str(exc)
            logger.warning("Discovery failed for %s: %s", discovery_id, exc)
        except Exception as exc:
            discovery.status = "failed"
            discovery.error = str(exc)
            logger.exception("Unexpected discovery failure for %s", discovery_id)

        await db.commit()


async def queue_due_discoveries() -> None:
    now = datetime.now(UTC)
    async with async_session() as db:
        result = await db.execute(
            select(JobDiscovery.id).where(
                JobDiscovery.enabled.is_(True),
                JobDiscovery.status != "running",
                JobDiscovery.next_run_at.is_not(None),
                JobDiscovery.next_run_at <= now,
            )
        )
        due_ids = list(result.scalars())

    for discovery_id in due_ids:
        asyncio.create_task(run_discovery(discovery_id))
        logger.info("Queued due discovery %s", discovery_id)


async def discovery_scheduler_loop() -> None:
    while True:
        try:
            await queue_due_discoveries()
        except Exception:
            logger.exception("Discovery scheduler tick failed")
        await asyncio.sleep(SCHEDULER_POLL_SECONDS)
