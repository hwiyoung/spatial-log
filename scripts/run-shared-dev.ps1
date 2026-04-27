param()

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$status = git status --porcelain
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($status) {
    Write-Error "Shared runtime working tree is not clean. Commit, stash, or move local changes before updating develop."
    git status --short
    exit 1
}

git fetch origin develop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git switch develop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git pull --ff-only origin develop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path ".env")) {
    Write-Host "No .env file found. docker compose will use defaults. For shared runtime, copy .env.example to .env and set COMPOSE_PROJECT_NAME=spatial_log_shared."
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose ps
