from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.config import settings
from app.schemas.company_research import SearchResult
from app.services.search.base import SearchConfigurationError


@dataclass(frozen=True)
class JobSearchRequest:
    query: str
    country: str | None = None
    date_posted: str = "week"
    remote_only: bool = False


class JobSearchClient(Protocol):
    async def search(
        self,
        request: JobSearchRequest,
        *,
        max_results: int = 10,
    ) -> list[SearchResult]: ...


def get_job_search_client() -> JobSearchClient:
    from app.services.job_discovery.jsearch import JSearchClient

    api_key = settings.rapidapi_key
    if not api_key or not api_key.strip():
        raise SearchConfigurationError(
            "Job discovery requires RAPIDAPI_KEY (JSearch on RapidAPI). Add it to .env."
        )
    return JSearchClient(api_key.strip())
