"""Radar scheduler — polls watched companies' ATS boards on an interval.

Deliberately in-process: for a single-user local app a queue would be more
machinery than the problem needs. What it *does* need, and the previous discovery
scheduler lacked, is four things:

* rows claimed with ``FOR UPDATE SKIP LOCKED`` so a manual poll cannot race the tick
* task references retained, so in-flight polls are not garbage collected
* a concurrency cap
* a reaper, so a process restart mid-poll does not wedge a company forever
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import async_session
from app.logging_config import get_logger
from app.models import Posting, Profile, WatchedCompany
from app.schemas.radar import POLL_INTERVAL_DAYS, PollResult, WatchCriteria
from app.services.llm import get_llm_client
from app.services.llm.base import LLMConfigurationError, LLMError
from app.services.radar.screener import matches_criteria, screen_postings
from app.services.radar.sources import AtsBoardNotFoundError, AtsError, get_source
from app.services.radar.sources.base import RawPosting
from app.services.radar.triage import triage_postings
from app.services.settings_service import get_radar_poll_interval

logger = get_logger(__name__)

SCHEDULER_POLL_SECONDS = 60

# Retained so in-flight polls are not garbage collected mid-run.
_running_tasks: set[asyncio.Task] = set()
_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(settings.radar_max_concurrent_polls)
    return _semaphore


def _criteria_of(company: WatchedCompany) -> WatchCriteria:
    try:
        return WatchCriteria.model_validate(company.criteria or {})
    except ValueError:
        return WatchCriteria()


async def claim_company(db: AsyncSession, company_id: UUID) -> WatchedCompany | None:
    """Take an exclusive claim on a company, or return None if someone else has it."""
    now = datetime.now(UTC)
    stale_before = now - timedelta(minutes=settings.radar_stale_claim_minutes)

    result = await db.execute(
        select(WatchedCompany)
        .where(WatchedCompany.id == company_id)
        .with_for_update(skip_locked=True)
    )
    company = result.scalar_one_or_none()
    if company is None:
        return None

    claimed_at = company.polling_started_at
    if claimed_at is not None:
        if claimed_at.tzinfo is None:
            claimed_at = claimed_at.replace(tzinfo=UTC)
        if claimed_at > stale_before:
            return None
        logger.info("Reclaiming stale Radar poll for company %s", company_id)

    company.polling_started_at = now
    await db.commit()
    return company


async def poll_company(company_id: UUID) -> PollResult:
    """Fetch a board, store new postings, screen them. Errors stay on the row."""
    async with _get_semaphore():
        async with async_session() as db:
            company = await claim_company(db, company_id)
            if company is None:
                return PollResult(watched_company_id=company_id, error="already running")

            profile = await db.get(Profile, company.profile_id)
            if profile is None:
                company.status = "error"
                company.last_error = "Profile not found"
                company.polling_started_at = None
                await db.commit()
                return PollResult(watched_company_id=company_id, error="Profile not found")

            result = PollResult(watched_company_id=company_id)
            try:
                fetched = await _fetch_board(company)
                result.fetched = len(fetched)

                criteria = _criteria_of(company)
                eligible = [item for item in fetched if matches_criteria(item, criteria)]

                # Triage costs an LLM call, so only ever run it on postings we have not
                # seen — anything already stored was triaged on an earlier poll. In the
                # steady state a board returns nothing new and this costs nothing.
                known_ids = await _known_external_ids(db, company)
                unseen = [item for item in eligible if item.external_id not in known_ids]
                relevant = await _triage(db, profile, unseen) if unseen else []
                result.dropped_by_triage = len(unseen) - len(relevant)

                # Known postings still go through so their last_seen_at is refreshed.
                to_store = [item for item in eligible if item.external_id in known_ids] + relevant
                fresh = await _store_postings(db, company, to_store)
                result.new_postings = len(fresh)

                # Commit the fetch before screening. Screening is the slow, failure-prone
                # part; a provider that times out must not cost us the postings we already
                # have. Anything left unscored stays `new` and is retried next poll.
                await db.commit()

                # Screen every unscored posting, not just this poll's arrivals — otherwise
                # postings stranded by an earlier provider outage would never be scored.
                pending = await _unscreened_postings(db, company)
                if pending:
                    result.screened = await _screen(db, profile, pending)

                company.status = "active"
                company.last_error = None
            except AtsBoardNotFoundError as exc:
                company.status = "unresolved"
                company.last_error = (
                    "That board no longer exists. Re-add the company with its careers URL."
                )
                result.error = str(exc)
                logger.info("Radar board vanished for company %s: %s", company_id, exc)
            except AtsError as exc:
                company.status = "error"
                company.last_error = str(exc)
                result.error = str(exc)
                logger.warning("Radar poll failed for company %s: %s", company_id, exc)
            except Exception as exc:
                company.status = "error"
                company.last_error = str(exc)
                result.error = str(exc)
                logger.exception("Unexpected Radar poll failure for company %s", company_id)

            company.last_polled_at = datetime.now(UTC)
            company.polling_started_at = None
            await db.commit()

            logger.info(
                "Radar poll done: company=%s fetched=%s off_target=%s new=%s screened=%s",
                company_id,
                result.fetched,
                result.dropped_by_triage,
                result.new_postings,
                result.screened,
            )
            return result


async def _fetch_board(company: WatchedCompany) -> list[RawPosting]:
    source = get_source(company.ats_provider)
    return await source.fetch(company.ats_token)


async def _store_postings(
    db: AsyncSession,
    company: WatchedCompany,
    incoming: list[RawPosting],
) -> list[Posting]:
    """Upsert on (company, external_id). Returns only the genuinely new rows."""
    if not incoming:
        return []

    existing_rows = await db.execute(
        select(Posting).where(Posting.watched_company_id == company.id)
    )
    by_external_id = {row.external_id: row for row in existing_rows.scalars()}

    now = datetime.now(UTC)
    fresh: list[Posting] = []

    for item in incoming:
        prior = by_external_id.get(item.external_id)
        if prior is not None:
            prior.last_seen_at = now
            prior.title = item.title
            prior.location = item.location
            prior.url = item.url or prior.url
            continue

        posting = Posting(
            watched_company_id=company.id,
            profile_id=company.profile_id,
            external_id=item.external_id,
            url=item.url,
            title=item.title,
            location=item.location,
            remote_flag=item.remote_flag,
            description=item.description,
            posted_at=item.posted_at,
            raw_payload=item.raw_payload or None,
            state="new",
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(posting)
        fresh.append(posting)

    await db.flush()
    return fresh


async def _known_external_ids(db: AsyncSession, company: WatchedCompany) -> set[str]:
    result = await db.execute(
        select(Posting.external_id).where(Posting.watched_company_id == company.id)
    )
    return set(result.scalars())


async def _triage(db: AsyncSession, profile: Profile, unseen: list[RawPosting]) -> list[RawPosting]:
    """Semantic discipline filter. Passes everything through if the LLM is unavailable."""
    try:
        llm = await get_llm_client(db)
    except (LLMConfigurationError, LLMError) as exc:
        logger.info("Triage skipped — LLM unavailable, keeping all %s: %s", len(unseen), exc)
        return unseen
    return await triage_postings(llm, profile, unseen)


async def _unscreened_postings(db: AsyncSession, company: WatchedCompany) -> list[Posting]:
    """Postings for this company that still have no score, oldest first."""
    result = await db.execute(
        select(Posting)
        .where(
            Posting.watched_company_id == company.id,
            Posting.state == "new",
        )
        .order_by(Posting.first_seen_at.asc())
    )
    return list(result.scalars())


async def _screen(db: AsyncSession, profile: Profile, postings: list[Posting]) -> int:
    try:
        llm = await get_llm_client(db)
    except (LLMConfigurationError, LLMError) as exc:
        logger.info("Radar screening skipped — LLM unavailable: %s", exc)
        return 0
    return await screen_postings(llm, profile, postings)


def spawn_poll(company_id: UUID) -> None:
    """Fire a poll without awaiting it, keeping a reference so it survives."""
    task = asyncio.create_task(poll_company(company_id))
    _running_tasks.add(task)
    task.add_done_callback(_running_tasks.discard)


async def due_company_ids(db: AsyncSession, *, now: datetime | None = None) -> list[UUID]:
    moment = now or datetime.now(UTC)
    interval_days = POLL_INTERVAL_DAYS.get(await get_radar_poll_interval(db), 1)
    cutoff = moment - timedelta(days=interval_days)

    result = await db.execute(
        select(WatchedCompany.id).where(
            WatchedCompany.status == "active",
            (WatchedCompany.last_polled_at.is_(None)) | (WatchedCompany.last_polled_at <= cutoff),
        )
    )
    return list(result.scalars())


async def queue_due_polls() -> None:
    async with async_session() as db:
        due = await due_company_ids(db)

    for company_id in due:
        spawn_poll(company_id)
        logger.info("Queued Radar poll for company %s", company_id)


async def radar_scheduler_loop() -> None:
    while True:
        try:
            await queue_due_polls()
        except Exception:
            logger.exception("Radar scheduler tick failed")
        await asyncio.sleep(SCHEDULER_POLL_SECONDS)
