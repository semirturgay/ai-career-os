from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_profile_or_404
from app.db.session import get_db
from app.logging_config import get_logger
from app.models import JobDiscovery, Profile
from app.schemas.discovery import (
    DiscoveryCreate,
    DiscoveryUpdate,
    JobDiscoveryRead,
)
from app.services.job_discovery.intervals import compute_next_run_at
from app.services.job_discovery.orchestrator import run_discovery
from app.services.job_discovery.serialize import (
    discovery_to_read,
    dismiss_candidate,
)
from app.services.settings_service import get_discovery_default_interval

logger = get_logger(__name__)

router = APIRouter(tags=["discoveries"])


async def get_discovery_or_404(
    profile_id: UUID,
    discovery_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> JobDiscovery:
    discovery = await db.get(JobDiscovery, discovery_id)
    if not discovery or discovery.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return discovery


@router.get("/profiles/{profile_id}/discoveries", response_model=list[JobDiscoveryRead])
async def list_discoveries(
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobDiscovery)
        .where(JobDiscovery.profile_id == profile.id)
        .order_by(JobDiscovery.created_at.desc())
    )
    return [discovery_to_read(item) for item in result.scalars()]


@router.post(
    "/profiles/{profile_id}/discoveries",
    response_model=JobDiscoveryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_discovery(
    body: DiscoveryCreate,
    background_tasks: BackgroundTasks,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    criteria = body.model_dump(exclude={"interval"})
    discovery = JobDiscovery(
        profile_id=profile.id,
        criteria=criteria,
        interval=body.interval,
        enabled=True,
        status="pending",
        candidates=[],
    )
    db.add(discovery)
    await db.commit()
    await db.refresh(discovery)

    background_tasks.add_task(run_discovery, discovery.id)
    logger.info("Queued discovery %s for profile=%s", discovery.id, profile.id)
    return discovery_to_read(discovery)


@router.get("/profiles/{profile_id}/discoveries/{discovery_id}", response_model=JobDiscoveryRead)
async def get_discovery(discovery: JobDiscovery = Depends(get_discovery_or_404)):
    return discovery_to_read(discovery)


@router.patch("/profiles/{profile_id}/discoveries/{discovery_id}", response_model=JobDiscoveryRead)
async def update_discovery(
    body: DiscoveryUpdate,
    discovery: JobDiscovery = Depends(get_discovery_or_404),
    db: AsyncSession = Depends(get_db),
):
    patch = body.model_dump(exclude_unset=True)
    if "enabled" in patch:
        discovery.enabled = patch["enabled"]
    if "interval" in patch:
        discovery.interval = patch["interval"]

    default_interval = await get_discovery_default_interval(db)
    if discovery.enabled and discovery.last_run_at:
        discovery.next_run_at = compute_next_run_at(
            interval=discovery.interval,  # type: ignore[arg-type]
            default_interval=default_interval,  # type: ignore[arg-type]
            from_time=discovery.last_run_at,
        )
    elif not discovery.enabled:
        discovery.next_run_at = None

    await db.commit()
    await db.refresh(discovery)
    return discovery_to_read(discovery)


@router.post(
    "/profiles/{profile_id}/discoveries/{discovery_id}/run",
    response_model=JobDiscoveryRead,
)
async def run_discovery_now(
    background_tasks: BackgroundTasks,
    discovery: JobDiscovery = Depends(get_discovery_or_404),
    db: AsyncSession = Depends(get_db),
):
    if discovery.status in ("running", "pending"):
        return discovery_to_read(discovery)

    discovery.status = "pending"
    discovery.error = None
    await db.commit()
    await db.refresh(discovery)

    background_tasks.add_task(run_discovery, discovery.id)
    logger.info("Manual run queued for discovery %s", discovery.id)
    return discovery_to_read(discovery)


@router.post(
    "/profiles/{profile_id}/discoveries/{discovery_id}/viewed",
    response_model=JobDiscoveryRead,
)
async def mark_discovery_viewed(
    discovery: JobDiscovery = Depends(get_discovery_or_404),
    db: AsyncSession = Depends(get_db),
):
    from datetime import UTC, datetime

    discovery.last_viewed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(discovery)
    return discovery_to_read(discovery)


@router.post(
    "/profiles/{profile_id}/discoveries/{discovery_id}/candidates/{candidate_id}/dismiss",
    response_model=JobDiscoveryRead,
)
async def dismiss_discovery_candidate(
    candidate_id: str,
    discovery: JobDiscovery = Depends(get_discovery_or_404),
    db: AsyncSession = Depends(get_db),
):
    discovery.candidates = dismiss_candidate(discovery.candidates or [], candidate_id)
    await db.commit()
    await db.refresh(discovery)
    return discovery_to_read(discovery)


@router.delete(
    "/profiles/{profile_id}/discoveries/{discovery_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_discovery(
    discovery: JobDiscovery = Depends(get_discovery_or_404),
    db: AsyncSession = Depends(get_db),
):
    await db.delete(discovery)
    await db.commit()
