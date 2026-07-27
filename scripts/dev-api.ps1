$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "backend")

$envPath = Join-Path $Root ".env"
if (-not (Test-Path $envPath)) {
  Write-Host "Missing .env - copy .env.example and set DATABASE_URL." -ForegroundColor Yellow
}

# Load .env into process env for uvicorn
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line -split "=", 2
    if ($parts.Count -lt 2) { return }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

uv run uvicorn rolloutguard_api.main:app --reload --host 127.0.0.1 --port 8000
