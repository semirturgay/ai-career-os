from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.logging_config import get_logger
from app.prompts import load_prompt
from app.schemas.job_extraction import JobExtraction, JobExtractionLLM
from app.services.capture_text_normalization import extract_job_description_section
from app.services.job_extraction_normalize import normalize_job_payload
from app.services.llm import Message, get_llm_client

logger = get_logger(__name__)


def _full_job_description(job_text: str) -> str:
    text = job_text.strip()
    if not text:
        return "No description extracted."
    section = extract_job_description_section(text)
    return (section or text).strip()


async def structure_job(db: AsyncSession, job_text: str) -> JobExtraction:
    client = await get_llm_client(db)
    llm_extraction = await client.generate_structured(
        messages=[
            Message(role="system", content=load_prompt("job_extraction")),
            Message(role="user", content=f"Job posting text:\n\n{job_text.strip()}"),
        ],
        response_model=JobExtractionLLM,
        transform_payload=normalize_job_payload,
        max_tokens=settings.job_extraction_llm_max_tokens,
    )
    full_description = _full_job_description(job_text)
    extraction = JobExtraction(
        **llm_extraction.model_dump(exclude={"description"}),
        description=full_description,
    )
    logger.info(
        "Structured job — work_mode=%r, location=%r",
        extraction.work_mode,
        extraction.location,
    )
    return extraction
