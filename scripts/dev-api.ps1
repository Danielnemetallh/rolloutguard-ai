$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root "backend")
# Default 8001 avoids stale processes often left on 8000 from older dev sessions.
$ApiPort = if ($env:API_PORT) { $env:API_PORT } else { "8001" }

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
    # Always let the repo .env override inherited shell variables for this process.
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

# Stop stale RolloutGuard uvicorn workers still bound to the dev port.
Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
  Where-Object {
    $_.CommandLine -like '*rolloutguard_api.main:app*' -and
    $_.CommandLine -like "*--port $ApiPort*"
  } |
  ForEach-Object {
    Write-Host "Stopping stale RolloutGuard API process $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

$env:PYTHONPATH = "src"
uv run uvicorn rolloutguard_api.main:app --reload --host 127.0.0.1 --port $ApiPort
