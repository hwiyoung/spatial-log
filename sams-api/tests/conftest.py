"""
공용 테스트 픽스처.

일부 라우터(collections 생성, items 갱신)는 stac-fastapi 래퍼가 아니라 psycopg2 로
pgSTAC 를 직접 호출한다. 테스트가 만든 collection 이 dev DB 에 남으면 다음 실행에서
UniqueViolation 으로 깨지므로, 세션 시작/종료 시 테스트 전용 collection 을 정리한다.
DB 미가용 환경(순수 단위 테스트만 도는 CI 등)에서는 조용히 건너뛴다.
"""

import pytest

# 테스트들이 사용하는 collection id — 여기 등록된 것만 정리한다 (실데이터 보호)
TEST_COLLECTION_IDS = ["test-project", "test-e2e-col", "test-e2e", "test-col"]


def _cleanup_test_collections() -> None:
    try:
        import psycopg2
        from sams.config import settings

        conn = psycopg2.connect(settings.DATABASE_URL, connect_timeout=3)
        try:
            cur = conn.cursor()
            cur.execute("ALTER TABLE pgstac.items DISABLE TRIGGER ALL")
            cur.execute("ALTER TABLE pgstac.collections DISABLE TRIGGER ALL")
            cur.execute("""
                SELECT inhrelid::regclass::text
                FROM pg_inherits WHERE inhparent = 'pgstac.items'::regclass
            """)
            partitions = [row[0] for row in cur.fetchall()]
            for col_id in TEST_COLLECTION_IDS:
                for part in partitions:
                    cur.execute(f"DELETE FROM {part} WHERE collection = %s", (col_id,))
                cur.execute("DELETE FROM pgstac.collections WHERE id = %s", (col_id,))
                cur.execute("DELETE FROM sams.item_history WHERE collection_id = %s", (col_id,))
            cur.execute("ALTER TABLE pgstac.items ENABLE TRIGGER ALL")
            cur.execute("ALTER TABLE pgstac.collections ENABLE TRIGGER ALL")
            conn.commit()
        finally:
            conn.close()
    except Exception:
        # DB 없음/이력 테이블 없음 등 — 단위 테스트 진행에 영향 주지 않는다
        pass


@pytest.fixture(scope="session", autouse=True)
def clean_test_collections():
    """세션 시작 전·종료 후 테스트 collection 정리 — 반복 실행 가능하게."""
    _cleanup_test_collections()
    yield
    _cleanup_test_collections()
