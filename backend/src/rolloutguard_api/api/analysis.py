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
    diff_against_previous,
    ensure_demo_project,
    findings_to_dicts,
    list_analysis_runs,
    run_analysis_from_paths,
)
from rolloutguard_api.services.export import export_analysis
from rolloutguard_api.services.ingest import IngestError, profile_workbook
from rolloutguard_api.services.reconcile import reconcile

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
    contract: UploadFile = File(...),
    schedule: UploadFile = File(...),
    status: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ensure_demo_project(db)
    if db.get(models.Project, project_id) is None:
        raise AppError("PROJECT_NOT_FOUND", "Projekt nicht gefunden", status_code=404)

    settings = get_settings()
    upload_root = Path(settings.upload_dir) / "incoming"
    upload_root.mkdir(parents=True, exist_ok=True)

    async def _save(upload: UploadFile, name: str) -> Path:
        suffix = Path(upload.filename or name).suffix.lower()
        if suffix != ".xlsx":
            raise AppError(
                "UNSUPPORTED_FILE_TYPE",
                "Nur .xlsx-Dateien sind für Vertrag, Terminplan und Status erlaubt.",
                details={"file": name},
            )
        dest = upload_root / name
        content = await upload.read()
        dest.write_bytes(content)
        return dest

    try:
        paths = {
            "contract": await _save(contract, "contract_obligations.xlsx"),
            "schedule": await _save(schedule, "partner_schedule.xlsx"),
            "status": await _save(status, "site_project_status.xlsx"),
        }
        run, analysis, sites = run_analysis_from_paths(db, paths, project_id=project_id)
    except IngestError as exc:
        raise AppError(exc.code, exc.message, details=exc.details) from exc

    return {
        "analysis_run_id": run.id,
        "batch_id": run.batch_id,
        "kpis": analysis.kpis,
        "site_count": len(sites),
    }


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
    """Rebuild timeline from latest (or specified) analysis findings + synthetic re-profile."""
    settings = get_settings()
    synth = Path(settings.synthetic_dir)
    paths = {
        "contract": synth / "contract_obligations.xlsx",
        "schedule": synth / "partner_schedule.xlsx",
        "status": synth / "site_project_status.xlsx",
    }
    if not all(p.exists() for p in paths.values()):
        raise AppError("SYNTHETIC_MISSING", "Synthetische Daten fehlen", status_code=404)

    results = {k: profile_workbook(p) for k, p in paths.items()}
    sites = reconcile(results["contract"], results["schedule"], results["status"])
    site = sites.get(site_id)
    if not site:
        raise AppError(
            "SITE_NOT_FOUND",
            "Standort nicht gefunden",
            status_code=404,
            details={"site_id": site_id},
        )

    findings = []
    if analysis_id:
        findings = findings_to_dicts(analysis_id, db, site_id=site_id)

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
