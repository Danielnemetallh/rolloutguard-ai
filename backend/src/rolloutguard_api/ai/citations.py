"""Resolve model-proposed source identifiers against trusted persisted evidence."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from rolloutguard_api.db import models

MAX_AGENT_CITATIONS = 12
MAX_CITATION_SNIPPET_CHARS = 280
DOCUMENT_MEMORY_ID = re.compile(r"\Adoc:(\d{1,19})#c(\d{1,9})\Z")


class AgentCitation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    source_kind: Literal["workbook_cell", "document_chunk"] = Field(alias="sourceKind")
    label: str
    locator: str
    snippet: str | None
    evidence_id: str | None = Field(alias="evidenceId")
    document_id: int | None = Field(alias="documentId")


def _truncate_snippet(value: object) -> str | None:
    if value is None:
        return None
    normalized = " ".join(str(value).split())
    if not normalized:
        return None
    if len(normalized) <= MAX_CITATION_SNIPPET_CHARS:
        return normalized
    return f"{normalized[: MAX_CITATION_SNIPPET_CHARS - 1]}…"


def _workbook_evidence_by_id(
    db: Session, analysis_run_id: int
) -> dict[str, dict[str, object]]:
    evidence_by_id: dict[str, dict[str, object]] = {}
    findings = db.query(models.FindingRow).filter_by(analysis_run_id=analysis_run_id).all()
    for finding in findings:
        for raw_evidence in finding.evidence_json or []:
            if not isinstance(raw_evidence, dict):
                continue
            evidence_id = raw_evidence.get("evidence_id")
            if isinstance(evidence_id, str) and evidence_id not in evidence_by_id:
                evidence_by_id[evidence_id] = raw_evidence
    return evidence_by_id


def _workbook_citation(
    evidence_id: str, evidence: dict[str, object]
) -> AgentCitation | None:
    filename = evidence.get("file")
    sheet = evidence.get("sheet")
    row = evidence.get("row")
    column = evidence.get("column")
    if not isinstance(filename, str) or not isinstance(sheet, str):
        return None
    if not isinstance(row, int) or not isinstance(column, str):
        return None
    return AgentCitation(
        id=evidence_id,
        source_kind="workbook_cell",
        label=filename,
        locator=f"{sheet}, Zeile {row}, {column}",
        snippet=_truncate_snippet(evidence.get("value")),
        evidence_id=evidence_id,
        document_id=None,
    )


def _document_citation(
    db: Session, *, project_id: int, memory_id: str
) -> AgentCitation | None:
    match = DOCUMENT_MEMORY_ID.fullmatch(memory_id)
    if match is None:
        return None
    document_id, chunk_index = (int(value) for value in match.groups())
    row = (
        db.query(models.DocumentChunk, models.Document)
        .join(models.Document, models.DocumentChunk.document_id == models.Document.id)
        .filter(
            models.Document.id == document_id,
            models.Document.project_id == project_id,
            models.DocumentChunk.chunk_index == chunk_index,
        )
        .first()
    )
    if row is None:
        return None
    chunk, document = row
    return AgentCitation(
        id=memory_id,
        source_kind="document_chunk",
        label=document.filename,
        locator=f"Abschnitt {chunk.chunk_index + 1}",
        snippet=_truncate_snippet(chunk.text),
        evidence_id=None,
        document_id=document.id,
    )


def resolve_agent_citations(
    db: Session,
    *,
    analysis_run_id: int,
    evidence_ids: list[str],
    memory_ids: list[str],
) -> list[AgentCitation]:
    run = db.get(models.AnalysisRun, analysis_run_id)
    if run is None:
        return []
    batch = db.get(models.ImportBatch, run.batch_id)
    if batch is None:
        return []

    evidence_by_id = _workbook_evidence_by_id(db, analysis_run_id)
    citations: list[AgentCitation] = []
    seen: set[str] = set()

    for evidence_id in evidence_ids:
        if evidence_id in seen:
            continue
        evidence = evidence_by_id.get(evidence_id)
        citation = _workbook_citation(evidence_id, evidence) if evidence is not None else None
        if citation is not None:
            citations.append(citation)
            seen.add(evidence_id)
        if len(citations) == MAX_AGENT_CITATIONS:
            return citations

    for memory_id in memory_ids:
        if memory_id in seen:
            continue
        citation = _document_citation(db, project_id=batch.project_id, memory_id=memory_id)
        if citation is not None:
            citations.append(citation)
            seen.add(memory_id)
        if len(citations) == MAX_AGENT_CITATIONS:
            break
    return citations
