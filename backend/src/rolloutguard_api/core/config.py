from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
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
    _REPO_ROOT / ".env",
)
# Project .env must win over stale shell env (e.g. other tools setting DEEPSEEK_*).
if _ENV_FILE.exists():
    load_dotenv(_ENV_FILE, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = "sqlite:///./rolloutguard.db"
    demo_user_name: str = "Demo-Analystin"
    demo_user_role: str = "Analystin"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    # low | high | max | disabled (thinking off)
    deepseek_reasoning_effort: str = "low"
    # Set LLM_ENABLED=true in .env for live DeepSeek. CI and clones stay on the mock.
    llm_enabled: bool = False
    composio_api_key: str = ""
    composio_user_id: str = "demo-analystin"
    composio_notion_database_id: str = ""
    composio_notion_page_id: str = ""
    upload_dir: Path = Path("../data/uploads")
    synthetic_dir: Path = Path("../data/synthetic")
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def has_deepseek_api_key(self) -> bool:
        return bool(self.deepseek_api_key.strip())

    @property
    def live_llm_configured(self) -> bool:
        return self.llm_enabled and self.has_deepseek_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
