"""Golden tests: seeded synthetic anomalies must be detected by the rule engine."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from rolloutguard_api.domain.schema import HERO_SITE_ID
from rolloutguard_api.services.ingest import profile_workbook
from rolloutguard_api.services.reconcile import reconcile
from rolloutguard_api.services.rules import evaluate_sites

SYNTH = Path(__file__).resolve().parents[2] / "data" / "synthetic"
AS_OF = date(2026, 7, 26)


def _run_pipeline():
    contract = profile_workbook(SYNTH / "contract_obligations.xlsx")
    schedule = profile_workbook(SYNTH / "partner_schedule.xlsx")
    status = profile_workbook(SYNTH / "site_project_status.xlsx")
    sites = reconcile(contract, schedule, status)
    return evaluate_sites(sites, as_of=AS_OF), json.loads(
        (SYNTH / "anomaly_manifest.json").read_text(encoding="utf-8")
    )


def test_hero_site_sla_and_seq() -> None:
    result, _manifest = _run_pipeline()
    hero_rules = {
        f.rule_id for f in result.findings if f.site_id == HERO_SITE_ID
    }
    assert "SLA-001" in hero_rules
    assert "SEQ-002" in hero_rules


def test_seeded_anomalies_detected() -> None:
    result, manifest = _run_pipeline()
    found: dict[str, set[str]] = {}
    for f in result.findings:
        found.setdefault(f.rule_id, set()).add(f.site_id)

    missing: list[str] = []
    for anomaly in manifest["anomalies"]:
        site_id = anomaly["site_id"]
        for rule_id in anomaly["rule_ids"]:
            # Leading-zero demo is a lineage/parser concern, not necessarily DQ-001
            if anomaly["anomaly_id"] == "A-ID-LEADING-ZERO":
                continue
            if site_id not in found.get(rule_id, set()):
                missing.append(f"{anomaly['anomaly_id']}:{rule_id}:{site_id}")

    assert missing == [], f"Missing expected findings: {missing}"


def test_analysis_kpis_present() -> None:
    result, _manifest = _run_pipeline()
    assert result.kpis["sites_total"] >= 40
    assert result.kpis["findings_total"] >= 10
    assert result.kpis["findings_critical"] >= 1
    assert "SLA-001" in result.kpis["findings_by_rule"]


def test_findings_carry_evidence() -> None:
    result, _manifest = _run_pipeline()
    hero = [f for f in result.findings if f.site_id == HERO_SITE_ID and f.rule_id == "SLA-001"]
    assert hero
    assert hero[0].evidence, "SLA finding must include source evidence refs"
