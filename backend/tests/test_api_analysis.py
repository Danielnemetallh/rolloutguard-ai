"""API integration tests."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from openpyxl import Workbook

from rolloutguard_api.domain.schema import CONTRACT_HEADERS, SCHEDULE_HEADERS, STATUS_HEADERS
from rolloutguard_api.main import create_app

SYNTH = Path(__file__).resolve().parents[2] / "data" / "synthetic"
IMPORTED_SITE_ID = "KG-TEST-0001"
IMPORTED_DUE_DATE = "2026-10-01"


def _write_sheet(path: Path, headers: dict[str, str], row: dict[str, object]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    keys = list(headers)
    sheet.append([headers[key] for key in keys])
    sheet.append([row[key] for key in keys])
    workbook.save(path)


def _imported_workbooks(tmp_path: Path) -> dict[str, Path]:
    contract = tmp_path / "kaggle_contract_obligations.xlsx"
    schedule = tmp_path / "kaggle_partner_schedule.xlsx"
    status = tmp_path / "kaggle_site_project_status.xlsx"
    _write_sheet(
        contract,
        CONTRACT_HEADERS,
        {
            "site_id": IMPORTED_SITE_ID,
            "partner_id": "PARTNER-NORTH",
            "obligation_code": "INT_READY",
            "contractual_due_date": IMPORTED_DUE_DATE,
            "sla_days": 10,
            "required_evidence": "FAT",
            "contract_version": "SOW-1",
        },
    )
    _write_sheet(
        schedule,
        SCHEDULE_HEADERS,
        {
            "site_id": IMPORTED_SITE_ID,
            "milestone_code": "INTEGRATION",
            "planned_date": "2026-09-20",
            "forecast_date": "2026-09-22",
            "actual_date": None,
            "partner_status": "On Track",
            "last_updated_at": "2026-09-01T08:00:00+00:00",
        },
    )
    _write_sheet(
        status,
        STATUS_HEADERS,
        {
            "site_id": IMPORTED_SITE_ID,
            "permit_status": "APPROVED",
            "construction_status": "DONE",
            "fibre_ready_date": "2026-09-18",
            "integration_test_status": "PENDING",
            "acceptance_status": "NOT_STARTED",
            "blocker_comment": "Kaggle fixture",
        },
    )
    return {"contract": contract, "schedule": schedule, "status": status}


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


def test_import_single_workbook_is_listed_and_filled_from_synthetic() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    workbook = SYNTH / "contract_obligations.xlsx"
    assert workbook.exists(), "Run scripts/generate-synthetic.ps1 first"

    with workbook.open("rb") as handle:
        result = client.post(
            f"/api/projects/{project_id}/imports",
            files={
                "files": (
                    "kaggle_contract_obligations.xlsx",
                    handle,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    assert result.status_code == 200, result.text
    body = result.json()
    assert "kaggle_contract_obligations.xlsx" in body["imported_files"]
    assert "schedule" in body["filled_from_synthetic"]
    assert "status" in body["filled_from_synthetic"]
    assert body["analysis_run_id"]

    documents = client.get(f"/api/projects/{project_id}/documents").json()["documents"]
    assert any(doc["filename"] == "kaggle_contract_obligations.xlsx" for doc in documents)


def test_import_workbook_without_xlsx_suffix() -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    workbook = SYNTH / "partner_schedule.xlsx"
    with workbook.open("rb") as handle:
        result = client.post(
            f"/api/projects/{project_id}/imports",
            files={
                "files": (
                    "analysis-1",
                    handle,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
    assert result.status_code == 200, result.text
    body = result.json()
    assert any(name.endswith(".xlsx") for name in body["imported_files"])
    documents = client.get(f"/api/projects/{project_id}/documents").json()["documents"]
    assert any("analysis-1" in doc["filename"] for doc in documents)


def test_timeline_uses_imported_run_workbooks(tmp_path: Path) -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]
    paths = _imported_workbooks(tmp_path)

    with (
        paths["contract"].open("rb") as contract,
        paths["schedule"].open("rb") as schedule,
        paths["status"].open("rb") as status,
    ):
        result = client.post(
            f"/api/projects/{project_id}/imports",
            files={
                "contract": (
                    paths["contract"].name,
                    contract,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
                "schedule": (
                    paths["schedule"].name,
                    schedule,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
                "status": (
                    paths["status"].name,
                    status,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            },
        )
    assert result.status_code == 200, result.text
    analysis_id = result.json()["analysis_run_id"]

    missing = client.get(f"/api/sites/{IMPORTED_SITE_ID}/timeline")
    assert missing.status_code == 404

    timeline = client.get(
        f"/api/sites/{IMPORTED_SITE_ID}/timeline",
        params={"analysis_id": analysis_id},
    )
    assert timeline.status_code == 200, timeline.text
    body = timeline.json()
    assert body["site_id"] == IMPORTED_SITE_ID
    assert body["timeline"]["contractual_due_date"] == IMPORTED_DUE_DATE
    assert body["timeline"]["blocker_comment"] == "Kaggle fixture"
