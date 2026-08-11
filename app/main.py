import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.feedback import router as feedback_router
from app.api.jobs import router as jobs_router
from app.api.llm import router as llm_router
from app.api.match_analyses import router as match_analyses_router
from app.api.profiles import router as profiles_router
from app.api.radar import router as radar_router
from app.api.settings import router as settings_router
from app.config import settings
from app.db.session import engine
from app.logging_config import (
    RequestIdMiddleware,
    RequestLoggingMiddleware,
    get_logger,
    setup_logging,
)
from app.services.document_classifier.tuning_log import log_classifier_tuning_log_location
from app.services.http_client import close_http_client, init_http_client
from app.services.radar.poller import radar_scheduler_loop

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.app_name)
    log_classifier_tuning_log_location()
    await init_http_client()
    scheduler_task = asyncio.create_task(radar_scheduler_loop())
    yield
    scheduler_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await scheduler_task
    logger.info("Shutting down — disposing DB engine and HTTP client")
    await close_http_client()
    await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(profiles_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(match_analyses_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(llm_router, prefix="/api/v1")
app.include_router(radar_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
