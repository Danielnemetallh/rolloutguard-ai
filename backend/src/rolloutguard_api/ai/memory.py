"""Session, decision log, corpus search, and site summaries."""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from rolloutguard_api.core.logging import get_logger
from rolloutguard_api.db import models
from rolloutguard_api.domain.schema import RULE_CATALOGUE

log = get_logger(__name__)
_fts_enabled = False

SITE_RE = re.compile(r"DE-[A-Z]{2,}-\d+")
MAX_SESSION_TURNS = 8
MAX_SESSION_CHARS = 3000
CHUNK_CHARS = 2000
CHUNK_OVERLAP = 200


def persist_agent_turn(
    db: Session,
    *,
    analysis_run_id: int,
    role: str,
    content: str,
    tool_trace: list[str] | None = None,
    citations: dict[str, Any] | None = None,
) -> models.AgentMessage:
    row = models.AgentMessage(
        analysis_run_id=analysis_run_id,
        role=role,
        content=content,
        tool_trace_json=tool_trace or [],
        citation_json=citations or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def recall_session(
    db: Session, analysis_run_id: int, limit: int = MAX_SESSION_TURNS
) -> list[dict[str, Any]]:
    rows = (
        db.query(models.AgentMessage)
        .filter_by(analysis_run_id=analysis_run_id)
        .order_by(models.AgentMessage.id.desc())
        .limit(max(1, min(limit, 16)))
        .all()
    )
    rows = list(reversed(rows))
    packed: list[dict[str, Any]] = []
    used = 0
    for row in rows:
        used += len(row.content)
        if used > MAX_SESSION_CHARS and packed:
            break
        packed.append(
            {
                "role": row.role,
                "content": row.content,
                "tool_trace": row.tool_trace_json,
                "citations": row.citation_json,
            }
        )
    return packed


def record_decision(
    db: Session,
    *,
    kind: str,
    site_id: str | None = None,
    rule_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> models.DecisionEvent:
    event = models.DecisionEvent(
        kind=kind,
        site_id=site_id,
        rule_id=rule_id,
        payload_json=payload or {},
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def search_decisions(
    db: Session,
    *,
    site_id: str | None = None,
    rule_id: str | None = None,
    partner: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    q = db.query(models.DecisionEvent).order_by(models.DecisionEvent.id.desc())
    if site_id:
        q = q.filter_by(site_id=site_id)
    if rule_id:
        q = q.filter_by(rule_id=rule_id)
    rows = q.limit(max(1, min(limit, 25))).all()
    results = [
        {
            "id": r.id,
            "kind": r.kind,
            "site_id": r.site_id,
            "rule_id": r.rule_id,
            "payload": r.payload_json,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    if partner:
        lowered = partner.lower()
        results = [
            r
            for r in results
            if lowered in json.dumps(r.get("payload") or {}, ensure_ascii=False).lower()
        ]
    return results


def chunk_text(text_value: str) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text_value).strip()
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + CHUNK_CHARS)
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def site_ids_in(text_value: str) -> list[str]:
    return sorted(set(SITE_RE.findall(text_value)))


def _sanitize_fts_term(term: str) -> str:
    cleaned = re.sub(r"[^\w\-]+", "", term, flags=re.UNICODE)
    return cleaned.strip()


def _fts_match_expression(query: str) -> str:
    terms = [_sanitize_fts_term(t) for t in re.split(r"\s+", query.strip()) if t.strip()]
    terms = [t for t in terms if t]
    if not terms:
        return '""'
    return " OR ".join(terms[:6])


def init_corpus_fts(engine: Any) -> None:
    """Create FTS structures and backfill existing chunks."""
    global _fts_enabled
    dialect = engine.dialect.name
    try:
        if dialect == "sqlite":
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts "
                        "USING fts5(text, chunk_rowid UNINDEXED)"
                    )
                )
            with Session(engine) as db:
                rows = db.query(models.DocumentChunk).all()
                for row in rows:
                    _index_chunk_fts(db, row.id, row.text)
                db.commit()
        elif dialect == "postgresql":
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_document_chunks_text_fts "
                        "ON document_chunks USING gin (to_tsvector('simple', text))"
                    )
                )
        _fts_enabled = True
    except Exception as exc:  # noqa: BLE001
        _fts_enabled = False
        log.warning("corpus_fts_init_failed", error=type(exc).__name__)


