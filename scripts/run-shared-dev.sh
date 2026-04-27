#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Shared runtime working tree is not clean. Commit, stash, or move local changes before updating develop."
  git status --short
  exit 1
fi

git fetch origin develop
git switch develop
git pull --ff-only origin develop

if [ ! -f ".env" ]; then
  echo "No .env file found. docker compose will use defaults. For shared runtime, copy .env.example to .env and set COMPOSE_PROJECT_NAME=spatial_log_shared."
fi

docker compose up -d --build
docker compose ps
