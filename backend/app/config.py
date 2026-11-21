from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.ai_usage import ModelPrice
from app.schemas.payments import PaymentConfig

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    app_env: str = "development"
    # Product identity (ADR-0005): the working name and, once the owner has one, the public address.
    brand_name: str = "TurkTalk"
    public_app_url: str = ""
    manual_payments: PaymentConfig = Field(default_factory=PaymentConfig)
    database_url: str = "sqlite:///./data/trainer.db"
    cors_allowed_origin_regex: str = (
        r"https://turktalk(?:-[a-z0-9-]+)?\.vercel\.app"
    )
    default_level: str = "A2"
    default_session_length: int = Field(default=20, ge=1, le=100)
    auto_next: bool = True
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    review_login_username: str = "turktalkreview"
    review_login_email: str | None = None
    # No built-in administrators: an account becomes admin only when the deployment names it.
    admin_emails: str = ""
    debug_admin_email: str = ""
    free_daily_phrase_limit: int = Field(default=20, ge=1, le=1000)
    premium_daily_phrase_limit: int = Field(default=100, ge=1, le=1000)
    auth_timeout_seconds: float = Field(default=5, gt=0, le=30)
    auth_max_retries: int = Field(default=1, ge=0, le=3)

    telegram_bot_token: SecretStr | None = Field(default=None, repr=False)
    telegram_chat_id: str | None = None
    telegram_timeout_seconds: float = Field(default=3, gt=0, le=10)

    anthropic_api_key: str | None = None
    anthropic_grading_model: str | None = None
    anthropic_utility_model: str | None = None
    # Effort per role (ADR-0007): grading is the judgement-sensitive task.
    anthropic_grading_effort: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    anthropic_utility_effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    # Output ceilings per role. Thinking counts toward them; they also set the worst case the budget guard checks.
    anthropic_grading_max_tokens: int = Field(default=8000, ge=1000, le=64000)
    anthropic_utility_max_tokens: int = Field(default=6000, ge=1000, le=64000)
    anthropic_timeout_seconds: float = Field(default=20, gt=0, le=120)
    anthropic_max_retries: int = Field(default=2, ge=0, le=5)
    # Total time one logical Claude call may take across its retries, so a request fits the 60 s function limit.
    anthropic_call_deadline_seconds: float = Field(default=25, gt=0, le=120)
    anthropic_retry_backoff_seconds: float = Field(default=0.5, ge=0, le=10)
    anthropic_assistance_timeout_seconds: float = Field(default=6, gt=0, le=12)
    anthropic_assistance_max_retries: int = Field(default=0, ge=0, le=1)

    elevenlabs_api_key: str | None = None
    elevenlabs_stt_model: str | None = None
    # Further models the debug admin may switch to for diagnosis. Each needs a price entry.
    elevenlabs_stt_models: list[str] = Field(default_factory=list)
    elevenlabs_base_url: str = "https://api.elevenlabs.io"
    elevenlabs_timeout_seconds: float = Field(default=20, gt=0, le=120)
    elevenlabs_max_retries: int = Field(default=1, ge=0, le=3)
    # Language learners answer in (ISO 639-1). See ADR-0004.
    target_language_code: str = "tr"

    max_audio_bytes: int = Field(default=1_000_000, ge=10_000, le=1_000_000)

    # Spend cap. See docs/architecture/interfaces/budget-guard.md.
    ai_monthly_budget_usd: float = Field(default=25, ge=0)
    ai_price_table: dict[str, ModelPrice] = Field(default_factory=dict)
    # Per-user share of the budget per UTC day, so one account cannot drain it (quality Q-2).
    ai_free_user_daily_budget_usd: float = Field(default=1.0, ge=0)
    ai_premium_user_daily_budget_usd: float = Field(default=3.0, ge=0)
    ai_budget_alert_fraction: float = Field(default=0.8, gt=0, le=1)
    ai_max_audio_seconds: float = Field(default=130, gt=0)

    mastery_consolidating_threshold: float = Field(default=0.65, ge=0, le=1)
    mastery_mastered_threshold: float = Field(default=0.85, ge=0, le=1)
    long_reaction_ms: int = Field(default=2500, ge=0)
    long_internal_pause_ms: int = Field(default=1500, ge=0)


@lru_cache
def get_settings() -> Settings:
    return Settings()
