"""Run-history listing and diff-against-previous-run behavior."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from rolloutguard_api.domain.generate_synthetic import generate
from rolloutguard_api.main import create_app


def _upload(client: TestClient, project_id: int, paths: dict[str, Path]) -> dict:
    with (
        paths["contract"].open("rb") as c,
        paths["schedule"].open("rb") as s,
        paths["status"].open("rb") as st,
    ):
        res = client.post(
            f"/api/projects/{project_id}/imports",
            files={
                "contract": ("contract_obligations.xlsx", c),
                "schedule": ("partner_schedule.xlsx", s),
                "status": ("site_project_status.xlsx", st),
            },
        )
    assert res.status_code == 200, res.text
    return res.json()


def test_run_history_and_diff(tmp_path: Path) -> None:
    client = TestClient(create_app())
    project_id = client.get("/api/projects").json()[0]["id"]

    paths_a = generate(tmp_path / "a", n_sites=40)
    paths_b = generate(tmp_path / "b", n_sites=45)

    first = _upload(client, project_id, paths_a)
    second = _upload(client, project_id, paths_b)
    assert first["analysis_run_id"] != second["analysis_run_id"]

    history = client.get(f"/api/projects/{project_id}/analyses")
    assert history.status_code == 200
    run_ids = [a["id"] for a in history.json()["analyses"]]
    assert first["analysis_run_id"] in run_ids
    assert second["analysis_run_id"] in run_ids
    # Most recent run listed first.
    assert run_ids[0] == second["analysis_run_id"]

    diff = client.get(f"/api/analyses/{second['analysis_run_id']}/diff")
    assert diff.status_code == 200
    body = diff.json()
    assert body["compared_to_run_id"] == first["analysis_run_id"]
    assert body["new_count"] >= 0
    assert body["resolved_count"] >= 0
    # The hero scenario (SLA-001/SEQ-002) is seeded identically in both runs.
    assert body["persisting_count"] > 0

    # Diffing a run never compares it against a later run (ordering sanity).
    first_diff = client.get(f"/api/analyses/{first['analysis_run_id']}/diff")
    assert first_diff.status_code == 200
    assert first_diff.json()["compared_to_run_id"] != second["analysis_run_id"]