def _index_chunk_fts(db: Session, chunk_id: int, chunk_text_value: str) -> None:
    if not _fts_enabled or db.bind is None:
        return
    if db.bind.dialect.name != "sqlite":
        return
    db.execute(
        text(
            "INSERT OR REPLACE INTO document_chunks_fts(rowid, text) "
            "VALUES (:rowid, :text)"
        ),
        {"rowid": chunk_id, "text": chunk_text_value},
    )


def add_chunks(
    db: Session,
    document: models.Document,
    text_value: str,
) -> None:
    created: list[models.DocumentChunk] = []
    for index, chunk in enumerate(chunk_text(text_value)):
        row = models.DocumentChunk(
            document_id=document.id,
            chunk_index=index,
            text=chunk,
            site_ids_json=site_ids_in(chunk),
            token_count=max(1, len(chunk) // 4),
        )
        db.add(row)
        created.append(row)
    db.flush()
    for row in created:
        _index_chunk_fts(db, row.id, row.text)
    db.commit()


def index_analysis_corpus(db: Session, analysis_run_id: int, project_id: int) -> None:
    """Chunk rules + current-run findings into the document corpus."""
    existing = (
        db.query(models.Document)
        .filter_by(project_id=project_id, kind="workbook_extract")
        .filter(models.Document.filename == f"analysis-{analysis_run_id}")
        .first()
    )
    if existing:
        return
    parts = ["Regelkatalog:"]
    for rule in RULE_CATALOGUE:
        parts.append(f"{rule['rule_id']}: {rule.get('description', '')}")
    findings = (
        db.query(models.FindingRow).filter_by(analysis_run_id=analysis_run_id).all()
    )
    parts.append("Befunde:")
    for finding in findings:
        evidence = " ".join(
            str(e.get("evidence_id", ""))
            for e in (finding.evidence_json or [])
            if isinstance(e, dict)
        )
        parts.append(
            f"{finding.site_id} {finding.rule_id} {finding.severity} {finding.message} {evidence}"
        )
    body = "\n".join(parts)
    doc = models.Document(
        project_id=project_id,
        filename=f"analysis-{analysis_run_id}",
        mime="text/plain",
        sha256=f"analysis-{analysis_run_id}",
        kind="workbook_extract",
        storage_key="",
        extract_json={},
    )
    db.add(doc)
    db.flush()
    add_chunks(db, doc, body)


def _search_corpus_ilike(
    db: Session,
    query: str,
    *,
    project_id: int | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    terms = [t for t in re.split(r"\s+", query.strip()) if t]
    q = db.query(models.DocumentChunk, models.Document).join(
        models.Document, models.DocumentChunk.document_id == models.Document.id
    )
    if project_id is not None:
        q = q.filter(models.Document.project_id == project_id)
    for term in terms[:6]:
        q = q.filter(models.DocumentChunk.text.ilike(f"%{term}%"))
    rows = q.order_by(models.DocumentChunk.id.desc()).limit(max(1, min(limit, 10))).all()
    return _hits_from_rows(rows)


def _hits_from_rows(rows: list[Any]) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for chunk, doc in rows:
        hits.append(
            {
                "chunk_id": f"doc:{doc.id}#c{chunk.chunk_index}",
                "document_id": doc.id,
                "filename": doc.filename,
                "kind": doc.kind,
                "snippet": chunk.text[:280],
                "site_ids": chunk.site_ids_json,
            }
        )
    return hits


def _search_corpus_fts(
    db: Session,
    query: str,
    *,
    project_id: int | None = None,
    limit: int = 5,
) -> list[dict[str, Any]] | None:
    if not _fts_enabled or db.bind is None:
        return None
    dialect = db.bind.dialect.name
    capped = max(1, min(limit, 10))
    try:
        if dialect == "sqlite":
            match = _fts_match_expression(query)
            if match == '""':
                return []
            sql = """
                SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.site_ids_json,
                       d.filename, d.kind, d.project_id
                FROM document_chunks_fts fts
                JOIN document_chunks dc ON dc.id = fts.rowid
                JOIN documents d ON d.id = dc.document_id
                WHERE fts MATCH :match
            """
            params: dict[str, Any] = {"match": match, "limit": capped}
            if project_id is not None:
                sql += " AND d.project_id = :project_id"
                params["project_id"] = project_id
            sql += " ORDER BY dc.id DESC LIMIT :limit"
            rows = db.execute(text(sql), params).fetchall()
            hits: list[dict[str, Any]] = []
            for row in rows:
                hits.append(
                    {
                        "chunk_id": f"doc:{row.document_id}#c{row.chunk_index}",
                        "document_id": row.document_id,
                        "filename": row.filename,
                        "kind": row.kind,
                        "snippet": row.text[:280],
                        "site_ids": row.site_ids_json,
                    }
                )
            return hits
        if dialect == "postgresql":
            sql = """
                SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.site_ids_json,
                       d.filename, d.kind
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                WHERE to_tsvector('simple', dc.text) @@ plainto_tsquery('simple', :query)
            """
            params = {"query": query, "limit": capped}
            if project_id is not None:
                sql += " AND d.project_id = :project_id"
                params["project_id"] = project_id
            sql += " ORDER BY dc.id DESC LIMIT :limit"
            rows = db.execute(text(sql), params).fetchall()
            hits = []
            for row in rows:
                hits.append(
                    {
                        "chunk_id": f"doc:{row.document_id}#c{row.chunk_index}",
                        "document_id": row.document_id,
                        "filename": row.filename,
                        "kind": row.kind,
                        "snippet": row.text[:280],
                        "site_ids": row.site_ids_json,
                    }
                )
            return hits
    except Exception as exc:  # noqa: BLE001
        log.debug("corpus_fts_search_failed", error=type(exc).__name__)
        return None
    return None


def search_corpus(
    db: Session,
    query: str,
    *,
    project_id: int | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    fts_hits = _search_corpus_fts(db, query, project_id=project_id, limit=limit)
    if fts_hits is not None:
        return fts_hits
    return _search_corpus_ilike(db, query, project_id=project_id, limit=limit)


def rebuild_site_summaries(db: Session, analysis_run_id: int) -> None:
    findings = db.query(models.FindingRow).filter_by(analysis_run_id=analysis_run_id).all()
    by_site: dict[str, list[models.FindingRow]] = {}
    for finding in findings:
        by_site.setdefault(finding.site_id, []).append(finding)
    for site_id, rows in by_site.items():
        open_rows = [r for r in rows if r.status == "open"]
        rules = ", ".join(sorted({r.rule_id for r in open_rows})[:6]) or "keine offenen Regeln"
        last = (
            db.query(models.DecisionEvent)
            .filter_by(site_id=site_id)
            .order_by(models.DecisionEvent.id.desc())
            .first()
        )
        last_line = (
            f"Letzte Entscheidung: {last.kind}."
            if last
            else "Noch keine menschliche Entscheidung."
        )
        facts = rows[0].facts_json if rows else {}
        dates = ", ".join(
            f"{k}={v}"
            for k, v in facts.items()
            if "date" in k and v
        ) or "keine Datumsfakten"
        text_value = (
            f"Standort {site_id}. Offene Befunde: {len(open_rows)} ({rules}). "
            f"Daten: {dates}. {last_line} Schweregrade stammen aus den Regeln, nicht vom Modell."
        )
        existing = (
            db.query(models.SiteSummary)
            .filter_by(site_id=site_id, analysis_run_id=analysis_run_id)
            .first()
        )
        if existing:
            existing.text = text_value
        else:
            db.add(
                models.SiteSummary(
                    site_id=site_id,
                    analysis_run_id=analysis_run_id,
                    text=text_value,
                )
            )
    db.commit()


def get_site_summary(db: Session, analysis_run_id: int, site_id: str) -> dict[str, Any]:
    row = (
        db.query(models.SiteSummary)
        .filter_by(analysis_run_id=analysis_run_id, site_id=site_id)
        .first()
    )
    if not row:
        return {"site_id": site_id, "summary": None}
    return {"site_id": site_id, "summary": row.text, "memory_id": f"memory:summary:{row.id}"}
