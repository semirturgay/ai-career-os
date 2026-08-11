from __future__ import annotations

import time

import httpx

from app.schemas.company_research import SearchResult
from app.services.http_client import get_http_client
from app.services.search.base import SearchError
from app.services.search.tracing import ToolCallTrace, log_tool_call

PROVIDER = "tavily"
BASE_URL = "https://api.tavily.com/search"


class TavilySearchClient:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key.strip()

    async def search(self, query: str, *, max_results: int = 5) -> list[SearchResult]:
        started = time.perf_counter()
        try:
            results = await self._fetch(query, max_results=max_results)
            log_tool_call(
                ToolCallTrace(
                    operation="web_search",
                    provider=PROVIDER,
                    query=query,
                    latency_ms=(time.perf_counter() - started) * 1000,
                    result_count=len(results),
                    status="ok",
                )
            )
            return results
        except SearchError as exc:
            log_tool_call(
                ToolCallTrace(
                    operation="web_search",
                    provider=PROVIDER,
                    query=query,
                    latency_ms=(time.perf_counter() - started) * 1000,
                    result_count=0,
                    status="error",
                    error=str(exc),
                )
            )
            raise

    async def _fetch(self, query: str, *, max_results: int) -> list[SearchResult]:
        payload = {
            "api_key": self._api_key,
            "query": query,
            "max_results": max(1, min(max_results, 20)),
            "search_depth": "basic",
            "include_answer": False,
        }

        client = get_http_client()
        try:
            response = await client.post(BASE_URL, json=payload, timeout=60.0)
        except httpx.HTTPError as exc:
            raise SearchError(f"Tavily request failed: {exc}") from exc

        if response.status_code == 401:
            raise SearchError("Tavily rejected the API key (401)")
        if response.status_code == 429:
            raise SearchError("Tavily rate limit exceeded (429)")
        if response.status_code >= 400:
            raise SearchError(f"Tavily HTTP {response.status_code}: {response.text[:200]}")

        body = response.json()
        raw = body.get("results") if isinstance(body, dict) else None
        if not isinstance(raw, list):
            return []

        return _to_search_results(raw[:max_results])


def _to_search_results(raw: list[object]) -> list[SearchResult]:
    results: list[SearchResult] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        url = str(item.get("url") or "").strip()
        snippet = str(item.get("content") or item.get("snippet") or title).strip()
        if not title or not url:
            continue
        results.append(SearchResult(title=title[:500], url=url[:2048], snippet=snippet[:2000]))
    return results
