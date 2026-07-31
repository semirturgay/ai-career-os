from sqlalchemy.ext.asyncio import AsyncSession

from app.prompts import load_prompt
from app.schemas.job_capture import JobCaptureClassification
from app.services.llm import Message, get_llm_client


def build_capture_classification_message(
    text: str,
    *,
    page_title: str | None = None,
    page_url: str | None = None,
) -> str:
    parts = ["Captured visible page text:\n", text.strip()]
    if page_title:
        parts.append(f"\n\nBrowser tab title: {page_title.strip()}")
    if page_url:
        parts.append(f"\nPage URL (metadata only, not fetched): {page_url.strip()}")
    return "".join(parts)


async def classify_job_capture(
    db: AsyncSession,
    text: str,
    *,
    page_title: str | None = None,
    page_url: str | None = None,
) -> JobCaptureClassification:
    client = await get_llm_client(db)
    return await client.generate_structured(
        messages=[
            Message(role="system", content=load_prompt("job_capture_classification")),
            Message(
                role="user",
                content=build_capture_classification_message(
                    text,
                    page_title=page_title,
                    page_url=page_url,
                ),
            ),
        ],
        response_model=JobCaptureClassification,
    )
