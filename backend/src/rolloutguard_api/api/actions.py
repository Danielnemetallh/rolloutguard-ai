"""Proposed actions, documents, mappings, Composio connect."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from rolloutguard_api.api.errors import AppError
from rolloutguard_api.core.config import get_settings
from rolloutguard_api.db import models
from rolloutguard_api.db.session import get_db
from rolloutguard_api.integrations.composio_executor import connect_link, integration_status
from rolloutguard_api.services.actions import (
    approve_mapping,
    confirm_action,
    dismiss_action,
    list_actions,
    pending_mappings,
    upsert_draft,
)
from rolloutguard_api.services.analysis import ensure_demo_project
from rolloutguard_api.services.documents import ingest_document, list_documents
from rolloutguard_api.services.ingest import IngestError

router = APIRouter(prefix="/api", tags=["actions"])


class MappingApprove(BaseModel):
    canonical_field: str | None = None


class ManualDraft(BaseModel):
    analysis_run_id: int
    action_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    site_id: str | None = None


@router.get("/projects/{project_id}/actions")
def get_actions(
    project_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ensure_demo_project(db)
    return {"actions": list_actions(db, project_id=project_id, status=status)}


@router.post("/actions/{action_id}/confirm")
def post_confirm(action_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = confirm_action(db, action_id)
    if result.get("error"):
        raise AppError("ACTION_NOT_FOUND", "Aktion nicht gefunden", status_code=404)
    return result


@router.post("/actions/{action_id}/dismiss")
def post_dismiss(action_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = dismiss_action(db, action_id)
    if result.get("error"):
        raise AppError("ACTION_NOT_FOUND", "Aktion nicht gefunden", status_code=404)
    return result


@router.post("/projects/{project_id}/actions/draft")
def post_manual_draft(
    project_id: int, body: ManualDraft, db: Session = Depends(get_db)
) -> dict[str, Any]:
    ensure_demo_project(db)
    if db.get(models.Project, project_id) is None:
        raise AppError("PROJECT_NOT_FOUND", "Projekt nicht gefunden", status_code=404)
    row = upsert_draft(
        db,
        action_type=body.action_type,
        payload=body.payload,
        analysis_run_id=body.analysis_run_id,
        site_ids=[body.site_id] if body.site_id else [],
    )
    return {"id": row.id, "status": row.status, "action_type": row.action_type}


@router.get("/integrations/status")
def get_integrations() -> dict[str, Any]:
    return integration_status()


@router.post("/integrations/connect")
def post_connect() -> dict[str, Any]:
    return connect_link()


@router.get("/projects/{project_id}/documents")
def get_documents(project_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    ensure_demo_project(db)
    return {"documents": list_documents(db, project_id)}


@router.post("/projects/{project_id}/documents")
async def post_document(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ensure_demo_project(db)
    if db.get(models.Project, project_id) is None:
        raise AppError("PROJECT_NOT_FOUND", "Projekt nicht gefunden", status_code=404)
    settings = get_settings()
    dest_dir = Path(settings.upload_dir) / "documents"
    dest_dir.mkdir(parents=True, exist_ok=True)
    original = file.filename or "document.bin"
    dest = dest_dir / original
    dest.write_bytes(await file.read())
    try:
        doc = ingest_document(db, project_id=project_id, path=dest, original_name=original)
    except IngestError as exc:
        raise AppError(exc.code, exc.message, details=exc.details) from exc
    return {
        "id": doc.id,
        "filename": doc.filename,
        "kind": doc.kind,
        "extract": doc.extract_json,
    }


@router.get("/projects/{project_id}/mappings")
def get_mappings(project_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    ensure_demo_project(db)
    return {"mappings": pending_mappings(db, project_id)}


@router.post("/column-mappings/{mapping_id}/approve")
def post_mapping_approve(
    mapping_id: int,
    body: MappingApprove,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    result = approve_mapping(db, mapping_id, canonical_field=body.canonical_field)
    if result.get("error"):
        raise AppError("MAPPING_NOT_FOUND", "Zuordnung nicht gefunden", status_code=404)
    return result
