"""Annotated Excel / Markdown export with formula-injection sanitization."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from sqlalchemy.orm import Session

from rolloutguard_api.db import models
from rolloutguard_api.services.analysis import findings_to_dicts


def sanitize_cell(value: Any) -> Any:
    """Neutralize spreadsheet formula injection on export."""
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    text = str(value)
    if text and text[0] in {"=", "+", "-", "@", "\t", "\r"}:
        return f"'{text}"
    return text


def export_analysis(
    db: Session,
    analysis_run_id: int,
    *,
    output_dir: Path,
    created_by: str = "Demo Analyst",
) -> dict[str, Any]:
    run = db.get(models.AnalysisRun, analysis_run_id)
    if not run:
        raise ValueError("analysis_not_found")

    findings = findings_to_dicts(analysis_run_id, db)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    xlsx_path = output_dir / f"rolloutguard_analysis_{analysis_run_id}_{stamp}.xlsx"
    md_path = output_dir / f"rolloutguard_analysis_{analysis_run_id}_{stamp}.md"

    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    summary.append(["metric", "value"])
    for key, value in (run.summary_json or {}).items():
        summary.append([sanitize_cell(key), sanitize_cell(value)])

    findings_ws = wb.create_sheet("Findings")
    findings_ws.append(
        ["id", "site_id", "rule_id", "severity", "status", "message", "evidence"]
    )
    for f in findings:
        evidence = "; ".join(
            f"{e.get('evidence_id')}@{e.get('file')}:{e.get('sheet')}!{e.get('column')}{e.get('row')}"
            for e in f.get("evidence", [])
        )
        findings_ws.append(
            [
                f["id"],
                sanitize_cell(f["site_id"]),
                sanitize_cell(f["rule_id"]),
                sanitize_cell(f["severity"]),
                sanitize_cell(f["status"]),
                sanitize_cell(f["message"]),
                sanitize_cell(evidence),
            ]
        )
    wb.save(xlsx_path)

    lines = [
        f"# RolloutGuard analysis #{analysis_run_id}",
        "",
        f"Generated: {stamp}",
        "",
        "## KPIs",
        "",
    ]
    for key, value in (run.summary_json or {}).items():
        lines.append(f"- **{key}**: {value}")
    lines.extend(["", "## Findings", ""])
    for f in findings[:50]:
        lines.append(
            f"- `{f['severity']}` **{f['site_id']}** / {f['rule_id']}: {f['message']}"
        )
    lines.append("")
    lines.append("_Synthetic demo export. Not affiliated with any operator._")
    md_path.write_text("\n".join(lines), encoding="utf-8")

    row = models.ExportRow(
        analysis_run_id=analysis_run_id,
        format="xlsx+md",
        storage_key=str(xlsx_path),
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "export_id": row.id,
        "xlsx_path": str(xlsx_path),
        "markdown_path": str(md_path),
        "finding_count": len(findings),
    }
