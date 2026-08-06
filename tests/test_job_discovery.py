from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.company_research import SearchResult
from app.schemas.discovery import (
    DiscoveryAgentStep,
    DiscoveryCandidatePick,
    DiscoveryCriteria,
    DiscoverySynthesisResult,
)
from app.services.job_discovery.agent import discover_job_candidates
from app.services.job_discovery.candidates import (
    fallback_candidates_from_results,
    merge_candidates,
    picks_to_candidates,
)
from app.services.job_discovery.queries import (
    build_refresh_queries,
    build_seed_queries,
    simplify_title,
)


@pytest.mark.asyncio
async def test_discover_job_candidates_runs_seeds_and_synthesizes():
    profile = SimpleNamespace(
        structured_data={"name": "Alex", "skills": ["Python", "FastAPI"]},
        resume_text="Backend engineer with Python experience.",
    )
    criteria = DiscoveryCriteria(
        title="Senior Backend Engineer",
        country="Germany",
        remote="remote",
    )

    search_results = [
        SearchResult(
            title="Senior Backend Engineer - Acme",
            url="https://boards.greenhouse.io/acme/jobs/1",
            snippet="Remote Python backend role in Berlin.",
        ),
    ]
    synthesis = DiscoverySynthesisResult(
        candidates=[
            DiscoveryCandidatePick(
                result_index=1,
                company="Acme",
                fit_score=82,
                fit_reason="Remote Python role matches profile.",
            )
        ]
    )

    mock_llm = AsyncMock()
    mock_llm.generate_structured = AsyncMock(
        side_effect=[
            DiscoveryAgentStep(action="synthesize", rationale="Seeds enough."),
            synthesis,
        ]
    )

    mock_search = AsyncMock()
    mock_search.search = AsyncMock(return_value=search_results)

    with patch("app.services.job_discovery.agent.get_llm_client", AsyncMock(return_value=mock_llm)):
        candidates = await discover_job_candidates(
            db=AsyncMock(),
            profile=profile,
            criteria=criteria,
            search_client=mock_search,
        )

    assert len(candidates) == 1
    assert candidates[0]["company"] == "Acme"
    assert mock_search.search.await_args_list[0].kwargs["max_results"] == 10
    assert mock_search.search.await_count >= 1


def test_build_seed_queries_avoids_site_operators():
    criteria = DiscoveryCriteria(title="Senior Software Engineer / AI Engineer", country="Turkey")
    queries = build_seed_queries(criteria)
    assert queries
    assert all("site:" not in query for query in queries)
    assert "Turkey" in queries[0]


def test_simplify_title_takes_primary_role():
    assert simplify_title("Senior Software Engineer / AI Engineer") == "Senior Software Engineer"


def test_merge_candidates_dedupes_by_url():
    seen = datetime.now(UTC).isoformat()
    existing = [
        {
            "id": "c1",
            "title": "Engineer",
            "company": "Acme",
            "url": "https://example.com/jobs/1",
            "snippet": "old",
            "source": "example.com",
            "fit_score": 70,
            "fit_reason": "ok",
            "dismissed": False,
            "first_seen_at": seen,
            "last_seen_at": seen,
        }
    ]
    incoming = [
        {
            "id": "c2",
            "title": "Senior Engineer",
            "company": "Acme",
            "url": "https://example.com/jobs/1?utm=1",
            "snippet": "updated",
            "source": "example.com",
            "fit_score": 80,
            "fit_reason": "better",
            "dismissed": False,
            "first_seen_at": seen,
            "last_seen_at": seen,
        }
    ]

    merged = merge_candidates(existing, incoming)
    assert len(merged) == 1
    assert merged[0]["snippet"] == "updated"


def test_picks_to_candidates_uses_search_result_fields():
    seen_at = datetime.now(UTC)
    picks = [
        DiscoveryCandidatePick(
            result_index=1,
            company="Acme",
            fit_score=75,
            fit_reason="Good title match.",
        )
    ]
    results = [
        SearchResult(
            title="Backend Engineer",
            url="https://boards.greenhouse.io/acme/jobs/1",
            snippet="Python backend role.",
        )
    ]

    items = picks_to_candidates(picks, results, seen_at=seen_at)
    assert len(items) == 1
    assert items[0]["title"] == "Backend Engineer"
    assert items[0]["source"] == "boards.greenhouse.io"


