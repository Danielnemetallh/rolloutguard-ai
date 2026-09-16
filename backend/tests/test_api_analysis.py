"""API integration tests."""

from __future__ import annotations

import json
from contextlib import ExitStack
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient

import rolloutguard_api.db.session as db_session
from rolloutguard_api.db import models
from rolloutguard_api.main import create_app


def test_analyze_synthetic_end_to_end() -> None:
    client = TestClient(create_app())

    projects = client.get("/api/projects")
    assert projects.status_code == 200
    assert len(projects.json()) >= 1
    project_id = projects.json()[0]["id"]

    result = client.post(f"/api/projects/{project_id}/analyze-synthetic")
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["kpis"]["findings_total"] >= 10
    assert any(h["rule_id"] == "SLA-001" for h in body["hero_findings"])

    analysis_id = body["analysis_run_id"]
    findings = client.get(
        f"/api/analyses/{analysis_id}/findings",
        params={"severity": "critical"},
    )
    assert findings.status_code == 200
    assert findings.json()["count"] >= 1

    timeline = client.get(
        "/api/sites/DE-NRW-0107/timeline",
        params={"analysis_id": analysis_id},
    )
    assert timeline.status_code == 200
    assert timeline.json()["timeline"]["contractual_due_date"] == "2026-09-15"

    finding_id = findings.json()["findings"][0]["id"]
    review = client.post(
        f"/api/findings/{finding_id}/reviews",
        json={"decision": "dismiss", "reason": "Partner already notified"},
    )
    assert review.status_code == 200
    assert review.json()["status"] == "dismissed"

    refreshed = client.get(
        f"/api/analyses/{analysis_id}/findings",
        params={"site_id": findings.json()["findings"][0]["site_id"]},
    )
    assert refreshed.status_code == 200
    assert any(item["status"] == "dismissed" for item in refreshed.json()["findings"])


def test_uploaded_fixture_timeline_and_export_use_selected_run() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    fixture_dir = (
        Path(__file__).resolve().parents[2] / "data" / "fixtures" / "kaggle_construction"
    )
    manifest = json.loads((fixture_dir / "manifest.json").read_text(encoding="utf-8"))
    expected_sites = {project["site_id"] for project in manifest["projects"].values()}
    fixture_paths = {
        "contract": fixture_dir / "kaggle_contract_obligations.xlsx",
        "schedule": fixture_dir / "kaggle_partner_schedule.xlsx",
        "status": fixture_dir / "kaggle_site_project_status.xlsx",
    }

    synthetic = client.post(f"/api/projects/{project_id}/analyze-synthetic")
    assert synthetic.status_code == 200, synthetic.text
    synthetic_analysis_id = synthetic.json()["analysis_run_id"]

    with ExitStack() as stack:
        files = {
            logical_type: (
                path.name,
                stack.enter_context(path.open("rb")),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            for logical_type, path in fixture_paths.items()
        }
        imported = client.post(f"/api/projects/{project_id}/imports", files=files)

    assert imported.status_code == 200, imported.text
    import_body = imported.json()
    assert import_body["site_count"] == len(expected_sites)
    analysis_id = import_body["analysis_run_id"]

    with db_session.SessionLocal() as db:
        source_files = db.query(models.SourceFile).filter_by(batch_id=import_body["batch_id"]).all()
        source_filenames = {source_file.filename for source_file in source_files}
        assert source_filenames == {
            "contract_obligations.xlsx",
            "partner_schedule.xlsx",
            "site_project_status.xlsx",
        }
        assert all(Path(source_file.storage_key).is_file() for source_file in source_files)

    findings = client.get(f"/api/analyses/{analysis_id}/findings")
    assert findings.status_code == 200
    assert findings.json()["count"] >= 1

    for site_id in sorted(expected_sites):
        timeline = client.get(
            f"/api/sites/{site_id}/timeline",
            params={"analysis_id": analysis_id},
        )
        assert timeline.status_code == 200, timeline.text
        timeline_body = timeline.json()
        assert timeline_body["site_id"] == site_id
        assert {evidence["file"] for evidence in timeline_body["evidence"]} <= source_filenames

    synthetic_timeline = client.get(
        "/api/sites/DE-NRW-0107/timeline",
        params={"analysis_id": synthetic_analysis_id},
    )
    assert synthetic_timeline.status_code == 200, synthetic_timeline.text
    assert synthetic_timeline.json()["timeline"]["contractual_due_date"] == "2026-09-15"
    assert {
        evidence["file"] for evidence in synthetic_timeline.json()["evidence"]
    } <= {
        "contract_obligations.xlsx",
        "partner_schedule.xlsx",
        "site_project_status.xlsx",
    }

    exported = client.post(f"/api/analyses/{analysis_id}/exports")
    assert exported.status_code == 200, exported.text
    assert Path(exported.json()["xlsx_path"]).exists()
    assert Path(exported.json()["markdown_path"]).exists()


def test_timeline_rejects_unknown_analysis() -> None:
    client = TestClient(create_app())

    response = client.get(
        "/api/sites/DE-NRW-0107/timeline",
        params={"analysis_id": 999999},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "ANALYSIS_NOT_FOUND"


def test_timeline_reports_missing_source_workbook() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    analysis_id = client.post(f"/api/projects/{project_id}/analyze-synthetic").json()[
        "analysis_run_id"
    ]

    db = db_session.SessionLocal()
    source_file = (
        db.query(models.SourceFile)
        .join(models.ImportBatch, models.SourceFile.batch_id == models.ImportBatch.id)
        .join(models.AnalysisRun, models.AnalysisRun.batch_id == models.ImportBatch.id)
        .filter(models.AnalysisRun.id == analysis_id, models.SourceFile.logical_type == "contract")
        .one()
    )
    source_file_id = source_file.id
    original_storage_key = source_file.storage_key
    original_filename = source_file.filename
    source_file.storage_key = "missing-contract-workbook.xlsx"
    source_file.filename = "missing-contract-workbook.xlsx"
    db.commit()
    db.close()

    try:
        response = client.get(
            "/api/sites/DE-NRW-0107/timeline",
            params={"analysis_id": analysis_id},
        )
    finally:
        db = db_session.SessionLocal()
        source_file = db.get(models.SourceFile, source_file_id)
        assert source_file is not None
        source_file.storage_key = original_storage_key
        source_file.filename = original_filename
        db.commit()
        db.close()

    assert response.status_code == 404
    assert response.json()["code"] == "ANALYSIS_SOURCE_MISSING"


def test_import_rejects_non_xlsx_upload() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    files = {
        "contract": ("notes.csv", BytesIO(b"not an xlsx"), "text/csv"),
        "schedule": ("schedule.xlsx", BytesIO(b"not an xlsx"), "application/octet-stream"),
        "status": ("status.xlsx", BytesIO(b"not an xlsx"), "application/octet-stream"),
    }

    response = client.post(f"/api/projects/{project_id}/imports", files=files)

    assert response.status_code == 400
    assert response.json()["code"] == "UNSUPPORTED_FILE_TYPE"
