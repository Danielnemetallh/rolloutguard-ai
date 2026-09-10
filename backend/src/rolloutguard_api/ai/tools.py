"""Allowlisted agent tools: German descriptions, English names."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from rolloutguard_api.ai.memory import (
    get_site_summary,
    recall_session,
    search_corpus,
    search_decisions,
)
from rolloutguard_api.db import models
from rolloutguard_api.domain.schema import RULE_CATALOGUE
from rolloutguard_api.services.actions import upsert_draft
from rolloutguard_api.services.analysis import findings_to_dicts
from rolloutguard_api.services.documents import document_payload, list_documents

MAX_RESULT_CHARS = 4000


def _truncate(payload: dict[str, Any]) -> dict[str, Any]:
    encoded = json.dumps(payload, ensure_ascii=False)
    if len(encoded) <= MAX_RESULT_CHARS:
        return payload
    return {"truncated": True, "preview": encoded[: MAX_RESULT_CHARS - 40]}


def _project_id(db: Session, analysis_run_id: int) -> int | None:
    run = db.get(models.AnalysisRun, analysis_run_id)
    if not run:
        return None
    batch = db.get(models.ImportBatch, run.batch_id)
    return batch.project_id if batch else None


def tool_get_portfolio_kpis(db: Session, analysis_run_id: int, **_: Any) -> dict[str, Any]:
    run = db.get(models.AnalysisRun, analysis_run_id)
    if not run:
        return {"error": "analysis_not_found"}
    return _truncate({"analysis_run_id": run.id, "kpis": run.summary_json})


def tool_list_findings(
    db: Session,
    analysis_run_id: int,
    severity: str | None = None,
    rule_id: str | None = None,
    site_id: str | None = None,
    limit: int = 5,
    **_: Any,
) -> dict[str, Any]:
    limit = max(1, min(int(limit or 5), 10))
    items = findings_to_dicts(
        analysis_run_id,
        db,
        severity=severity,
        rule_id=rule_id,
        site_id=site_id,
    )[:limit]
    slim = [
        {
            "id": i["id"],
            "site_id": i["site_id"],
            "rule_id": i["rule_id"],
            "severity": i["severity"],
            "message": i["message"],
            "evidence_ids": [e.get("evidence_id") for e in i.get("evidence", [])],
        }
        for i in items
    ]
    return _truncate({"count": len(slim), "findings": slim})


def tool_get_site_timeline(
    db: Session,
    analysis_run_id: int,
    site_id: str,
    **_: Any,
) -> dict[str, Any]:
    items = findings_to_dicts(analysis_run_id, db, site_id=site_id)
    if not items:
        return {"site_id": site_id, "findings": [], "note": "Keine Befunde für den Standort"}
    evidence_ids = [
        e.get("evidence_id")
        for item in items
        for e in item.get("evidence", [])
        if e.get("evidence_id")
    ]
    return _truncate(
        {
            "site_id": site_id,
            "findings": [
                {
                    "rule_id": i["rule_id"],
                    "severity": i["severity"],
                    "message": i["message"],
                    "facts": i["facts"],
                }
                for i in items
            ],
            "evidence_ids": sorted(set(evidence_ids)),
        }
    )


def tool_get_rule_definition(db: Session, rule_id: str, **_: Any) -> dict[str, Any]:
    for rule in RULE_CATALOGUE:
        if rule["rule_id"] == rule_id:
            return rule
    return {"error": "unknown_rule", "rule_id": rule_id}


def tool_recall_session(db: Session, analysis_run_id: int, **_: Any) -> dict[str, Any]:
    return _truncate({"turns": recall_session(db, analysis_run_id)})


def tool_search_decisions(
    db: Session,
    analysis_run_id: int,
    site_id: str | None = None,
    rule_id: str | None = None,
    partner: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    return _truncate(
        {
            "decisions": search_decisions(
                db, site_id=site_id, rule_id=rule_id, partner=partner
            )
        }
    )


def tool_search_corpus(
    db: Session,
    analysis_run_id: int,
    query: str,
    **_: Any,
) -> dict[str, Any]:
    project_id = _project_id(db, analysis_run_id)
    hits = search_corpus(db, query, project_id=project_id)
    return _truncate({"hits": hits})


def tool_get_site_summary(
    db: Session,
    analysis_run_id: int,
    site_id: str,
    **_: Any,
) -> dict[str, Any]:
    return get_site_summary(db, analysis_run_id, site_id)


def tool_list_documents(db: Session, analysis_run_id: int, **_: Any) -> dict[str, Any]:
    project_id = _project_id(db, analysis_run_id)
    if project_id is None:
        return {"error": "analysis_not_found"}
    return _truncate({"documents": list_documents(db, project_id)})


def tool_extract_document(
    db: Session,
    analysis_run_id: int,
    document_id: int,
    **_: Any,
) -> dict[str, Any]:
    return _truncate(document_payload(db, int(document_id)))


def _draft(
    db: Session,
    *,
    analysis_run_id: int,
    action_type: str,
    payload: dict[str, Any],
    site_id: str | None = None,
    evidence_ids: list[str] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    row = upsert_draft(
        db,
        action_type=action_type,
        payload=payload,
        analysis_run_id=analysis_run_id,
        site_ids=[site_id] if site_id else [],
        evidence_ids=evidence_ids or [],
        idempotency_key=idempotency_key,
    )
    return {
        "proposed_action_id": row.id,
        "status": row.status,
        "action_type": row.action_type,
    }


def tool_draft_calendar_event(
    db: Session,
    analysis_run_id: int,
    site_id: str,
    title: str,
    date: str,
    milestone_kind: str = "due",
    description: str | None = None,
    evidence_ids: list[str] | None = None,
    **_: Any,
) -> dict[str, Any]:
    key = f"{site_id}:{milestone_kind}"
    return _draft(
        db,
        analysis_run_id=analysis_run_id,
        action_type="calendar",
        payload={
            "site_id": site_id,
            "title": title,
            "date": date,
            "milestone_kind": milestone_kind,
            "description": description,
        },
        site_id=site_id,
        evidence_ids=evidence_ids,
        idempotency_key=key,
    )


def tool_draft_email(
    db: Session,
    analysis_run_id: int,
    subject: str,
    body: str,
    site_id: str | None = None,
    to: str | None = None,
    evidence_ids: list[str] | None = None,
    **_: Any,
) -> dict[str, Any]:
    return _draft(
        db,
        analysis_run_id=analysis_run_id,
        action_type="email",
        payload={
            "to": to or "partner@nordturm.demo",
            "subject": subject,
            "body": body,
            "site_id": site_id,
        },
        site_id=site_id,
        evidence_ids=evidence_ids,
    )


def tool_draft_board_card(
    db: Session,
    analysis_run_id: int,
    title: str,
    body: str | None = None,
    site_id: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    return _draft(
        db,
        analysis_run_id=analysis_run_id,
        action_type="board",
        payload={"title": title, "body": body, "site_id": site_id},
        site_id=site_id,
    )


def tool_draft_override(
    db: Session,
    analysis_run_id: int,
    site_id: str,
    field: str,
    new_value: str,
    reason: str | None = None,
    evidence_ids: list[str] | None = None,
    **_: Any,
) -> dict[str, Any]:
    return _draft(
        db,
        analysis_run_id=analysis_run_id,
        action_type="override",
        payload={
            "site_id": site_id,
            "field": field,
            "new_value": new_value,
            "reason": reason,
        },
        site_id=site_id,
        evidence_ids=evidence_ids,
    )


def tool_draft_watch(
    db: Session,
    analysis_run_id: int,
    site_id: str | None = None,
    partner_id: str | None = None,
    rule_id: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    return _draft(
        db,
        analysis_run_id=analysis_run_id,
        action_type="watch",
        payload={"site_id": site_id, "partner_id": partner_id, "rule_id": rule_id},
        site_id=site_id,
        idempotency_key=f"watch:{site_id}:{rule_id}:{partner_id}",
    )


def tool_draft_task(
    db: Session,
    analysis_run_id: int,
    title: str,
    due: str | None = None,
    owner: str | None = None,
    site_id: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    return _draft(
        db,
        analysis_run_id=analysis_run_id,
        action_type="task",
        payload={"title": title, "due": due, "owner": owner, "site_id": site_id},
        site_id=site_id,
    )


def _fn(
    name: str,
    description: str,
    properties: dict[str, Any],
    required: list[str],
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


TOOL_SPECS: list[dict[str, Any]] = [
    _fn(
        "get_portfolio_kpis",
        "Kennzahlen des Analyse-Laufs lesen.",
        {"analysis_run_id": {"type": "integer"}},
        ["analysis_run_id"],
    ),
    _fn(
        "list_findings",
        "Befunde eines Laufs listen, optional nach Schwere, Regel oder Standort.",
        {
            "analysis_run_id": {"type": "integer"},
            "severity": {"type": "string"},
            "rule_id": {"type": "string"},
            "site_id": {"type": "string"},
            "limit": {"type": "integer"},
        },
        ["analysis_run_id"],
    ),
    _fn(
        "get_site_timeline",
        "Timeline-Fakten und Befunde eines Standorts lesen.",
        {
            "analysis_run_id": {"type": "integer"},
            "site_id": {"type": "string"},
        },
        ["analysis_run_id", "site_id"],
    ),
    _fn(
        "get_rule_definition",
        "Klartext-Definition einer Regel-ID liefern.",
        {"rule_id": {"type": "string"}},
        ["rule_id"],
    ),
    _fn(
        "recall_session",
        "Letzte Chat-Nachrichten dieses Analyse-Laufs erinnern.",
        {"analysis_run_id": {"type": "integer"}},
        ["analysis_run_id"],
    ),
    _fn(
        "search_decisions",
        "Bereits bestätigte Reviews, Aktionen und Watches suchen. Vor jedem Entwurf aufrufen.",
        {
            "analysis_run_id": {"type": "integer"},
            "site_id": {"type": "string"},
            "rule_id": {"type": "string"},
            "partner": {"type": "string"},
        },
        ["analysis_run_id"],
    ),
    _fn(
        "search_corpus",
        "Dokumente, Regeltexte und Befund-Chunks per Stichwort suchen. Zitiert chunk_id.",
        {
            "analysis_run_id": {"type": "integer"},
            "query": {"type": "string"},
        },
        ["analysis_run_id", "query"],
    ),
    _fn(
        "get_site_summary",
        "Kurze deutsche Standortzusammenfassung lesen.",
        {
            "analysis_run_id": {"type": "integer"},
            "site_id": {"type": "string"},
        },
        ["analysis_run_id", "site_id"],
    ),
    _fn(
        "list_documents",
        "Hochgeladene PDFs und Texte des Projekts listen.",
        {"analysis_run_id": {"type": "integer"}},
        ["analysis_run_id"],
    ),
    _fn(
        "extract_document",
        "Gespeicherten Dokumenttext und strukturierte Vorschläge lesen.",
        {
            "analysis_run_id": {"type": "integer"},
            "document_id": {"type": "integer"},
        },
        ["analysis_run_id", "document_id"],
    ),
    _fn(
        "draft_calendar_event",
        "Kalenderentwurf anlegen (kein Google-Aufruf). Freigeben erstellt den Termin.",
        {
            "analysis_run_id": {"type": "integer"},
            "site_id": {"type": "string"},
            "title": {"type": "string"},
            "date": {"type": "string"},
            "milestone_kind": {"type": "string"},
            "description": {"type": "string"},
        },
        ["analysis_run_id", "site_id", "title", "date"],
    ),
    _fn(
        "draft_email",
        "E-Mail-Entwurf in der Aktionsqueue anlegen. Freigeben erzeugt einen Gmail-Draft.",
        {
            "analysis_run_id": {"type": "integer"},
            "subject": {"type": "string"},
            "body": {"type": "string"},
            "site_id": {"type": "string"},
            "to": {"type": "string"},
        },
        ["analysis_run_id", "subject", "body"],
    ),
    _fn(
        "draft_board_card",
        "Notion-/Board-Karte als Entwurf anlegen.",
        {
            "analysis_run_id": {"type": "integer"},
            "title": {"type": "string"},
            "body": {"type": "string"},
            "site_id": {"type": "string"},
        },
        ["analysis_run_id", "title"],
    ),
    _fn(
        "draft_override",
        "Meilenstein-Override als Entwurf anlegen. Ändert Excel nicht.",
        {
            "analysis_run_id": {"type": "integer"},
            "site_id": {"type": "string"},
            "field": {"type": "string"},
            "new_value": {"type": "string"},
            "reason": {"type": "string"},
        },
        ["analysis_run_id", "site_id", "field", "new_value"],
    ),
    _fn(
        "draft_watch",
        "Watch-Entwurf anlegen. Erst nach Freigeben scharf. Feuert beim nächsten Import in-app.",
        {
            "analysis_run_id": {"type": "integer"},
            "site_id": {"type": "string"},
            "partner_id": {"type": "string"},
            "rule_id": {"type": "string"},
        },
        ["analysis_run_id"],
    ),
    _fn(
        "draft_task",
        "Aufgabe als Entwurf anlegen (in-app und optional Notion nach Freigeben).",
        {
            "analysis_run_id": {"type": "integer"},
            "title": {"type": "string"},
            "due": {"type": "string"},
            "owner": {"type": "string"},
            "site_id": {"type": "string"},
        },
        ["analysis_run_id", "title"],
    ),
]

TOOL_IMPL: dict[str, Callable[..., dict[str, Any]]] = {
    "get_portfolio_kpis": tool_get_portfolio_kpis,
    "list_findings": tool_list_findings,
    "get_site_timeline": tool_get_site_timeline,
    "get_rule_definition": tool_get_rule_definition,
    "recall_session": tool_recall_session,
    "search_decisions": tool_search_decisions,
    "search_corpus": tool_search_corpus,
    "get_site_summary": tool_get_site_summary,
    "list_documents": tool_list_documents,
    "extract_document": tool_extract_document,
    "draft_calendar_event": tool_draft_calendar_event,
    "draft_email": tool_draft_email,
    "draft_board_card": tool_draft_board_card,
    "draft_override": tool_draft_override,
    "draft_watch": tool_draft_watch,
    "draft_task": tool_draft_task,
}
