"""AI assistant and explanation endpoints."""

from __future__ import annotations

import asyncio
import contextlib
import threading
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from rolloutguard_api.ai.agent import AgentAnswer, run_agent
from rolloutguard_api.ai.cancel import (
    AgentCancelled,
    cancel_inflight,
    register_inflight,
    unregister_inflight,
)
from rolloutguard_api.ai.enrichment import classify_blocker, explain_finding
from rolloutguard_api.ai.memory import (
    delete_agent_session,
    get_agent_session,
    list_agent_sessions,
    new_session_id,
    rename_agent_session,
    resolve_session_id,
)
from rolloutguard_api.ai.provider import get_llm_provider, llm_mock_reason
from rolloutguard_api.api.errors import AppError
from rolloutguard_api.core.config import get_settings
from rolloutguard_api.core.logging import get_logger
from rolloutguard_api.db import models
from rolloutguard_api.db import session as db_session
from rolloutguard_api.db.session import get_db

router = APIRouter(prefix="/api", tags=["assistant"])
log = get_logger(__name__)


class ExplainRequest(BaseModel):
    finding_id: int


class ViewportFinding(BaseModel):
    id: int
    site_id: str = ""
    rule_id: str = ""
    severity: str = ""
    status: str = ""
    message: str = ""
    facts: dict[str, Any] = Field(default_factory=dict)
    evidence_count: int = 0


class ViewportContext(BaseModel):
    page: str = Field(max_length=64)
    label: str = Field(max_length=200)
    finding_id: int | None = None
    kpis: dict[str, Any] = Field(default_factory=dict)
    selected_finding: ViewportFinding | None = None
    visible_findings: list[ViewportFinding] = Field(default_factory=list)
    pending_draft_count: int = 0


class AssistantQuery(BaseModel):
    analysis_run_id: int
    question: str = Field(max_length=2000)
    session_id: str | None = Field(default=None, max_length=36)
    viewport: ViewportContext | None = None
    force_mock: bool = False
    client_request_id: str | None = Field(default=None, max_length=80)


class CancelAssistantQuery(BaseModel):
    client_request_id: str | None = Field(default=None, max_length=80)
    analysis_run_id: int | None = None


class CreateSessionRequest(BaseModel):
    analysis_run_id: int


class RenameSessionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class BlockerRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)


