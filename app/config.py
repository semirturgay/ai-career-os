from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra="ignore" so a stale key in someone's .env (a provider we dropped, a setting
    # that was renamed) never blocks startup — and so we don't accumulate dead fields
    # here just to keep old .env files loading.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AI Career OS"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://career:career@127.0.0.1:5432/ai_career_os"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8765",
    ]

    # Match analysis: retrieve relevant resume chunks before LLM call
    match_rag_enabled: bool = True
    match_rag_top_k: int = 10
    match_rag_embed_model: str = "BAAI/bge-small-en-v1.5"
    match_rag_embed_dims: int = 384
    match_rag_per_requirement: bool = True
    match_rag_per_requirement_top_k: int = 3
    match_compact_job_prompt: bool = True
    match_llm_max_tokens: int = 768
    job_extraction_llm_max_tokens: int = 2048
    cover_letter_max_body_chars: int = 400
    cover_letter_llm_max_tokens: int = 512
    app_web_url: str = "http://localhost:5173"

    document_classifier_enabled: bool = True
    document_classifier_model: str = "smr123/resume-job-classifier"
    document_classifier_min_confidence: float = 0.45
    document_classifier_max_length: int = 512
    document_classifier_chunk_size: int = 800
    document_classifier_chunk_overlap: int = 200
    document_classifier_tuning_log_enabled: bool = True
    document_classifier_tuning_log_path: str = "data/classifier_tuning_log.csv"

    # Optional env fallbacks for LLM (overridden by DB settings when set)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    google_api_key: str | None = None
    groq_api_key: str | None = None
    mistral_api_key: str | None = None
    together_api_key: str | None = None
    azure_openai_api_key: str | None = None
    nvidia_api_key: str | None = None

    # Web search providers (optional — company research and Radar board resolution
    # use every provider that is configured).
    tavily_api_key: str | None = None
    search_include_duckduckgo: bool = True

    # Radar: how long a claimed poll may run before the reaper reclaims it.
    radar_stale_claim_minutes: int = 15
    radar_max_concurrent_polls: int = 4
    radar_screen_limit_per_poll: int = 20


settings = Settings()
