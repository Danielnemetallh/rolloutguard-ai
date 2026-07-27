$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"
uv run python -m rolloutguard_api.domain.generate_synthetic --out "$Root\data\synthetic" --sites 50
Write-Host "Synthetic workbooks ready in data\synthetic"
