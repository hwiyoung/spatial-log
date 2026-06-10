"""
Item 이력(audit log) 서비스.

등록·상태 전환·메타데이터 수정·위치 지정·프로젝트 이동·관계 변경·preview 생성 등
Item 에 일어난 사건을 sams.item_history 테이블에 기록하고 조회한다.

설계 원칙:
- 이력 기록 실패가 본 작업(등록/수정/이동)을 실패시키지 않는다 — 경고 로그 후 계속 진행.
- DB 접근은 이 코드베이스의 관례(요청당 psycopg2 직결, items._pgstac_update_item 와 동일)를 따른다.
- 행위자(actor)는 인증 도입 전까지 NULL — 허구의 이름을 만들어내지 않는다.

참조: docs/system_structure_design.md 페이지 2-B (Detail · History)
"""

import json
import logging

import psycopg2

from sams.config import settings

logger = logging.getLogger(__name__)

# Detail History 섹션이 아이콘으로 구분하는 이벤트 유형
EVENT_TYPES = {"register", "status", "meta", "location", "assign", "relation", "preview", "file"}

_CREATE_SQL = """
CREATE SCHEMA IF NOT EXISTS sams;
CREATE TABLE IF NOT EXISTS sams.item_history (
    id BIGSERIAL PRIMARY KEY,
    collection_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail JSONB,
    actor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_item_history_item
    ON sams.item_history (collection_id, item_id, created_at DESC);
"""


def ensure_history_table() -> None:
    """이력 테이블을 멱등 생성한다. 앱 시작 시 1회 호출."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(_CREATE_SQL)
        conn.commit()
    finally:
        conn.close()


def record_event(
    collection_id: str,
    item_id: str,
    event_type: str,
    summary: str,
    detail: dict | None = None,
    actor: str | None = None,
) -> None:
    """이벤트 1건을 기록한다. 실패해도 예외를 전파하지 않는다 (본 작업 보호)."""
    if event_type not in EVENT_TYPES:
        logger.warning("알 수 없는 이력 event_type: %s (%s/%s)", event_type, collection_id, item_id)
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sams.item_history
                        (collection_id, item_id, event_type, summary, detail, actor)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (collection_id, item_id, event_type, summary,
                     json.dumps(detail, ensure_ascii=False) if detail else None, actor),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        logger.warning("이력 기록 실패: %s %s/%s — %s", event_type, collection_id, item_id, summary, exc_info=True)


def list_events(collection_id: str, item_id: str, limit: int = 100) -> list[dict]:
    """Item 의 이력을 최신순으로 조회한다."""
    conn = psycopg2.connect(settings.DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT event_type, summary, detail, actor, created_at
                FROM sams.item_history
                WHERE collection_id = %s AND item_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (collection_id, item_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "event_type": r[0],
            "summary": r[1],
            "detail": r[2],
            "actor": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
        }
        for r in rows
    ]


def move_history(old_collection_id: str, item_id: str, new_collection_id: str) -> None:
    """프로젝트 이동 시 이력이 Item 을 따라가도록 collection_id 를 갱신한다. 실패는 경고만."""
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE sams.item_history SET collection_id = %s WHERE collection_id = %s AND item_id = %s",
                    (new_collection_id, old_collection_id, item_id),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        logger.warning("이력 이동 실패: %s/%s → %s", old_collection_id, item_id, new_collection_id, exc_info=True)


def delete_collection_history(collection_id: str) -> None:
    """Collection 삭제 시 하위 Item 이력을 일괄 정리한다. 실패는 경고만."""
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sams.item_history WHERE collection_id = %s", (collection_id,))
            conn.commit()
        finally:
            conn.close()
    except Exception:
        logger.warning("Collection 이력 정리 실패: %s", collection_id, exc_info=True)


def delete_history(collection_id: str, item_id: str) -> None:
    """Item 삭제 시 이력도 함께 정리한다. 실패는 경고만."""
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM sams.item_history WHERE collection_id = %s AND item_id = %s",
                    (collection_id, item_id),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        logger.warning("이력 삭제 실패: %s/%s", collection_id, item_id, exc_info=True)
