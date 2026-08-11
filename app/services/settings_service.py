from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import SettingsValidationError
from app.models import AppSettings
from app.schemas.providers import (
    DEFAULT_BASE_URLS,
    DEFAULT_MODELS,
    LOCAL_PROVIDERS,
    PROVIDER_ENV_KEYS,
    PROVIDER_REGISTRY,
    LLMProvider,
    normalize_provider,
)
from app.schemas.radar import POLL_INTERVAL_DAYS
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.llm.urls import normalize_openai_base_url


@dataclass
class EffectiveLLMSettings:
    provider: LLMProvider
    model: str
    api_key: str | None
    base_url: str | None


def _env_api_key(provider: LLMProvider) -> str | None:
    attr = PROVIDER_ENV_KEYS.get(provider)
    if not attr:
        return None
    return getattr(settings, attr, None)


def _is_configured(
    provider: LLMProvider | None,
    api_key: str | None,
    env_key: str | None,
) -> bool:
    if not provider:
        return False
    if provider in LOCAL_PROVIDERS:
        return True
    return bool(api_key or env_key)


def _validate_provider_config(
    provider: LLMProvider,
    api_key: str | None,
    base_url: str | None,
) -> None:
    meta = PROVIDER_REGISTRY[provider]

    if meta.requires_api_key and not api_key:
        raise SettingsValidationError(
            f"API key required for {meta.label}. "
            "Enter a key or set the matching environment variable on the server."
        )

    if provider == "azure_openai" and not base_url:
        raise SettingsValidationError(
            "Azure OpenAI requires your deployment base URL "
            "(e.g. https://<resource>.openai.azure.com/openai/v1)."
        )


async def get_settings_row(db: AsyncSession) -> AppSettings | None:
    return await db.get(AppSettings, 1)


async def get_settings_read(db: AsyncSession) -> SettingsRead:
    row = await get_settings_row(db)
    provider = normalize_provider(row.llm_provider if row else None)
    env_key = _env_api_key(provider) if provider else None
    poll_interval = row.radar_poll_interval if row else "daily"
    if poll_interval not in POLL_INTERVAL_DAYS:
        poll_interval = "daily"

    return SettingsRead(
        llm_provider=provider,
        llm_model=row.llm_model if row else None,
        llm_base_url=row.llm_base_url if row else None,
        api_key_set=bool(row and row.llm_api_key) or bool(env_key),
        configured=_is_configured(provider, row.llm_api_key if row else None, env_key),
        radar_poll_interval=poll_interval,  # type: ignore[arg-type]
    )


async def upsert_settings(db: AsyncSession, body: SettingsUpdate) -> SettingsRead:
    row = await get_settings_row(db)
    if row is None:
        row = AppSettings(id=1)
        db.add(row)

    row.llm_provider = body.llm_provider
    row.llm_model = body.llm_model or DEFAULT_MODELS[body.llm_provider]
    row.llm_base_url = body.llm_base_url or DEFAULT_BASE_URLS[body.llm_provider]

    meta = PROVIDER_REGISTRY[body.llm_provider]
    if row.llm_base_url and meta.show_base_url:
        row.llm_base_url = normalize_openai_base_url(row.llm_base_url)

    if body.llm_api_key is not None:
        row.llm_api_key = body.llm_api_key

    env_key = _env_api_key(body.llm_provider)
    effective_key = row.llm_api_key or env_key
    _validate_provider_config(body.llm_provider, effective_key, row.llm_base_url)

    await db.commit()
    await db.refresh(row)
    return await get_settings_read(db)


async def get_effective_llm_settings(db: AsyncSession) -> EffectiveLLMSettings | None:
    row = await get_settings_row(db)
    if not row or not row.llm_provider:
        return None

    provider = normalize_provider(row.llm_provider)
    if not provider:
        return None
    env_key = _env_api_key(provider)
    api_key = row.llm_api_key or env_key

    if provider not in LOCAL_PROVIDERS and not api_key:
        return None

    base_url = row.llm_base_url or DEFAULT_BASE_URLS[provider]
    meta = PROVIDER_REGISTRY[provider]
    if base_url and meta.show_base_url:
        base_url = normalize_openai_base_url(base_url)

    return EffectiveLLMSettings(
        provider=provider,
        model=row.llm_model or DEFAULT_MODELS[provider],
        api_key=api_key,
        base_url=base_url,
    )


async def get_radar_poll_interval(db: AsyncSession) -> str:
    row = await get_settings_row(db)
    interval = row.radar_poll_interval if row else "daily"
    if interval not in POLL_INTERVAL_DAYS:
        return "daily"
    return interval


async def set_radar_poll_interval(db: AsyncSession, interval: str) -> str:
    if interval not in POLL_INTERVAL_DAYS:
        raise SettingsValidationError("radar_poll_interval must be daily, 3d, or weekly")

    row = await get_settings_row(db)
    if row is None:
        row = AppSettings(id=1)
        db.add(row)

    row.radar_poll_interval = interval
    await db.commit()
    await db.refresh(row)
    return row.radar_poll_interval
