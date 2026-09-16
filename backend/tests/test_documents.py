from pathlib import Path

from fastapi.testclient import TestClient

from rolloutguard_api.main import create_app
from rolloutguard_api.services.documents import extract_text, write_simple_pdf


def test_pdf_text_extract(tmp_path: Path) -> None:
    pdf = tmp_path / "sow.pdf"
    write_simple_pdf(pdf, ["Standort DE-NRW-0107", "Faelligkeit 15.09.2026"])
    text = extract_text(pdf)
    assert "DE-NRW-0107" in text
    assert "15.09.2026" in text


def test_upload_document_and_search() -> None:
    from rolloutguard_api.ai.memory import search_corpus
    from rolloutguard_api.db.session import SessionLocal

    client = TestClient(create_app())
    projects = client.get("/api/projects").json()
    project_id = projects[0]["id"]
    analysis = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()
    assert analysis["analysis_run_id"]

    docs = client.get(f"/api/projects/{project_id}/documents").json()
    names = [d["filename"] for d in docs["documents"]]
    assert any("vertrag" in n.lower() or n.endswith(".pdf") for n in names)

    db = SessionLocal()
    try:
        hits = search_corpus(db, "DE-NRW-0107 Vertrag", project_id=project_id, limit=5)
        assert hits
        assert any("DE-NRW-0107" in hit.get("snippet", "") for hit in hits)
    finally:
        db.close()
