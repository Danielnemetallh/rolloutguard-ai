"""evaluate_sites() must default `as_of` to the real current date, not a
frozen calendar date — otherwise FRS-001 (freshness) silently drifts wrong
as soon as real time passes the hardcoded value."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from rolloutguard_api.services.reconcile import CanonicalSite
from rolloutguard_api.services.rules import evaluate_sites


def _site(last_updated_at: datetime) -> CanonicalSite:
    return CanonicalSite(
        site_id="DE-TEST-0001",
        sources_present={"contract", "schedule", "status"},
        last_updated_at=last_updated_at,
    )


def test_default_as_of_uses_real_today_not_a_frozen_date() -> None:
    # Fresh relative to *real* today; would incorrectly fire FRS-001 if the
    # engine still defaulted to a stale hardcoded as_of far in the future.
    fresh = _site(datetime.now(UTC) - timedelta(days=5))
    result = evaluate_sites({fresh.site_id: fresh})
    assert result.as_of == date.today()
    assert not any(f.rule_id == "FRS-001" for f in result.findings)


def test_frs_001_fires_for_data_older_than_threshold() -> None:
    stale = _site(datetime.now(UTC) - timedelta(days=45))
    result = evaluate_sites({stale.site_id: stale})
    assert any(f.rule_id == "FRS-001" for f in result.findings)
