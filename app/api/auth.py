"""Optional shared-secret gate for the API.

AI Career OS is built to run on the machine that owns the data, where "who is calling"
is answered by the network: nothing outside localhost can reach it. That answer stops
being true the moment the backend is deployed somewhere with a public URL, and there is
no user model to fall back on — every resource is nested under ``/profiles/{id}`` and
the only check is whether that row exists. An exposed instance is a readable *and
writable* resume database for anyone who finds the hostname.

Setting ``API_TOKEN`` closes that gap without inventing an auth system this app does not
otherwise need. Leave it unset and the API behaves exactly as it always has, so nobody
running ``docker compose up`` on their laptop has to care.

This is a deployment lock, not multi-user auth: one token, one operator, no per-user
data separation. Sharing an instance between people means sharing one pile of data.
"""

from collections.abc import Callable
from secrets import compare_digest

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.logging_config import get_logger

logger = get_logger(__name__)

TOKEN_HEADER = "X-API-Token"

# Platform health checks are unauthenticated by necessity — Render, Railway and friends
# probe this before any config of ours is in play, and it discloses nothing but liveness.
PUBLIC_PATHS = frozenset({"/health"})


def _presented_token(request: Request) -> str | None:
    """Accept the standard bearer header, or a plain one for clients without auth plumbing."""
    authorization = request.headers.get("Authorization", "")
    scheme, _, credentials = authorization.partition(" ")
    if scheme.casefold() == "bearer" and credentials:
        return credentials

    return request.headers.get(TOKEN_HEADER) or None


class ApiTokenMiddleware(BaseHTTPMiddleware):
    """Require a shared secret on every request once ``API_TOKEN`` is configured."""

    def __init__(self, app: Callable, token: str | None) -> None:
        super().__init__(app)
        self._token = token
        if token:
            logger.info("API token gate is active — requests must present a token")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if self._token is None or self._is_exempt(request):
            return await call_next(request)

        presented = _presented_token(request)
        # compare_digest keeps the comparison time independent of how much of the token
        # matched, so a public instance cannot be brute-forced a character at a time.
        if presented is None or not compare_digest(presented, self._token):
            logger.warning("Rejected unauthenticated %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=401,
                content={
                    "detail": (
                        "Missing or invalid API token. This backend was started with "
                        "API_TOKEN set; send it as `Authorization: Bearer <token>`."
                    )
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        return await call_next(request)

    @staticmethod
    def _is_exempt(request: Request) -> bool:
        # CORSMiddleware sits outside this one and answers preflights itself, so an
        # OPTIONS should never arrive here. Exempting it anyway costs nothing and means
        # reordering the stack later surfaces as a 401 rather than as an opaque
        # browser-side CORS failure, which is far harder to trace back to this file.
        return request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS
