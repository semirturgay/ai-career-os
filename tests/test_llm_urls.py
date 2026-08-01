from pathlib import Path
from unittest.mock import patch

from app.services.llm.urls import normalize_openai_base_url


def test_host_native_prefers_127_over_localhost():
    assert normalize_openai_base_url("http://localhost:1234") == "http://127.0.0.1:1234/v1"


def test_host_native_keeps_127():
    assert normalize_openai_base_url("http://127.0.0.1:1234/v1") == "http://127.0.0.1:1234/v1"


def test_host_native_rewrites_docker_gateway_to_localhost(monkeypatch):
    monkeypatch.delenv("LLM_HOST_GATEWAY", raising=False)
    with patch.object(Path, "exists", return_value=False):
        assert (
            normalize_openai_base_url("http://host.docker.internal:1234/v1")
            == "http://127.0.0.1:1234/v1"
        )


def test_docker_rewrites_localhost_to_host_gateway(monkeypatch):
    monkeypatch.setenv("LLM_HOST_GATEWAY", "host.docker.internal")
    assert (
        normalize_openai_base_url("http://127.0.0.1:1234/v1")
        == "http://host.docker.internal:1234/v1"
    )
    assert (
        normalize_openai_base_url("http://localhost:11434")
        == "http://host.docker.internal:11434/v1"
    )


def test_dockerenv_file_triggers_gateway_rewrite(monkeypatch):
    monkeypatch.delenv("LLM_HOST_GATEWAY", raising=False)
    with patch.object(Path, "exists", return_value=True):
        assert (
            normalize_openai_base_url("http://127.0.0.1:1234")
            == "http://host.docker.internal:1234/v1"
        )


def test_custom_gateway_env(monkeypatch):
    monkeypatch.setenv("LLM_HOST_GATEWAY", "gateway.test")
    assert normalize_openai_base_url("http://127.0.0.1:1234") == "http://gateway.test:1234/v1"
