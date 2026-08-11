"""Contract every ATS board source implements.

These are public, keyless, documented JSON endpoints that employers publish so
job boards can syndicate their listings. We read those — never a human-facing
careers page. See docs/intake-policy.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol, runtime_checkable


class AtsError(Exception):
    """A board could not be read. Isolated per company — never fails a whole tick."""


class AtsBoardNotFoundError(AtsError):
    """The board token does not exist for this provider (a 404, not an outage)."""


@dataclass(frozen=True)
class RawPosting:
    """One role as the ATS advertises it, normalized across providers."""

    external_id: str
    title: str
    description: str
    url: str | None = None
    location: str | None = None
    remote_flag: bool = False
    posted_at: datetime | None = None
    raw_payload: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class AtsSource(Protocol):
    provider: str
    label: str

    def matches_url(self, url: str) -> str | None:
        """Return the board token if this URL belongs to this provider, else None."""
        ...

    def board_url(self, token: str) -> str:
        """Canonical human-facing board URL, for display only."""
        ...

    async def probe(self, token: str) -> bool:
        """Cheap existence check used by slug resolution."""
        ...

    async def fetch(self, token: str) -> list[RawPosting]:
        """All currently open roles on the board, with full descriptions."""
        ...
