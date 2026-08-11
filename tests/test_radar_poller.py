"""Poller mechanics: dedupe on ATS id, claim/reap semantics, due selection.

These are the behaviours the previous discovery scheduler got wrong — a crashed
run wedged a monitor forever, and a manual run could race the tick.
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.config import settings
from app.models import Posting, WatchedCompany
from app.services.radar.poller import _store_postings, claim_company, due_company_ids
from app.services.radar.sources.base import RawPosting


def company(**overrides) -> WatchedCompany:
    defaults = dict(
        id=uuid.uuid4(),
        profile_id=uuid.uuid4(),
        name="Acme",
        ats_provider="greenhouse",
        ats_token="acme",
        status="active",
        polling_started_at=None,
        last_polled_at=None,
    )
    defaults.update(overrides)
    return WatchedCompany(**defaults)


def raw(external_id: str, title: str = "Engineer") -> RawPosting:
    return RawPosting(
        external_id=external_id,
        title=title,
        description="Some description",
        url=f"https://example.com/{external_id}",
    )


def db_returning(rows):
    """An AsyncMock session whose next execute() yields `rows` via .scalars()."""
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value = rows
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    db.execute.return_value = result
    db.add = MagicMock()
    return db


# --- dedupe -------------------------------------------------------------------


async def test_store_postings_inserts_new_rows():
    watched = company()
    db = db_returning([])

    fresh = await _store_postings(db, watched, [raw("1"), raw("2")])

    assert len(fresh) == 2
    assert {p.external_id for p in fresh} == {"1", "2"}
    assert db.add.call_count == 2


async def test_store_postings_dedupes_on_external_id():
    """The ATS id is stable, which is why we key on it rather than the URL."""
    watched = company()
    existing = Posting(
        id=uuid.uuid4(),
        watched_company_id=watched.id,
        profile_id=watched.profile_id,
        external_id="1",
        title="Engineer",
        description="old",
        state="screened",
        screen_score=70,
    )
    db = db_returning([existing])

    fresh = await _store_postings(db, watched, [raw("1", "Engineer II"), raw("2")])

    assert [p.external_id for p in fresh] == ["2"]
    # The already-known posting is refreshed, not re-inserted or re-screened.
    assert existing.title == "Engineer II"
    assert existing.state == "screened"
    assert existing.screen_score == 70
    assert db.add.call_count == 1


async def test_store_postings_handles_empty_board():
    db = db_returning([])
    assert await _store_postings(db, company(), []) == []
    db.execute.assert_not_awaited()


# --- claim / reap -------------------------------------------------------------


async def test_claim_marks_polling_started():
    watched = company()
    db = db_returning([watched])

    claimed = await claim_company(db, watched.id)

    assert claimed is watched
    assert watched.polling_started_at is not None
    db.commit.assert_awaited()


async def test_claim_refuses_a_live_claim():
    """A manual poll must not race the scheduler tick."""
    watched = company(polling_started_at=datetime.now(UTC) - timedelta(minutes=1))
    db = db_returning([watched])

    assert await claim_company(db, watched.id) is None


async def test_claim_reclaims_a_stale_run():
    """A process restart mid-poll must not wedge the company forever."""
    stale = datetime.now(UTC) - timedelta(minutes=settings.radar_stale_claim_minutes + 5)
    watched = company(polling_started_at=stale)
    db = db_returning([watched])

    claimed = await claim_company(db, watched.id)

    assert claimed is watched
    assert watched.polling_started_at > stale


async def test_claim_tolerates_naive_timestamps():
    """Postgres can hand back naive datetimes; comparing them must not explode."""
    naive_stale = datetime.now(UTC).replace(tzinfo=None) - timedelta(
        minutes=settings.radar_stale_claim_minutes + 5
    )
    watched = company(polling_started_at=naive_stale)
    db = db_returning([watched])

    assert await claim_company(db, watched.id) is not None


async def test_claim_returns_none_for_missing_company():
    db = db_returning([])
    assert await claim_company(db, uuid.uuid4()) is None


# --- due selection ------------------------------------------------------------


async def test_due_company_ids_uses_configured_interval(monkeypatch):
    expected = [uuid.uuid4(), uuid.uuid4()]
    db = db_returning(expected)

    async def fake_interval(_db):
        return "weekly"

    monkeypatch.setattr("app.services.radar.poller.get_radar_poll_interval", fake_interval)

    assert await due_company_ids(db) == expected
    db.execute.assert_awaited_once()
