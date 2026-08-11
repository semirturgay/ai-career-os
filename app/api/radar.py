"""Radar API — watched companies and the postings their ATS boards advertise."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, nulls_last, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_profile_or_404
from app.db.session import get_db
from app.logging_config import get_logger
from app.models import Posting, Profile, WatchedCompany
from app.schemas.api.models import JobRead
from app.schemas.radar import (
    PollResult,
    PostingRead,
    RadarTargetRead,
    RadarTargetUpdate,
    ResolvedBoard,
    ResolveRequest,
    WatchCriteria,
    WatchedCompanyCreate,
    WatchedCompanyRead,
    WatchedCompanyUpdate,
)
from app.services.match.orchestrator import run_match_analysis
from app.services.radar.poller import poll_company, spawn_poll
from app.services.radar.promote import PostingAlreadyPromotedError, promote_posting
from app.services.radar.resolver import BoardNotFoundError, resolve_board

logger = get_logger(__name__)

router = APIRouter(tags=["radar"])


async def get_watched_company_or_404(
    company_id: UUID,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
) -> WatchedCompany:
    company = await db.get(WatchedCompany, company_id)
    if not company or company.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Watched company not found")
    return company


async def get_posting_or_404(
    posting_id: UUID,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
) -> Posting:
    posting = await db.get(Posting, posting_id)
    if not posting or posting.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Posting not found")
    return posting


def _to_read(
    company: WatchedCompany,
    *,
    posting_count: int = 0,
    new_posting_count: int = 0,
) -> WatchedCompanyRead:
    return WatchedCompanyRead(
        id=company.id,
        profile_id=company.profile_id,
        name=company.name,
        ats_provider=company.ats_provider,
        ats_token=company.ats_token,
        board_url=company.board_url,
        criteria=WatchCriteria.model_validate(company.criteria or {}),
        status=company.status,
        last_polled_at=company.last_polled_at,
        last_error=company.last_error,
        last_viewed_at=company.last_viewed_at,
        created_at=company.created_at,
        posting_count=posting_count,
        new_posting_count=new_posting_count,
    )


@router.get("/profiles/{profile_id}/radar", response_model=list[WatchedCompanyRead])
async def list_watched_companies(
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchedCompany)
        .where(WatchedCompany.profile_id == profile.id)
        .order_by(WatchedCompany.name.asc())
    )
    companies = list(result.scalars())
    if not companies:
        return []

    counts = await db.execute(
        select(
            Posting.watched_company_id,
            func.count(Posting.id),
            func.count(Posting.id).filter(Posting.state.in_(("new", "screened"))),
        )
        .where(Posting.profile_id == profile.id)
        .group_by(Posting.watched_company_id)
    )
    by_company = {row[0]: (row[1], row[2]) for row in counts}

    return [
        _to_read(
            company,
            posting_count=by_company.get(company.id, (0, 0))[0],
            new_posting_count=by_company.get(company.id, (0, 0))[1],
        )
        for company in companies
    ]


@router.post("/profiles/{profile_id}/radar/resolve", response_model=ResolvedBoard)
async def resolve_company_board(
    body: ResolveRequest,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a name or careers URL to a board. Nothing is saved until confirmed."""
    try:
        return await resolve_board(body.query, db=db)
    except BoardNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/profiles/{profile_id}/radar",
    response_model=WatchedCompanyRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_watched_company(
    body: WatchedCompanyCreate,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    company = WatchedCompany(
        profile_id=profile.id,
        name=body.name,
        ats_provider=body.ats_provider,
        ats_token=body.ats_token,
        board_url=body.board_url,
        criteria=body.criteria.model_dump(),
        status="active",
    )
    db.add(company)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{body.name} is already on your radar",
        ) from exc

    await db.refresh(company)
    spawn_poll(company.id)
    logger.info("Added %s to radar (%s/%s)", company.name, company.ats_provider, company.ats_token)
    return _to_read(company)


