$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"

if (-not (Test-Path "$Root\.env")) {
  Write-Host "Missing .env — copy .env.example and set DATABASE_URL (Neon)." -ForegroundColor Yellow
}

# Load .env into process for uvicorn children
if (Test-Path "$Root\.env") {
  Get-Content "$Root\.env" | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $name, $value = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
  }
}

uv run uvicorn rolloutguard_api.main:app --reload --host 127.0.0.1 --port 8000
