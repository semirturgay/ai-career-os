"""The shared-secret gate that makes a deployed backend safe to expose.

These build their own tiny app rather than importing app.main, because the real app
binds the token once at import time — a test that monkeypatched settings afterwards
would pass while proving nothing.
"""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx import ASGITransport
from pydantic import ValidationError

from app.api.auth import ApiTokenMiddleware
from app.config import MIN_API_TOKEN_LENGTH, Settings

TOKEN = "s3cret-token-long-enough-to-pass"


def build_app(token: str | None) -> FastAPI:
    app = FastAPI()
    app.add_middleware(ApiTokenMiddleware, token=token)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/v1/profiles")
    async def profiles():
        return [{"id": "1"}]

    return app


async def call(app: FastAPI, path: str = "/api/v1/profiles", **kwargs) -> httpx.Response:
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path, **kwargs)


@pytest.mark.asyncio
async def test_unset_token_leaves_the_api_open():
    """The default has to stay zero-friction — this is a laptop app first."""
    response = await call(build_app(None))

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_configured_token_rejects_requests_without_one():
    response = await call(build_app(TOKEN))

    assert response.status_code == 401
    assert "API_TOKEN" in response.json()["detail"]
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "headers",
    [
        {"Authorization": f"Bearer {TOKEN}"},
        {"X-API-Token": TOKEN},
    ],
    ids=["bearer", "plain-header"],
)
async def test_correct_token_is_accepted_in_either_form(headers: dict[str, str]):
    response = await call(build_app(TOKEN), headers=headers)

    assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "headers",
    [
        {"Authorization": f"Bearer {TOKEN}x"},
        {"Authorization": TOKEN},  # bearer scheme missing entirely
        {"Authorization": "Bearer "},
        {"X-API-Token": TOKEN[:-1]},
        {"X-API-Token": ""},
    ],
)
async def test_wrong_token_is_rejected(headers: dict[str, str]):
    response = await call(build_app(TOKEN), headers=headers)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_health_stays_open_so_platform_probes_work():
    """Render and Railway probe this before any of our config is in play."""
    response = await call(build_app(TOKEN), path="/health")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_preflight_is_not_gated():
    """A gated preflight surfaces in the browser as an opaque CORS error, not a 401."""
    transport = ASGITransport(app=build_app(TOKEN))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/api/v1/profiles",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


@pytest.mark.asyncio
async def test_rejection_still_carries_cors_headers():
    """Without these the extension sees a network error and can't show the real reason."""
    response = await call(build_app(TOKEN), headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_short_token_fails_startup():
    """A guessable token is worse than none — it only looks like protection."""
    with pytest.raises(ValidationError, match="at least"):
        Settings(api_token="x" * (MIN_API_TOKEN_LENGTH - 1))


@pytest.mark.parametrize("value", ["", "   ", None])
def test_blank_token_reads_as_disabled(value: str | None):
    """`API_TOKEN=` in a .env file means off, not an empty secret that matches nothing."""
    assert Settings(api_token=value).api_token is None


def test_token_is_stripped():
    assert Settings(api_token=f"  {TOKEN}  ").api_token == TOKEN
