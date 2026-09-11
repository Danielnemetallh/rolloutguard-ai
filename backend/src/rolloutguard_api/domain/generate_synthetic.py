"""Generate synthetic rollout workbooks with seeded anomalies.

Produces three Excel files with intentionally inconsistent headers plus an
anomaly_manifest.json documenting expected rule findings.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from openpyxl import Workbook

from rolloutguard_api.domain.schema import (
    CONTRACT_HEADERS,
    HERO_SITE_ID,
    OBLIGATION_TO_MILESTONE,
    PARTNERS,
    REGIONS,
    RULE_CATALOGUE,
    SCHEDULE_HEADERS,
    STATUS_HEADERS,
    STATUS_VOCAB,
)


@dataclass
class Anomaly:
    anomaly_id: str
    site_id: str
    rule_ids: list[str]
    severity: str
    description: str
    notes: str = ""


@dataclass
class SitePlan:
    site_id: str
    partner_id: str
    region: str
    due_date: date
    planned_integration: date
    forecast_integration: date
    fibre_ready: date
    permit_status: str = "APPROVED"
    construction_status: str = "DONE"
    construction_actual: date | None = None
    integration_status: str = "PENDING"
    acceptance_status: str = "NOT_STARTED"
    partner_status_key: str = "ON_TRACK"
    blocker_comment: str = ""
    include_in_contract: bool = True
    include_in_schedule: bool = True
    include_in_status: bool = True
    # Relative to generation time (not a frozen calendar date) so the demo
    # dataset stays "fresh" under FRS-001 no matter when it's regenerated.
    last_updated: datetime = field(
        default_factory=lambda: datetime.now(UTC) - timedelta(days=6)
    )
    # Special flags for seeded anomalies
    duplicate_conflict: bool = False
    ambiguous_date: bool = False
    unknown_status: bool = False
    missing_actual_when_done: bool = False
    leading_zero_site: bool = False
    rename_header_variant: bool = False


def _d(year: int, month: int, day: int) -> date:
    return date(year, month, day)


def build_sites(n: int = 50) -> tuple[list[SitePlan], list[Anomaly]]:
    sites: list[SitePlan] = []
    anomalies: list[Anomaly] = []
    partners = [p["partner_id"] for p in PARTNERS]
    base = _d(2026, 8, 1)

    for i in range(1, n + 1):
        partner = partners[(i - 1) % len(partners)]
        region = REGIONS[(i - 1) % len(REGIONS)]
        site_id = f"DE-{region}-{i:04d}"
        due = base + timedelta(days=14 + (i % 40))
        planned = due - timedelta(days=8)
        forecast = planned + timedelta(days=(i % 5))
        fibre = planned - timedelta(days=2)
        construction_actual = planned - timedelta(days=10)

        sites.append(
            SitePlan(
                site_id=site_id,
                partner_id=partner,
                region=region,
                due_date=due,
                planned_integration=planned,
                forecast_integration=forecast,
                fibre_ready=fibre,
                construction_actual=construction_actual,
                partner_status_key="ON_TRACK" if forecast <= due else "AT_RISK",
            )
        )

    # --- Seeded anomalies (hero scenario first) ---
    # Pick a stable slot and rewrite to the interview demo site ID.
    hero = sites[0]
    hero.site_id = HERO_SITE_ID
    hero.partner_id = "PARTNER-NORTH"
    hero.region = "NRW"
    hero.due_date = _d(2026, 9, 15)
    hero.planned_integration = _d(2026, 9, 7)
    hero.forecast_integration = _d(2026, 9, 20)  # after contractual due → SLA-001
    hero.fibre_ready = _d(2026, 9, 18)  # after planned/forecast conflict → SEQ-002
    hero.construction_status = "DONE"
    hero.construction_actual = _d(2026, 8, 28)
    hero.integration_status = "PENDING"
    hero.acceptance_status = "NOT_STARTED"
    hero.partner_status_key = "AT_RISK"
    hero.blocker_comment = "Backhaul handover moved by supplier"
    hero.last_updated = datetime.now(UTC) - timedelta(days=3)
    anomalies.append(
        Anomaly(
            anomaly_id="A-HERO-001",
            site_id=HERO_SITE_ID,
            rule_ids=["SLA-001", "SEQ-002"],
            severity="critical",
            description=(
                "Integration forecast 20 Sep exceeds contractual due 15 Sep; "
                "forecast also precedes fibre-ready 18 Sep relative to planned slot."
            ),
            notes="Primary 10-minute demo scenario",
        )
    )

    # A02: site in schedule only (missing from contract) → DQ-002
    orphan = sites[2]
    orphan.include_in_contract = False
    orphan.blocker_comment = "Added late by partner spreadsheet"
    anomalies.append(
        Anomaly(
            anomaly_id="A-DQ-002-MISSING-CONTRACT",
            site_id=orphan.site_id,
            rule_ids=["DQ-002"],
            severity="critical",
            description="Site appears in schedule/status but not in contract obligations",
        )
    )

    # A03: duplicate site with conflicting forecast → DQ-001
    dup = sites[3]
    dup.duplicate_conflict = True
    anomalies.append(
        Anomaly(
            anomaly_id="A-DQ-001-DUP-CONFLICT",
            site_id=dup.site_id,
            rule_ids=["DQ-001"],
            severity="critical",
            description="Duplicate schedule rows with conflicting forecast dates",
        )
    )

    # A04: completed partner status without actual date → STS-001
    no_actual = sites[4]
    no_actual.construction_status = "DONE"
    no_actual.construction_actual = None
    no_actual.missing_actual_when_done = True
    no_actual.partner_status_key = "DONE"
    anomalies.append(
        Anomaly(
            anomaly_id="A-STS-001-NO-ACTUAL",
            site_id=no_actual.site_id,
            rule_ids=["STS-001"],
            severity="warning",
            description="Completed status has no actual completion date",
        )
    )

    # A05: acceptance complete while integration test pending → SEQ-003
    early_accept = sites[5]
    early_accept.acceptance_status = "COMPLETE"
    early_accept.integration_status = "PENDING"
    early_accept.partner_status_key = "AT_RISK"
    anomalies.append(
        Anomaly(
            anomaly_id="A-SEQ-003-EARLY-ACCEPT",
            site_id=early_accept.site_id,
            rule_ids=["SEQ-003"],
            severity="critical",
            description="Acceptance marked complete while integration test still pending",
        )
    )

    # A06: construction before permit → SEQ-001
    seq_permit = sites[6]
    seq_permit.permit_status = "PENDING"
    seq_permit.construction_status = "DONE"
    seq_permit.construction_actual = _d(2026, 7, 1)
    anomalies.append(
        Anomaly(
            anomaly_id="A-SEQ-001-BUILD-BEFORE-PERMIT",
            site_id=seq_permit.site_id,
            rule_ids=["SEQ-001"],
            severity="critical",
            description="Construction actual exists while permit is not approved",
        )
    )

    # A07: ambiguous / unparseable date → DQ-003
    bad_date = sites[7]
    bad_date.ambiguous_date = True
    anomalies.append(
        Anomaly(
            anomaly_id="A-DQ-003-BAD-DATE",
            site_id=bad_date.site_id,
            rule_ids=["DQ-003"],
            severity="warning",
            description="Forecast cell contains an ambiguous/unparseable date string",
        )
    )

    # A08: stale partner update → FRS-001
    stale = sites[8]
    stale.last_updated = datetime.now(UTC) - timedelta(days=45)  # > 30-day threshold
    stale.partner_status_key = "AT_RISK"
    anomalies.append(
        Anomaly(
            anomaly_id="A-FRS-001-STALE",
            site_id=stale.site_id,
            rule_ids=["FRS-001"],
            severity="warning",
            description="Partner schedule last_updated older than freshness threshold (30 days)",
        )
    )

    # A09: unknown status vocabulary → DQ-004
    unk = sites[9]
    unk.unknown_status = True
    anomalies.append(
        Anomaly(
            anomaly_id="A-DQ-004-UNKNOWN-STATUS",
            site_id=unk.site_id,
            rule_ids=["DQ-004"],
            severity="warning",
            description="Partner status uses unknown vocabulary not in alias map",
        )
    )

    # A10: actual date while status not completed → STS-002
    mismatch = sites[10]
    mismatch.integration_status = "PENDING"
    mismatch.partner_status_key = "ON_TRACK"
    # We'll put an actual date on INTEGRATION while status not DONE
    mismatch.forecast_integration = mismatch.due_date - timedelta(days=2)
    anomalies.append(
        Anomaly(
            anomaly_id="A-STS-002-ACTUAL-VS-STATUS",
            site_id=mismatch.site_id,
            rule_ids=["STS-002"],
            severity="warning",
            description="Integration actual date present while partner status is not completed",
        )
    )

    # A11: site missing from status workbook → DQ-002
    missing_status = sites[11]
    missing_status.include_in_status = False
    anomalies.append(
        Anomaly(
            anomaly_id="A-DQ-002-MISSING-STATUS",
            site_id=missing_status.site_id,
            rule_ids=["DQ-002"],
            severity="warning",
            description="Site present in contract/schedule but missing from project status",
        )
    )

    # A12: leading-zero trap site (numeric coercion risk) — use a special ID
    zero_site = sites[12]
    zero_site.site_id = "DE-HH-0077"  # kept as string; manifest notes leading-zero handling
    zero_site.leading_zero_site = True
    anomalies.append(
        Anomaly(
            anomaly_id="A-ID-LEADING-ZERO",
            site_id=zero_site.site_id,
            rule_ids=["DQ-001"],
            severity="warning",
            description="Site ID must remain a string to preserve formatting (leading-zero demo)",
            notes="Generator writes ID as text; parser must not coerce to number",
        )
    )

    # A13: header rename variant on one schedule column for mapping demo
    sites[13].rename_header_variant = True

    # A14: clean SLA miss without fibre conflict
    sla_only = sites[14]
    sla_only.due_date = _d(2026, 8, 20)
    sla_only.forecast_integration = _d(2026, 8, 28)
    sla_only.fibre_ready = _d(2026, 8, 10)
    sla_only.planned_integration = _d(2026, 8, 18)
    sla_only.partner_status_key = "DELAYED"
    anomalies.append(
        Anomaly(
            anomaly_id="A-SLA-001-LATE-FORECAST",
            site_id=sla_only.site_id,
            rule_ids=["SLA-001"],
            severity="critical",
            description="Forecast exceeds contractual due date",
        )
    )

    return sites, anomalies


def _fmt_date(d: date | None, *, german: bool = False, blank: bool = False) -> str | None:
    if blank or d is None:
        return None
    if german:
        return d.strftime("%d.%m.%Y")
    return d.isoformat()


def _partner_status_label(partner_id: str, key: str, *, unknown: bool = False) -> str:
    if unknown:
        return "???Wobbly???"
    return STATUS_VOCAB[partner_id][key]


def write_contract_workbook(path: Path, sites: list[SitePlan]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Obligations"
    headers = list(CONTRACT_HEADERS.values())
    ws.append(headers)

    for site in sites:
        if not site.include_in_contract:
            continue
        row = {
            "Standort-ID": site.site_id,
            "Partner Code": site.partner_id,
            "Obligation": "INT_READY",
            "Vertragsfälligkeit": _fmt_date(site.due_date, german=True),
            "SLA Tage": 10,
            "Required Evidence": "integration_test, acceptance_protocol",
            "SOW Version": "SOW-3.2",
        }
        ws.append([row[h] for h in headers])

    # Second obligation type for a subset (BUILD_COMPLETE) — keeps workbook realistic
    for site in sites[:15]:
        if not site.include_in_contract:
            continue
        ws.append(
            [
                site.site_id,
                site.partner_id,
                "BUILD_COMPLETE",
                _fmt_date(site.due_date - timedelta(days=20), german=True),
                15,
                "as_built, photos",
                "SOW-3.2",
            ]
        )

    wb.save(path)


def write_schedule_workbook(path: Path, sites: list[SitePlan]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Milestones"

    # Default headers; one site triggers a renamed header column for mapping demo
    headers = list(SCHEDULE_HEADERS.values())
    # Use "Forecast Date" instead of "Forecast" as a drift variant on the sheet header
    # while still mapping to forecast_date — keeps a single column name for the workbook.
    # For mapping challenge we rename the header workbook-wide once.
    headers = [
        "Site Ref",
        "Milestone",
        "Plan Date",
        "Forecast Date",  # renamed from "Forecast" (schema drift)
        "Actual",
        "Status",
        "Last Update",
    ]
    ws.append(headers)

    for site in sites:
        if not site.include_in_schedule:
            continue

        forecast_cell: Any
        if site.ambiguous_date:
            forecast_cell = "end of Sept-ish"
        else:
            forecast_cell = _fmt_date(site.forecast_integration)

        actual_cell = None
        if site.site_id == sites[10].site_id:
            # STS-002: actual present while not completed
            actual_cell = _fmt_date(site.forecast_integration - timedelta(days=1))

        status = _partner_status_label(
            site.partner_id, site.partner_status_key, unknown=site.unknown_status
        )

        ws.append(
            [
                site.site_id,
                "INTEGRATION",
                _fmt_date(site.planned_integration),
                forecast_cell,
                actual_cell,
                status,
                site.last_updated.isoformat().replace("+00:00", "Z"),
            ]
        )

        if site.duplicate_conflict:
            # Conflicting duplicate row
            ws.append(
                [
                    site.site_id,
                    "INTEGRATION",
                    _fmt_date(site.planned_integration),
                    _fmt_date(site.forecast_integration + timedelta(days=12)),
                    None,
                    status,
                    site.last_updated.isoformat().replace("+00:00", "Z"),
                ]
            )

    wb.save(path)


def write_status_workbook(path: Path, sites: list[SitePlan]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Sites"
    headers = list(STATUS_HEADERS.values())
    ws.append(headers)

    for site in sites:
        if not site.include_in_status:
            continue
        ws.append(
            [
                site.site_id,
                site.permit_status,
                site.construction_status,
                _fmt_date(site.fibre_ready, german=True),
                site.integration_status,
                site.acceptance_status,
                site.blocker_comment or None,
            ]
        )

    wb.save(path)


def write_manifest(
    path: Path,
    sites: list[SitePlan],
    anomalies: list[Anomaly],
    files: dict[str, str],
) -> None:
    expected_by_rule: dict[str, list[str]] = {}
    for a in anomalies:
        for rule_id in a.rule_ids:
            expected_by_rule.setdefault(rule_id, []).append(a.site_id)

    payload = {
        "generated_at": datetime.now(UTC).isoformat(),
        "disclaimer": "Fully synthetic fictional data for demo purposes only.",
        "site_count": len(sites),
        "partner_count": len(PARTNERS),
        "partners": PARTNERS,
        "files": files,
        "hero_site_id": HERO_SITE_ID,
        "header_aliases": {
            "contract_obligations.xlsx": CONTRACT_HEADERS,
            "partner_schedule.xlsx": {
                **SCHEDULE_HEADERS,
                "forecast_date": "Forecast Date",  # drifted header
            },
            "site_project_status.xlsx": STATUS_HEADERS,
        },
        "obligation_to_milestone": OBLIGATION_TO_MILESTONE,
        "rules": RULE_CATALOGUE,
        "anomalies": [asdict(a) for a in anomalies],
        "expected_findings_by_rule": expected_by_rule,
        "freshness_threshold_days": 30,
        "analysis_as_of": "2026-07-26",
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def generate(output_dir: Path, n_sites: int = 50) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    sites, anomalies = build_sites(n_sites)

    # Ensure hero ID uniqueness after rewrite
    seen: set[str] = set()
    deduped: list[SitePlan] = []
    for s in sites:
        if s.site_id in seen and not s.duplicate_conflict:
            continue
        seen.add(s.site_id)
        deduped.append(s)
    sites = deduped

    contract = output_dir / "contract_obligations.xlsx"
    schedule = output_dir / "partner_schedule.xlsx"
    status = output_dir / "site_project_status.xlsx"
    manifest = output_dir / "anomaly_manifest.json"

    write_contract_workbook(contract, sites)
    write_schedule_workbook(schedule, sites)
    write_status_workbook(status, sites)
    write_manifest(
        manifest,
        sites,
        anomalies,
        files={
            "contract": contract.name,
            "schedule": schedule.name,
            "status": status.name,
        },
    )

    from rolloutguard_api.services.documents import ensure_synthetic_sow

    sow = ensure_synthetic_sow(output_dir)

    return {
        "contract": contract,
        "schedule": schedule,
        "status": status,
        "manifest": manifest,
        "sow": sow,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate RolloutGuard synthetic workbooks")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[4] / "data" / "synthetic",
        help="Output directory for workbooks and manifest",
    )
    parser.add_argument("--sites", type=int, default=50, help="Number of synthetic sites")
    args = parser.parse_args()
    paths = generate(args.out, n_sites=args.sites)
    print(f"Wrote {len(paths)} artefacts to {args.out}")
    for key, path in paths.items():
        print(f"  {key}: {path.name}")


if __name__ == "__main__":
    main()
