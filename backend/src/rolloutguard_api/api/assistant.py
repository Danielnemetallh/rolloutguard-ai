"""AI assistant and explanation endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from rolloutguard_api.ai.agent import run_agent
from rolloutguard_api.ai.enrichment import classify_blocker, explain_finding
from rolloutguard_api.ai.provider import get_llm_provider
from rolloutguard_api.api.errors import AppError
from rolloutguard_api.core.config import get_settings
from rolloutguard_api.db import models
from rolloutguard_api.db.session import get_db

router = APIRouter(prefix="/api", tags=["assistant"])


class ExplainRequest(BaseModel):
    finding_id: int


class AssistantQuery(BaseModel):
    analysis_run_id: int
    question: str = Field(max_length=2000)
    force_mock: bool = False


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


@router.post("/assistant/queries")
def assistant_query(body: AssistantQuery, db: Session = Depends(get_db)) -> dict[str, Any]:
    provider = get_llm_provider(force_mock=body.force_mock)
    answer = run_agent(
        db,
        analysis_run_id=body.analysis_run_id,
        question=body.question,
        provider=provider,
    )
    return {
        "provider": provider.name,
        "result": answer.model_dump(by_alias=True),
    }


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
    model = (
        settings.deepseek_model
        if provider.name != "deterministic-mock"
        else provider.name
    )
    return {
        "llm_enabled": settings.llm_enabled,
        "provider": provider.name,
        "model": model,
        "base_url": settings.deepseek_base_url,
        "has_api_key": bool(settings.deepseek_api_key),
    }