@router.post("/findings/{finding_id}/explain")
def explain(finding_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    finding = db.get(models.FindingRow, finding_id)
    if not finding:
        raise AppError("FINDING_NOT_FOUND", "Befund nicht gefunden", status_code=404)
    provider = get_llm_provider()
    result = explain_finding(
        rule_id=finding.rule_id,
        severity=finding.severity,
        message=finding.message,
        facts=finding.facts_json,
        evidence=finding.evidence_json,
        blocker_comment=(finding.facts_json or {}).get("blocker_comment"),
        provider=provider,
    )
    return {
        "finding_id": finding.id,
        "provider": provider.name,
        "explanation": result.model_dump(),
    }


def _require_analysis_run(db: Session, analysis_run_id: int) -> models.AnalysisRun:
    run = db.get(models.AnalysisRun, analysis_run_id)
    if not run:
        raise AppError("ANALYSIS_NOT_FOUND", "Analyse-Lauf nicht gefunden", status_code=404)
    return run


@router.post("/assistant/sessions")
def create_assistant_session(
    body: CreateSessionRequest, db: Session = Depends(get_db)
) -> dict[str, Any]:
    _require_analysis_run(db, body.analysis_run_id)
    return {
        "session_id": new_session_id(),
        "analysis_run_id": body.analysis_run_id,
        "preview": "",
        "turn_count": 0,
        "created_at": datetime.now(UTC).isoformat(),
        "updated_at": None,
    }


@router.get("/assistant/sessions")
def list_assistant_sessions(
    analysis_run_id: int, db: Session = Depends(get_db)
) -> dict[str, Any]:
    _require_analysis_run(db, analysis_run_id)
    sessions = list_agent_sessions(db, analysis_run_id)
    return {"count": len(sessions), "sessions": sessions}


@router.get("/assistant/sessions/{session_id}")
def get_assistant_session(session_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    session = get_agent_session(db, session_id)
    if not session:
        raise AppError("SESSION_NOT_FOUND", "Sitzung nicht gefunden", status_code=404)
    return session


@router.patch("/assistant/sessions/{session_id}")
def rename_assistant_session(
    session_id: str,
    body: RenameSessionRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not rename_agent_session(db, session_id, body.title):
        raise AppError("SESSION_NOT_FOUND", "Sitzung nicht gefunden", status_code=404)
    session = get_agent_session(db, session_id)
    if not session:
        raise AppError("SESSION_NOT_FOUND", "Sitzung nicht gefunden", status_code=404)
    return session


@router.delete("/assistant/sessions/{session_id}")
def delete_assistant_session(session_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    if not delete_agent_session(db, session_id):
        raise AppError("SESSION_NOT_FOUND", "Sitzung nicht gefunden", status_code=404)
    return {"deleted": True, "session_id": session_id}


def _assistant_payload(
    *,
    provider_name: str,
    session_id: str,
    force_mock: bool,
    answer: AgentAnswer,
) -> dict[str, Any]:
    mock_reason = llm_mock_reason(force_mock=force_mock)
    return {
        "provider": provider_name,
        "session_id": session_id,
        "using_mock": mock_reason is not None,
        "mock_reason": mock_reason,
        "result": answer.model_dump(by_alias=True),
    }


def _run_assistant_query(body: AssistantQuery, cancel: threading.Event) -> dict[str, Any]:
    db = db_session.SessionLocal()
    try:
        _require_analysis_run(db, body.analysis_run_id)
        try:
            session_id = resolve_session_id(
                db,
                analysis_run_id=body.analysis_run_id,
                session_id=body.session_id,
            )
        except ValueError as exc:
            if str(exc) == "session_run_mismatch":
                raise AppError(
                    "SESSION_RUN_MISMATCH",
                    "Sitzung gehört nicht zu diesem Analyse-Lauf",
                    status_code=409,
                ) from exc
            raise AppError("INVALID_SESSION_ID", "Ungültige Sitzungs-ID", status_code=400) from exc

        provider = get_llm_provider(force_mock=body.force_mock)
        try:
            answer = run_agent(
                db,
                analysis_run_id=body.analysis_run_id,
                question=body.question,
                session_id=session_id,
                viewport=body.viewport.model_dump() if body.viewport else None,
                provider=provider,
                cancel_event=cancel,
            )
        except AgentCancelled:
            return {
                "cancelled": True,
                "provider": provider.name,
                "session_id": session_id,
            }
        except Exception as exc:  # noqa: BLE001
            log.warning("assistant_query_failed", error=type(exc).__name__)
            answer = AgentAnswer(
                answer="Die KI-Antwort ist gerade nicht verfügbar. Bitte erneut versuchen.",
                abstained=True,
                confidence=0.0,
            )
        return _assistant_payload(
            provider_name=provider.name,
            session_id=session_id,
            force_mock=body.force_mock,
            answer=answer,
        )
    finally:
        db.close()


@router.post("/assistant/queries/cancel")
def cancel_assistant_query(body: CancelAssistantQuery) -> dict[str, Any]:
    cancelled = cancel_inflight(
        client_request_id=body.client_request_id,
        analysis_run_id=body.analysis_run_id,
    )
    log.info(
        "assistant_query_cancel_requested",
        cancelled=cancelled,
        client_request_id=body.client_request_id,
        analysis_run_id=body.analysis_run_id,
    )
    return {"cancelled": cancelled}


@router.post("/assistant/queries")
async def assistant_query(body: AssistantQuery, request: Request) -> dict[str, Any]:
    cancel = threading.Event()
    inflight_key = register_inflight(
        cancel,
        analysis_run_id=body.analysis_run_id,
        client_request_id=body.client_request_id,
    )

    async def _watch_disconnect() -> None:
        try:
            while not cancel.is_set():
                if await request.is_disconnected():
                    cancel.set()
                    log.info("assistant_query_cancelled", reason="disconnect")
                    return
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            return

    watcher = asyncio.create_task(_watch_disconnect())
    try:
        payload = await asyncio.to_thread(_run_assistant_query, body, cancel)
        if payload.get("cancelled"):
            return JSONResponse(status_code=499, content=payload)  # type: ignore[return-value]
        return payload
    finally:
        cancel.set()
        unregister_inflight(inflight_key, body.analysis_run_id)
        watcher.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await watcher


@router.post("/assistant/classify-blocker")
def blocker_classify(body: BlockerRequest) -> dict[str, Any]:
    provider = get_llm_provider()
    return {
        "provider": provider.name,
        "result": classify_blocker(body.comment, provider=provider),
    }


@router.get("/assistant/status")
def assistant_status() -> dict[str, Any]:
    settings = get_settings()
    provider = get_llm_provider()
    mock_reason = llm_mock_reason()
    model = (
        settings.deepseek_model
        if provider.name != "deterministic-mock"
        else provider.name
    )
    return {
        "llm_enabled": settings.llm_enabled,
        "live_llm_configured": settings.live_llm_configured,
        "provider": provider.name,
        "model": model,
        "base_url": settings.deepseek_base_url,
        "has_api_key": settings.has_deepseek_api_key,
        "using_mock": mock_reason is not None,
        "mock_reason": mock_reason,
    }
