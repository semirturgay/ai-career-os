"""Company name / careers URL → ATS board resolution."""

import pytest

from app.schemas.company_research import SearchResult
from app.services.radar import resolver
from app.services.radar.resolver import (
    BoardNotFoundError,
    board_from_url,
    looks_like_url,
    resolve_board,
    slug_candidates,
)
from app.services.radar.sources.base import RawPosting


class FakeSource:
    def __init__(self, provider, *, token=None, roles=1):
        self.provider = provider
        self.label = provider.title()
        self._token = token
        self._roles = roles
        self.probe_calls: list[str] = []

    def matches_url(self, url):
        return self._token if self._token and self._token in url else None

    def board_url(self, token):
        return f"https://{self.provider}.example/{token}"

    async def probe(self, token):
        self.probe_calls.append(token)
        return token == self._token

    async def fetch(self, token):
        if token != self._token:
            return []
        return [
            RawPosting(external_id=str(i), title=f"Role {i}", description="text")
            for i in range(self._roles)
        ]


def use_sources(monkeypatch, *sources):
    monkeypatch.setattr(resolver, "all_sources", lambda: tuple(sources))


# --- helpers ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://boards.greenhouse.io/acme", True),
        ("boards.greenhouse.io/acme", True),
        ("Anthropic", False),
        ("Acme Labs Inc", False),
    ],
)
def test_looks_like_url(value, expected):
    assert looks_like_url(value) is expected


@pytest.mark.parametrize(
    ("name", "expected_first"),
    [
        ("Anthropic", "anthropic"),
        ("Acme Labs, Inc.", "acmelabs"),
        ("North-Wind Systems", "northwindsystems"),
    ],
)
def test_slug_candidates_strips_noise(name, expected_first):
    assert slug_candidates(name)[0] == expected_first


def test_slug_candidates_includes_hyphenated_and_head_word():
    candidates = slug_candidates("Acme Labs")
    assert "acmelabs" in candidates
    assert "acme-labs" in candidates
    assert "acme" in candidates


def test_slug_candidates_are_capped():
    assert len(slug_candidates("One Two Three Four Five")) <= 3


def test_board_from_url_finds_real_provider():
    match = board_from_url("https://jobs.lever.co/northwind")
    assert match is not None
    source, token = match
    assert source.provider == "lever"
    assert token == "northwind"


# --- tier 1: URL --------------------------------------------------------------


async def test_resolve_prefers_url_when_one_is_pasted(monkeypatch):
    source = FakeSource("greenhouse", token="acme", roles=4)
    use_sources(monkeypatch, source)

    board = await resolve_board("https://greenhouse.example/acme")

    assert board.resolved_via == "url"
    assert board.ats_token == "acme"
    assert board.open_role_count == 4
    assert source.probe_calls == []  # no probing needed


# --- tier 2: probe ------------------------------------------------------------


async def test_resolve_probes_slug_candidates(monkeypatch):
    miss = FakeSource("greenhouse", token="somethingelse")
    hit = FakeSource("lever", token="anthropic", roles=7)
    use_sources(monkeypatch, miss, hit)

    board = await resolve_board("Anthropic")

    assert board.resolved_via == "probe"
    assert board.ats_provider == "lever"
    assert board.ats_token == "anthropic"
    assert board.open_role_count == 7


async def test_resolve_skips_board_with_no_open_roles(monkeypatch):
    """An empty board is usually a wrong-slug collision, not the company we want."""
    empty = FakeSource("greenhouse", token="acme", roles=0)
    use_sources(monkeypatch, empty)

    async def no_search(*_args, **_kwargs):
        return None

    monkeypatch.setattr(resolver, "_resolve_by_search", no_search)

    with pytest.raises(BoardNotFoundError):
        await resolve_board("Acme")


async def test_probe_failures_never_propagate(monkeypatch):
    class ExplodingSource(FakeSource):
        async def probe(self, token):
            raise RuntimeError("network down")

    use_sources(monkeypatch, ExplodingSource("greenhouse", token="acme"))

    async def no_search(*_args, **_kwargs):
        return None

    monkeypatch.setattr(resolver, "_resolve_by_search", no_search)

    with pytest.raises(BoardNotFoundError):
        await resolve_board("Acme")


# --- tier 3: search -----------------------------------------------------------


async def test_resolve_falls_back_to_web_search(monkeypatch):
    hit = FakeSource("ashby", token="orbital", roles=2)
    use_sources(monkeypatch, hit)

    class FakeSearchClient:
        async def search(self, query, *, max_results=8):
            assert "careers" in query
            return [
                SearchResult(title="Blog", url="https://example.com/blog", snippet="A blog post"),
                SearchResult(
                    title="Orbital Careers",
                    url="https://ashby.example/orbital",
                    snippet="Open roles",
                ),
            ]

    monkeypatch.setattr(resolver, "create_search_client", lambda: FakeSearchClient())

    # Name deliberately unrelated to the board slug, so probing cannot short-circuit.
    board = await resolve_board("Skyward Aerospace")

    assert board.resolved_via == "search"
    assert board.ats_token == "orbital"
    assert board.name == "Skyward Aerospace"


async def test_resolve_rejects_blank_query():
    with pytest.raises(BoardNotFoundError):
        await resolve_board("   ")
