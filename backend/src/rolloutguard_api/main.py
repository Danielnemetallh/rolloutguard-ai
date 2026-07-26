from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rolloutguard_api.api.errors import AppError, app_error_handler
from rolloutguard_api.api.health import router as health_router
from rolloutguard_api.core.config import get_settings
from rolloutguard_api.core.logging import configure_logging, get_logger

configure_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.synthetic_dir.mkdir(parents=True, exist_ok=True)
    log.info(
        "app_started",
        env=settings.app_env,
        llm_enabled=settings.llm_enabled,
        upload_dir=str(settings.upload_dir.resolve()),
    )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="RolloutGuard AI",
        description=(
            "Evidence-linked Excel reconciliation and milestone compliance "
            "for synthetic mobile-network rollout data. Demo mode — synthetic data only."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(health_router)

    @app.get("/api/meta")
    def meta() -> dict[str, object]:
        s = get_settings()
        return {
            "name": "RolloutGuard AI",
            "demo_mode": True,
            "synthetic_data": True,
            "disclaimer": (
                "Independent prototype with fictional data. "
                "Not affiliated with or commissioned by any telecommunications operator."
            ),
            "user": {
                "display_name": s.demo_user_name,
                "role": s.demo_user_role,
            },
            "llm_enabled": s.llm_enabled,
            "llm_model": s.opencode_model if s.llm_enabled else "deterministic-mock",
        }

    return app


app = create_app()


def main() -> None:
    import uvicorn
    from dotenv import load_dotenv

    # backend/src/rolloutguard_api/main.py -> repo root is parents[3]
    env_path = Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(env_path)

    uvicorn.run(
        "rolloutguard_api.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )
