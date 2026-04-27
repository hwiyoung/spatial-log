#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

sanitize() {
  tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//; s/_+/_/g'
}

branch="$(git branch --show-current)"
if [ -z "${branch}" ] && [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
  echo "Cannot determine current branch. Set COMPOSE_PROJECT_NAME to the temporary project name and run again."
  exit 1
fi

user_part="$(printf '%s' "${USER:-dev}" | sanitize)"
branch_part="$(printf '%s' "${branch:-manual}" | sanitize)"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-spatial_log_${user_part}_${branch_part}_temp}"

echo "Stopping temporary runtime: ${COMPOSE_PROJECT_NAME}"
docker compose down
echo "Stopped containers and network only. Bind-mounted data remains on disk."
