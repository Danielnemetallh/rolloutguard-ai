"""Canonical domain schema and rule catalogue for RolloutGuard synthetic demo."""

from __future__ import annotations

from typing import Final

PARTNERS: Final[list[dict[str, str]]] = [
    {"partner_id": "PARTNER-NORTH", "name": "NordTurm Infrastruktur GmbH"},
    {"partner_id": "PARTNER-SOUTH", "name": "AlpenLink Deployment AG"},
    {"partner_id": "PARTNER-EAST", "name": "OstMast Bau & Integration"},
]

REGIONS: Final[list[str]] = ["NRW", "BY", "BE", "HH", "SN", "BW", "NI", "HE"]

# Canonical field names used after mapping
CONTRACT_FIELDS: Final[list[str]] = [
    "site_id",
    "partner_id",
    "obligation_code",
    "contractual_due_date",
    "sla_days",
    "required_evidence",
    "contract_version",
]

SCHEDULE_FIELDS: Final[list[str]] = [
    "site_id",
    "milestone_code",
    "planned_date",
    "forecast_date",
    "actual_date",
    "partner_status",
    "last_updated_at",
]

STATUS_FIELDS: Final[list[str]] = [
    "site_id",
    "permit_status",
    "construction_status",
    "fibre_ready_date",
    "integration_test_status",
    "acceptance_status",
    "blocker_comment",
]

# Intentionally inconsistent source headers per workbook (mapping challenge)
CONTRACT_HEADERS: Final[dict[str, str]] = {
    "site_id": "Standort-ID",
    "partner_id": "Partner Code",
    "obligation_code": "Obligation",
    "contractual_due_date": "Vertragsfälligkeit",
    "sla_days": "SLA Tage",
    "required_evidence": "Required Evidence",
    "contract_version": "SOW Version",
}

SCHEDULE_HEADERS: Final[dict[str, str]] = {
    "site_id": "Site Ref",
    "milestone_code": "Milestone",
    "planned_date": "Plan Date",
    "forecast_date": "Forecast",
    "actual_date": "Actual",
    "partner_status": "Status",
    "last_updated_at": "Last Update",
}

STATUS_HEADERS: Final[dict[str, str]] = {
    "site_id": "Location Key",
    "permit_status": "Permit",
    "construction_status": "Build Status",
    "fibre_ready_date": "Fibre Ready",
    "integration_test_status": "Integration Test",
    "acceptance_status": "Acceptance",
    "blocker_comment": "Blocker Notes",
}

# Partner-specific status vocabularies (normalized later)
STATUS_VOCAB: Final[dict[str, dict[str, str]]] = {
    "PARTNER-NORTH": {
        "ON_TRACK": "On Track",
        "AT_RISK": "At Risk",
        "DELAYED": "Delayed",
        "DONE": "Completed",
    },
    "PARTNER-SOUTH": {
        "ON_TRACK": "grün",
        "AT_RISK": "gelb",
        "DELAYED": "rot",
        "DONE": "fertig",
    },
    "PARTNER-EAST": {
        "ON_TRACK": "OK",
        "AT_RISK": "Watch",
        "DELAYED": "Late",
        "DONE": "Done",
    },
}

OBLIGATION_TO_MILESTONE: Final[dict[str, str]] = {
    "PERMIT_READY": "PERMIT",
    "BUILD_COMPLETE": "CONSTRUCTION",
    "INT_READY": "INTEGRATION",
    "ACCEPT_COMPLETE": "ACCEPTANCE",
}

RULE_CATALOGUE: Final[list[dict[str, str]]] = [
    {
        "rule_id": "DQ-001",
        "severity": "critical",
        "description": "Doppelter kanonischer Schlüssel mit widersprüchlichen Werten",
    },
    {
        "rule_id": "DQ-002",
        "severity": "warning",
        "description": "Standort fehlt in einer Pflichtquelle",
    },
    {
        "rule_id": "DQ-003",
        "severity": "warning",
        "description": "Nicht lesbares oder mehrdeutiges Datum",
    },
    {
        "rule_id": "DQ-004",
        "severity": "warning",
        "description": "Unbekannter Status nach Normalisierung",
    },
    {
        "rule_id": "SEQ-001",
        "severity": "critical",
        "description": "Bau-Ist vor Genehmigung",
    },
    {
        "rule_id": "SEQ-002",
        "severity": "critical",
        "description": "Integration vor Fibre-Ready-Datum",
    },
    {
        "rule_id": "SEQ-003",
        "severity": "critical",
        "description": "Abnahme vor erforderlichem Integrationstest",
    },
    {
        "rule_id": "STS-001",
        "severity": "warning",
        "description": "Status fertig ohne Ist-Datum",
    },
    {
        "rule_id": "STS-002",
        "severity": "warning",
        "description": "Ist-Datum vorhanden, Status nicht abgeschlossen",
    },
    {
        "rule_id": "SLA-001",
        "severity": "critical",
        "description": "Forecast oder Ist nach vertraglicher Fälligkeit",
    },
    {
        "rule_id": "FRS-001",
        "severity": "warning",
        "description": "Quelldatensatz älter als die Aktualitätsschwelle",
    },
]

# Hero demo site used in the 10-minute interview scenario
HERO_SITE_ID: Final[str] = "DE-NRW-0107"
