"""Shared pytest fixtures — isolated SQLite DB per test session."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
TEST_DB = REPO_ROOT / "backend" / "test_rolloutguard.db"


@pytest.fixture(scope="session", autouse=True)
def _configure_test_env() -> None:
    if TEST_DB.exists():
        TEST_DB.unlink()
    os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
    os.environ["SYNTHETIC_DIR"] = str(REPO_ROOT / "data" / "synthetic")
    os.environ["UPLOAD_DIR"] = str(REPO_ROOT / "data" / "uploads")
    os.environ["LLM_ENABLED"] = "false"

    # Clear cached settings / rebuild engine bindings for tests
    from rolloutguard_api.core.config import get_settings

    get_settings.cache_clear()

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    import rolloutguard_api.db.session as session_mod

    settings = get_settings()
    session_mod.engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        future=True,
    )
    session_mod.SessionLocal = sessionmaker(
        bind=session_mod.engine, autocommit=False, autoflush=False, future=True
    )
    session_mod.init_db()
    yield
    session_mod.engine.dispose()
    try:
        TEST_DB.unlink(missing_ok=True)
    except PermissionError:
        pass
