"""Shared HTTP for ATS boards — one traced request helper, reused by every provider."""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.services.http_client import get_http_client
from app.services.radar.sources.base import AtsBoardNotFoundError, AtsError
from app.services.search.tracing import ToolCallTrace, log_tool_call

ATS_TIMEOUT_SECONDS = 20.0
ATS_PROBE_TIMEOUT_SECONDS = 8.0

# Identify ourselves. These are syndication endpoints; being nameable is the point.
ATS_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "ai-career-os/1.0 (+https://github.com/semirturgay/ai-career-os)",
}


async def fetch_json(
    *,
    provider: str,
    operation: str,
    url: str,
    timeout: float = ATS_TIMEOUT_SECONDS,
) -> Any:
    """GET JSON from an ATS board, tracing the call like every other tool call."""
    started = time.perf_counter()
    try:
        response = await get_http_client().get(
            url,
            headers=ATS_HEADERS,
            timeout=timeout,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        _trace(provider, operation, url, started, 0, "error", str(exc))
        raise AtsError(f"{provider} board request failed: {exc}") from exc

    if response.status_code == 404:
        _trace(provider, operation, url, started, 0, "error", "404")
        raise AtsBoardNotFoundError(f"{provider} board not found")

    if response.status_code >= 400:
        _trace(provider, operation, url, started, 0, "error", f"HTTP {response.status_code}")
        raise AtsError(f"{provider} board returned HTTP {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        _trace(provider, operation, url, started, 0, "error", "invalid JSON")
        raise AtsError(f"{provider} board returned invalid JSON") from exc

    count = len(payload) if isinstance(payload, list) else 1
    _trace(provider, operation, url, started, count, "ok", None)
    return payload


def _trace(
    provider: str,
    operation: str,
    url: str,
    started: float,
    count: int,
    status: str,
    error: str | None,
) -> None:
    log_tool_call(
        ToolCallTrace(
            operation=operation,
            provider=provider,
            query=url,
            latency_ms=(time.perf_counter() - started) * 1000,
            result_count=count,
            status=status,
            error=error,
        )
    )
