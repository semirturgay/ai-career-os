from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.search.base import SearchClient
from app.services.search.composite import CompositeSearchClient
from app.services.search.duckduckgo import DuckDuckGoSearchClient


def _non_empty(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def create_search_client() -> SearchClient:
    """Build search client from env keys — merges all configured providers."""
    clients: list[SearchClient] = []
    names: list[str] = []

    tavily_key = _non_empty(settings.tavily_api_key)
    if tavily_key:
        from app.services.search.tavily import TavilySearchClient

        clients.append(TavilySearchClient(tavily_key))
        names.append("tavily")

    if settings.search_include_duckduckgo or not clients:
        clients.append(DuckDuckGoSearchClient())
        names.append("duckduckgo")

    if len(clients) == 1:
        return clients[0]
    return CompositeSearchClient(clients, provider_names=names)


async def get_search_client(_db: AsyncSession) -> SearchClient:
    return create_search_client()
