from pydantic import BaseModel, Field, field_validator

from app.schemas.discovery import DiscoveryDefaultInterval
from app.schemas.providers import LLMProvider

__all__ = ["LLMProvider", "SettingsRead", "SettingsUpdate", "DiscoveryDefaultInterval"]


class SettingsRead(BaseModel):
    llm_provider: LLMProvider | None
    llm_model: str | None
    llm_base_url: str | None
    api_key_set: bool
    configured: bool
    discovery_default_interval: DiscoveryDefaultInterval = "weekly"


class SettingsUpdate(BaseModel):
    llm_provider: LLMProvider
    llm_model: str | None = Field(default=None, max_length=100)
    llm_base_url: str | None = Field(default=None, max_length=500)
    llm_api_key: str | None = Field(default=None, min_length=1)

    @field_validator("llm_model", "llm_base_url", "llm_api_key", mode="before")
    @classmethod
    def empty_str_to_none(cls, value: str | None) -> str | None:
        if isinstance(value, str) and not value.strip():
            return None
        return value
