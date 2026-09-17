from __future__ import annotations

from pathlib import Path

from rolloutguard_api.services.ingest import profile_workbook
from rolloutguard_api.services.reconcile import reconcile

FIXTURE = Path(__file__).resolve().parents[2] / "data" / "fixtures" / "kaggle_construction"


def test_kaggle_fixture_profiles_and_reconciles() -> None:
    contract = profile_workbook(FIXTURE / "kaggle_contract_obligations.xlsx")
    schedule = profile_workbook(FIXTURE / "kaggle_partner_schedule.xlsx")
    status = profile_workbook(FIXTURE / "kaggle_site_project_status.xlsx")

    assert contract.profile.logical_type == "contract"
    assert schedule.profile.logical_type == "schedule"
    assert status.profile.logical_type == "status"
    sites = reconcile(contract, schedule, status)
    expected_sites = {
        f"KAGGLE-DE-{project_id}"
        for project_id in ("1328", "1329", "1330", "1335", "1338", "1340", "1343", "1345")
    }
    assert set(sites) == expected_sites
