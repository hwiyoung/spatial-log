#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

sanitize() {
  tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g'
}

branch="$(git branch --show-current)"
if [ -z "${branch}" ]; then
  echo "Cannot determine current branch. Check git status and run again."
  exit 1
fi

user_part="$(printf '%s' "${USER:-dev}" | sanitize)"
branch_part="$(printf '%s' "${branch}" | sanitize)"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-spatial_log_${user_part}_${branch_part}_temp}"

if [ -n "${SPATIAL_LOG_PORT_OFFSET:-}" ]; then
  port_offset="${SPATIAL_LOG_PORT_OFFSET}"
else
  port_offset="$(printf '%s' "${COMPOSE_PROJECT_NAME}" | cksum | awk '{print $1 % 500}')"
fi

set_default_port() {
  local name="$1"
  local base="$2"
  if [ -z "${!name:-}" ]; then
    export "${name}=$((base + port_offset))"
  fi
}

export SAMS_DATA_ROOT="${SAMS_DATA_ROOT:-${REPO_ROOT}/.docker-data/${COMPOSE_PROJECT_NAME}}"
set_default_port POSTGRES_HOST_PORT 15432
set_default_port REDIS_HOST_PORT 16379
set_default_port FRONTEND_HOST_PORT 13000
set_default_port NGINX_HOST_PORT 17800
set_default_port SAMS_API_HOST_PORT 18000
set_default_port STAC_API_HOST_PORT 19080
set_default_port MINIO_API_HOST_PORT 19100
set_default_port MINIO_CONSOLE_HOST_PORT 19200

echo "Starting temporary runtime for branch: ${branch}"
echo "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}"
echo "SAMS_DATA_ROOT=${SAMS_DATA_ROOT}"
echo "Nginx:        http://localhost:${NGINX_HOST_PORT}"
echo "Frontend:    http://localhost:${FRONTEND_HOST_PORT}"
echo "SAMS API:    http://localhost:${SAMS_API_HOST_PORT}/health"
echo "STAC API:    http://localhost:${STAC_API_HOST_PORT}/"
echo "MinIO UI:    http://localhost:${MINIO_CONSOLE_HOST_PORT}/"

docker compose up -d --build
docker compose ps
