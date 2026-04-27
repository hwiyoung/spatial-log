param()

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function ConvertTo-SafeName {
    param([string]$Value)
    $safe = $Value.ToLower() -replace '[^a-z0-9]+', '_'
    $safe = $safe.Trim('_') -replace '_+', '_'
    if ([string]::IsNullOrWhiteSpace($safe)) { return "dev" }
    return $safe
}

$branch = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -and -not $env:COMPOSE_PROJECT_NAME) {
    Write-Error "Cannot determine current branch. Set COMPOSE_PROJECT_NAME to the temporary project name and run again."
    exit 1
}

$userPart = ConvertTo-SafeName ($(if ($env:USERNAME) { $env:USERNAME } elseif ($env:USER) { $env:USER } else { "dev" }))
$branchPart = ConvertTo-SafeName ($(if ($branch) { $branch } else { "manual" }))
if (-not $env:COMPOSE_PROJECT_NAME) {
    $env:COMPOSE_PROJECT_NAME = "spatial_log_${userPart}_${branchPart}_temp"
}

Write-Host "Stopping temporary runtime: $($env:COMPOSE_PROJECT_NAME)"
docker compose down
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Stopped containers and network only. Bind-mounted data remains on disk."
