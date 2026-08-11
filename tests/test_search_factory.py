from unittest.mock import patch

from app.services.search.duckduckgo import DuckDuckGoSearchClient
from app.services.search.factory import create_search_client


def test_create_search_client_defaults_to_duckduckgo():
    with patch("app.services.search.factory.settings") as mock_settings:
        mock_settings.tavily_api_key = None
        mock_settings.search_include_duckduckgo = True

        client = create_search_client()

    assert isinstance(client, DuckDuckGoSearchClient)


def test_create_search_client_builds_composite_with_tavily():
    with patch("app.services.search.factory.settings") as mock_settings:
        mock_settings.tavily_api_key = "tavily-key"
        mock_settings.search_include_duckduckgo = True

        client = create_search_client()

    from app.services.search.composite import CompositeSearchClient

    assert isinstance(client, CompositeSearchClient)
    assert len(client._clients) == 2
    assert client._provider_names == ["tavily", "duckduckgo"]
