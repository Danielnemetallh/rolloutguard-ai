"""Reconcile multi-source workbook records into canonical site views."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from rolloutguard_api.services.ingest import IngestResult, MappingSuggestion
from rolloutguard_api.services.normalize import (
    coerce_int,
    normalize_site_id,
    normalize_status,
    parse_date,
)


@dataclass
class EvidenceRef:
    evidence_id: str
    file: str
    sheet: str
    row: int
    column: str
    value: str | None


@dataclass
class CanonicalSite:
    site_id: str
    partner_id: str | None = None
    contractual_due_date: date | None = None
    sla_days: int | None = None
    required_evidence: str | None = None
    obligation_code: str | None = None
    planned_date: date | None = None
    forecast_date: date | None = None
    actual_date: date | None = None
    partner_status: str | None = None
    partner_status_known: bool = True
    last_updated_at: datetime | None = None
    permit_status: str | None = None
    construction_status: str | None = None
    fibre_ready_date: date | None = None
    integration_test_status: str | None = None
    acceptance_status: str | None = None
    blocker_comment: str | None = None
    sources_present: set[str] = field(default_factory=set)
    evidence: list[EvidenceRef] = field(default_factory=list)
    date_errors: list[EvidenceRef] = field(default_factory=list)
    conflicting_forecasts: list[date] = field(default_factory=list)
    raw_flags: dict[str, Any] = field(default_factory=dict)


def _apply_mappings(values: dict[str, Any], mappings: list[MappingSuggestion]) -> dict[str, Any]:
    by_header = {m.source_header: m for m in mappings if m.canonical_field}
    out: dict[str, Any] = {}
    for header, value in values.items():
        suggestion = by_header.get(header)
        if suggestion and suggestion.canonical_field:
            out[suggestion.canonical_field] = value
    return out


def _evidence(
    prefix: str,
    filename: str,
    sheet: str,
    row: int,
    column: str,
    value: Any,
    counter: list[int],
) -> EvidenceRef:
    counter[0] += 1
    return EvidenceRef(
        evidence_id=f"{prefix}-{counter[0]}",
        file=filename,
        sheet=sheet,
        row=row,
        column=column,
        value=None if value is None else str(value),
    )


def reconcile(
    contract: IngestResult | None,
    schedule: IngestResult | None,
    status: IngestResult | None,
) -> dict[str, CanonicalSite]:
    sites: dict[str, CanonicalSite] = {}
    counter = [0]

    def ensure(site_id: str) -> CanonicalSite:
        if site_id not in sites:
            sites[site_id] = CanonicalSite(site_id=site_id)
        return sites[site_id]

    if contract:
        for rec in contract.records:
            mapped = _apply_mappings(rec.values, contract.profile.mappings)
            site_id = normalize_site_id(mapped.get("site_id"))
            if not site_id:
                continue
            # Focus on INT_READY obligations for SLA checks; still mark presence
            site = ensure(site_id)
            site.sources_present.add("contract")
            site.partner_id = site.partner_id or (
                str(mapped["partner_id"]).strip() if mapped.get("partner_id") else None
            )
            obligation = mapped.get("obligation_code")
            if obligation and str(obligation).strip().upper() == "INT_READY":
                due, err = parse_date(mapped.get("contractual_due_date"))
                col = next(
                    (
                        m.source_header
                        for m in contract.profile.mappings
                        if m.canonical_field == "contractual_due_date"
                    ),
                    "contractual_due_date",
                )
                ev = _evidence(
                    "E-CONTRACT",
                    contract.profile.filename,
                    rec.sheet,
                    rec.row_number,
                    col,
                    mapped.get("contractual_due_date"),
                    counter,
                )
                site.evidence.append(ev)
                if err:
                    site.date_errors.append(ev)
                else:
                    site.contractual_due_date = due
                site.sla_days = coerce_int(mapped.get("sla_days"))
                site.required_evidence = (
                    str(mapped["required_evidence"])
                    if mapped.get("required_evidence")
                    else None
                )
                site.obligation_code = "INT_READY"

    if schedule:
        forecasts_by_site: dict[str, list[date]] = {}
        for rec in schedule.records:
            mapped = _apply_mappings(rec.values, schedule.profile.mappings)
            site_id = normalize_site_id(mapped.get("site_id"))
            if not site_id:
                continue
            site = ensure(site_id)
            site.sources_present.add("schedule")

            for field_name, attr in (
                ("planned_date", "planned_date"),
                ("forecast_date", "forecast_date"),
                ("actual_date", "actual_date"),
            ):
                raw = mapped.get(field_name)
                parsed, err = parse_date(raw)
                col = next(
                    (
                        m.source_header
                        for m in schedule.profile.mappings
                        if m.canonical_field == field_name
                    ),
                    field_name,
                )
                if raw is not None and str(raw).strip() != "":
                    ev = _evidence(
                        "E-SCHEDULE",
                        schedule.profile.filename,
                        rec.sheet,
                        rec.row_number,
                        col,
                        raw,
                        counter,
                    )
                    site.evidence.append(ev)
                    if err:
                        site.date_errors.append(ev)
                    elif field_name == "forecast_date" and parsed is not None:
                        forecasts_by_site.setdefault(site_id, []).append(parsed)
                        if site.forecast_date is None:
                            site.forecast_date = parsed
                    elif parsed is not None:
                        setattr(site, attr, parsed)

            if mapped.get("partner_status") is not None:
                status_val, known = normalize_status(mapped.get("partner_status"))
                site.partner_status = status_val
                site.partner_status_known = known
                col = next(
                    (
                        m.source_header
                        for m in schedule.profile.mappings
                        if m.canonical_field == "partner_status"
                    ),
                    "partner_status",
                )
                site.evidence.append(
                    _evidence(
                        "E-SCHEDULE",
                        schedule.profile.filename,
                        rec.sheet,
                        rec.row_number,
                        col,
                        mapped.get("partner_status"),
                        counter,
                    )
                )

            raw_updated = mapped.get("last_updated_at")
            if raw_updated:
                text = str(raw_updated).replace("Z", "+00:00")
                try:
                    site.last_updated_at = datetime.fromisoformat(text)
                except ValueError:
                    pass

        for site_id, forecasts in forecasts_by_site.items():
            unique = sorted(set(forecasts))
            if len(unique) > 1:
                sites[site_id].conflicting_forecasts = unique
                sites[site_id].raw_flags["duplicate_conflict"] = True

    if status:
        for rec in status.records:
            mapped = _apply_mappings(rec.values, status.profile.mappings)
            site_id = normalize_site_id(mapped.get("site_id"))
            if not site_id:
                continue
            site = ensure(site_id)
            site.sources_present.add("status")
            for field_name in (
                "permit_status",
                "construction_status",
                "integration_test_status",
                "acceptance_status",
                "blocker_comment",
            ):
                if mapped.get(field_name) is not None:
                    setattr(site, field_name, str(mapped[field_name]).strip())
            fibre, err = parse_date(mapped.get("fibre_ready_date"))
            if mapped.get("fibre_ready_date") is not None:
                col = next(
                    (
                        m.source_header
                        for m in status.profile.mappings
                        if m.canonical_field == "fibre_ready_date"
                    ),
                    "fibre_ready_date",
                )
                ev = _evidence(
                    "E-STATUS",
                    status.profile.filename,
                    rec.sheet,
                    rec.row_number,
                    col,
                    mapped.get("fibre_ready_date"),
                    counter,
                )
                site.evidence.append(ev)
                if err:
                    site.date_errors.append(ev)
                else:
                    site.fibre_ready_date = fibre

    return sites
