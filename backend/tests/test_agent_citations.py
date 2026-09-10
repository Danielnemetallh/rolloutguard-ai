from __future__ import annotations

import json

from fastapi.testclient import TestClient

from rolloutguard_api.ai.agent import run_agent
from rolloutguard_api.ai.citations import resolve_agent_citations
from rolloutguard_api.ai.provider import LLMProvider, LLMResponse
from rolloutguard_api.db import models
from rolloutguard_api.main import create_app


def _analysis_context() -> tuple[int, int, dict[str, object]]:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    analysis_id = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()[
        "analysis_run_id"
    ]
    findings = client.get(f"/api/analyses/{analysis_id}/findings").json()["findings"]
    evidence = next(item for finding in findings for item in finding["evidence"])
    return project_id, analysis_id, evidence


def _document_with_chunk(
    db,
    *,
    project_id: int,
    filename: str,
    chunk_index: int = 0,
    text: str = "Stored source excerpt",
) -> models.Document:
    document = models.Document(
        project_id=project_id,
        filename=filename,
        mime="text/plain",
        sha256=f"{project_id}-{filename}",
        kind="document",
        storage_key="",
        extract_json={},
    )
    db.add(document)
    db.flush()
    db.add(
        models.DocumentChunk(
            document_id=document.id,
            chunk_index=chunk_index,
            text=text,
            site_ids_json=[],
            token_count=1,
        )
    )
    db.commit()
    return document


def test_resolve_agent_citations_validates_sources_and_preserves_order() -> None:
    project_id, analysis_id, evidence = _analysis_context()

    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        long_text = "A" * 400
        document = _document_with_chunk(
            db,
            project_id=project_id,
            filename="partnervertrag-lang.pdf",
            chunk_index=2,
            text=long_text,
        )
        foreign_project = models.Project(name="Foreign project")
        db.add(foreign_project)
        db.commit()
        foreign_document = _document_with_chunk(
            db,
            project_id=foreign_project.id,
            filename="foreign.pdf",
        )

        evidence_id = str(evidence["evidence_id"])
        citations = resolve_agent_citations(
            db,
            analysis_run_id=analysis_id,
            evidence_ids=[evidence_id, evidence_id, "E-UNKNOWN-999"],
            memory_ids=[
                f"doc:{document.id}#c2",
                f"doc:{document.id}#c2",
                "doc:not-an-id#c0",
                f"doc:{foreign_document.id}#c0",
            ],
        )

        assert [citation.id for citation in citations] == [
            evidence_id,
            f"doc:{document.id}#c2",
        ]
        workbook = citations[0]
        assert workbook.source_kind == "workbook_cell"
        assert workbook.label == evidence["file"]
        assert str(evidence["sheet"]) in workbook.locator
        assert str(evidence["row"]) in workbook.locator
        assert str(evidence["column"]) in workbook.locator
        assert workbook.snippet == str(evidence["value"])
        assert workbook.evidence_id == evidence_id
        assert workbook.document_id is None

        document_citation = citations[1]
        assert document_citation.source_kind == "document_chunk"
        assert document_citation.label == "partnervertrag-lang.pdf"
        assert document_citation.locator == "Abschnitt 3"
        assert len(document_citation.snippet or "") == 280
        assert document_citation.document_id == document.id
        assert document_citation.evidence_id is None
    finally:
        db.close()


def test_resolve_agent_citations_caps_results_at_twelve() -> None:
    project_id, analysis_id, _ = _analysis_context()

    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        document_ids = [
            _document_with_chunk(db, project_id=project_id, filename=f"source-{index}.txt").id
            for index in range(13)
        ]
        citations = resolve_agent_citations(
            db,
            analysis_run_id=analysis_id,
            evidence_ids=[],
            memory_ids=[f"doc:{document_id}#c0" for document_id in document_ids],
        )
        assert len(citations) == 12
        assert [citation.document_id for citation in citations] == document_ids[:12]
    finally:
        db.close()


def test_run_agent_returns_and_persists_normalized_citations() -> None:
    _, analysis_id, evidence = _analysis_context()
    evidence_id = str(evidence["evidence_id"])

    class CitationProvider(LLMProvider):
        name = "citation-test"

        def complete(
            self,
            messages,
            *,
            tools=None,
            temperature=0.0,
            max_tokens=1200,
            thinking=False,
        ) -> LLMResponse:
            return LLMResponse(
                content=json.dumps(
                    {
                        "answer": "Validated answer",
                        "evidence_ids": [evidence_id],
                        "memory_ids": [],
                    }
                ),
                model=self.name,
                latency_ms=1,
            )

    from rolloutguard_api.db.session import SessionLocal

    db = SessionLocal()
    try:
        answer = run_agent(
            db,
            analysis_run_id=analysis_id,
            question="Which source supports this?",
            provider=CitationProvider(),
        )
        assert [citation.id for citation in answer.citations] == [evidence_id]

        persisted = (
            db.query(models.AgentMessage)
            .filter_by(analysis_run_id=analysis_id, role="assistant")
            .order_by(models.AgentMessage.id.desc())
            .first()
        )
        assert persisted is not None
        assert persisted.citation_json["citations"][0]["id"] == evidence_id
        assert persisted.citation_json["evidence_ids"] == [evidence_id]
    finally:
        db.close()


def test_assistant_query_serializes_structured_citations(monkeypatch) -> None:
    _, analysis_id, evidence = _analysis_context()
    evidence_id = str(evidence["evidence_id"])

    class ApiCitationProvider(LLMProvider):
        name = "citation-api-test"

        def complete(
            self,
            messages,
            *,
            tools=None,
            temperature=0.0,
            max_tokens=1200,
            thinking=False,
        ) -> LLMResponse:
            return LLMResponse(
                content=json.dumps(
                    {
                        "answer": "API answer",
                        "evidence_ids": [evidence_id],
                        "citations": [{"id": "forged-model-citation"}],
                    }
                ),
                model=self.name,
                latency_ms=1,
            )

    monkeypatch.setattr(
        "rolloutguard_api.api.assistant.get_llm_provider",
        lambda force_mock=False: ApiCitationProvider(),
    )
    response = TestClient(create_app()).post(
        "/api/assistant/queries",
        json={"analysis_run_id": analysis_id, "question": "Show the source"},
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["evidence_ids"] == [evidence_id]
    assert result["citations"] == [
        {
            "id": evidence_id,
            "sourceKind": "workbook_cell",
            "label": evidence["file"],
            "locator": (
                f"{evidence['sheet']}, Zeile {evidence['row']}, {evidence['column']}"
            ),
            "snippet": str(evidence["value"]),
            "evidenceId": evidence_id,
            "documentId": None,
        }
    ]


def test_deterministic_agent_returns_validated_citation_metadata() -> None:
    _, analysis_id, _ = _analysis_context()
    response = TestClient(create_app()).post(
        "/api/assistant/queries",
        json={
            "analysis_run_id": analysis_id,
            "question": "Liste alle kritischen Befunde dieses Laufs.",
            "force_mock": True,
        },
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["evidence_ids"]
    assert result["citations"]
    assert all(citation["sourceKind"] == "workbook_cell" for citation in result["citations"])
