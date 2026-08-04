from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.logging_config import get_logger
from app.prompts import load_prompt
from app.schemas.job_extraction import JobExtraction
from app.services.job_extraction_normalize import normalize_job_payload
from app.services.llm import Message, get_llm_client

logger = get_logger(__name__)


async def structure_job(db: AsyncSession, job_text: str) -> JobExtraction:
    client = await get_llm_client(db)
    extraction = await client.generate_structured(
        messages=[
            Message(role="system", content=load_prompt("job_extraction")),
            Message(role="user", content=f"Job posting text:\n\n{job_text.strip()}"),
        ],
        response_model=JobExtraction,
        transform_payload=normalize_job_payload,
        max_tokens=settings.job_extraction_llm_max_tokens,
    )
    logger.info(
        "Structured job — work_mode=%r, location=%r",
        extraction.work_mode,
        extraction.location,
    )
    return extraction
