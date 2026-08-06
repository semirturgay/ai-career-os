from __future__ import annotations

from app.models import Profile
from app.prompts import load_prompt
from app.schemas.company_research import SearchResult
from app.schemas.discovery import DiscoveryAgentStep, DiscoveryCriteria, DiscoverySynthesisResult
from app.services.job_discovery.candidates import picks_to_candidates
from app.services.job_discovery.filters import filter_job_listings
from app.services.job_discovery.queries import build_seed_queries
from app.services.llm import Message, get_llm_client
from app.services.match.formatters import format_profile
from app.services.search import SearchClient, get_search_client
from app.services.search.tracing import AgentStepTrace, log_agent_step

DISCOVERY_MAX_AGENT_STEPS = 3
DISCOVERY_MAX_AGENT_SEARCHES = 2
DISCOVERY_SEARCH_RESULTS_PER_QUERY = 10
TARGET_CANDIDATE_POOL = 8


def _format_criteria(criteria: DiscoveryCriteria) -> str:
    parts = [f"Target role: {criteria.title}"]
    if criteria.city:
        parts.append(f"City: {criteria.city}")
    elif criteria.country:
        parts.append(f"Country: {criteria.country}")
    if criteria.remote != "any":
        parts.append(f"Work mode: {criteria.remote}")
    if criteria.notes:
        parts.append(f"Notes: {criteria.notes}")
    return "\n".join(parts)


def _format_search_results(results: list[SearchResult]) -> str:
    if not results:
        return "No search results returned."

    blocks: list[str] = []
    for index, result in enumerate(results, start=1):
        blocks.append(
            "\n".join(
                [
                    f"[{index}] {result.title}",
                    f"URL: {result.url}",
                    f"Snippet: {result.snippet}",
                ]
            )
        )
    return "\n\n".join(blocks)


def build_discovery_agent_user_message(
    profile: Profile,
    criteria: DiscoveryCriteria,
    search_results: list[SearchResult],
    *,
    step: int,
    max_steps: int,
    searches_done: int,
    max_searches: int,
) -> str:
    return "\n\n".join(
        [
            f"Discovery step {step} of {max_steps}.",
            f"Searches used: {searches_done}/{max_searches}.",
            f"Candidate profile:\n\n{format_profile(profile)}",
            f"Discovery criteria:\n\n{_format_criteria(criteria)}",
            (
                f"Results collected so far:\n\n{_format_search_results(search_results)}"
                if search_results
                else "No search results yet."
            ),
            (
                "Choose action=search with one NEW short query (max 90 chars), "
                "or action=synthesize if you have enough job listing snippets."
            ),
        ]
    )


def build_discovery_synthesize_user_message(
    profile: Profile,
    criteria: DiscoveryCriteria,
    search_results: list[SearchResult],
) -> str:
    return "\n\n".join(
        [
            f"Candidate profile:\n\n{format_profile(profile)}",
            f"Discovery criteria:\n\n{_format_criteria(criteria)}",
            f"Web search results:\n\n{_format_search_results(search_results)}",
        ]
    )


def _dedupe_search_results(results: list[SearchResult]) -> list[SearchResult]:
    seen_urls: set[str] = set()
    unique: list[SearchResult] = []
    for result in results:
        key = result.url.casefold()
        if key in seen_urls:
            continue
        seen_urls.add(key)
        unique.append(result)
    return unique


async def _search_and_collect(
    search_client: SearchClient,
    query: str,
    collected: list[SearchResult],
) -> list[SearchResult]:
    batch = await search_client.search(
        query,
        max_results=DISCOVERY_SEARCH_RESULTS_PER_QUERY,
    )
    batch = filter_job_listings(batch)
    return _dedupe_search_results([*collected, *batch])


async def _run_seed_searches(
    search_client: SearchClient,
    criteria: DiscoveryCriteria,
) -> list[SearchResult]:
    collected: list[SearchResult] = []
    for query in build_seed_queries(criteria):
        collected = await _search_and_collect(search_client, query, collected)
        if len(collected) >= TARGET_CANDIDATE_POOL:
            break
    return collected


async def _run_agent_search_loop(
    llm,
    search_client: SearchClient,
    profile: Profile,
    criteria: DiscoveryCriteria,
    collected: list[SearchResult],
) -> list[SearchResult]:
    searches_done = 0
    queries_seen: set[str] = set()
    empty_streak = 0

    for step in range(1, DISCOVERY_MAX_AGENT_STEPS + 1):
        if len(collected) >= TARGET_CANDIDATE_POOL:
            break

        agent_step = await llm.generate_structured(
            messages=[
                Message(role="system", content=load_prompt("job_discovery_agent")),
                Message(
                    role="user",
                    content=build_discovery_agent_user_message(
                        profile,
                        criteria,
                        collected,
                        step=step,
                        max_steps=DISCOVERY_MAX_AGENT_STEPS,
                        searches_done=searches_done,
                        max_searches=DISCOVERY_MAX_AGENT_SEARCHES,
                    ),
                ),
            ],
            response_model=DiscoveryAgentStep,
        )

        log_agent_step(
            AgentStepTrace(
                step=step,
                max_steps=DISCOVERY_MAX_AGENT_STEPS,
                action=agent_step.action,
                query=agent_step.query,
                rationale=agent_step.rationale,
                searches_done=searches_done,
                total_results=len(collected),
            )
        )

        if agent_step.action == "synthesize":
            break

        if searches_done >= DISCOVERY_MAX_AGENT_SEARCHES:
            break

        query = (agent_step.query or "").strip()
        if not query or "site:" in query.casefold():
            # LLM site: queries are unreliable — skip and ask again next step.
            continue

        query_key = query.casefold()
        if query_key in queries_seen:
            continue
        queries_seen.add(query_key)

        before = len(collected)
        collected = await _search_and_collect(search_client, query, collected)
        if len(collected) > before:
            empty_streak = 0
        else:
            empty_streak += 1
            if empty_streak >= 2:
                break

        searches_done += 1

    return collected


async def _synthesize_candidates(
    llm,
    profile: Profile,
    criteria: DiscoveryCriteria,
    search_results: list[SearchResult],
):
    from datetime import UTC, datetime

    if not search_results:
        return []

    synthesis = await llm.generate_structured(
        messages=[
            Message(role="system", content=load_prompt("job_discovery_synthesize")),
            Message(
                role="user",
                content=build_discovery_synthesize_user_message(profile, criteria, search_results),
            ),
        ],
        response_model=DiscoverySynthesisResult,
    )

    seen_at = datetime.now(UTC)
    return picks_to_candidates(synthesis.candidates, search_results, seen_at=seen_at)


async def discover_job_candidates(
    db,
    profile: Profile,
    criteria: DiscoveryCriteria,
    *,
    search_client: SearchClient | None = None,
) -> list[dict]:
    llm = await get_llm_client(db)
    client = search_client or await get_search_client(db)

    collected = await _run_seed_searches(client, criteria)
    if len(collected) < 3:
        collected = await _run_agent_search_loop(llm, client, profile, criteria, collected)

    return await _synthesize_candidates(llm, profile, criteria, collected)