@router.patch("/profiles/{profile_id}/radar/{company_id}", response_model=WatchedCompanyRead)
async def update_watched_company(
    body: WatchedCompanyUpdate,
    company: WatchedCompany = Depends(get_watched_company_or_404),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        company.name = body.name
    if body.criteria is not None:
        company.criteria = body.criteria.model_dump()
    if body.status is not None:
        company.status = body.status
        if body.status == "active":
            company.last_error = None

    await db.commit()
    await db.refresh(company)
    return _to_read(company)


@router.delete("/profiles/{profile_id}/radar/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watched_company(
    company: WatchedCompany = Depends(get_watched_company_or_404),
    db: AsyncSession = Depends(get_db),
):
    await db.delete(company)
    await db.commit()


@router.post("/profiles/{profile_id}/radar/{company_id}/poll", response_model=PollResult)
async def poll_watched_company(
    company: WatchedCompany = Depends(get_watched_company_or_404),
):
    """Poll now. Runs inline so the caller sees the result rather than a spinner."""
    return await poll_company(company.id)


@router.post("/profiles/{profile_id}/radar/{company_id}/viewed", response_model=WatchedCompanyRead)
async def mark_company_viewed(
    company: WatchedCompany = Depends(get_watched_company_or_404),
    db: AsyncSession = Depends(get_db),
):
    company.last_viewed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(company)
    return _to_read(company)


@router.put("/profiles/{profile_id}/radar/target", response_model=RadarTargetRead)
async def set_radar_target(
    body: RadarTargetUpdate,
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    """Set what Radar should surface, then rebuild the feed against it.

    Triage only runs on postings we have not seen, so narrowing the target would
    otherwise leave every previously-stored off-target role sitting in the feed.
    Un-promoted, un-dismissed postings are cleared and the boards re-polled, which
    re-triages them under the new target. Promotions and dismissals are decisions the
    user already made, so those postings survive.
    """
    profile.radar_target = (body.target or "").strip() or None

    cleared = await db.execute(
        delete(Posting).where(
            Posting.profile_id == profile.id,
            Posting.state.in_(("new", "screened")),
        )
    )

    companies = await db.execute(
        select(WatchedCompany.id).where(
            WatchedCompany.profile_id == profile.id,
            WatchedCompany.status == "active",
        )
    )
    company_ids = list(companies.scalars())

    if company_ids:
        # Re-poll now rather than waiting for the next scheduled tick.
        await db.execute(
            update(WatchedCompany)
            .where(WatchedCompany.id.in_(company_ids))
            .values(last_polled_at=None)
        )

    await db.commit()

    for company_id in company_ids:
        spawn_poll(company_id)

    cleared_count = cleared.rowcount or 0
    logger.info(
        "Radar target set for profile %s — cleared %s posting(s), re-polling %s company(ies)",
        profile.id,
        cleared_count,
        len(company_ids),
    )
    return RadarTargetRead(
        radar_target=profile.radar_target,
        cleared_postings=cleared_count,
        repolled_companies=len(company_ids),
    )


# Literal `postings` paths are distinct from the `{company_id}` routes above by segment
# count. If a GET /radar/{company_id} is ever added, declare it *after* this one.
@router.get("/profiles/{profile_id}/radar/postings", response_model=list[PostingRead])
async def list_postings(
    state: list[str] | None = Query(default=None),
    min_score: int | None = Query(default=None, ge=0, le=100),
    company_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Posting, WatchedCompany.name)
        .join(WatchedCompany, Posting.watched_company_id == WatchedCompany.id)
        .where(Posting.profile_id == profile.id)
    )
    if state:
        query = query.where(Posting.state.in_(state))
    else:
        query = query.where(Posting.state.in_(("new", "screened")))
    if min_score is not None:
        query = query.where(Posting.screen_score >= min_score)
    if company_id is not None:
        query = query.where(Posting.watched_company_id == company_id)

    query = query.order_by(
        nulls_last(Posting.screen_score.desc()),
        Posting.first_seen_at.desc(),
    ).limit(limit)

    result = await db.execute(query)
    items: list[PostingRead] = []
    for posting, company_name in result:
        read = PostingRead.model_validate(posting)
        read.company_name = company_name
        items.append(read)
    return items


@router.post("/profiles/{profile_id}/radar/postings/{posting_id}/promote", response_model=JobRead)
async def promote_posting_to_job(
    background_tasks: BackgroundTasks,
    posting: Posting = Depends(get_posting_or_404),
    profile: Profile = Depends(get_profile_or_404),
    db: AsyncSession = Depends(get_db),
):
    try:
        job, analysis_id = await promote_posting(db, posting, profile)
    except PostingAlreadyPromotedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": str(exc), "job_id": str(exc.job_id)},
        ) from exc

    if analysis_id:
        background_tasks.add_task(run_match_analysis, analysis_id)
    return JobRead.model_validate(job)


@router.post(
    "/profiles/{profile_id}/radar/postings/{posting_id}/dismiss",
    response_model=PostingRead,
)
async def dismiss_posting(
    posting: Posting = Depends(get_posting_or_404),
    db: AsyncSession = Depends(get_db),
):
    posting.state = "dismissed"
    await db.commit()
    await db.refresh(posting)
    return PostingRead.model_validate(posting)
