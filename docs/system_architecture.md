# SAMS 시스템 아키텍처

## 1. 컴포넌트 구성

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Nginx (리버스 프록시)                       │
│  /          → Frontend (React SPA)                           │
│  /api/      → SAMS API (FastAPI)                             │
│  /stac/     → STAC API (stac-fastapi)                        │
│  /minio/    → MinIO Console                                  │
└──────┬──────────────┬──────────────┬─────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Frontend  │  │ SAMS API  │  │ STAC API  │
│ (React)   │  │ (FastAPI) │  │(stac-fast │
│ port:3000 │  │ port:8000 │  │api) :8080 │
└───────────┘  └─────┬─────┘  └─────┬─────┘
                     │              │
              ┌──────┴──────┐       │
              │             │       │
              ▼             ▼       ▼
        ┌──────────┐  ┌──────────────────┐
        │  Worker  │  │  PostgreSQL      │
        │ (Celery) │  │  + PostGIS       │
        │ 썸네일생성 │  │  + pgSTAC        │
        │ 메타추출  │  │  port:5432       │
        └────┬─────┘  └──────────────────┘
             │
             ▼
        ┌──────────┐
        │  MinIO   │
        │  (S3)    │
        │ port:9000│
        └──────────┘
```

### 각 컴포넌트 역할

| 컴포넌트 | 역할 | 기술 |
|---------|------|------|
| **Frontend** | 4페이지 SPA (Explorer, Detail, Project, Upload) | React + MapLibre GL |
| **SAMS API** | 커스텀 비즈니스 로직 (업로드, 자동 채움, Collection 관리) | Python FastAPI |
| **STAC API** | STAC 표준 검색 엔드포인트 (/search, /collections, /items) | stac-fastapi-pgstac |
| **Worker** | 비동기 작업 (메타데이터 추출, 썸네일 생성, 파일 업로드) | Celery + Redis |
| **PostgreSQL** | 데이터 저장 (pgSTAC JSONB + PostGIS 공간 인덱스) | PostgreSQL 16 + PostGIS 3.4 + pgSTAC |
| **MinIO** | 파일 스토리지 (S3 호환) | MinIO |
| **Redis** | Celery 메시지 브로커 + 자동완성 캐시 | Redis 7 |
| **Nginx** | 리버스 프록시, 정적 파일 서빙, SSL | Nginx |

### SAMS API vs STAC API 분리 이유

stac-fastapi는 STAC 표준 엔드포인트만 제공한다. 벌크 업로드, 메타데이터 자동 채움, Collection 생성 폼 처리, 관계 자동 제안 같은 SAMS 고유 로직은 별도 API로 분리한다. SAMS API가 STAC API를 내부적으로 호출하거나, 직접 pgSTAC에 접근한다.

---

## 2. docker-compose.yml

```yaml
version: "3.9"

services:
  # ── Database ──
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: samsdb
      POSTGRES_USER: sams
      POSTGRES_PASSWORD: ${DB_PASSWORD:-sams_dev_2024}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sams -d samsdb"]
      interval: 5s
      retries: 5

  # ── pgSTAC Migration ──
  pgstac-migrate:
    image: ghcr.io/stac-utils/pgstac:v0.9.1
    environment:
      PGHOST: db
      PGDATABASE: samsdb
      PGUSER: sams
      PGPASSWORD: ${DB_PASSWORD:-sams_dev_2024}
    depends_on:
      db:
        condition: service_healthy
    command: ["migrate"]
    restart: "no"

  # ── STAC API ──
  stac-api:
    image: ghcr.io/stac-utils/stac-fastapi-pgstac:v3.0.0
    environment:
      APP_HOST: 0.0.0.0
      APP_PORT: "8080"
      POSTGRES_HOST_READER: db
      POSTGRES_HOST_WRITER: db
      POSTGRES_DBNAME: samsdb
      POSTGRES_USER: sams
      POSTGRES_PASS: ${DB_PASSWORD:-sams_dev_2024}
      POSTGRES_PORT: "5432"
    ports:
      - "8080:8080"
    depends_on:
      pgstac-migrate:
        condition: service_completed_successfully

  # ── SAMS API ──
  sams-api:
    build:
      context: ./sams-api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://sams:${DB_PASSWORD:-sams_dev_2024}@db:5432/samsdb
      STAC_API_URL: http://stac-api:8080
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: sams-archive
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/1
    ports:
      - "8000:8000"
    depends_on:
      - db
      - stac-api
      - minio
      - redis
    volumes:
      - upload_tmp:/tmp/uploads

  # ── Worker ──
  worker:
    build:
      context: ./sams-api
      dockerfile: Dockerfile
    command: celery -A sams.worker worker --loglevel=info --concurrency=2
    environment:
      DATABASE_URL: postgresql://sams:${DB_PASSWORD:-sams_dev_2024}@db:5432/samsdb
      STAC_API_URL: http://stac-api:8080
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: sams-archive
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/1
    depends_on:
      - db
      - minio
      - redis
    volumes:
      - upload_tmp:/tmp/uploads

  # ── MinIO (S3) ──
  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  # ── Redis ──
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # ── Frontend ──
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      REACT_APP_SAMS_API: /api
      REACT_APP_STAC_API: /stac

  # ── Nginx ──
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - sams-api
      - stac-api
      - minio

