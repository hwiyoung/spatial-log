#!/usr/bin/env bash
# SAMS 내부 베타 백업 — PostgreSQL 덤프 + MinIO 데이터 스냅샷.
# 수백 GB 실데이터 업로드 전 1차 안전망 (변경경로 자동 테스트 대신 복구로 보장).
#
# 사용:
#   deploy/backup.sh [출력디렉터리]        # 기본: ./backups
# 복구(참고):
#   docker exec -i sams-db-1 pg_restore -U sams -d samsdb --clean < samsdb.dump
#   tar -xzf minio-data.tar.gz -C "$SAMS_DATA_ROOT"   (스택 중지 상태에서)
set -euo pipefail

PROJECT="${COMPOSE_PROJECT_NAME:-sams}"
DATA_ROOT="${SAMS_DATA_ROOT:-/media/innopam/InnoPAM-8TB/sams-data}"
OUT="${1:-./backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$OUT/$STAMP"
mkdir -p "$DEST"

echo "[1/2] PostgreSQL 덤프 (${PROJECT}-db-1)..."
docker exec "${PROJECT}-db-1" pg_dump -U sams -d samsdb -Fc -f /tmp/samsdb.dump
docker cp "${PROJECT}-db-1:/tmp/samsdb.dump" "$DEST/samsdb.dump"
docker exec "${PROJECT}-db-1" rm -f /tmp/samsdb.dump

echo "[2/2] MinIO 데이터 스냅샷 (${DATA_ROOT}/minio)..."
tar -czf "$DEST/minio-data.tar.gz" -C "$DATA_ROOT" minio

echo "완료: $DEST"
ls -lh "$DEST"
