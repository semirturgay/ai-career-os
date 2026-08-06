from __future__ import annotations

import time

import httpx

from app.schemas.company_research import SearchResult
from app.services.http_client import get_http_client
from app.services.job_discovery.job_search import JobSearchRequest
from app.services.search.base import SearchError
from app.services.search.tracing import ToolCallTrace, log_tool_call

PROVIDER = "jsearch"
BASE_URL = "https://jsearch.p.rapidapi.com/search-v2"


class JSearchClient:
    """JSearch via RapidAPI — aggregated LinkedIn, Indeed, Glassdoor, etc."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def search(
        self,
        request: JobSearchRequest,
        *,
        max_results: int = 10,
    ) -> list[SearchResult]:
        started = time.perf_counter()
        query_label = request.query
        try:
            raw = await self._fetch_page(request)
            results = _to_search_results(raw[: max_results * 2])[:max_results]
            log_tool_call(
                ToolCallTrace(
                    operation="job_search",
                    provider=PROVIDER,
                    query=query_label,
                    latency_ms=(time.perf_counter() - started) * 1000,
                    result_count=len(results),
                    status="ok",
                )
            )
            return results
        except SearchError as exc:
            log_tool_call(
                ToolCallTrace(
                    operation="job_search",
                    provider=PROVIDER,
                    query=query_label,
                    latency_ms=(time.perf_counter() - started) * 1000,
                    result_count=0,
                    status="error",
                    error=str(exc),
                )
            )
            raise

    async def _fetch_page(self, request: JobSearchRequest) -> list[dict]:
        params: dict[str, str | int | bool] = {
            "query": request.query,
            "num_pages": 1,
            "date_posted": request.date_posted,
            "employment_types": "FULLTIME",
        }
        if request.country:
            params["country"] = request.country.casefold()
        if request.remote_only:
            params["work_from_home"] = True

        headers = {
            "x-rapidapi-host": "jsearch.p.rapidapi.com",
            "x-rapidapi-key": self._api_key,
        }

        client = get_http_client()
        try:
            response = await client.get(BASE_URL, headers=headers, params=params, timeout=60.0)
        except httpx.HTTPError as exc:
            raise SearchError(f"JSearch request failed: {exc}") from exc

        if response.status_code == 401:
            raise SearchError("JSearch rejected the RapidAPI key (401)")
        if response.status_code == 429:
            raise SearchError("JSearch rate limit exceeded (429)")
        if response.status_code >= 400:
            raise SearchError(f"JSearch HTTP {response.status_code}: {response.text[:200]}")

        payload = response.json()
        return _extract_job_items(payload)


def _extract_job_items(payload: object) -> list[dict]:
    if not isinstance(payload, dict):
        return []

    data = payload.get("data")
    if isinstance(data, dict):
        jobs = data.get("jobs")
        if isinstance(jobs, list):
            return [item for item in jobs if isinstance(item, dict)]

    for key in ("data", "jobs"):
        items = payload.get(key)
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
    return []


def _to_search_result(item: dict) -> SearchResult:
    title = (item.get("job_title") or "").strip()
    url = (item.get("job_apply_link") or item.get("job_google_link") or "").strip()
    if not url:
        apply_options = item.get("apply_options")
        if isinstance(apply_options, list):
            for option in apply_options:
                if isinstance(option, dict):
                    link = (option.get("apply_link") or "").strip()
                    if link:
                        url = link
                        break
    if not title or not url:
        raise SearchError("JSearch returned a job missing title or apply URL")

    company = (item.get("employer_name") or "").strip()
    location = _format_location(item)
    description = (item.get("job_description") or "").strip()
    salary = _format_salary(item)
    posted = (item.get("job_posted_at_datetime_utc") or item.get("job_posted_at") or "").strip()

    snippet_parts = [part for part in (company, location, salary, posted) if part]
    if description:
        snippet_parts.append(description[:1200])
    snippet = " · ".join(snippet_parts) if snippet_parts else title

    return SearchResult(title=title[:500], url=url[:2048], snippet=snippet[:2000])


def _to_search_results(raw: list[dict]) -> list[SearchResult]:
    results: list[SearchResult] = []
    for item in raw:
        try:
            results.append(_to_search_result(item))
        except SearchError:
            continue
    return results


def _format_location(item: dict) -> str:
    parts = [
        str(item.get("job_city") or "").strip(),
        str(item.get("job_state") or "").strip(),
        str(item.get("job_country") or "").strip(),
    ]
    location = ", ".join(part for part in parts if part)
    if item.get("job_is_remote"):
        return f"Remote / {location}" if location else "Remote"
    return location or "Unknown"


def _format_salary(item: dict) -> str:
    minimum = item.get("job_min_salary")
    maximum = item.get("job_max_salary")
    if minimum and maximum:
        period = str(item.get("job_salary_period") or "year").lower()
        return f"${minimum:,} - ${maximum:,} / {period}"
    return ""