@pytest.mark.asyncio
async def test_discover_job_candidates_falls_back_when_synthesis_empty():
    profile = SimpleNamespace(
        structured_data={"name": "Alex", "skills": ["Python"]},
        resume_text="Backend engineer.",
    )
    criteria = DiscoveryCriteria(title="Senior Backend Engineer", country="Germany")
    search_results = [
        SearchResult(
            title="Senior Backend Engineer - Acme",
            url="https://boards.greenhouse.io/acme/jobs/99",
            snippet="Python backend role in Berlin.",
        ),
        SearchResult(
            title="Backend Engineer - Beta",
            url="https://boards.greenhouse.io/beta/jobs/100",
            snippet="Remote Python role.",
        ),
        SearchResult(
            title="Backend Engineer - Gamma",
            url="https://boards.greenhouse.io/gamma/jobs/101",
            snippet="FastAPI backend role.",
        ),
    ]

    mock_llm = AsyncMock()
    mock_llm.generate_structured = AsyncMock(
        return_value=DiscoverySynthesisResult(candidates=[]),
    )

    mock_search = AsyncMock()
    mock_search.search = AsyncMock(return_value=search_results)

    with patch("app.services.job_discovery.agent.get_llm_client", AsyncMock(return_value=mock_llm)):
        candidates = await discover_job_candidates(
            db=AsyncMock(),
            profile=profile,
            criteria=criteria,
            search_client=mock_search,
        )

    assert len(candidates) == 3


@pytest.mark.asyncio
async def test_discover_job_candidates_skips_known_urls_on_rerun():
    profile = SimpleNamespace(
        structured_data={"name": "Alex", "skills": ["Python"]},
        resume_text="Backend engineer.",
    )
    criteria = DiscoveryCriteria(title="Senior Backend Engineer", country="Germany")
    known_url = "https://boards.greenhouse.io/acme/jobs/1"
    search_results = [
        SearchResult(
            title="Senior Backend Engineer - Acme",
            url=known_url,
            snippet="Python backend role.",
        ),
        SearchResult(
            title="Backend Engineer - Beta",
            url="https://boards.greenhouse.io/beta/jobs/2",
            snippet="Remote Python role.",
        ),
    ]

    mock_llm = AsyncMock()
    mock_llm.generate_structured = AsyncMock(
        side_effect=[
            DiscoveryAgentStep(action="synthesize", rationale="Enough results."),
            DiscoverySynthesisResult(candidates=[]),
        ]
    )

    mock_search = AsyncMock()
    mock_search.search = AsyncMock(return_value=search_results)

    with patch("app.services.job_discovery.agent.get_llm_client", AsyncMock(return_value=mock_llm)):
        candidates = await discover_job_candidates(
            db=AsyncMock(),
            profile=profile,
            criteria=criteria,
            search_client=mock_search,
            existing_urls=frozenset({"https://boards.greenhouse.io/acme/jobs/1"}),
        )

    assert len(candidates) == 1
    assert candidates[0]["url"] == search_results[1].url


def test_build_refresh_queries_differs_from_seed_queries():
    criteria = DiscoveryCriteria(title="Senior Software Engineer", country="Turkey")
    seed = {query.casefold() for query in build_seed_queries(criteria)}
    refresh = build_refresh_queries(criteria)
    assert refresh
    assert all(query.casefold() not in seed for query in refresh)


def test_fallback_candidates_from_results_skips_known_urls():
    seen_at = datetime.now(UTC)
    results = [
        SearchResult(
            title="Engineer - Acme",
            url="https://boards.greenhouse.io/acme/jobs/1",
            snippet="Python role.",
        ),
        SearchResult(
            title="Engineer - Beta",
            url="https://boards.greenhouse.io/beta/jobs/2",
            snippet="Backend role.",
        ),
    ]

    items = fallback_candidates_from_results(
        results,
        known_urls=frozenset({"https://boards.greenhouse.io/acme/jobs/1"}),
        seen_at=seen_at,
    )
    assert len(items) == 1
    assert "beta" in items[0]["url"]
