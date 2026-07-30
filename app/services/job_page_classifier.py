from sqlalchemy.ext.asyncio import AsyncSession

from app.prompts import load_prompt
from app.schemas.job_page_classify import JobPageClassification
from app.services.llm import Message, get_llm_client

CLASSIFY_MAX_TOKENS = 256


def build_classify_user_message(
    text_sample: str,
    *,
    url: str | None = None,
    page_title: str | None = None,
) -> str:
    parts = ["Page text sample (from visible DOM):\n", text_sample.strip()]
    if page_title:
        parts.append(f"\n\nBrowser tab title: {page_title.strip()}")
    if url:
        parts.append(f"\n\nPage URL (metadata only): {url.strip()}")
    return "".join(parts)


async def classify_job_page(
    db: AsyncSession,
    text_sample: str,
    *,
    url: str | None = None,
    page_title: str | None = None,
) -> JobPageClassification:
    client = await get_llm_client(db)
    return await client.generate_structured(
        messages=[
            Message(role="system", content=load_prompt("job_page_classify")),
            Message(
                role="user",
                content=build_classify_user_message(
                    text_sample,
                    url=url,
                    page_title=page_title,
                ),
            ),
        ],
        response_model=JobPageClassification,
        max_tokens=CLASSIFY_MAX_TOKENS,
    )