volumes:
  pgdata:
  miniodata:
  upload_tmp:
```

### 실행

```bash
# 환경변수 설정 (.env 파일)
echo "DB_PASSWORD=your_secure_password" > .env
echo "MINIO_ROOT_USER=minioadmin" >> .env
echo "MINIO_ROOT_PASSWORD=your_minio_password" >> .env

# 전체 기동
docker-compose up -d

# pgSTAC 마이그레이션 확인
docker-compose logs pgstac-migrate

# STAC API 확인
curl http://localhost:8080/

# SAMS API 확인
curl http://localhost:8000/health
```

---

## 3. API 설계

### 3.1 STAC 표준 엔드포인트 (stac-fastapi, /stac/)

stac-fastapi가 자동으로 제공하는 엔드포인트. 별도 구현 불필요.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /stac/ | API 루트 (Landing Page) |
| GET | /stac/collections | Collection 목록 |
| GET | /stac/collections/{id} | Collection 상세 |
| GET | /stac/collections/{id}/items | Collection의 Item 목록 |
| GET | /stac/collections/{id}/items/{item_id} | Item 상세 |
| POST | /stac/search | STAC Search (CQL2 필터) |
| POST | /stac/collections | Collection 생성 |
| PUT | /stac/collections/{id} | Collection 수정 |
| POST | /stac/collections/{id}/items | Item 등록 |
| PUT | /stac/collections/{id}/items/{item_id} | Item 수정 |
| DELETE | /stac/collections/{id}/items/{item_id} | Item 삭제 |

### 3.2 SAMS 커스텀 엔드포인트 (/api/)

STAC 표준으로 처리할 수 없는 SAMS 고유 로직.

#### Collection 관리

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/collections | Collection 생성 (SAMS 확장 필드 포함). 내부적으로 STAC Collection 생성 + 확장 메타 저장. |
| PUT | /api/collections/{id} | Collection 수정 (expected_deliverables 등) |
| GET | /api/collections/{id}/dashboard | 대시보드 데이터 (예상 vs 실제, Draft 목록, 최근 등록) |
| GET | /api/collections/{id}/spatial-summary | 공간 현황 요약 (유형별 bbox 목록) |

##### Collection 확장 필드 JSON 스키마

`extent.spatial.bbox`와 `extent.temporal.interval`은 소속 Item으로부터 자동 계산된다.

```json
{
  "id": "bulguksa-2024-survey",
  "title": "2024 경주 불국사 정밀실측",
  "description": "...",
  "project:client": "문화재청",
  "project:site": "경주 불국사",
  "project:period_start": "2024-03-01",
  "project:period_end": "2024-06-30",
  "project:manager": "홍길동",
  "project:default_epsg": 5186,
  "expected_deliverables": [
    {"category": "pointcloud", "count": 3, "description": "다보탑, 석가탑, 대웅전"}
  ],
  "status": "active",
  "license": "CC-BY-4.0",
  "created": "2024-03-01T10:00:00Z",
  "updated": "2024-04-15T14:00:00Z"
}
```

#### 업로드 + 자동 채움 ⭐

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/upload/analyze | 파일/폴더를 받아 자동 분석. 유형 판별 + 메타 추출 + 상속 + 관계 제안. 매니페스트 초안 반환. |
| POST | /api/upload/validate | 매니페스트를 받아 필수 필드 검증. 오류/경고 목록 반환. |
| POST | /api/upload/register | 검증 통과된 매니페스트로 STAC Item 일괄 생성 + S3 업로드. |
| GET | /api/upload/manifest-template/{collection_id} | Collection 기본값이 채워진 빈 매니페스트 템플릿 (Excel). |
| POST | /api/upload/manifest-import | Excel 매니페스트 업로드 → 파싱 → 검증 결과 반환. |
| GET | /api/upload/presigned-url | S3 Presigned URL 발급 (대용량 직접 업로드용). |
| POST | /api/upload/upload-complete | Presigned URL 직접 업로드 완료 통지. upload_id를 받아 S3에 파일 존재 확인 후 분석 시작. |

##### /api/upload/analyze 상세

```
Request:
  POST /api/upload/analyze
  Content-Type: multipart/form-data
  Body:
    collection_id: "bulguksa-2024"
    files: [file1, file2, ...] 또는
    folder_path: "/uploaded/bulguksa-2024-upload/"

