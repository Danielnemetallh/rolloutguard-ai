"""API integration tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

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
