"""Application settings.

Loaded from environment variables (and a .env file at repo root in dev).
Pydantic enforces types at startup so the app fails fast on bad config.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["local", "staging", "production"] = "local"
    app_log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: str = "*"

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "eduadvisor"
    postgres_user: str = "eduadvisor"
    postgres_password: str = Field(default="", repr=False)

    redis_host: str = "redis"
    redis_port: int = 6379

    vault_addr: str = "http://vault:8200"
    vault_dev_root_token_id: str = Field(default="", repr=False)

    # --- M2: DAA / Moodle (real integration; URLs must be reachable from the API container) ---
    daa_base_url: str = "https://daa.uit.edu.vn"
    daa_login_path: str = "/user"
    daa_profile_path: str = "/user"
    daa_grades_path: str = "/sinhvien/kqhoctap"
    daa_grades_summary_path: str = "/sinhvien/kqhoctap"
    daa_schedule_path: str = "/sinhvien/tkb"
    daa_exams_path: str = "/sinhvien/tracuu/lichthi"
    daa_registration_path: str = "/sinhvien/dkhp/thongtindangky"

    moodle_base_url: str = "https://courses.uit.edu.vn"
    moodle_login_path: str = "/login/index.php"
    moodle_calendar_path: str = "/calendar/view.php?view=upcoming"

    http_user_agent: str = "UIT-EduAdvisor/0.1 (+https://github.com/)"
    http_timeout_seconds: float = 45.0

    captcha_state_ttl_seconds: int = 300
    captcha_cooldown_seconds: int = 60
    captcha_fail_threshold: int = 3

    student_session_ttl_seconds: int = 7 * 24 * 60 * 60
    session_cookie_name: str = "uea_session"
    session_cookie_secure: bool = True

    daa_captcha_rate_limit_per_hour: int = 30
    daa_login_rate_limit_per_hour: int = 10

    # --- M4: admin auth ---
    admin_session_ttl_seconds: int = 8 * 60 * 60
    admin_session_cookie_name: str = "uea_admin_session"
    admin_session_cookie_secure: bool = True
    admin_login_rate_limit_per_hour: int = 60
    admin_private_storage_dir: str = "/tmp/uit_eduadvisor_admin_private"
    admin_upload_max_file_size_bytes: int = 10 * 1024 * 1024

    # --- M6: AI Mate (Gemini + RAG; secrets must not appear in repr) ---
    ai_gemini_api_key: str = Field(default="", repr=False)
    ai_gemini_model: str = "gemini-2.0-flash"
    ai_embedding_model: str = "gemini-embedding-2"
    ai_chat_rate_limit_per_minute: int = 27
    ai_chat_rate_limit_per_hour: int = 200
    ai_chat_timeout_seconds: float = 60.0
    ai_stream_first_byte_seconds: float = 3.0
    ai_summary_retention_days: int = 90
    ai_public_policy_retrieve_per_hour: int = 120

    # --- Groq ---
    groq_api_key: str = Field(default="", repr=False)
    groq_model: str = "openai/gpt-oss-120b"

    # --- M7: Remote Bot (tokens are secrets; set repr=False) ---
    discord_bot_token: str = Field(default="", repr=False)
    bot_command_rate_limit_per_hour: int = 50
    bot_link_token_ttl_seconds: int = 600
    reminder_check_interval_seconds: int = 300
    reminder_exam_hours_before: int = 36
    reminder_deadline_hours_before: int = 18

    # --- Email / SMTP ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = Field(default="", repr=False)
    smtp_from_email: str = ""
    smtp_use_tls: bool = False

    postgres_url_override: str | None = None

    @property
    def database_url(self) -> str:
        if self.postgres_url_override:
            return self.postgres_url_override
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        raise RuntimeError(f"Invalid configuration: {exc}") from exc
