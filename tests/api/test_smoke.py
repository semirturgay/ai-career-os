"""API wiring smoke tests — verify routes respond without a live database."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import pytest


@pytest.mark.asyncio
async def test_list_profiles(api_client: httpx.AsyncClient):
    response = await api_client.get("/api/v1/profiles")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_profile_not_found(api_client: httpx.AsyncClient):
    response = await api_client.get(f"/api/v1/profiles/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Profile not found"


@pytest.mark.asyncio
async def test_list_jobs(api_client: httpx.AsyncClient):
    response = await api_client.get("/api/v1/jobs")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_job_not_found(api_client: httpx.AsyncClient):
    response = await api_client.get(f"/api/v1/jobs/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


@pytest.mark.asyncio
async def test_list_match_analyses(api_client: httpx.AsyncClient):
    response = await api_client.get("/api/v1/match-analyses")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_feedback_requires_profile(api_client: httpx.AsyncClient):
    response = await api_client.get("/api/v1/feedback")

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_feedback_empty(api_client: httpx.AsyncClient):
    response = await api_client.get(f"/api/v1/feedback?profile_id={uuid4()}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_match_analysis_not_found(api_client: httpx.AsyncClient):
    response = await api_client.get(f"/api/v1/match-analyses/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Match analysis not found"


@pytest.mark.asyncio
async def test_get_settings(api_client: httpx.AsyncClient):
    response = await api_client.get("/api/v1/settings")

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["api_key_set"] is False
    assert body["llm_provider"] is None


@pytest.mark.asyncio
async def test_list_models(api_client: httpx.AsyncClient):
    with patch(
        "app.api.llm.list_provider_models",
        new=AsyncMock(return_value=["qwen/qwen3.5-9b"]),
    ):
        response = await api_client.post(
            "/api/v1/llm/models",
            json={"llm_provider": "local", "llm_base_url": "http://127.0.0.1:1234/v1"},
        )

    assert response.status_code == 200
    assert response.json() == {"models": ["qwen/qwen3.5-9b"]}