Response:
{
  "manifest": [
    {
      "file_path": "pointcloud/dabotap_scan.laz",
      "bundled_files": null,
      "detected_category": "pointcloud",
      "category_confidence": 1.0,
      "auto_extracted": {
        "pc:count": {"value": 15230482, "source": "file"},
        "pc:density": {"value": 248.3, "source": "file"},
        "pc:encoding": {"value": "LAZ", "source": "file"},
        "proj:epsg": {"value": 5186, "source": "collection_default", "warning": "파일에서 확인 불가"},
        "bbox": {"value": [129.332, 35.790, 12.0, 129.333, 35.791, 25.5], "source": "file"},
        "file:size": {"value": 2147483648, "source": "file"}
      },
      "inherited": {
        "project:name": {"value": "2024 경주 불국사 정밀실측", "source": "collection"},
        "project:site": {"value": "경주 불국사", "source": "collection"}
      },
      "suggested_links": [
        {"rel": "related", "target_file": "3dmodel/dabotap.obj", "confidence": 0.7,
         "reason": "같은 target 추정 (파일명 'dabotap' 공통)"}
      ],
      "required_empty": ["datetime", "description", "target"],
      "warnings": ["proj:epsg: 파일 헤더에서 좌표계를 확인할 수 없어 Collection 기본값(5186)을 적용했습니다."]
    }
  ],
  "summary": {
    "total_files": 8,
    "detected_types": {"pointcloud": 3, "3d_model": 1, "orthoimage": 1, "image": 1, "video": 1, "document": 1},
    "auto_filled_percentage": 72,
    "manual_required_fields": 24
  }
}
```

**번들 파일의 경우**: 0단계 그룹핑으로 묶인 파일은 `file_path`에 대표 파일(예: `.obj`)이, `bundled_files`에 동반 파일 목록이 들어간다.

```json
{
  "file_path": "3dmodel/dabotap.obj",
  "bundled_files": ["3dmodel/dabotap.mtl", "3dmodel/dabotap_diffuse.png"],
  "detected_category": "3d_model",
  ...
}
```

#### Item 관리

| 메서드 | 경로 | 설명 |
|--------|------|------|
| PUT | /api/items/{id} | Item 메타데이터 수정. properties 업데이트 후 STAC Item PUT 호출. |
| PUT | /api/items/{id}/status | Draft→Published 전환 (필수 필드 검증 후) |
| GET | /api/items/{id}/timeline | 같은 target+category의 시점별 Item 목록 |
| GET | /api/items/{id}/related | 관계 그래프 데이터 (links 양방향 해석) |
| POST | /api/items/{id}/links | 관계 추가 (양방향 자동 생성) |
| DELETE | /api/items/{id}/links/{link_index} | 관계 삭제 (양방향 자동 삭제) |

#### 삭제

| 메서드 | 경로 | 설명 |
|--------|------|------|
| DELETE | /api/items/{id} | Item 삭제. S3 파일 + STAC Item + 양방향 links 정리. |
| DELETE | /api/collections/{id} | Collection 삭제 (소속 Item이 0건일 때만 가능). |

#### 검색 보조

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/search/autocomplete?q={keyword} | 키워드 자동완성 (site, target, description에서) |
| GET | /api/search/facets | 검색 패싯 (유형별 건수, 사이트별 건수, 연도별 건수) |
| GET | /api/field-values/{field_name}?collection={id} | 특정 필드의 기존 값 목록 (자동완성용) |

---

## 4. 파일 스토리지 전략

### 4.1 S3 경로 규칙

```
s3://sams-archive/
  └── {collection_id}/
        └── {data_category}/
              └── {item_id}/
                    ├── {원본 파일명}           ← roles: ["data"]
                    ├── {원본명}_thumb.png      ← roles: ["thumbnail"]
                    └── {변환본}               ← roles: ["compressed", "converted", "preview"] (Phase 2)
