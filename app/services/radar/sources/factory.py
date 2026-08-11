"""ATS source registry — mirrors app/services/search/factory.py."""

from __future__ import annotations

from app.services.radar.sources.ashby import AshbySource
from app.services.radar.sources.base import AtsSource
from app.services.radar.sources.greenhouse import GreenhouseSource
from app.services.radar.sources.lever import LeverSource

# Order matters for slug probing: most common first, so a hit costs fewer requests.
_SOURCES: tuple[AtsSource, ...] = (
    GreenhouseSource(),
    LeverSource(),
    AshbySource(),
)

_BY_PROVIDER: dict[str, AtsSource] = {source.provider: source for source in _SOURCES}


def all_sources() -> tuple[AtsSource, ...]:
    return _SOURCES


def get_source(provider: str) -> AtsSource:
    source = _BY_PROVIDER.get(provider)
    if source is None:
        raise KeyError(f"Unknown ATS provider: {provider}")
    return source


def supported_providers() -> list[str]:
    return [source.provider for source in _SOURCES]
