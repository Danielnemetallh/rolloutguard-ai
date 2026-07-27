"""Safe Excel ingestion, profiling, and hybrid header mapping."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from rolloutguard_api.domain.schema import (
    CONTRACT_FIELDS,
    CONTRACT_HEADERS,
    SCHEDULE_FIELDS,
    SCHEDULE_HEADERS,
    STATUS_FIELDS,
    STATUS_HEADERS,
)

ALLOWED_SUFFIXES = {".xlsx"}
MAX_UNCOMPRESSED_HINT_BYTES = 25 * 1024 * 1024
MAX_ROWS = 20_000
MAX_COLS = 80

# Exact alias dictionary: normalized header → canonical field
_ALIAS_TABLE: dict[str, str] = {}


def _norm_header(value: str) -> str:
    text = value.strip().lower()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _build_aliases() -> None:
    if _ALIAS_TABLE:
        return
    for mapping in (CONTRACT_HEADERS, SCHEDULE_HEADERS, STATUS_HEADERS):
        for canonical, source in mapping.items():
            _ALIAS_TABLE[_norm_header(source)] = canonical
            _ALIAS_TABLE[_norm_header(canonical)] = canonical
    # Extra aliases / drift variants
    extras = {
        "forecast date": "forecast_date",
        "site id": "site_id",
        "standort id": "site_id",
        "location key": "site_id",
        "site ref": "site_id",
        "vertragsfaelligkeit": "contractual_due_date",
        "last update": "last_updated_at",
        "build status": "construction_status",
        "fibre ready": "fibre_ready_date",
        "fiber ready": "fibre_ready_date",
        "integration test": "integration_test_status",
        "blocker notes": "blocker_comment",
        "partner code": "partner_id",
        "sow version": "contract_version",
        "sla tage": "sla_days",
        "plan date": "planned_date",
    }
    _ALIAS_TABLE.update(extras)


@dataclass
class ColumnProfile:
    source_header: str
    index: int
    null_ratio: float
    sample_values: list[str]
    inferred_kind: str  # id | date | number | text | empty
    unique_ratio: float


@dataclass
class MappingSuggestion:
    source_header: str
    canonical_field: str | None
    confidence: float
    method: str  # exact | fuzzy | llm | none
    rationale: str
    needs_approval: bool


@dataclass
class WorkbookProfile:
    filename: str
    sha256: str
    sheet_name: str
    row_count: int
    columns: list[ColumnProfile]
    mappings: list[MappingSuggestion]
    logical_type: str | None
    warnings: list[str] = field(default_factory=list)


@dataclass
class SourceRecord:
    sheet: str
    row_number: int
    values: dict[str, Any]
    record_hash: str


@dataclass
class IngestResult:
    profile: WorkbookProfile
    records: list[SourceRecord]
    storage_path: Path


class IngestError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_upload(path: Path) -> None:
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        raise IngestError(
            "UNSUPPORTED_FILE_TYPE",
            "Only .xlsx workbooks are accepted in the MVP.",
            {"filename": path.name, "suffix": path.suffix},
        )
    if path.stat().st_size > MAX_UNCOMPRESSED_HINT_BYTES:
        raise IngestError(
            "FILE_TOO_LARGE",
            "Workbook exceeds the configured size limit.",
            {"filename": path.name, "size": path.stat().st_size},
        )
    # Reject macro-enabled / OLE trick names
    if path.suffix.lower() in {".xlsm", ".xlsb", ".xls"}:
        raise IngestError("MACRO_NOT_ALLOWED", "Macro-enabled Excel files are rejected.")


def _infer_kind(values: list[Any]) -> str:
    non_null = [v for v in values if v is not None and str(v).strip() != ""]
    if not non_null:
        return "empty"
    date_hits = 0
    num_hits = 0
    for v in non_null:
        if isinstance(v, datetime):
            date_hits += 1
            continue
        s = str(v).strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) or re.fullmatch(r"\d{1,2}\.\d{1,2}\.\d{4}", s):
            date_hits += 1
        elif re.fullmatch(r"-?\d+(\.\d+)?", s):
            num_hits += 1
    ratio = len(non_null)
    if date_hits / ratio >= 0.6:
        return "date"
    if num_hits / ratio >= 0.8:
        return "number"
    # High uniqueness + string → likely id
    unique = len({str(v) for v in non_null})
    if unique / ratio >= 0.9 and num_hits / ratio < 0.5:
        return "id"
    return "text"


def _fuzzy_score(a: str, b: str) -> float:
    """Simple token Jaccard + substring boost — no external fuzzy lib needed."""
    ta = set(a.split())
    tb = set(b.split())
    if not ta or not tb:
        return 0.0
    jaccard = len(ta & tb) / len(ta | tb)
    substr = 0.15 if a in b or b in a else 0.0
    return min(1.0, jaccard + substr)


def suggest_mapping(
    header: str,
    kind: str,
    *,
    allowed_fields: set[str] | None = None,
) -> MappingSuggestion:
    _build_aliases()
    norm = _norm_header(header)
    allowed = allowed_fields or set(CONTRACT_FIELDS + SCHEDULE_FIELDS + STATUS_FIELDS)

    if norm in _ALIAS_TABLE and _ALIAS_TABLE[norm] in allowed:
        field = _ALIAS_TABLE[norm]
        return MappingSuggestion(
            source_header=header,
            canonical_field=field,
            confidence=0.98,
            method="exact",
            rationale=f"Exact alias match for '{header}' → {field}",
            needs_approval=False,
        )

    # Fuzzy against known aliases and canonical names
    best_field: str | None = None
    best_score = 0.0
    best_label = ""
    candidates = list(_ALIAS_TABLE.items()) + [( _norm_header(f), f) for f in allowed]
    for label, field in candidates:
        if field not in allowed:
            continue
        score = _fuzzy_score(norm, label)
        if score > best_score:
            best_score = score
            best_field = field
            best_label = label

    if best_field and best_score >= 0.55:
        needs = best_score < 0.85
        return MappingSuggestion(
            source_header=header,
            canonical_field=best_field,
            confidence=round(best_score, 3),
            method="fuzzy",
            rationale=f"Fuzzy match '{header}' ~ '{best_label}' → {best_field}",
            needs_approval=needs,
        )

    # Kind-based weak hint for site ids
    if kind == "id" and "site_id" in allowed:
        return MappingSuggestion(
            source_header=header,
            canonical_field="site_id",
            confidence=0.45,
            method="fuzzy",
            rationale="Column looks like an identifier; weak site_id suggestion",
            needs_approval=True,
        )

    return MappingSuggestion(
        source_header=header,
        canonical_field=None,
        confidence=0.0,
        method="none",
        rationale="No confident mapping; mark UNKNOWN or map manually",
        needs_approval=True,
    )


def detect_logical_type(mappings: list[MappingSuggestion]) -> str | None:
    mapped = {m.canonical_field for m in mappings if m.canonical_field}
    scores = {
        "contract": len(mapped & set(CONTRACT_FIELDS)),
        "schedule": len(mapped & set(SCHEDULE_FIELDS)),
        "status": len(mapped & set(STATUS_FIELDS)),
    }
    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    if scores[best] >= 3:
        return best
    return None


def profile_workbook(path: Path) -> IngestResult:
    validate_upload(path)
    digest = sha256_file(path)

    try:
        wb = load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001
        raise IngestError(
            "CORRUPT_WORKBOOK",
            "Workbook could not be opened.",
            {"filename": path.name, "error": type(exc).__name__},
        ) from exc

    if not wb.sheetnames:
        raise IngestError("EMPTY_WORKBOOK", "Workbook has no sheets.", {"filename": path.name})

    sheet_name = wb.sheetnames[0]
    ws = wb[sheet_name]
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration as exc:
        raise IngestError("EMPTY_SHEET", "Sheet has no rows.", {"sheet": sheet_name}) from exc

    headers = [
        str(h).strip() if h is not None else f"UNNAMED_{i}"
        for i, h in enumerate(header_row)
    ]
    if len(headers) > MAX_COLS:
        raise IngestError(
            "TOO_MANY_COLUMNS",
            "Sheet exceeds column limit.",
            {"columns": len(headers), "max": MAX_COLS},
        )

    raw_rows: list[tuple[Any, ...]] = []
    for i, row in enumerate(rows_iter, start=2):
        if i > MAX_ROWS + 1:
            raise IngestError(
                "TOO_MANY_ROWS",
                "Sheet exceeds row limit.",
                {"max": MAX_ROWS},
            )
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        raw_rows.append(row)

    columns: list[ColumnProfile] = []
    for idx, header in enumerate(headers):
        col_vals = [r[idx] if idx < len(r) else None for r in raw_rows]
        non_null = [v for v in col_vals if v is not None and str(v).strip() != ""]
        samples = [str(v)[:80] for v in non_null[:5]]
        unique_ratio = (len({str(v) for v in non_null}) / len(non_null)) if non_null else 0.0
        null_ratio = 1.0 - (len(non_null) / len(col_vals) if col_vals else 0.0)
        columns.append(
            ColumnProfile(
                source_header=header,
                index=idx,
                null_ratio=round(null_ratio, 3),
                sample_values=samples,
                inferred_kind=_infer_kind(col_vals),
                unique_ratio=round(unique_ratio, 3),
            )
        )

    # Provisional logical type from exact aliases, then constrain fuzzy suggestions
    provisional = [
        suggest_mapping(c.source_header, c.inferred_kind) for c in columns
    ]
    logical = detect_logical_type(provisional)
    allowed = {
        "contract": set(CONTRACT_FIELDS),
        "schedule": set(SCHEDULE_FIELDS),
        "status": set(STATUS_FIELDS),
    }.get(logical or "", None)

    mappings = [
        suggest_mapping(c.source_header, c.inferred_kind, allowed_fields=allowed)
        for c in columns
    ]
    logical = detect_logical_type(mappings) or logical

    warnings: list[str] = []
    if any(m.needs_approval for m in mappings):
        warnings.append("One or more column mappings require human approval.")
    if logical is None:
        warnings.append("Could not confidently detect workbook logical type.")

    records: list[SourceRecord] = []
    for row_number, row in enumerate(raw_rows, start=2):
        values = {
            headers[i]: (row[i] if i < len(row) else None) for i in range(len(headers))
        }
        # Preserve site-like IDs as strings
        payload = {k: (str(v) if v is not None else None) for k, v in values.items()}
        blob = "|".join(f"{k}={payload[k]}" for k in sorted(payload))
        records.append(
            SourceRecord(
                sheet=sheet_name,
                row_number=row_number,
                values=payload,
                record_hash=hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16],
            )
        )

    profile = WorkbookProfile(
        filename=path.name,
        sha256=digest,
        sheet_name=sheet_name,
        row_count=len(records),
        columns=columns,
        mappings=mappings,
        logical_type=logical,
        warnings=warnings,
    )
    wb.close()
    return IngestResult(profile=profile, records=records, storage_path=path)