```

예시:
```
s3://sams-archive/
  └── bulguksa-2024/
        ├── pointcloud/
        │     └── bg-dabotap-pc-20240312/
        │           ├── dabotap_scan.laz
        │           └── dabotap_scan_thumb.png
        ├── 3d_model/
        │     └── bg-dabotap-3d-20240315/
        │           ├── dabotap.obj
        │           ├── dabotap.mtl
        │           ├── texture_0.jpg
        │           └── dabotap_thumb.png
        └── document/
              └── bg-report-20240415/
                    ├── survey_report.pdf
                    └── survey_report_thumb.png
```

### 4.2 업로드 방식

**소용량 파일 (<100MB)**: API 경유 업로드. SAMS API가 받아서 S3에 저장.

**대용량 파일 (≥100MB)**: Presigned URL 직접 업로드. 프론트엔드가 SAMS API에서 Presigned URL을 발급받고, 브라우저에서 직접 MinIO/S3에 멀티파트 업로드. 완료 후 SAMS API에 통지.

```
대용량 업로드 흐름:

Frontend                SAMS API               MinIO (S3)
   │                       │                       │
   │──GET presigned-url───▶│                       │
   │◀──url+upload_id──────│                       │
   │                       │                       │
   │──PUT (file data)─────────────────────────────▶│
   │◀──200 OK─────────────────────────────────────│
   │                       │                       │
   │──POST upload-complete─▶│                       │
   │                       │──verify file exists──▶│
   │                       │◀─────────────────────│
   │◀──200 (분석 시작)──────│                       │
```

### 4.3 중복 파일 처리

같은 Item ID로 재업로드하면 기존 파일을 **버전닝**으로 보관한다 (MinIO의 버전닝 기능 활용). 최신 버전이 기본 제공되고, 이전 버전도 복구 가능하다.

### 4.4 Asset href 생성 규칙

STAC Item의 `assets.{key}.href`에는 **S3 경로가 아닌 API 경유 URL**을 저장한다.

```
assets.data.href = "/api/files/bulguksa-2024/pointcloud/bg-dabotap-pc-20240312/dabotap_scan.laz"
```

SAMS API가 이 경로를 받으면 내부적으로 S3 Presigned URL을 생성하여 리다이렉트한다. 이렇게 하면 S3 접근 키가 프론트엔드에 노출되지 않고, 향후 권한 제어를 API 레이어에서 처리할 수 있다.

---

## 5. 데이터 흐름 요약

### 시나리오 1: 벌크 업로드

```
1. 사용자가 Upload 페이지에서 Collection 선택 + 폴더 업로드
2. Frontend → POST /api/upload/analyze (폴더)
3. SAMS API:
   a. 파일 유형 판별 (1단계)
   b. 메타데이터 자동 추출 (2단계) ← 핵심 차별점
   c. Collection 기본값 상속 (3단계)
   d. 관계 자동 제안 (4단계)
   e. 매니페스트 초안 반환
4. Frontend가 매니페스트를 테이블로 표시
5. 사용자가 빈 칸(description, target, datetime)만 채움
6. Frontend → POST /api/upload/validate
7. 검증 통과 → POST /api/upload/register
8. SAMS API:
   a. 대용량 파일: Presigned URL 발급 → Frontend가 직접 S3 업로드
   b. 소용량 파일: API가 S3 업로드
   c. STAC Item JSON 생성 → POST /stac/collections/{id}/items (일괄)
   d. 양방향 links 처리
   e. 썸네일 생성 작업을 Worker 큐에 추가
9. Worker가 비동기로 썸네일 생성 → S3 업로드 → Asset 업데이트
```

### 시나리오 2: 검색

```
1. 사용자가 Explorer에서 키워드 입력 + 유형 필터 + 지도 영역 선택
2. Frontend → POST /stac/search (CQL2 필터)
   {
     "filter": {
       "op": "and",
       "args": [
         {"op": "like", "args": [{"property": "description"}, "%다보탑%"]},
         {"op": "=", "args": [{"property": "data_category"}, "pointcloud"]},
         {"op": "s_intersects", "args": [{"property": "geometry"}, {"type": "Polygon", ...}]}
       ]
     },
     "sortby": [{"field": "datetime", "direction": "desc"}],
     "limit": 20
   }
