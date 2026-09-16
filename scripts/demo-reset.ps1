$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "== RolloutGuard demo reset ==" -ForegroundColor Cyan
Set-Location (Join-Path $Root "backend")
uv run python -m rolloutguard_api.domain.generate_synthetic --out (Join-Path $Root "data\synthetic") --sites 50

# Remove only local runtime state. Source workbooks, fixtures, scripts, and tests stay intact.
$RuntimeCandidates = @(
  (Join-Path $Root "backend\rolloutguard.db"),
  (Join-Path $Root "rolloutguard.db"),
  (Join-Path $Root "data\uploads\incoming"),
  (Join-Path $Root "data\uploads\batches"),
  (Join-Path $Root "data\uploads\exports")
)

foreach ($runtimePath in $RuntimeCandidates) {
  if (Test-Path $runtimePath -PathType Container) {
    Remove-Item $runtimePath -Recurse -Force
    Write-Host "Removed runtime directory: $runtimePath"
  } elseif (Test-Path $runtimePath -PathType Leaf) {
    Remove-Item $runtimePath -Force
    Write-Host "Removed runtime file: $runtimePath"
  }
}

# Always return to repo root so follow-up .\scripts\... commands work
Set-Location $Root

Write-Host ""
Write-Host "Next:" -ForegroundColor Green
Write-Host "  1. .\scripts\dev-api.ps1"
Write-Host "  2. .\scripts\dev-web.ps1   (separate terminal)"
Write-Host "  3. Open http://localhost:5173"
Write-Host "  4. Auf 'Analyse starten' klicken"
Write-Host "  5. Befund DE-NRW-0107 öffnen (SLA-001 / SEQ-002)"
Write-Host "  6. 'KI erklären' und Agent-Chip 'September-Integrationsziel'"
