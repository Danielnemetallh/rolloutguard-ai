<#
.SYNOPSIS
  Import a checked-in fixture workbook set without touching data/synthetic/.

.DESCRIPTION
  Posts the three .xlsx files under data/fixtures/<name>/ to POST /api/projects/{id}/imports.
  Synthetic demo files and the interview hero scenario (DE-NRW-0107) stay unchanged.

  To restore a clean interview state afterwards:
    .\scripts\demo-reset.ps1

.PARAMETER Name
  Fixture folder under data/fixtures/ (default: kaggle_construction).

.PARAMETER FixtureDir
  Override path when fixtures live outside the repo (e.g. another clone).

.PARAMETER ApiPort
  API port (default: API_PORT env var, else 8001).
#>
param(
  [string]$Name = "kaggle_construction",
  [string]$FixtureDir = "",
  [string]$ApiPort = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $ApiPort) {
  $ApiPort = if ($env:API_PORT) { $env:API_PORT } else { "8001" }
}

if ($FixtureDir) {
  $dir = (Resolve-Path $FixtureDir).Path
} else {
  $dir = Join-Path $Root "data\fixtures\$Name"
}

if (-not (Test-Path $dir)) {
  Write-Error "Fixture directory not found: $dir"
}

$manifestPath = Join-Path $dir "manifest.json"
if (Test-Path $manifestPath) {
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  $contractFile = Join-Path $dir $manifest.outputs.contract.filename
  $scheduleFile = Join-Path $dir $manifest.outputs.schedule.filename
  $statusFile = Join-Path $dir $manifest.outputs.status.filename
} else {
  $contractFile = Join-Path $dir "kaggle_contract_obligations.xlsx"
  $scheduleFile = Join-Path $dir "kaggle_partner_schedule.xlsx"
  $statusFile = Join-Path $dir "kaggle_site_project_status.xlsx"
}

foreach ($path in @($contractFile, $scheduleFile, $statusFile)) {
  if (-not (Test-Path $path)) {
    Write-Error "Missing workbook: $path"
  }
}

$baseUrl = "http://127.0.0.1:$ApiPort"

Write-Host "== RolloutGuard fixture import ==" -ForegroundColor Cyan
Write-Host "Fixture: $dir"
Write-Host "API:     $baseUrl"
Write-Host "(data/synthetic/ is not modified)" -ForegroundColor DarkGray
Write-Host ""

try {
  $projects = Invoke-RestMethod -Uri "$baseUrl/api/projects" -Method Get
} catch {
  Write-Error "API not reachable at $baseUrl - start .\scripts\dev-api.ps1 first."
}

$projectId = $projects[0].id
Write-Host "Project #$projectId"

$curlArgs = @(
  "-sS", "-X", "POST",
  "$baseUrl/api/projects/$projectId/imports",
  "-F", "contract=@$contractFile;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;filename=contract_obligations.xlsx",
  "-F", "schedule=@$scheduleFile;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;filename=partner_schedule.xlsx",
  "-F", "status=@$statusFile;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;filename=site_project_status.xlsx"
)

$raw = & curl.exe @curlArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "Import failed: $raw"
}

$result = $raw | ConvertFrom-Json
$runId = $result.analysis_run_id

Write-Host ""
Write-Host "Import OK - analysis run #$runId" -ForegroundColor Green
Write-Host "  Sites:    $($result.site_count)"
Write-Host "  Findings: $($result.kpis.findings_total) (critical: $($result.kpis.findings_critical))"
Write-Host ""
Write-Host "In the UI:" -ForegroundColor Yellow
Write-Host "  - Open http://localhost:5173 and pick Lauf #$runId in the run dropdown"
Write-Host "  - Or refresh and use the newest run if it is already selected"
Write-Host ""
Write-Host "Back to interview demo:" -ForegroundColor Yellow
Write-Host "  .\scripts\demo-reset.ps1   then Analyse starten (synthetic DE-NRW-0107)"
