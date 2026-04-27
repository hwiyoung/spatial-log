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

function Get-StableOffset {
    param([string]$Value)
    $sum = 0
    foreach ($ch in $Value.ToCharArray()) {
        $sum = ($sum + [int][char]$ch) % 500
    }
    return $sum
}

function Set-DefaultEnv {
    param([string]$Name, [int]$Value)
    if (-not [Environment]::GetEnvironmentVariable($Name, "Process")) {
        [Environment]::SetEnvironmentVariable($Name, [string]$Value, "Process")
    }
}

$branch = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
    Write-Error "Cannot determine current branch. Check git status and run again."
    exit 1
}

$userPart = ConvertTo-SafeName ($(if ($env:USERNAME) { $env:USERNAME } elseif ($env:USER) { $env:USER } else { "dev" }))
$branchPart = ConvertTo-SafeName $branch
if (-not $env:COMPOSE_PROJECT_NAME) {
    $env:COMPOSE_PROJECT_NAME = "spatial_log_${userPart}_${branchPart}_temp"
}

if ($env:SPATIAL_LOG_PORT_OFFSET) {
    $portOffset = [int]$env:SPATIAL_LOG_PORT_OFFSET
} else {
    $portOffset = Get-StableOffset $env:COMPOSE_PROJECT_NAME
}

if (-not $env:SAMS_DATA_ROOT) {
    $env:SAMS_DATA_ROOT = Join-Path $RepoRoot ".docker-data/$($env:COMPOSE_PROJECT_NAME)"
}
Set-DefaultEnv "POSTGRES_HOST_PORT" (15432 + $portOffset)
Set-DefaultEnv "REDIS_HOST_PORT" (16379 + $portOffset)
Set-DefaultEnv "FRONTEND_HOST_PORT" (13000 + $portOffset)
Set-DefaultEnv "NGINX_HOST_PORT" (17800 + $portOffset)
Set-DefaultEnv "SAMS_API_HOST_PORT" (18000 + $portOffset)
Set-DefaultEnv "STAC_API_HOST_PORT" (19080 + $portOffset)
Set-DefaultEnv "MINIO_API_HOST_PORT" (19100 + $portOffset)
Set-DefaultEnv "MINIO_CONSOLE_HOST_PORT" (19200 + $portOffset)

Write-Host "Starting temporary runtime for branch: $branch"
Write-Host "COMPOSE_PROJECT_NAME=$($env:COMPOSE_PROJECT_NAME)"
Write-Host "SAMS_DATA_ROOT=$($env:SAMS_DATA_ROOT)"
Write-Host "Nginx:        http://localhost:$($env:NGINX_HOST_PORT)"
Write-Host "Frontend:    http://localhost:$($env:FRONTEND_HOST_PORT)"
Write-Host "SAMS API:    http://localhost:$($env:SAMS_API_HOST_PORT)/health"
Write-Host "STAC API:    http://localhost:$($env:STAC_API_HOST_PORT)/"
Write-Host "MinIO UI:    http://localhost:$($env:MINIO_CONSOLE_HOST_PORT)/"

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose ps
