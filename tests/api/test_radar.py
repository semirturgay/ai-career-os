"""Radar API wiring — routes, ownership checks, and error mapping."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.models import Posting, Profile, WatchedCompany
from app.schemas.radar import ResolvedBoard
from app.services.radar.resolver import BoardNotFoundError


def make_profile() -> Profile:
    return Profile(
        id=uuid.uuid4(),
        name="Ada Lovelace",
        headline="Backend Engineer",
        resume_text="Python and PostgreSQL.",
    )


def make_company(profile_id: uuid.UUID) -> WatchedCompany:
    return WatchedCompany(
        id=uuid.uuid4(),
        profile_id=profile_id,
        name="Acme",
        ats_provider="greenhouse",
        ats_token="acme",
        board_url="https://job-boards.greenhouse.io/acme",
        criteria={},
        status="active",
        last_polled_at=None,
        last_error=None,
        last_viewed_at=None,
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_list_radar_requires_existing_profile(api_client: httpx.AsyncClient):
    response = await api_client.get(f"/api/v1/profiles/{uuid.uuid4()}/radar")

    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"


@pytest.mark.asyncio
async def test_list_radar_returns_empty_for_new_profile(
    api_client: httpx.AsyncClient,
    mock_db_session_empty_lists: AsyncMock,
):
    profile = make_profile()
    mock_db_session_empty_lists.get = AsyncMock(return_value=profile)
    result = MagicMock()
    result.scalars.return_value = []
    mock_db_session_empty_lists.execute = AsyncMock(return_value=result)

    response = await api_client.get(f"/api/v1/profiles/{profile.id}/radar")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_resolve_returns_candidate_board(
    api_client: httpx.AsyncClient,
    mock_db_session_empty_lists: AsyncMock,
):
    profile = make_profile()
    mock_db_session_empty_lists.get = AsyncMock(return_value=profile)

    board = ResolvedBoard(
        name="Acme",
        ats_provider="greenhouse",
        ats_token="acme",
        board_url="https://job-boards.greenhouse.io/acme",
        open_role_count=12,
        resolved_via="probe",
    )

    with patch("app.api.radar.resolve_board", AsyncMock(return_value=board)):
        response = await api_client.post(
            f"/api/v1/profiles/{profile.id}/radar/resolve",
            json={"query": "Acme"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["ats_provider"] == "greenhouse"
    assert body["ats_token"] == "acme"
    assert body["open_role_count"] == 12


@pytest.mark.asyncio
async def test_resolve_maps_not_found_to_404(
    api_client: httpx.AsyncClient,
    mock_db_session_empty_lists: AsyncMock,
):
    profile = make_profile()
    mock_db_session_empty_lists.get = AsyncMock(return_value=profile)

    with patch(
        "app.api.radar.resolve_board",
        AsyncMock(side_effect=BoardNotFoundError("Couldn't find a board")),
    ):
        response = await api_client.post(
            f"/api/v1/profiles/{profile.id}/radar/resolve",
            json={"query": "Nonexistent Co"},
        )

    assert response.status_code == 404
    assert "Couldn't find a board" in response.json()["detail"]


@pytest.mark.asyncio
async def test_resolve_rejects_blank_query(
    api_client: httpx.AsyncClient,
    mock_db_session_empty_lists: AsyncMock,
):
    profile = make_profile()
    mock_db_session_empty_lists.get = AsyncMock(return_value=profile)

    response = await api_client.post(
        f"/api/v1/profiles/{profile.id}/radar/resolve",
        json={"query": ""},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_company_from_another_profile_is_not_found(
    api_client: httpx.AsyncClient,
    mock_db_session_empty_lists: AsyncMock,
):
    """Ownership is enforced, not assumed from the URL."""
    profile = make_profile()
    someone_elses = make_company(uuid.uuid4())

    async def fake_get(model, key):
        return profile if model is Profile else someone_elses

    mock_db_session_empty_lists.get = AsyncMock(side_effect=fake_get)

    response = await api_client.patch(
        f"/api/v1/profiles/{profile.id}/radar/{someone_elses.id}",
        json={"status": "paused"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Watched company not found"


@pytest.mark.asyncio
async def test_dismiss_posting_sets_state(
    api_client: httpx.AsyncClient,
    mock_db_session_empty_lists: AsyncMock,
):
    profile = make_profile()
    posting = Posting(
        id=uuid.uuid4(),
        watched_company_id=uuid.uuid4(),
        profile_id=profile.id,
        external_id="1",
        title="Senior Backend Engineer",
        description="Build things.",
        remote_flag=False,
        state="screened",
        first_seen_at=datetime.now(UTC),
        last_seen_at=datetime.now(UTC),
    )

    async def fake_get(model, key):
        return profile if model is Profile else posting

    mock_db_session_empty_lists.get = AsyncMock(side_effect=fake_get)

    response = await api_client.post(
        f"/api/v1/profiles/{profile.id}/radar/postings/{posting.id}/dismiss"
    )

    assert response.status_code == 200
    assert response.json()["state"] == "dismissed"
    assert posting.state == "dismissed"


@pytest.mark.asyncio
async def test_settings_exposes_radar_poll_interval(api_client: httpx.AsyncClient):
    response = await api_client.get("/api/v1/settings/radar-poll-interval")

    assert response.status_code == 200
    assert response.json()["radar_poll_interval"] in {"daily", "3d", "weekly"}


@pytest.mark.asyncio
async def test_settings_rejects_unknown_interval(api_client: httpx.AsyncClient):
    response = await api_client.put(
        "/api/v1/settings/radar-poll-interval",
        json={"radar_poll_interval": "hourly"},
    )

    assert response.status_code == 422
