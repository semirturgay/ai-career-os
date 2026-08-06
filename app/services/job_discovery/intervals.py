from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

from app.schemas.discovery import DiscoveryDefaultInterval, DiscoveryInterval

INTERVAL_DAYS: dict[DiscoveryDefaultInterval, int] = {
    "daily": 1,
    "3d": 3,
    "weekly": 7,
}


def resolve_interval(
    interval: DiscoveryInterval,
    default_interval: DiscoveryDefaultInterval,
) -> DiscoveryDefaultInterval:
    if interval == "default":
        return default_interval
    return interval  # type: ignore[return-value]


def compute_next_run_at(
    *,
    interval: DiscoveryInterval,
    default_interval: DiscoveryDefaultInterval,
    from_time: datetime | None = None,
) -> datetime:
    base = from_time or datetime.now(UTC)
    resolved = resolve_interval(interval, default_interval)
    days = INTERVAL_DAYS[resolved]
    return base + timedelta(days=days)


def hostname_from_url(url: str) -> str | None:
    try:
        host = urlparse(url).hostname or ""
        return host.removeprefix("www.") or None
    except Exception:
        return None
