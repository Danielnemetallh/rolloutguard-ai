from fastapi import APIRouter
from sqlalchemy import text

from rolloutguard_api.core.config import get_settings
from rolloutguard_api.db.session import engine

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def ready() -> dict[str, object]:
    settings = get_settings()
    db_ok = False
    db_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:  # noqa: BLE001 — surface readiness failure cleanly
        db_error = type(exc).__name__

    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "database_error": db_error,
        "llm_enabled": settings.llm_enabled,
        "demo_mode": True,
    }
