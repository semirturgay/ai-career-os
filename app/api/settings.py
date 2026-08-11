from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.radar import (
    RadarPollIntervalRead,
    RadarPollIntervalUpdate,
)
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings_service import (
    get_radar_poll_interval,
    get_settings_read,
    set_radar_poll_interval,
    upsert_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsRead)
async def read_settings(db: AsyncSession = Depends(get_db)):
    return await get_settings_read(db)


@router.put("", response_model=SettingsRead)
async def update_settings(body: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    return await upsert_settings(db, body)


@router.get("/radar-poll-interval", response_model=RadarPollIntervalRead)
async def read_radar_poll_interval(db: AsyncSession = Depends(get_db)):
    interval = await get_radar_poll_interval(db)
    return RadarPollIntervalRead(radar_poll_interval=interval)  # type: ignore[arg-type]


@router.put("/radar-poll-interval", response_model=RadarPollIntervalRead)
async def update_radar_poll_interval(
    body: RadarPollIntervalUpdate,
    db: AsyncSession = Depends(get_db),
):
    interval = await set_radar_poll_interval(db, body.radar_poll_interval)
    return RadarPollIntervalRead(radar_poll_interval=interval)  # type: ignore[arg-type]
