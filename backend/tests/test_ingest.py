from pathlib import Path

from rolloutguard_api.services.ingest import IngestError, profile_workbook, validate_upload

SYNTH = Path(__file__).resolve().parents[2] / "data" / "synthetic"


def test_validate_rejects_non_xlsx(tmp_path: Path) -> None:
    bad = tmp_path / "notes.csv"
    bad.write_text("a,b\n1,2\n", encoding="utf-8")
    try:
        validate_upload(bad)
        raise AssertionError("expected IngestError")
    except IngestError as exc:
        assert exc.code == "UNSUPPORTED_FILE_TYPE"


def test_profile_contract_workbook() -> None:
    path = SYNTH / "contract_obligations.xlsx"
    assert path.exists(), "Run scripts/generate-synthetic.ps1 first"
    result = profile_workbook(path)
    assert result.profile.logical_type == "contract"
    assert result.profile.row_count > 0
    mapped = {
        m.source_header: m.canonical_field
        for m in result.profile.mappings
        if m.canonical_field
    }
    assert "site_id" in mapped.values()
    assert "contractual_due_date" in mapped.values()
    assert all(m.method in {"exact", "fuzzy"} for m in result.profile.mappings if m.canonical_field)


def test_profile_schedule_forecast_date_drift() -> None:
    path = SYNTH / "partner_schedule.xlsx"
    result = profile_workbook(path)
    assert result.profile.logical_type == "schedule"
    forecast = next(
        m for m in result.profile.mappings if m.source_header == "Forecast Date"
    )
    assert forecast.canonical_field == "forecast_date"
    assert forecast.confidence >= 0.55


def test_profile_status_workbook() -> None:
    path = SYNTH / "site_project_status.xlsx"
    result = profile_workbook(path)
    assert result.profile.logical_type == "status"
    assert any(m.canonical_field == "fibre_ready_date" for m in result.profile.mappings)
