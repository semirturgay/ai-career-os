import os
from pathlib import Path

DOCKER_HOST_GATEWAY_ENV = "LLM_HOST_GATEWAY"
DEFAULT_DOCKER_HOST_GATEWAY = "host.docker.internal"


def _docker_host_gateway() -> str | None:
    """When the API runs in Docker, local LLMs (LM Studio/Ollama) live on the host."""
    explicit = os.environ.get(DOCKER_HOST_GATEWAY_ENV, "").strip()
    if explicit:
        return explicit
    if Path("/.dockerenv").exists():
        return DEFAULT_DOCKER_HOST_GATEWAY
    return None


def _rewrite_local_host(url: str, gateway: str) -> str:
    for host in ("127.0.0.1", "localhost"):
        url = url.replace(f"://{host}:", f"://{gateway}:")
        if url.endswith(f"://{host}"):
            url = f"{url[: -len(host)]}{gateway}"
    return url


def normalize_openai_base_url(base_url: str) -> str:
    """Normalize OpenAI-compatible base URLs and end with /v1."""
    url = base_url.strip().rstrip("/")
    gateway = _docker_host_gateway()
    if gateway:
        url = _rewrite_local_host(url, gateway)
    else:
        # Host-native: prefer 127.0.0.1 over localhost (macOS IPv6 hangs)
        url = url.replace("://localhost:", "://127.0.0.1:")
        if url.endswith("://localhost"):
            url = f"{url[: -len('localhost')]}127.0.0.1"
    if not url.endswith("/v1"):
        url = f"{url}/v1"
    return url