3. STAC API → pgSTAC 쿼리 (GIN 인덱스 + GiST 공간 인덱스)
4. 결과 반환 → Frontend가 지도 마커 + 결과 목록 표시
5. 사용자가 Item 클릭 → 미리보기 패널 → "상세 보기"
6. Frontend → GET /stac/collections/{id}/items/{item_id} + GET /api/items/{id}/related
7. Detail 전체 페이지 표시
```

---

## 6. 보안 고려사항 (Phase 1 최소)

| 항목 | Phase 1 | Phase 2 |
|------|---------|---------|
| 인증 | 사내 네트워크 신뢰 (인증 없음) 또는 Basic Auth | OAuth2 / OIDC |
| S3 접근 | API 경유 Presigned URL만 허용 | IAM 정책 |
| CORS | 사내 도메인만 허용 | 외부 공유 시 동적 허용 |
| HTTPS | 사내는 HTTP 가능 | 외부 공유 시 필수 |

---

## 7. 개발 디렉토리 구조

```
sams/
├── docker-compose.yml
├── .env
├── nginx/
│     └── nginx.conf
├── sams-api/
│     ├── Dockerfile
│     ├── requirements.txt
│     ├── sams/
│     │     ├── __init__.py
│     │     ├── main.py              ← FastAPI 앱
│     │     ├── config.py            ← 설정
│     │     ├── worker.py            ← Celery 워커
│     │     ├── routers/
│     │     │     ├── upload.py      ← /api/upload/* ⭐
│     │     │     ├── collections.py ← /api/collections/*
│     │     │     ├── items.py       ← /api/items/*
│     │     │     ├── search.py      ← /api/search/*
│     │     │     └── files.py       ← /api/files/*
│     │     ├── pipeline/            ← 자동 채움 파이프라인 ⭐
│     │     │     ├── __init__.py
│     │     │     ├── detect.py      ← 1단계: 유형 판별
│     │     │     ├── extract.py     ← 2단계: 메타 추출 (유형별)
│     │     │     ├── inherit.py     ← 3단계: Collection 상속
│     │     │     ├── suggest.py     ← 4단계: 관계 제안
│     │     │     └── thumbnail.py   ← 5단계: 썸네일 생성
│     │     ├── models/
│     │     │     ├── manifest.py    ← 매니페스트 Pydantic 모델
│     │     │     └── collection.py  ← Collection 확장 모델
│     │     └── services/
│     │           ├── stac.py        ← STAC API 호출 래퍼
│     │           └── storage.py     ← S3 업/다운로드
│     └── tests/
│           ├── test_detect.py
│           ├── test_extract.py
│           └── fixtures/            ← 테스트용 샘플 파일
│                 ├── sample.laz
│                 ├── sample.obj
│                 ├── sample.tif
│                 └── sample.mp4
├── frontend/
│     ├── Dockerfile
│     ├── package.json
│     ├── src/
│     │     ├── App.jsx
│     │     ├── pages/
│     │     │     ├── Explorer.jsx
│     │     │     ├── Detail.jsx
│     │     │     ├── Project.jsx
│     │     │     └── Upload.jsx
│     │     ├── components/
│     │     │     ├── Map2D.jsx
│     │     │     ├── PreviewPanel.jsx
│     │     │     ├── SearchFilters.jsx
│     │     │     └── ManifestEditor.jsx
│     │     └── services/
│     │           ├── stacApi.js
│     │           └── samsApi.js
│     └── public/
└── docs/
      ├── system_structure_design.md
      ├── autofill_pipeline_spec.md
      ├── system_architecture.md      ← 이 문서
      ├── stac_metadata_design_v4.xlsx
      └── system_use_scenarios.md
```

---

## 8. 구현 순서 (Phase 1)

| 순서 | 작업 | 의존성 | 예상 기간 |
|------|------|--------|----------|
| 1 | DB + pgSTAC + STAC API (docker-compose) | — | 1일 |
| 2 | MinIO + S3 경로 규칙 | — | 0.5일 |
| 3 | 자동 채움 파이프라인 (detect + extract) ⭐ | 1 | 3~5일 |
| 4 | SAMS API: /api/upload/analyze | 3 | 2일 |
| 5 | SAMS API: /api/upload/register + S3 업로드 | 2, 4 | 2일 |
| 6 | SAMS API: Collection 관리 + 대시보드 | 1 | 1~2일 |
| 7 | Worker: 썸네일 생성 | 2 | 2일 |
| 8 | Frontend: Upload 페이지 (벌크 + 단건) | 4, 5 | 3~4일 |
| 9 | Frontend: Explorer (검색 + 2D 지도) | 1 | 3~4일 |
| 10 | Frontend: Detail (미리보기 + 전체 페이지) | 1, 6 | 2~3일 |
| 11 | Frontend: Project (대시보드 + 공간 현황) | 6 | 2~3일 |
| 12 | 통합 테스트 + 실제 데이터 등록 | 전체 | 2~3일 |

**총 예상: 3~4주** (1인 풀타임 기준)

핵심 경로: 1→3→4→5→8 (DB→파이프라인→API→프론트). 이 경로에서 3번(자동 채움)이 가장 오래 걸리고 가장 중요하다.
