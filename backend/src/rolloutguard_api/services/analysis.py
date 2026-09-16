"""Orchestrate import → reconcile → rules → persistence."""

from __future__ import annotations

import hashlib
import shutil
from dataclasses import asdict
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from rolloutguard_api.core.config import get_settings
from rolloutguard_api.db import models
from rolloutguard_api.services.ingest import IngestError, IngestResult, profile_workbook
from rolloutguard_api.services.reconcile import CanonicalSite, reconcile
from rolloutguard_api.services.rules import RULE_VERSION, AnalysisResult, evaluate_sites


class AnalysisSourceError(ValueError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


def ensure_demo_project(db: Session) -> models.Project:
    project = db.query(models.Project).filter_by(name="Synthetic Rollout Demo").first()
    if project:
        return project
    project = models.Project(name="Synthetic Rollout Demo", timezone="Europe/Berlin")
    db.add(project)
    db.flush()
    user = db.query(models.User).filter_by(subject="demo").first()
    if not user:
        settings = get_settings()
        db.add(
            models.User(
                subject="demo",
                display_name=settings.demo_user_name,
                role=settings.demo_user_role,
            )
        )
    db.commit()
    db.refresh(project)
    return project


def _persist_ingest(
    db: Session, batch: models.ImportBatch, result: IngestResult
) -> models.SourceFile:
    sf = models.SourceFile(
        batch_id=batch.id,
        logical_type=result.profile.logical_type,
        filename=result.profile.filename,
        sha256=result.profile.sha256,
        sheet_names=[result.profile.sheet_name],
        storage_key=str(result.storage_path),
        profile_json={
            "row_count": result.profile.row_count,
            "warnings": result.profile.warnings,
            "columns": [asdict(c) for c in result.profile.columns],
        },
    )
    db.add(sf)
    db.flush()
    for m in result.profile.mappings:
        db.add(
            models.ColumnMapping(
                source_file_id=sf.id,
                source_header=m.source_header,
                canonical_field=m.canonical_field,
                confidence=m.confidence,
                method=m.method,
                approved_by=None if m.needs_approval else "auto",
            )
        )
    for rec in result.records:
        db.add(
            models.SourceRecordRow(
                source_file_id=sf.id,
                sheet=rec.sheet,
                row_number=rec.row_number,
                record_json=rec.values,
                record_hash=rec.record_hash,
            )
        )
    return sf


def run_analysis_from_paths(
    db: Session,
    paths: dict[str, Path],
    *,
    project_id: int | None = None,
    as_of: date | None = None,
) -> tuple[models.AnalysisRun, AnalysisResult, dict[str, CanonicalSite]]:
    settings = get_settings()
    project = (
        db.get(models.Project, project_id)
        if project_id
        else ensure_demo_project(db)
    )
    assert project is not None

    results: dict[str, IngestResult] = {}
    hashes: list[str] = []
    for key, path in paths.items():
        dest_dir = Path(settings.upload_dir) / "batches"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / path.name
        if path.resolve() != dest.resolve():
            shutil.copy2(path, dest)
        results[key] = profile_workbook(dest)
        hashes.append(results[key].profile.sha256)

    input_hash = hashlib.sha256("|".join(sorted(hashes)).encode()).hexdigest()

    # Idempotency: reuse prior completed batch with same input hash
    existing = (
        db.query(models.ImportBatch)
        .filter_by(project_id=project.id, input_hash=input_hash, status="analyzed")
        .order_by(models.ImportBatch.id.desc())
        .first()
    )
    if existing:
        run = (
            db.query(models.AnalysisRun)
            .filter_by(batch_id=existing.id)
            .order_by(models.AnalysisRun.id.desc())
            .first()
        )
        if run:
            sites = reconcile(
                results.get("contract"),
                results.get("schedule"),
                results.get("status"),
            )
            analysis = evaluate_sites(sites, as_of=as_of or date.today())
            return run, analysis, sites

    batch = models.ImportBatch(
        project_id=project.id,
        status="imported",
        input_hash=input_hash,
    )
    db.add(batch)
    db.flush()

    batch_dir = Path(settings.upload_dir) / "batches" / f"batch-{batch.id}"
    batch_dir.mkdir(parents=True, exist_ok=True)
    for key, result in results.items():
        source_path = paths[key]
        dest = batch_dir / result.profile.filename
        if source_path.resolve() != dest.resolve():
            shutil.copy2(source_path, dest)
        result.storage_path = dest

    for key in ("contract", "schedule", "status"):
        if key in results:
            _persist_ingest(db, batch, results[key])

    sites = reconcile(
        results.get("contract"),
        results.get("schedule"),
        results.get("status"),
    )
    analysis = evaluate_sites(sites, as_of=as_of or date.today())

    for site in sites.values():
        region = site.site_id.split("-")[1] if "-" in site.site_id else None
        existing_site = (
            db.query(models.Site)
            .filter_by(project_id=project.id, canonical_site_id=site.site_id)
            .first()
        )
        if not existing_site:
            db.add(
                models.Site(
                    project_id=project.id,
                    canonical_site_id=site.site_id,
                    partner_id=site.partner_id,
                    region=region,
                )
            )

    run = models.AnalysisRun(
        batch_id=batch.id,
        rule_set_checksum=hashlib.sha256(RULE_VERSION.encode()).hexdigest()[:16],
        status="completed",
        summary_json=analysis.kpis,
    )
    db.add(run)
    db.flush()

    for f in analysis.findings:
        db.add(
            models.FindingRow(
                analysis_run_id=run.id,
                site_id=f.site_id,
                rule_id=f.rule_id,
                rule_version=f.version,
                severity=f.severity,
                status=f.status,
                message=f.message,
                facts_json=f.facts,
                evidence_json=[asdict(e) for e in f.evidence],
            )
        )

    batch.status = "analyzed"
    batch.completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(run)
    return run, analysis, sites


def _resolve_source_file_path(source_file: models.SourceFile) -> Path:
    stored_path = Path(source_file.storage_key)
    candidates = [stored_path]
    if not stored_path.is_absolute():
        candidates.extend(
            [
                Path.cwd() / stored_path,
                Path(get_settings().upload_dir) / "batches" / source_file.filename,
            ]
        )

    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_file():
            return resolved

    raise AnalysisSourceError(
        "ANALYSIS_SOURCE_MISSING",
        "Source workbook for this analysis is not available",
        details={
            "logical_type": source_file.logical_type,
            "filename": source_file.filename,
        },
    )


def _load_sites_from_batch(db: Session, batch_id: int) -> dict[str, CanonicalSite]:
    source_files = db.query(models.SourceFile).filter_by(batch_id=batch_id).all()
    paths: dict[str, Path] = {}
    for source_file in source_files:
        logical_type = source_file.logical_type
        if logical_type not in {"contract", "schedule", "status"}:
            continue
        if logical_type in paths:
            raise AnalysisSourceError(
                "ANALYSIS_SOURCE_DUPLICATE",
                "Analysis contains duplicate source workbook types",
                details={"logical_type": logical_type},
            )
        paths[logical_type] = _resolve_source_file_path(source_file)

    missing = sorted({"contract", "schedule", "status"} - paths.keys())
    if missing:
        raise AnalysisSourceError(
            "ANALYSIS_SOURCE_INCOMPLETE",
            "Analysis is missing one or more source workbooks",
            details={"logical_types": missing},
        )

    try:
        results = {logical_type: profile_workbook(path) for logical_type, path in paths.items()}
    except IngestError as exc:
        raise AnalysisSourceError(exc.code, exc.message, details=exc.details) from exc
    return reconcile(results["contract"], results["schedule"], results["status"])


def load_sites_for_timeline(
    db: Session,
    analysis_id: int | None = None,
) -> tuple[int | None, dict[str, CanonicalSite]]:
    effective_analysis_id = analysis_id
    if effective_analysis_id is None:
        latest_run = (
            db.query(models.AnalysisRun)
            .order_by(models.AnalysisRun.id.desc())
            .first()
        )
        if latest_run is not None:
            effective_analysis_id = latest_run.id

    if effective_analysis_id is not None:
        run = db.get(models.AnalysisRun, effective_analysis_id)
        if run is None:
            raise AnalysisSourceError(
                "ANALYSIS_NOT_FOUND",
                "Analysis run not found",
                details={"analysis_id": effective_analysis_id},
            )
        batch = db.get(models.ImportBatch, run.batch_id)
        if batch is None:
            raise AnalysisSourceError(
                "ANALYSIS_BATCH_NOT_FOUND",
                "Import batch for this analysis is not available",
                details={"analysis_id": effective_analysis_id},
            )
        return effective_analysis_id, _load_sites_from_batch(db, batch.id)

    settings = get_settings()
    synthetic_dir = Path(settings.synthetic_dir)
    paths = {
        "contract": synthetic_dir / "contract_obligations.xlsx",
        "schedule": synthetic_dir / "partner_schedule.xlsx",
        "status": synthetic_dir / "site_project_status.xlsx",
    }
    if not all(path.exists() for path in paths.values()):
        raise AnalysisSourceError("SYNTHETIC_MISSING", "Synthetic data missing")

    try:
        results = {logical_type: profile_workbook(path) for logical_type, path in paths.items()}
    except IngestError as exc:
        raise AnalysisSourceError(exc.code, exc.message, details=exc.details) from exc
    return None, reconcile(results["contract"], results["schedule"], results["status"])


def list_analysis_runs(db: Session, project_id: int) -> list[models.AnalysisRun]:
    # Ordered by primary key rather than created_at: inserts are strictly
    # sequential (single writer per run), and id avoids timestamp-resolution
    # ties that a same-second created_at comparison could get wrong.
    return (
        db.query(models.AnalysisRun)
        .join(models.ImportBatch, models.AnalysisRun.batch_id == models.ImportBatch.id)
        .filter(models.ImportBatch.project_id == project_id)
        .order_by(models.AnalysisRun.id.desc())
        .all()
    )


def previous_analysis_run(db: Session, run: models.AnalysisRun) -> models.AnalysisRun | None:
    batch = db.get(models.ImportBatch, run.batch_id)
    if batch is None:
        return None
    return (
        db.query(models.AnalysisRun)
        .join(models.ImportBatch, models.AnalysisRun.batch_id == models.ImportBatch.id)
        .filter(models.ImportBatch.project_id == batch.project_id)
        .filter(models.AnalysisRun.id < run.id)
        .order_by(models.AnalysisRun.id.desc())
        .first()
    )


def diff_against_previous(db: Session, analysis_id: int) -> dict[str, Any]:
    """Compare a run's findings against the prior run for the same project.

    Findings are matched on (site_id, rule_id) — the identity of "the same
    exception" across runs, independent of message wording or row order.
    """
    run = db.get(models.AnalysisRun, analysis_id)
    if run is None:
        raise ValueError("analysis_not_found")
    previous = previous_analysis_run(db, run)

    def _keyed(run_id: int) -> dict[tuple[str, str], dict[str, Any]]:
        return {(f["site_id"], f["rule_id"]): f for f in findings_to_dicts(run_id, db)}

    current = _keyed(run.id)
    prior = _keyed(previous.id) if previous else {}

    new_keys = current.keys() - prior.keys()
    resolved_keys = prior.keys() - current.keys()
    persisting_keys = current.keys() & prior.keys()

    return {
        "analysis_run_id": run.id,
        "compared_to_run_id": previous.id if previous else None,
        "compared_to_created_at": previous.created_at.isoformat()
        if previous and previous.created_at
        else None,
        "new_count": len(new_keys),
        "resolved_count": len(resolved_keys),
        "persisting_count": len(persisting_keys),
        "new_findings": [current[k] for k in new_keys],
        "resolved_findings": [prior[k] for k in resolved_keys],
    }


def findings_to_dicts(run_id: int, db: Session, **filters: Any) -> list[dict[str, Any]]:
    q = db.query(models.FindingRow).filter_by(analysis_run_id=run_id)
    if severity := filters.get("severity"):
        q = q.filter_by(severity=severity)
    if rule_id := filters.get("rule_id"):
        q = q.filter_by(rule_id=rule_id)
    if site_id := filters.get("site_id"):
        q = q.filter_by(site_id=site_id)
    if status := filters.get("status"):
        q = q.filter_by(status=status)
    rows = q.order_by(models.FindingRow.severity.asc(), models.FindingRow.site_id.asc()).all()
    return [
        {
            "id": r.id,
            "site_id": r.site_id,
            "rule_id": r.rule_id,
            "rule_version": r.rule_version,
            "severity": r.severity,
            "status": r.status,
            "message": r.message,
            "facts": r.facts_json,
            "evidence": r.evidence_json,
        }
        for r in rows
    ]
