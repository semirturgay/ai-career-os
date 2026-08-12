from __future__ import annotations

import asyncio
import time

from ddgs import DDGS

from app.schemas.company_research import SearchResult
from app.services.search.base import SearchError
from app.services.search.tracing import ToolCallTrace, log_tool_call

PROVIDER = "duckduckgo"

# ddgs is a metasearch aggregator, so `backend` names an engine (or a comma-separated
# set of them), not one of DuckDuckGo's own endpoints. "auto" rotates across all of
# them; the explicit list is the fallback for when that rotation comes back empty.
EXPLICIT_ENGINES = "duckduckgo,brave,mojeek"


class DuckDuckGoSearchClient:
    async def search(self, query: str, *, max_results: int = 5) -> list[SearchResult]:
        started = time.perf_counter()
        try:
            raw = await asyncio.to_thread(_search_sync, query, max_results)
            results = _to_search_results(raw)
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
        except Exception as exc:
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
            raise SearchError(f"DuckDuckGo search failed: {exc}") from exc


def _search_sync(query: str, max_results: int) -> list[dict]:
    """Retry across engines — a first attempt often comes back empty.

    No timelimit. Both callers (company research, and Radar resolving a company to its
    ATS board) want the authoritative page, which is usually old. Filtering to the last
    month pushed the real Greenhouse board below job-aggregator spam that republishes
    listings daily.
    """
    strategies: list[tuple[str, str | None]] = [
        ("auto", None),
        (EXPLICIT_ENGINES, None),
    ]
    last_error: Exception | None = None

    for backend, timelimit in strategies:
        try:
            with DDGS() as ddgs:
                raw = list(
                    ddgs.text(
                        query,
                        max_results=max_results,
                        backend=backend,
                        safesearch="moderate",
                        timelimit=timelimit,
                    )
                )
            if raw:
                return raw
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    return []


def _to_search_result(item: dict) -> SearchResult:
    title = (item.get("title") or "").strip()
    url = (item.get("href") or item.get("link") or "").strip()
    snippet = (item.get("body") or item.get("snippet") or title).strip()
    if not title or not url:
        raise SearchError("DuckDuckGo returned a result missing title or URL")
    return SearchResult(title=title[:500], url=url[:2048], snippet=snippet[:2000])


def _to_search_results(raw: list[dict]) -> list[SearchResult]:
    results: list[SearchResult] = []
    for item in raw:
        try:
            results.append(_to_search_result(item))
        except SearchError:
            continue
    return results
