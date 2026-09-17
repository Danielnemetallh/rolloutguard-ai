"""Create RolloutGuard workbooks from the downloaded Kaggle construction CSVs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from openpyxl import Workbook

PROJECT_IDS = ("1328", "1329", "1330", "1335", "1338", "1340", "1343", "1345")
PARTNERS = ("PARTNER-NORTH", "PARTNER-SOUTH", "PARTNER-EAST")
PROJECT_TO_SITE = {project_id: f"KAGGLE-DE-{project_id}" for project_id in PROJECT_IDS}
PROJECT_TO_PARTNER = {
    project_id: PARTNERS[index % len(PARTNERS)]
    for index, project_id in enumerate(PROJECT_IDS)
}
BASE_DATE = date(2020, 9, 1)
DATE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d")


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(value.strip(), date_format).date()
        except ValueError:
            continue
    return None


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_rows(rows: list[dict[str, str]], project_field: str) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        project_id = row.get(project_field, "").strip()
        if project_id in PROJECT_TO_SITE:
            grouped[project_id].append(row)
    return grouped


def dates_for(
    project_forms: list[dict[str, str]], project_tasks: list[dict[str, str]]
) -> tuple[date, date]:
    created = [
        parsed
        for row in [*project_forms, *project_tasks]
        if (parsed := parse_date(row.get("Created"))) is not None
    ]
    changed = [
        parsed
        for row in [*project_forms, *project_tasks]
        if (parsed := parse_date(row.get("Status Changed"))) is not None
    ]
    start = min(created, default=BASE_DATE)
    last_update = max(changed or created, default=start)
    return start, last_update


def status_summary(
    forms: list[dict[str, str]], tasks: list[dict[str, str]]
) -> tuple[str, str, str]:
    statuses = [row.get("Status", "").strip().lower() for row in [*forms, *tasks]]
    overdue = any(row.get("OverDue", "").strip().lower() == "true" for row in [*forms, *tasks])
    open_count = sum("open" in status or "ongoing" in status for status in statuses)
    closed_count = sum(
        any(token in status for token in ("closed", "complete", "signed off", "resolved"))
        for status in statuses
    )
    if overdue or open_count > closed_count:
        partner_status = "At Risk"
    elif closed_count == len(statuses) and statuses:
        partner_status = "Completed"
    else:
        partner_status = "On Track"
    construction_status = "Completed" if closed_count > open_count else "In Progress"
    permit_status = (
        "At Risk"
        if any("permit" in row.get("Type", "").lower() for row in forms)
        else "Ready"
    )
    return permit_status, construction_status, partner_status


def write_workbook(path: Path, headers: list[str], rows: list[list[Any]]) -> None:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Data"
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for cell in sheet[1]:
        cell.font = cell.font.copy(bold=True)
    for column in sheet.columns:
        width = min(max(len(str(cell.value or "")) for cell in column) + 2, 42)
        sheet.column_dimensions[column[0].column_letter].width = width
    workbook.save(path)


def adapt(
    forms: list[dict[str, str]],
    tasks: list[dict[str, str]],
    output_dir: Path,
    source_paths: dict[str, Path],
) -> dict[str, Any]:
    forms_by_project = project_rows(forms, "Project")
    tasks_by_project = project_rows(tasks, "project")
    contract_rows: list[list[Any]] = []
    schedule_rows: list[list[Any]] = []
    status_rows: list[list[Any]] = []
    project_manifest: dict[str, Any] = {}

    for index, project_id in enumerate(PROJECT_IDS):
        project_forms = forms_by_project.get(project_id, [])
        project_tasks = tasks_by_project.get(project_id, [])
        start, last_update = dates_for(project_forms, project_tasks)
        permit_status, construction_status, partner_status = status_summary(
            project_forms, project_tasks
        )
        site_id = PROJECT_TO_SITE[project_id]
        due_date = start + timedelta(days=30 + index * 5)
        forecast_date = due_date + timedelta(days=7 if partner_status == "At Risk" else 0)
        actual_date = last_update if construction_status == "Completed" else None
        task_types = Counter(
            row.get("Type", "").strip() for row in project_tasks if row.get("Type")
        )
        form_types = Counter(
            row.get("Type", "").strip() for row in project_forms if row.get("Type")
        )
        blocker = next(
            (
                row.get("Description", "").strip()
                for row in project_tasks
                if row.get("OverDue", "").strip().lower() == "true"
            ),
            "",
        )
        evidence = "; ".join(
            name for name, _ in (task_types + form_types).most_common(3)
        ) or "Kaggle source records"

        contract_rows.append([
            site_id,
            PROJECT_TO_PARTNER[project_id],
            "BUILD_COMPLETE",
            due_date,
            30 + index * 5,
            evidence,
            "KAGGLE-FIXTURE-1",
        ])
        schedule_rows.append([
            site_id,
            "CONSTRUCTION",
            start,
            forecast_date,
            actual_date,
            partner_status,
            last_update,
        ])
        status_rows.append([
            site_id,
            permit_status,
            construction_status,
            last_update if construction_status == "Completed" else None,
            "Passed" if construction_status == "Completed" else "Pending",
            "Accepted" if construction_status == "Completed" else "Pending",
            blocker,
        ])
        project_manifest[project_id] = {
            "site_id": site_id,
            "partner_id": PROJECT_TO_PARTNER[project_id],
            "form_rows": len(project_forms),
            "task_rows": len(project_tasks),
            "derived_start_date": start.isoformat(),
            "derived_last_update": last_update.isoformat(),
        }

    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "contract": output_dir / "kaggle_contract_obligations.xlsx",
        "schedule": output_dir / "kaggle_partner_schedule.xlsx",
        "status": output_dir / "kaggle_site_project_status.xlsx",
    }
    write_workbook(
        outputs["contract"],
        [
            "site_id", "partner_id", "obligation_code", "contractual_due_date",
            "sla_days", "required_evidence", "contract_version",
        ],
        contract_rows,
    )
    write_workbook(
        outputs["schedule"],
        [
            "site_id", "milestone_code", "planned_date", "forecast_date",
            "actual_date", "partner_status", "last_updated_at",
        ],
        schedule_rows,
    )
    write_workbook(
        outputs["status"],
        [
            "site_id", "permit_status", "construction_status", "fibre_ready_date",
            "integration_test_status", "acceptance_status", "blocker_comment",
        ],
        status_rows,
    )

    manifest = {
        "source": {
            name: {
                "path": str(path),
                "sha256": sha256_file(path),
                "rows": len(forms if name == "forms" else tasks),
            }
            for name, path in source_paths.items()
        },
        "projects": project_manifest,
        "outputs": {
            name: {"filename": path.name, "sha256": sha256_file(path), "rows": len(rows)}
            for name, path, rows in (
                ("contract", outputs["contract"], contract_rows),
                ("schedule", outputs["schedule"], schedule_rows),
                ("status", outputs["status"], status_rows),
            )
        },
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--forms", type=Path, required=True)
    parser.add_argument("--tasks", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    forms = read_csv(args.forms)
    tasks = read_csv(args.tasks)
    adapt(forms, tasks, args.output, {"forms": args.forms, "tasks": args.tasks})


if __name__ == "__main__":
    main()
