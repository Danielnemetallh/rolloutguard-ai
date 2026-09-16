"""Analysis and import API routes."""

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
from rolloutguard_api.services.analysis import (
    AnalysisSourceError,
    diff_against_previous,
    ensure_demo_project,
    findings_to_dicts,
    list_analysis_runs,
    load_sites_for_timeline,
    run_analysis_from_paths,
)
from rolloutguard_api.services.documents import ingest_document
from rolloutguard_api.services.export import export_analysis
from rolloutguard_api.services.ingest import IngestError

router = APIRouter(prefix="/api", tags=["analysis"])


class ReviewRequest(BaseModel):
    decision: str = Field(pattern="^(approve|dismiss|assign)$")
    reason: str | None = None


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    ensure_demo_project(db)
    projects = db.query(models.Project).all()
    return [{"id": p.id, "name": p.name, "timezone": p.timezone} for p in projects]


@router.post("/projects/{project_id}/analyze-synthetic")
def analyze_synthetic(project_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    """One-click demo: analyze the checked-in synthetic workbooks."""
    settings = get_settings()
    synth = Path(settings.synthetic_dir)
    paths = {
        "contract": synth / "contract_obligations.xlsx",
        "schedule": synth / "partner_schedule.xlsx",
        "status": synth / "site_project_status.xlsx",
    }
    for p in paths.values():
        if not p.exists():
            raise AppError(
                "SYNTHETIC_MISSING",
                "Synthetische Arbeitsmappen fehlen. scripts/generate-synthetic.ps1 ausführen.",
                status_code=404,
                details={"path": str(p)},
            )
    try:
        run, analysis, sites = run_analysis_from_paths(db, paths, project_id=project_id)
    except IngestError as exc:
        raise AppError(exc.code, exc.message, details=exc.details) from exc

    return {
        "analysis_run_id": run.id,
        "batch_id": run.batch_id,
        "kpis": analysis.kpis,
        "site_count": len(sites),
        "hero_findings": [
            {
                "site_id": f.site_id,
                "rule_id": f.rule_id,
                "severity": f.severity,
                "message": f.message,
            }
            for f in analysis.findings
            if f.site_id == "DE-NRW-0107"
        ],
    }


@router.get("/projects/{project_id}/analyses")
def list_analyses(project_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    if db.get(models.Project, project_id) is None:
        raise AppError("PROJECT_NOT_FOUND", "Projekt nicht gefunden", status_code=404)
    runs = list_analysis_runs(db, project_id)
    return {
        "project_id": project_id,
        "count": len(runs),
        "analyses": [
            {
                "id": r.id,
                "batch_id": r.batch_id,
                "status": r.status,
                "kpis": r.summary_json,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in runs
        ],
    }


@router.get("/analyses/{analysis_id}/diff")
def get_analysis_diff(analysis_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        return diff_against_previous(db, analysis_id)
    except ValueError as exc:
        raise AppError(
            "ANALYSIS_NOT_FOUND",
            "Analyse-Lauf nicht gefunden",
            status_code=404,
        ) from exc


@router.post("/projects/{project_id}/imports")
async def upload_imports(
    project_id: int,
    contract: UploadFile | None = File(None),
    schedule: UploadFile | None = File(None),
    status: UploadFile | None = File(None),
    files: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ensure_demo_project(db)
    if db.get(models.Project, project_id) is None:
        raise AppError("PROJECT_NOT_FOUND", "Projekt nicht gefunden", status_code=404)

    settings = get_settings()
    upload_root = Path(settings.upload_dir) / "incoming"
    upload_root.mkdir(parents=True, exist_ok=True)

    async def _save(upload: UploadFile, fallback_name: str) -> tuple[Path, str]:
        original = upload.filename or fallback_name
        content = await upload.read()
        suffix = Path(original).suffix.lower()
        content_type = (upload.content_type or "").lower()
        looks_xlsx = (
            suffix in {".xlsx", ".xlsm"}
            or content[:2] == b"PK"
            or "spreadsheetml" in content_type
            or content_type == "application/vnd.ms-excel"
        )
        if not looks_xlsx:
            raise AppError(
                "UNSUPPORTED_FILE_TYPE",
                "Nur Excel-Arbeitsmappen (.xlsx) können abgeglichen werden.",
                details={"file": original},
            )
        stem = Path(original).stem or "workbook"
        dest = upload_root / f"{stem}.xlsx"
        dest.write_bytes(content)
        return dest, original

    uploads: dict[str, Path] = {}
    originals: list[tuple[Path, str]] = []

    named = {"contract": contract, "schedule": schedule, "status": status}
    for slot, upload in named.items():
        if upload is None or not upload.filename:
            continue
        path, original_name = await _save(upload, f"{slot}.xlsx")
        uploads[slot] = path
        originals.append((path, original_name))

    for upload in files or []:
        if upload is None or not (upload.filename or "").strip():
            continue
        path, original_name = await _save(upload, upload.filename or "workbook.xlsx")
        slot = _workbook_slot_from_name(original_name)
        if slot is None or slot in uploads:
            slot = next(
                (key for key in ("contract", "schedule", "status") if key not in uploads),
                None,
            )
        if slot is None:
            continue
        uploads[slot] = path
        originals.append((path, original_name))

    if not uploads:
        raise AppError("NO_WORKBOOKS", "Keine Excel-Datei empfangen.", status_code=400)

    listed: list[str] = []
    try:
        for path, filename in originals:
            display = filename if Path(filename).suffix else f"{Path(filename).stem}.xlsx"
            ingest_document(db, project_id=project_id, path=path, original_name=display)
            listed.append(display)
        db.commit()
    except IngestError as exc:
        raise AppError(exc.code, exc.message, details=exc.details) from exc

    synth = Path(settings.synthetic_dir)
    defaults = {
        "contract": synth / "contract_obligations.xlsx",
        "schedule": synth / "partner_schedule.xlsx",
        "status": synth / "site_project_status.xlsx",
    }
    paths = {**defaults, **uploads}
    missing = [key for key, path in paths.items() if not path.exists()]
    if missing:
        raise AppError(
            "SYNTHETIC_MISSING",
            "Synthetische Arbeitsmappen fehlen. scripts/generate-synthetic.ps1 ausführen.",
            status_code=404,
            details={"missing": missing},
        )

    try:
        run, analysis, sites = run_analysis_from_paths(db, paths, project_id=project_id)
    except IngestError as exc:
        raise AppError(exc.code, exc.message, details=exc.details) from exc

    return {
        "analysis_run_id": run.id,
        "batch_id": run.batch_id,
        "kpis": analysis.kpis,
        "site_count": len(sites),
        "imported_files": listed,
        "filled_from_synthetic": [key for key in defaults if key not in uploads],
    }


def _workbook_slot_from_name(filename: str) -> str | None:
    name = filename.lower()
    if any(token in name for token in ("contract", "obligation", "vertrag")):
        return "contract"
    if any(token in name for token in ("schedule", "partner", "termin")):
        return "schedule"
    if any(token in name for token in ("status", "standort", "kaggle_site")):
        return "status"
    if "site_project" in name or "project_status" in name:
        return "status"
    return None


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    run = db.get(models.AnalysisRun, analysis_id)
    if not run:
        raise AppError("ANALYSIS_NOT_FOUND", "Analyse-Lauf nicht gefunden", status_code=404)
    return {
        "id": run.id,
        "batch_id": run.batch_id,
        "status": run.status,
        "rule_set_checksum": run.rule_set_checksum,
        "kpis": run.summary_json,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/analyses/{analysis_id}/findings")
def list_findings(
    analysis_id: int,
    severity: str | None = None,
    rule_id: str | None = None,
    site_id: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    run = db.get(models.AnalysisRun, analysis_id)
    if not run:
        raise AppError("ANALYSIS_NOT_FOUND", "Analyse-Lauf nicht gefunden", status_code=404)
    items = findings_to_dicts(
        analysis_id,
        db,
        severity=severity,
        rule_id=rule_id,
        site_id=site_id,
        status=status,
    )
    return {"analysis_run_id": analysis_id, "count": len(items), "findings": items}


@router.get("/sites/{site_id}/timeline")
def site_timeline(
    site_id: str,
    analysis_id: int | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Rebuild the timeline from the selected run's persisted source workbooks."""
    try:
        effective_analysis_id, sites = load_sites_for_timeline(db, analysis_id)
    except AnalysisSourceError as exc:
        status_code = 404 if exc.code in {
            "ANALYSIS_NOT_FOUND",
            "ANALYSIS_BATCH_NOT_FOUND",
            "ANALYSIS_SOURCE_MISSING",
            "ANALYSIS_SOURCE_INCOMPLETE",
            "SYNTHETIC_MISSING",
        } else 400
        raise AppError(exc.code, exc.message, status_code=status_code, details=exc.details) from exc
    site = sites.get(site_id)
    if not site:
        raise AppError(
            "SITE_NOT_FOUND",
            "Standort nicht gefunden",
            status_code=404,
            details={"site_id": site_id},
        )

    findings = []
    if effective_analysis_id:
        findings = findings_to_dicts(effective_analysis_id, db, site_id=site_id)

    fibre = site.fibre_ready_date.isoformat() if site.fibre_ready_date else None
    planned = site.planned_date.isoformat() if site.planned_date else None
    forecast = site.forecast_date.isoformat() if site.forecast_date else None
    actual = site.actual_date.isoformat() if site.actual_date else None
    due = site.contractual_due_date.isoformat() if site.contractual_due_date else None

    return {
        "site_id": site.site_id,
        "partner_id": site.partner_id,
        "timeline": {
            "permit_status": site.permit_status,
            "construction_status": site.construction_status,
            "fibre_ready_date": fibre,
            "planned_integration": planned,
            "forecast_integration": forecast,
            "actual_integration": actual,
            "contractual_due_date": due,
            "integration_test_status": site.integration_test_status,
            "acceptance_status": site.acceptance_status,
            "blocker_comment": site.blocker_comment,
            "partner_status": site.partner_status,
        },
        "sources_present": sorted(site.sources_present),
        "evidence": [asdict_safe(e) for e in site.evidence],
        "findings": findings,
    }


def asdict_safe(e: Any) -> dict[str, Any]:
    return {
        "evidence_id": e.evidence_id,
        "file": e.file,
        "sheet": e.sheet,
        "row": e.row,
        "column": e.column,
        "value": e.value,
    }


@router.post("/findings/{finding_id}/reviews")
def review_finding(
    finding_id: int,
    body: ReviewRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    finding = db.get(models.FindingRow, finding_id)
    if not finding:
        raise AppError("FINDING_NOT_FOUND", "Befund nicht gefunden", status_code=404)
    settings = get_settings()
    decision = models.ReviewDecision(
        finding_id=finding.id,
        decision=body.decision,
        reason=body.reason,
        user_id=settings.demo_user_name,
    )
    finding.status = {
        "approve": "approved",
        "dismiss": "dismissed",
        "assign": "assigned",
    }[body.decision]
    db.add(decision)
    from rolloutguard_api.ai.memory import record_decision

    record_decision(
        db,
        kind="review",
        site_id=finding.site_id,
        rule_id=finding.rule_id,
        payload={"finding_id": finding.id, "decision": body.decision},
    )
    db.commit()
    return {
        "finding_id": finding.id,
        "status": finding.status,
        "decision": body.decision,
        "reason": body.reason,
    }


@router.post("/analyses/{analysis_id}/exports")
def create_export(analysis_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    settings = get_settings()
    run = db.get(models.AnalysisRun, analysis_id)
    if not run:
        raise AppError("ANALYSIS_NOT_FOUND", "Analyse-Lauf nicht gefunden", status_code=404)
    out_dir = Path(settings.upload_dir) / "exports"
    try:
        result = export_analysis(
            db,
            analysis_id,
            output_dir=out_dir,
            created_by=settings.demo_user_name,
        )
    except ValueError as exc:
        raise AppError("EXPORT_FAILED", str(exc), status_code=400) from exc
    return result
