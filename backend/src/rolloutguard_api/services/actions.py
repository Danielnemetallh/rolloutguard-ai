"""Proposed actions: draft in DB, confirm executes adapters."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from rolloutguard_api.ai.memory import record_decision
from rolloutguard_api.core.config import get_settings
from rolloutguard_api.db import models
from rolloutguard_api.integrations.composio_executor import execute_confirmed


def _project_id_for_run(db: Session, analysis_run_id: int | None) -> int:
    if analysis_run_id:
        run = db.get(models.AnalysisRun, analysis_run_id)
        if run:
            batch = db.get(models.ImportBatch, run.batch_id)
            if batch:
                return batch.project_id
    project = db.query(models.Project).order_by(models.Project.id.asc()).first()
    return project.id if project else 1


def upsert_draft(
    db: Session,
    *,
    action_type: str,
    payload: dict[str, Any],
    analysis_run_id: int | None = None,
    site_ids: list[str] | None = None,
    evidence_ids: list[str] | None = None,
    idempotency_key: str | None = None,
) -> models.ProposedAction:
    project_id = _project_id_for_run(db, analysis_run_id)
    if idempotency_key:
        existing = (
            db.query(models.ProposedAction)
            .filter_by(project_id=project_id, idempotency_key=idempotency_key)
            .filter(models.ProposedAction.status.in_(["draft", "failed"]))
            .order_by(models.ProposedAction.id.desc())
            .first()
        )
        if existing:
            existing.payload_json = payload
            existing.site_ids_json = site_ids or []
            existing.evidence_ids_json = evidence_ids or []
            existing.analysis_run_id = analysis_run_id
            existing.status = "draft"
            db.commit()
            db.refresh(existing)
            return existing
    row = models.ProposedAction(
        project_id=project_id,
        analysis_run_id=analysis_run_id,
        action_type=action_type,
        status="draft",
        payload_json=payload,
        site_ids_json=site_ids or [],
        evidence_ids_json=evidence_ids or [],
        idempotency_key=idempotency_key,
        result_json={},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_actions(
    db: Session,
    *,
    project_id: int | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    q = db.query(models.ProposedAction).order_by(models.ProposedAction.id.desc())
    if project_id:
        q = q.filter_by(project_id=project_id)
    if status:
        q = q.filter_by(status=status)
    return [
        {
            "id": r.id,
            "action_type": r.action_type,
            "status": r.status,
            "payload": r.payload_json,
            "site_ids": r.site_ids_json,
            "evidence_ids": r.evidence_ids_json,
            "result": r.result_json,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in q.limit(80).all()
    ]


def confirm_action(db: Session, action_id: int) -> dict[str, Any]:
    row = db.get(models.ProposedAction, action_id)
    if not row:
        return {"error": "action_not_found"}
    if row.status == "confirmed":
        return {"id": row.id, "status": row.status, "result": row.result_json}
    result = execute_confirmed(row)
    row.result_json = result
    row.status = (
        "failed"
        if result.get("error") or result.get("composio_error")
        else "confirmed"
    )

    row.confirmed_at = datetime.now(UTC)
    db.commit()
    if row.status == "confirmed":
        site_id = (row.site_ids_json or [None])[0]
        if row.action_type == "watch":
            watch = models.Watch(
                project_id=row.project_id,
                site_id=row.payload_json.get("site_id") or site_id,
                partner_id=row.payload_json.get("partner_id"),
                rule_id=row.payload_json.get("rule_id"),
                status="armed",
                payload_json=row.payload_json,
            )
            db.add(watch)
            db.commit()
            record_decision(
                db,
                kind="watch",
                site_id=watch.site_id,
                rule_id=watch.rule_id,
                payload={"watch_id": watch.id, "action_id": row.id},
            )
        elif row.action_type == "override":
            ov = models.MilestoneOverride(
                project_id=row.project_id,
                site_id=str(row.payload_json.get("site_id") or site_id or ""),
                field=str(row.payload_json.get("field") or ""),
                new_value=str(row.payload_json.get("new_value") or ""),
                reason=row.payload_json.get("reason"),
                evidence_ids_json=row.evidence_ids_json,
            )
            db.add(ov)
            db.commit()
            record_decision(
                db,
                kind="override",
                site_id=ov.site_id,
                payload={"override_id": ov.id, "field": ov.field},
            )
        else:
            record_decision(
                db,
                kind="action_confirmed",
                site_id=str(site_id) if site_id else None,
                payload={"action_id": row.id, "action_type": row.action_type},
            )
    db.refresh(row)
    return {"id": row.id, "status": row.status, "result": row.result_json}


def dismiss_action(db: Session, action_id: int) -> dict[str, Any]:
    row = db.get(models.ProposedAction, action_id)
    if not row:
        return {"error": "action_not_found"}
    row.status = "dismissed"
    db.commit()
    return {"id": row.id, "status": row.status}


def fire_watches(db: Session, *, project_id: int, analysis_run_id: int) -> int:
    """Enqueue in-app reminders for armed watches after a new ingest."""
    watches = db.query(models.Watch).filter_by(project_id=project_id, status="armed").all()
    created = 0
    findings = db.query(models.FindingRow).filter_by(analysis_run_id=analysis_run_id).all()
    site_partners: dict[str, str | None] = {}
    if any(w.partner_id for w in watches):
        sites = db.query(models.Site).filter_by(project_id=project_id).all()
        site_partners = {s.canonical_site_id: s.partner_id for s in sites}
    for watch in watches:
        matches = []
        for finding in findings:
            if watch.site_id and finding.site_id != watch.site_id:
                continue
            if watch.rule_id and finding.rule_id != watch.rule_id:
                continue
            if watch.partner_id and site_partners.get(finding.site_id) != watch.partner_id:
                continue
            matches.append(finding)
        if not matches:
            continue
        key = f"watch-fire:{watch.id}:{analysis_run_id}"
        upsert_draft(
            db,
            action_type="watch_fire",
            analysis_run_id=analysis_run_id,
            payload={
                "watch_id": watch.id,
                "title": f"Watch: {watch.site_id or watch.rule_id} weiter auffällig",
                "message": (
                    f"{len(matches)} Befund(e) nach neuem Import. "
                    "Keine Mail wurde gesendet."
                ),
            },
            site_ids=[watch.site_id] if watch.site_id else [m.site_id for m in matches[:5]],
            idempotency_key=key,
        )
        created += 1
    return created


def apply_overrides(db: Session, project_id: int, sites: dict[str, Any]) -> None:
    rows = db.query(models.MilestoneOverride).filter_by(project_id=project_id).all()
    date_fields = {
        "forecast_date",
        "planned_date",
        "actual_date",
        "contractual_due_date",
        "fibre_ready_date",
    }
    for ov in rows:
        site = sites.get(ov.site_id)
        if site is None or not hasattr(site, ov.field):
            continue
        value: Any = ov.new_value
        if ov.field in date_fields:
            from datetime import date

            try:
                value = date.fromisoformat(ov.new_value)
            except ValueError:
                continue
        setattr(site, ov.field, value)


def pending_mappings(db: Session, project_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(models.ColumnMapping, models.SourceFile, models.ImportBatch)
        .join(models.SourceFile, models.ColumnMapping.source_file_id == models.SourceFile.id)
        .join(models.ImportBatch, models.SourceFile.batch_id == models.ImportBatch.id)
        .filter(models.ImportBatch.project_id == project_id)
        .filter(models.ColumnMapping.approved_by.is_(None))
        .all()
    )
    return [
        {
            "id": m.id,
            "source_header": m.source_header,
            "canonical_field": m.canonical_field,
            "confidence": m.confidence,
            "method": m.method,
            "filename": sf.filename,
        }
        for m, sf, _batch in rows
    ]


def approve_mapping(
    db: Session, mapping_id: int, canonical_field: str | None = None
) -> dict[str, Any]:
    row = db.get(models.ColumnMapping, mapping_id)
    if not row:
        return {"error": "mapping_not_found"}
    settings = get_settings()
    if canonical_field:
        row.canonical_field = canonical_field
    row.approved_by = settings.demo_user_name
    db.commit()
    return {
        "id": row.id,
        "canonical_field": row.canonical_field,
        "approved_by": row.approved_by,
    }
