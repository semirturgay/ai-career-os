from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "AI Career OS"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://career:career@127.0.0.1:5432/ai_career_os"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Match analysis: retrieve relevant resume chunks before LLM call
    match_rag_enabled: bool = True
    match_rag_top_k: int = 10
    match_rag_embed_model: str = "BAAI/bge-small-en-v1.5"
    match_rag_embed_dims: int = 384
    match_rag_per_requirement: bool = True
    match_rag_per_requirement_top_k: int = 3
    match_compact_job_prompt: bool = True
    match_llm_max_tokens: int = 768
    cover_letter_max_body_chars: int = 400
    cover_letter_llm_max_tokens: int = 512
    app_web_url: str = "http://localhost:5173"

    # Optional env fallbacks for LLM (overridden by DB settings when set)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    google_api_key: str | None = None
    groq_api_key: str | None = None
    mistral_api_key: str | None = None
    together_api_key: str | None = None
    azure_openai_api_key: str | None = None
    nvidia_api_key: str | None = None


settings = Settings()
