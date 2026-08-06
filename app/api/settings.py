from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.discovery import (
    DiscoveryDefaultIntervalRead,
    DiscoveryDefaultIntervalUpdate,
)
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings_service import (
    get_discovery_default_interval,
    get_settings_read,
    set_discovery_default_interval,
    upsert_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
async def read_settings(db: AsyncSession = Depends(get_db)):
    return await get_settings_read(db)


@router.put("", response_model=SettingsRead)
async def update_settings(body: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    return await upsert_settings(db, body)


@router.get("/discovery-default-interval", response_model=DiscoveryDefaultIntervalRead)
async def read_discovery_default_interval(db: AsyncSession = Depends(get_db)):
    interval = await get_discovery_default_interval(db)
    return DiscoveryDefaultIntervalRead(discovery_default_interval=interval)  # type: ignore[arg-type]


@router.put("/discovery-default-interval", response_model=DiscoveryDefaultIntervalRead)
async def update_discovery_default_interval(
    body: DiscoveryDefaultIntervalUpdate,
    db: AsyncSession = Depends(get_db),
):
    interval = await set_discovery_default_interval(db, body.discovery_default_interval)
    return DiscoveryDefaultIntervalRead(discovery_default_interval=interval)  # type: ignore[arg-type]
