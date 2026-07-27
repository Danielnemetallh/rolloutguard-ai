from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[4]
_ENV_FILE = next(
    (
        p
        for p in (
            _REPO_ROOT / ".env",
            Path.cwd() / ".env",
            Path.cwd().parent / ".env",
        )
        if p.exists()
    ),
    ".env",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    # Prefer Neon Postgres in .env. SQLite is a local/dev fallback when Neon is unset.
    database_url: str = "sqlite:///./rolloutguard.db"
    demo_user_name: str = "Demo Analyst"
    demo_user_role: str = "analyst"
    opencode_api_key: str = ""
    opencode_base_url: str = "https://opencode.ai/zen/v1"
    opencode_model: str = "deepseek-v4-flash-free"
    # low | medium | high | or empty to omit
    opencode_reasoning_effort: str = "medium"
    llm_enabled: bool = False
    upload_dir: Path = Path("../data/uploads")
    synthetic_dir: Path = Path("../data/synthetic")
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
