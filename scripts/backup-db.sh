#!/bin/bash
# Spatial Log - PostgreSQL 백업 스크립트
# 사용법: ./scripts/backup-db.sh [dev|prod]
# crontab 등록 예시: 0 3 * * * /path/to/spatial-log/scripts/backup-db.sh prod

set -euo pipefail

# 환경 설정
ENV="${1:-dev}"

# ENV 파라미터 검증 (영문/숫자만 허용)
if [[ ! "$ENV" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "오류: 잘못된 환경 이름: $ENV (dev 또는 prod만 허용)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups/${ENV}"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Docker Compose 파일 선택
COMPOSE_ARGS=(-f "${PROJECT_DIR}/docker-compose.yml")
if [ "$ENV" = "prod" ]; then
  COMPOSE_ARGS=(-f "${PROJECT_DIR}/docker-compose.prod.yml" --env-file "${PROJECT_DIR}/.env.prod")
fi

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

echo "=== Spatial Log DB 백업 시작 ==="
echo "환경: ${ENV}"
echo "시간: ${TIMESTAMP}"
echo "백업 경로: ${BACKUP_DIR}"

# 컨테이너 이름 확인
CONTAINER=$(docker compose "${COMPOSE_ARGS[@]}" ps -q db 2>/dev/null)
if [ -z "$CONTAINER" ]; then
  echo "오류: DB 컨테이너가 실행 중이 아닙니다."
  exit 1
fi

# pg_dump 실행
BACKUP_FILE="${BACKUP_DIR}/spatial-log_${ENV}_${TIMESTAMP}.sql.gz"
echo "덤프 중..."
docker exec "$CONTAINER" pg_dump -U postgres -d postgres \
  --clean --if-exists --no-owner \
  | gzip > "$BACKUP_FILE"

# 파일 크기 확인
FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "백업 완료: ${BACKUP_FILE} (${FILESIZE})"

# 오래된 백업 정리
echo "오래된 백업 정리 (${RETENTION_DAYS}일 이상)..."
DELETED=$(find "$BACKUP_DIR" -name "spatial-log_${ENV}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete -print | wc -l)
echo "삭제된 파일: ${DELETED}개"

# 현재 백업 목록
echo ""
echo "=== 현재 백업 목록 ==="
ls -lh "${BACKUP_DIR}"/spatial-log_"${ENV}"_*.sql.gz 2>/dev/null || echo "(없음)"

echo ""
echo "=== 백업 완료 ==="
