from __future__ import annotations

import asyncio
import time

from app.schemas.company_research import SearchResult
from app.services.search.base import SearchClient, SearchError
from app.services.search.tracing import ToolCallTrace, log_tool_call

PROVIDER = "composite"


class CompositeSearchClient:
    """Run multiple search providers in parallel and merge unique results."""

    def __init__(self, clients: list[SearchClient], *, provider_names: list[str]) -> None:
        if not clients:
            raise ValueError("CompositeSearchClient requires at least one client")
        if len(clients) != len(provider_names):
            raise ValueError("provider_names must match clients length")
        self._clients = clients
        self._provider_names = provider_names

    async def search(self, query: str, *, max_results: int = 5) -> list[SearchResult]:
        started = time.perf_counter()
        batches = await asyncio.gather(
            *[
                self._safe_search(client, name, query, max_results)
                for client, name in zip(self._clients, self._provider_names, strict=True)
            ]
        )

        merged = _merge_results(batches, max_results=max_results)
        log_tool_call(
            ToolCallTrace(
                operation="web_search",
                provider=PROVIDER,
                query=query,
                latency_ms=(time.perf_counter() - started) * 1000,
                result_count=len(merged),
                status="ok",
            )
        )
        return merged

    async def _safe_search(
        self,
        client: SearchClient,
        provider: str,
        query: str,
        max_results: int,
    ) -> list[SearchResult]:
        try:
            return await client.search(query, max_results=max_results)
        except SearchError as exc:
            log_tool_call(
                ToolCallTrace(
                    operation="web_search",
                    provider=provider,
                    query=query,
                    latency_ms=0,
                    result_count=0,
                    status="error",
                    error=str(exc),
                )
            )
            return []


def _merge_results(batches: list[list[SearchResult]], *, max_results: int) -> list[SearchResult]:
    seen_urls: set[str] = set()
    merged: list[SearchResult] = []

    for batch in batches:
        for result in batch:
            key = result.url.casefold()
            if key in seen_urls:
                continue
            seen_urls.add(key)
            merged.append(result)
            if len(merged) >= max_results:
                return merged

    return merged
