from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.company_research import SearchResult
from app.services.search.base import SearchError
from app.services.search.composite import CompositeSearchClient, _merge_results
from app.services.search.tavily import TavilySearchClient


@pytest.mark.asyncio
async def test_tavily_search_maps_results():
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "results": [
            {
                "title": "Backend Engineer - Acme",
                "url": "https://boards.greenhouse.io/acme/jobs/1",
                "content": "Python backend role in Berlin.",
            }
        ]
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=response)

    with patch("app.services.search.tavily.get_http_client", return_value=mock_client):
        client = TavilySearchClient("test-key")
        results = await client.search("backend engineer Berlin", max_results=5)

    assert len(results) == 1
    assert results[0].title == "Backend Engineer - Acme"
    assert "greenhouse" in results[0].url


def test_merge_results_dedupes_by_url():
    first = SearchResult(title="A", url="https://example.com/jobs/1", snippet="one")
    second = SearchResult(title="B", url="https://example.com/jobs/2", snippet="two")
    duplicate = SearchResult(title="A copy", url="https://example.com/jobs/1", snippet="dup")

    merged = _merge_results([[first, duplicate], [second]], max_results=5)
    assert len(merged) == 2
    assert merged[0].url == first.url
    assert merged[1].url == second.url


@pytest.mark.asyncio
async def test_composite_search_merges_provider_results():
    tavily = AsyncMock()
    tavily.search = AsyncMock(
        return_value=[
            SearchResult(
                title="Tavily result",
                url="https://example.com/jobs/1",
                snippet="from tavily",
            )
        ]
    )
    ddg = AsyncMock()
    ddg.search = AsyncMock(
        return_value=[
            SearchResult(
                title="DDG result",
                url="https://example.com/jobs/2",
                snippet="from ddg",
            ),
            SearchResult(
                title="Duplicate",
                url="https://example.com/jobs/1",
                snippet="duplicate",
            ),
        ]
    )

    composite = CompositeSearchClient([tavily, ddg], provider_names=["tavily", "duckduckgo"])
    results = await composite.search("backend engineer", max_results=5)

    assert len(results) == 2
    assert results[0].title == "Tavily result"
    assert results[1].title == "DDG result"


@pytest.mark.asyncio
async def test_composite_search_continues_when_provider_fails():
    failing = AsyncMock()
    failing.search = AsyncMock(side_effect=SearchError("blocked"))

    backup = AsyncMock()
    backup.search = AsyncMock(
        return_value=[SearchResult(title="Backup", url="https://example.com/jobs/9", snippet="ok")]
    )

    composite = CompositeSearchClient([failing, backup], provider_names=["tavily", "duckduckgo"])
    results = await composite.search("backend engineer", max_results=5)

    assert len(results) == 1
    assert results[0].title == "Backup"
