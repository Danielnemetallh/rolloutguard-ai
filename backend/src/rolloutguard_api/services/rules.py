"""Deterministic milestone / DQ / SLA rule engine.

The rule engine owns finding severity. The LLM never changes pass/warning/critical.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date
from typing import Any

from rolloutguard_api.domain.schema import RULE_CATALOGUE
from rolloutguard_api.services.reconcile import CanonicalSite, EvidenceRef

RULE_VERSION = "1.0.0"
DEFAULT_FRESHNESS_DAYS = 30
RULE_META = {r["rule_id"]: r for r in RULE_CATALOGUE}


@dataclass
class Finding:
    rule_id: str
    version: str
    site_id: str
    severity: str
    status: str  # open
    message: str
    facts: dict[str, Any]
    evidence: list[EvidenceRef] = field(default_factory=list)


RuleFn = Callable[[CanonicalSite, date], list[Finding]]

_DATE_LABELS = {
    "planned_date": "geplant",
    "forecast_date": "Forecast",
    "actual_date": "Ist",
}


def _date_label(field: str) -> str:
    return _DATE_LABELS.get(field, field)


def _finding(
    rule_id: str,
    site: CanonicalSite,
    message: str,
    facts: dict[str, Any],
    evidence: list[EvidenceRef] | None = None,
    *,
    severity: str | None = None,
) -> Finding:
    meta = RULE_META[rule_id]
    return Finding(
        rule_id=rule_id,
        version=RULE_VERSION,
        site_id=site.site_id,
        severity=severity or meta["severity"],
        status="open",
        message=message,
        facts=facts,
        evidence=evidence or list(site.evidence[:6]),
    )


def rule_dq_001(site: CanonicalSite, _as_of: date) -> list[Finding]:
    if site.conflicting_forecasts:
        return [
            _finding(
                "DQ-001",
                site,
                "Doppelte Planzeilen mit widersprüchlichen Forecast-Daten.",
                {
                    "forecasts": [d.isoformat() for d in site.conflicting_forecasts],
                },
            )
        ]
    return []


def rule_dq_002(site: CanonicalSite, _as_of: date) -> list[Finding]:
    required = {"contract", "schedule", "status"}
    missing = sorted(required - site.sources_present)
    if not missing:
        return []
    # Missing contract is more severe when schedule exists
    severity = "critical" if "contract" in missing else "warning"
    return [
        _finding(
            "DQ-002",
            site,
            f"Standort fehlt in erforderlicher(n) Quelle(n): {', '.join(missing)}.",
            {"missing_sources": missing, "present": sorted(site.sources_present)},
            severity=severity,
        )
    ]


def rule_dq_003(site: CanonicalSite, _as_of: date) -> list[Finding]:
    if not site.date_errors:
        return []
    return [
        _finding(
            "DQ-003",
            site,
            "Nicht lesbares oder mehrdeutiges Datum in der Quelldatei.",
            {"bad_cells": [e.evidence_id for e in site.date_errors]},
            evidence=site.date_errors,
        )
    ]


def rule_dq_004(site: CanonicalSite, _as_of: date) -> list[Finding]:
    if site.partner_status is not None and not site.partner_status_known:
        return [
            _finding(
                "DQ-004",
                site,
                f"Unbekanntes Partner-Status-Vokabular: {site.partner_status!r}.",
                {"raw_status": site.partner_status},
            )
        ]
    return []


def rule_seq_001(site: CanonicalSite, _as_of: date) -> list[Finding]:
    # Construction actual / DONE while permit not approved
    permit = (site.permit_status or "").upper()
    construction = (site.construction_status or "").upper()
    if construction in {"DONE", "COMPLETE", "COMPLETED"} and permit not in {
        "APPROVED",
        "DONE",
        "COMPLETE",
    }:
        return [
            _finding(
                "SEQ-001",
                site,
                "Bau als abgeschlossen markiert, obwohl die Genehmigung nicht erteilt ist.",
                {
                    "permit_status": site.permit_status,
                    "construction_status": site.construction_status,
                },
            )
        ]
    return []


def rule_seq_002(site: CanonicalSite, _as_of: date) -> list[Finding]:
    fibre = site.fibre_ready_date
    if fibre is None:
        return []
    findings: list[Finding] = []
    for label, value in (
        ("planned_date", site.planned_date),
        ("forecast_date", site.forecast_date),
        ("actual_date", site.actual_date),
    ):
        if value is not None and value < fibre:
            findings.append(
                _finding(
                    "SEQ-002",
                    site,
                    f"Integrationsdatum ({_date_label(label)}) liegt vor dem Fibre-Ready-Datum.",
                    {
                        label: value.isoformat(),
                        "fibre_ready_date": fibre.isoformat(),
                    },
                )
            )
    return findings


def rule_seq_003(site: CanonicalSite, _as_of: date) -> list[Finding]:
    acceptance = (site.acceptance_status or "").upper()
    integration = (site.integration_test_status or "").upper()
    if acceptance in {"COMPLETE", "COMPLETED", "DONE"} and integration not in {
        "COMPLETE",
        "COMPLETED",
        "DONE",
        "PASSED",
        "PASS",
    }:
        return [
            _finding(
                "SEQ-003",
                site,
                "Abnahme abgeschlossen, obwohl der Integrationstest fehlt.",
                {
                    "acceptance_status": site.acceptance_status,
                    "integration_test_status": site.integration_test_status,
                    "required_evidence": site.required_evidence,
                },
            )
        ]
    return []


def rule_sts_001(site: CanonicalSite, _as_of: date) -> list[Finding]:
    if site.partner_status == "DONE" and site.actual_date is None:
        return [
            _finding(
                "STS-001",
                site,
                "Status „fertig“, aber kein Ist-Datum vorhanden.",
                {"partner_status": site.partner_status, "actual_date": None},
            )
        ]
    return []


def rule_sts_002(site: CanonicalSite, _as_of: date) -> list[Finding]:
    if site.actual_date is not None and site.partner_status in {
        "ON_TRACK",
        "AT_RISK",
        "DELAYED",
    }:
        return [
            _finding(
                "STS-002",
                site,
                "Ist-Datum vorhanden, obwohl der Status nicht abgeschlossen ist.",
                {
                    "actual_date": site.actual_date.isoformat(),
                    "partner_status": site.partner_status,
                },
            )
        ]
    return []


def rule_sla_001(site: CanonicalSite, _as_of: date) -> list[Finding]:
    due = site.contractual_due_date
    if due is None:
        return []
    findings: list[Finding] = []
    for label, value in (("forecast_date", site.forecast_date), ("actual_date", site.actual_date)):
        if value is not None and value > due:
            findings.append(
                _finding(
                    "SLA-001",
                    site,
                    f"{_date_label(label)} liegt nach der vertraglichen Fälligkeit.",
                    {
                        label: value.isoformat(),
                        "contractual_due_date": due.isoformat(),
                        "delta_days": (value - due).days,
                    },
                )
            )
    return findings


def rule_frs_001(
    site: CanonicalSite,
    as_of: date,
    *,
    threshold_days: int = DEFAULT_FRESHNESS_DAYS,
) -> list[Finding]:
    if site.last_updated_at is None:
        return []
    updated = site.last_updated_at
    if updated.tzinfo is not None:
        updated_date = updated.astimezone(UTC).date()
    else:
        updated_date = updated.date()
    age = (as_of - updated_date).days
    if age > threshold_days:
        return [
            _finding(
                "FRS-001",
                site,
                f"Quelldatensatz ist {age} Tage alt (Schwelle {threshold_days}).",
                {
                    "last_updated_at": site.last_updated_at.isoformat(),
                    "age_days": age,
                    "threshold_days": threshold_days,
                },
            )
        ]
    return []


RULES: list[RuleFn] = [
    rule_dq_001,
    rule_dq_002,
    rule_dq_003,
    rule_dq_004,
    rule_seq_001,
    rule_seq_002,
    rule_seq_003,
    rule_sts_001,
    rule_sts_002,
    rule_sla_001,
    rule_frs_001,
]


@dataclass
class AnalysisResult:
    as_of: date
    rule_set_version: str
    site_count: int
    findings: list[Finding]
    kpis: dict[str, Any]


def evaluate_sites(
    sites: dict[str, CanonicalSite],
    *,
    as_of: date | None = None,
    freshness_days: int = DEFAULT_FRESHNESS_DAYS,
) -> AnalysisResult:
    as_of = as_of or date.today()
    findings: list[Finding] = []
    for site in sites.values():
        for rule in RULES:
            if rule is rule_frs_001:
                findings.extend(rule_frs_001(site, as_of, threshold_days=freshness_days))
            else:
                findings.extend(rule(site, as_of))

    critical = sum(1 for f in findings if f.severity == "critical")
    warning = sum(1 for f in findings if f.severity == "warning")
    by_rule: dict[str, int] = {}
    for f in findings:
        by_rule[f.rule_id] = by_rule.get(f.rule_id, 0) + 1

    late_sla = {
        f.site_id
        for f in findings
        if f.rule_id == "SLA-001"
    }
    kpis = {
        "sites_total": len(sites),
        "findings_total": len(findings),
        "findings_critical": critical,
        "findings_warning": warning,
        "sites_with_sla_risk": len(late_sla),
        "findings_by_rule": by_rule,
        "sources_complete": sum(
            1 for s in sites.values() if s.sources_present >= {"contract", "schedule", "status"}
        ),
    }
    return AnalysisResult(
        as_of=as_of,
        rule_set_version=RULE_VERSION,
        site_count=len(sites),
        findings=findings,
        kpis=kpis,
    )
