from collections.abc import Generator
from uuid import uuid4

from sqlalchemy import create_engine, inspect, or_, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from rolloutguard_api.core.config import get_settings

settings = get_settings()

connect_args: dict = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_agent_message_session_id() -> None:
    """Add session_id to existing agent_messages tables (create_all will not ALTER)."""
    inspector = inspect(engine)
    if "agent_messages" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("agent_messages")}
    with engine.begin() as conn:
        if "session_id" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE agent_messages ADD COLUMN session_id VARCHAR(36) DEFAULT ''"
                )
            )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_agent_messages_session_id "
                "ON agent_messages (session_id)"
            )
        )

    from rolloutguard_api.db import models

    db = SessionLocal()
    try:
        rows = (
            db.query(models.AgentMessage)
            .filter(
                or_(
                    models.AgentMessage.session_id.is_(None),
                    models.AgentMessage.session_id == "",
                )
            )
            .order_by(models.AgentMessage.id.asc())
            .all()
        )
        session_by_run: dict[int, str] = {}
        for row in rows:
            session_by_run.setdefault(row.analysis_run_id, str(uuid4()))
            row.session_id = session_by_run[row.analysis_run_id]
        if rows:
            db.commit()
    finally:
        db.close()


def init_db() -> None:
    # Import models so metadata is populated
    import rolloutguard_api.db.models  # noqa: F401
    from rolloutguard_api.ai.memory import init_corpus_fts

    Base.metadata.create_all(bind=engine)
    _ensure_agent_message_session_id()
    init_corpus_fts(engine)
