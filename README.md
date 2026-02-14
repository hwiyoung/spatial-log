# Spatial Log

3D 모델, 3D 스캔, 드론 이미지, 스마트폰 이미지 등 다양한 공간 데이터를 업로드, 가시화, 관리하고 공간 스토리를 구성·발행할 수 있는 **3D 공간정보 플랫폼**입니다.

> **핵심 철학**: "모든 것은 공간 위에 존재한다" — 캔버스는 항상 Cesium 지구본이며, 모든 콘텐츠는 GPS 좌표에 배치됩니다.

## 3축 아키텍처

```
Assets (업로드·관리)  →  Story (구성·편집)  →  Publish (발행·공유)
```

| 축 | 설명 |
|-----|------|
| **Assets** | 폴더 기반 파일 업로드, 정리, 검색, 3D 변환 파이프라인 |
| **Story** | Story → Scene → Entry 계층 구조로 공간 콘텐츠 구성 (항상 Cesium 캔버스) |
| **Publish** | Story 스냅샷을 Release로 발행, 공유 링크 생성, 버전 관리 |

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **데이터 관리** | 폴더 기반 파일 업로드, 정리, 검색 |
| **3D 가시화** | CesiumJS 지구본 캔버스 (3D 오브젝트 + 타입별 마커) |
| **Story 구성** | Scene별 Entry 배치 (spatial/visual/document/note 4종) |
| **공간 마커** | GPS 기반 마커 + 말풍선 팝업 (썸네일, 다운로드, 텍스트) |
| **Release 발행** | 스냅샷 기반 버전 관리, Scene 선택 발행, 공유 링크 |

### Entry 타입

| 타입 | 역할 | 파일 | 아이콘 | 마커색 |
|------|------|------|--------|--------|
| `spatial` | 3D 모델, 포인트클라우드 | 필수 | Box | blue |
| `visual` | 사진, 이미지 | 필수 | Image | green |
| `document` | PDF, 도면, 문서 | 필수 | FileText | purple |
| `note` | 텍스트, 링크, 메모 | 없음 | StickyNote | amber |

### Entry 추가 워크플로우

- **A. 우측 패널**: 타입 선택 → 파일/메모 입력 → GPS 자동 추출 또는 수동 지정
- **B. 에셋 드래그**: 에셋 브라우저에서 Cesium 캔버스로 드래그&드롭 → 드롭 위치 GPS로 Entry 생성
- **C. 지도 클릭**: "위치에 추가" → 지구본 클릭 → 해당 GPS에 Entry 생성 다이얼로그

## 지원 데이터

| 포맷 | Three.js 미리보기 | Cesium 지리 가시화 | 비고 |
|------|------------------|-------------------|------|
| **GLTF/GLB** | ✅ 완전 지원 | ⚠️ 변환 필요 | 권장 포맷 |
| **OBJ** | ✅ 완전 지원 | ✅ GLB Entity 직접 로드 | MTL/텍스처 포함, 방향 조정 가능 |
| **FBX** | ✅ 완전 지원 | ⚠️ 미지원 | 스케일 자동 조정 |
| **PLY** | ✅ 완전 지원 | ⚠️ 미지원 | 메시/포인트 클라우드 자동 감지 |
| **LAS** | ✅ 완전 지원 | ⚠️ 미지원 | 포인트 클라우드, 높이 기반 색상 |
| **E57** | ✅ 자동 변환 | ⚠️ 좌표 의존 | 서버에서 PLY로 자동 변환 |
| **이미지** | ✅ 완전 지원 | - | JPEG, PNG, TIFF (EXIF GPS 추출) |

### 3D 데이터 변환 파이프라인

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   E57 파일   │ ──→ │  PDAL Pipeline   │ ──→ │   PLY (다운샘플) │
└─────────────┘     │  - 좌표계 감지     │     │   + 높이 색상    │
                    │  - 다운샘플링      │     └─────────────────┘
                    │  - 색상 생성       │
                    └──────────────────┘

┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   OBJ 파일   │ ──→ │  WGS84 변환      │ ──→ │    obj2gltf     │ ──→ │   GLB (센터링)  │
│  + MTL/텍스처 │     │  (도→미터 변환)   │     │  + gltf-transform│     │   + tileset.json│
└─────────────┘     └──────────────────┘     └─────────────────┘     └─────────────────┘
```

**OBJ 변환 상세 과정:**
1. **좌표계 감지**: WGS84 (도 단위) / Korea TM (미터 단위) / 로컬 좌표 자동 감지
2. **WGS84 변환**: 경위도(도) → 로컬 미터 좌표로 변환 (중심점 기준)
3. **텍스처 복사**: MTL 파일에서 참조된 텍스처 파일을 Supabase 스토리지에서 검색하여 복사
4. **GLB 생성**: obj2gltf로 변환 (MTL/텍스처 포함), gltf-transform으로 센터링 및 압축
5. **Cesium 가시화**: GLB Entity 직접 로드 (위치 자동, 방향 슬라이더로 수동 조정)

변환 서비스는 Docker 컨테이너(`spatial-converter`)로 실행되며, 파일 업로드 시 자동으로 변환이 시작됩니다.

### 좌표계 지원

| 입력 좌표계 | 감지 방법 | 출력 |
|------------|----------|------|
| **WGS84 (EPSG:4326)** | 경위도 범위 자동 감지 | Cesium 지리 좌표로 직접 사용 |
| **Korea TM (EPSG:5186/5187)** | 미터 단위 범위 감지 | WGS84로 근사 변환 |
| **로컬 좌표계** | 기본값 | Three.js 원점 중심 렌더링 |

**참고**: 현재 E57 파일의 좌표계 감지는 완벽하지 않습니다. WGS84 좌표가 파일에 올바르게 저장되어 있어야 Cesium에서 정확한 위치에 표시됩니다.

## 기술 스택

### Frontend
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Icons**: Lucide React

### 3D Engine
- **CesiumJS** (순수 API): 3D 지구본 캔버스 (Story 워크스페이스 메인 뷰어, OpenStreetMap 타일)
- **Three.js** (react-three-fiber): Assets 페이지 3D 미리보기
- **Leaflet** (react-leaflet): 2D 맵 보조 가시화

### Backend
- **Supabase**: 인증, 데이터베이스, 스토리지
- **PostgreSQL + PostGIS**: 공간 데이터베이스
- **Kong**: API Gateway

### 3D 데이터 변환 서비스 (spatial-converter)
- **PDAL**: E57, LAS, PLY 포인트 클라우드 처리
- **obj2gltf**: OBJ → GLB 변환
- **gltf-transform**: GLB 압축 및 최적화
- **Python/FastAPI**: 변환 API 서버

## 시작하기

### 사전 요구사항
- Docker & Docker Compose (권장)
- 또는 Node.js 18+ / npm

### Docker로 실행 (권장)

```bash
# 저장소 클론
git clone https://github.com/hwiyoung/spatial-log.git
cd spatial-log

# 환경변수 파일 복사 (기본값 사용 가능)
cp .env.example .env

# 전체 서비스 실행 (앱 + Supabase)
docker compose up -d

# 로그 확인
docker compose logs -f

# 종료
docker compose down

# 데이터 포함 전체 삭제
docker compose down -v
```

### 서비스 접속

| 서비스 | URL | 설명 |
|--------|-----|------|
| **앱** | http://localhost:5174 | 프론트엔드 애플리케이션 |
| **Supabase API** | http://localhost:8100 | REST API / Auth |
| **Supabase Studio** | http://localhost:3101 | 데이터베이스 관리 UI |
| **변환 서비스** | http://localhost:8200 | 3D 데이터 변환 API |
| **Email UI** | http://localhost:9005 | 테스트 이메일 확인 (Inbucket) |

## 개발/운영 환경 분리

단일 서버에서 개발 환경과 운영(데모) 환경을 동시에 실행할 수 있습니다.

### 환경 구성

```
┌─────────────────────────────────────────────────────┐
│                    단일 서버                         │
├─────────────────────┬───────────────────────────────┤
│     개발 환경       │        운영(데모) 환경         │
├─────────────────────┼───────────────────────────────┤
│ Frontend: 5174      │ Frontend: 8090                │
│ API: 8100 (직접)    │ API: nginx 프록시 (동일 포트) │
│ Converter: 8200     │ Converter: nginx 프록시       │
│ Studio: 3101        │ (비노출)                       │
│ 데이터: /data/      │ 데이터: /data/prod/           │
└─────────────────────┴───────────────────────────────┘
```

> **운영환경 API 프록시**: 운영환경에서는 nginx가 `/rest/v1/`, `/auth/v1/`, `/storage/v1/`, `/converter/` 경로를 Kong/Converter로 프록시합니다. 프론트엔드와 API가 같은 도메인을 사용하므로, 외부 네트워크에서도 사설 IP 없이 접근 가능하고 CORS 문제가 발생하지 않습니다.

### 운영 환경 실행

```bash
# 1. 운영 환경 변수 파일 생성
cp .env.prod.example .env.prod
# .env.prod 파일을 편집하여 VITE_SUPABASE_ANON_KEY, VITE_CESIUM_ION_TOKEN 등 설정
# (VITE_SUPABASE_URL, VITE_CONVERTER_URL은 설정 불필요 - nginx 프록시 사용)

# 2. 운영 환경 시작
docker compose -f docker-compose.prod.yml --env-file .env.prod -p spatial-log-prod up -d --build

# 3. 상태 확인
docker compose -f docker-compose.prod.yml -p spatial-log-prod ps
```

> **주의**: 운영 환경은 프로젝트명 `-p spatial-log-prod`를 사용합니다. 개발 환경과 프로젝트명이 다르므로 반드시 명시해야 합니다.

### 환경별 접속 URL

| 환경 | 프론트엔드 | API | 변환 서비스 |
|------|-----------|-----|------------|
| **개발** | http://서버IP:5174 | http://서버IP:8100 (직접) | http://서버IP:8200 (직접) |
| **운영** | http://서버IP:8090 또는 도메인 | 같은 도메인/rest/v1/ (nginx 프록시) | 같은 도메인/converter/ (nginx 프록시) |

> **운영환경 참고**: API와 변환 서비스는 프론트엔드와 같은 도메인의 nginx 프록시를 통해 접근됩니다. 별도 포트(8101, 8201)는 내부 통신용으로만 사용됩니다.

### 코드 수정 시 동작

- **개발 환경**: Vite 핫 리로드로 즉시 반영 (소스 코드 마운트)
- **운영 환경**: Docker 이미지로 고정, 재빌드 전까지 변경 없음

```bash
# 운영 환경 업데이트 (재빌드)
docker compose -f docker-compose.prod.yml --env-file .env.prod -p spatial-log-prod up -d --build app
```

> **참고**: `--build app`으로 프론트엔드만 재빌드할 수 있습니다. 전체 재빌드는 `--build`만 사용하세요.

### 운영 환경 빌드 아키텍처

운영 환경은 Docker 멀티스테이지 빌드로 동작합니다:

```
Dockerfile (target: production)
├── Build Stage (node:20-alpine)
│   ├── npm ci (의존성 설치)
│   ├── ARG VITE_SUPABASE_ANON_KEY, VITE_CESIUM_ION_TOKEN (빌드 시 주입)
│   └── npm run build (Vite 프로덕션 빌드)
└── Production Stage (nginx:alpine)
    ├── dist/ → /usr/share/nginx/html
    └── nginx.conf → SPA 라우팅 + API 프록시
```

`VITE_SUPABASE_ANON_KEY`, `VITE_CESIUM_ION_TOKEN`은 `.env.prod`에서 `docker-compose.prod.yml`의 `build.args`를 통해 빌드 시 주입됩니다. `VITE_SUPABASE_URL`과 `VITE_CONVERTER_URL`은 런타임에 `window.location.origin`으로 자동 결정되며, nginx가 API 경로를 프록시합니다.

### 운영 환경 요청 흐름

```
브라우저 (sam.innopam.kr)
  ├─ /                    → nginx → index.html (SPA)
  ├─ /assets/*.js         → nginx → 정적 파일 (1년 캐시)
  ├─ /rest/v1/*           → nginx → Kong:8000 → PostgREST → PostgreSQL
  ├─ /auth/v1/*           → nginx → Kong:8000 → GoTrue (인증)
  ├─ /storage/v1/*        → nginx → Kong:8000 → Storage API (파일)
  └─ /converter/*         → nginx → spatial-converter:8200 (3D 변환)
```

### 데이터 분리

- 개발: `/data/db/`, `/data/storage/`, `/data/converter-output/`
- 운영: `/data/prod/db/`, `/data/prod/storage/`, `/data/prod/converter-output/`

두 환경의 데이터베이스와 파일 저장소는 완전히 분리되어 있습니다.

### 로컬 실행 (Supabase 없이)

Supabase 없이 로컬 스토리지(IndexedDB) 모드로 실행할 수 있습니다:

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (로컬 스토리지 모드)
npm run dev
```

> 환경변수 `VITE_SUPABASE_ANON_KEY`가 설정되지 않으면 자동으로 로컬 스토리지 모드로 동작합니다.

### 프로덕션 빌드

```bash
# Docker 프로덕션 빌드 (ANON_KEY 필수, URL은 nginx 프록시 사용)
docker build --target production \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg VITE_CESIUM_ION_TOKEN=your-cesium-token \
  -t spatial-log:prod .
docker run -p 80:80 spatial-log:prod

# 또는 로컬 빌드 (.env 파일에서 VITE_* 자동 로드)
npm run build
npm run preview
```

> **주의**: Docker 빌드 시 `--build-arg`로 `VITE_SUPABASE_ANON_KEY`를 전달하지 않으면, 앱이 Supabase에 연결하지 못하고 브라우저 localStorage 모드로 동작합니다. `VITE_SUPABASE_URL`과 `VITE_CONVERTER_URL`은 미설정 시 `window.location.origin`을 사용하여 nginx 프록시를 통해 API에 접근합니다.

## 환경변수

`.env` 파일에서 설정합니다:

```bash
# 데이터베이스 비밀번호
POSTGRES_PASSWORD=postgres

# JWT 시크릿 (생성: openssl rand -base64 32)
JWT_SECRET=your-jwt-secret

# Supabase API 키
ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key

# 프론트엔드 환경변수 (네트워크 접속 시 IP 주소로 변경)
VITE_SUPABASE_URL=http://localhost:8100
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CONVERTER_URL=http://localhost:8200
```

> **참고**: Cesium Ion 토큰은 더 이상 필요하지 않습니다. OpenStreetMap 타일을 사용합니다.

### 네트워크 환경 설정

**개발 환경**: 다른 PC에서 접속할 경우 `.env` 파일의 URL을 서버 IP로 변경:

```bash
# 개발 환경: .env
VITE_SUPABASE_URL=http://192.168.x.x:8100
VITE_CONVERTER_URL=http://192.168.x.x:8200
```

**운영 환경**: URL 설정이 필요 없습니다. nginx 프록시를 통해 동일 도메인에서 API에 접근하므로, 도메인이나 IP에 관계없이 자동으로 동작합니다.

```bash
# 운영 환경: .env.prod
# VITE_SUPABASE_URL → 미설정 (window.location.origin + nginx 프록시 사용)
# VITE_CONVERTER_URL → 미설정 (window.location.origin/converter + nginx 프록시 사용)
VITE_SUPABASE_ANON_KEY=your-anon-key  # 필수
VITE_CESIUM_ION_TOKEN=your-token       # 필수
```

> **참고**: 운영 환경은 `.env.prod` 변경 후 반드시 `--build`로 재빌드해야 합니다.

### 파일 업로드 제한

기본 파일 크기 제한은 **5GB** 입니다. 프론트엔드와 백엔드 양쪽에서 제한됩니다:

| 계층 | 파일 | 설정값 |
|------|------|--------|
| **프론트엔드** | `src/components/common/FileUpload.tsx` | `maxSize = 5 * 1024 * 1024 * 1024` |
| **백엔드 (개발)** | `docker-compose.yml` | `FILE_SIZE_LIMIT: 5368709120` |
| **백엔드 (운영)** | `docker-compose.prod.yml` | `FILE_SIZE_LIMIT: 5368709120` |

변경 시 **프론트엔드 + 백엔드 모두 수정** 후 재빌드가 필요합니다.

## 프로젝트 구조

```
spatial-log/
├── public/                     # 정적 에셋
├── src/
│   ├── components/
│   │   ├── common/             # Button, Modal, Card, Input, FileUpload, ErrorBoundary
│   │   ├── layout/             # Sidebar, Header, MainLayout
│   │   ├── viewer/             # ThreeCanvas, ModelViewer, GeoViewer (Assets 미리보기)
│   │   ├── story/              # Story 워크스페이스 (핵심)
│   │   │   ├── StoryWorkspace.tsx          # 전체화면 워크스페이스 (캔버스 + 패널)
│   │   │   ├── CesiumWorkspaceCanvas.tsx   # Cesium 캔버스 (마커, 3D 오브젝트, 드롭)
│   │   │   ├── EntryBalloonPopup.tsx       # 마커 클릭 말풍선 팝업
│   │   │   ├── SceneNavigator.tsx          # 좌측 패널 (Scene 목록 + 에셋 브라우저)
│   │   │   ├── SceneDetailPanel.tsx        # 우측 패널 (Entry 관리 + Scene 메타)
│   │   │   └── SplitViewport.tsx           # 분할 뷰포트
│   │   ├── release/            # Release 발행·뷰어
│   │   │   ├── ReleaseCreateDialog.tsx     # 발행 다이얼로그 (Scene 선택)
│   │   │   └── ReleaseViewer.tsx           # Release 뷰어 (읽기 전용 Cesium)
│   │   ├── project/            # AssetLinkModal (레거시 호환)
│   │   └── admin/              # IntegrityChecker, DevConsole
│   ├── pages/
│   │   ├── Dashboard.tsx       # 대시보드 (최근 Story, 에셋)
│   │   ├── Assets.tsx          # 데이터 관리 + 변환 상태 표시
│   │   ├── StoryList.tsx       # Story 목록
│   │   ├── StoryWorkspacePage.tsx  # Story 워크스페이스 (전체화면)
│   │   ├── PublishList.tsx     # Release 목록
│   │   ├── PublishDetail.tsx   # Release 상세 (뷰어)
│   │   ├── SharedRelease.tsx   # 공유 링크 페이지 (인증 불필요)
│   │   └── Login.tsx           # 로그인 페이지
│   ├── contexts/
│   │   └── AuthContext.tsx     # 인증 컨텍스트
│   ├── lib/
│   │   ├── supabase.ts         # Supabase 클라이언트 (운영: 동적 URL, 개발: 직접 URL)
│   │   └── database.types.ts   # 데이터베이스 타입 정의
│   ├── services/
│   │   ├── api.ts              # API 추상화 레이어 (Supabase/localStorage 자동 전환)
│   │   └── conversionService.ts # 변환 서비스 API 클라이언트
│   ├── stores/
│   │   ├── assetStore.ts       # 파일/폴더 상태 관리 (변환 트리거 포함)
│   │   ├── storyStore.ts       # Story/Scene/Entry 상태 관리
│   │   └── releaseStore.ts     # Release 상태 관리
│   ├── types/
│   │   └── story.ts            # Story/Scene/Entry/Release 타입 정의
│   ├── utils/
│   │   ├── storage.ts          # 로컬 스토리지 (IndexedDB)
│   │   ├── exifParser.ts       # EXIF 메타데이터 파서 (GPS 추출)
│   │   ├── modelLoader.ts      # 3D 모델 로더 (자동 스케일링 포함)
│   │   └── texturePreloader.ts # 텍스처 프리로딩 유틸리티
│   ├── App.tsx                 # 라우팅 + AuthGuard + localStorage 마이그레이션
│   └── main.tsx
├── services/
│   └── spatial-converter/      # 3D 데이터 변환 서비스
│       ├── converter.py        # 변환 로직 (PDAL, obj2gltf)
│       ├── server.py           # FastAPI 서버
│       ├── Dockerfile          # 변환 서비스 컨테이너
│       └── requirements.txt
├── supabase/
│   ├── schema.sql              # 데이터베이스 스키마 (기본)
│   ├── migrations/
│   │   ├── 001_stories_scenes_releases.sql  # Story/Scene/Entry/Release 테이블
│   │   └── 002_entry_type_refactor.sql      # Entry 4종 타입 + Scene 메타 확장
│   └── kong.yml                # API Gateway 설정
├── Dockerfile                  # 프론트엔드 Docker 설정 (멀티스테이지: dev/build/prod)
├── docker-compose.yml          # Docker Compose 개발 환경 (앱 + Supabase + Converter)
├── docker-compose.prod.yml     # Docker Compose 운영 환경 (ANON_KEY, CESIUM_TOKEN build args)
├── .env                        # 개발 환경 변수
├── .env.prod                   # 운영 환경 변수
├── nginx.conf                  # 프로덕션 Nginx 설정 (SPA 라우팅 + API/Converter 프록시)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## 데이터베이스 스키마

### 테이블

| 테이블 | 설명 |
|--------|------|
| `files` | 파일 메타데이터 (GPS, EXIF, 변환 상태, 공간 정보) |
| `folders` | 폴더 계층 구조 |
| `stories` | Story 정보 (title, description, status, tags) |
| `scenes` | Scene 정보 (title, zone_label, summary, sort_order) |
| `scene_entries` | Entry 정보 (entry_type, file_id, gps, title, body, url) |
| `releases` | Release 정보 (version, snapshot JSONB, share_token) |
| `projects` | 프로젝트 정보 (레거시 호환) |
| `annotations` | 3D 어노테이션 (레거시 호환) |
| `integrity_logs` | 무결성 검사 로그 |

### Story 계층 구조

```
stories
  └── scenes (sort_order 정렬)
        └── scene_entries (sort_order 정렬)
              ├── entry_type: spatial | visual | document | note
              ├── file_id → files (spatial/visual/document)
              ├── gps_latitude, gps_longitude (GPS 좌표)
              ├── title, body, url (note 타입용)
              └── spatial_anchor (3D 공간 좌표)
```

### files 테이블 주요 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `conversion_status` | VARCHAR | 'pending', 'converting', 'ready', 'failed' |
| `conversion_progress` | INTEGER | 변환 진행률 (0-100) |
| `converted_path` | TEXT | 변환된 파일 경로 |
| `metadata` | JSONB | 공간 정보 (spatialInfo: epsg, bbox, center, ...) |

### 마이그레이션 파일

| 파일 | 설명 |
|------|------|
| `supabase/schema.sql` | 기본 스키마 (files, folders, projects, annotations) |
| `001_stories_scenes_releases.sql` | Story/Scene/Entry/Release 테이블 생성 |
| `002_entry_type_refactor.sql` | Entry 4종 타입 리팩터링 + Scene zone_label/summary |

### 주요 기능
- **PostGIS 확장**: 공간 쿼리 지원
- **Row Level Security (RLS)**: 사용자별 데이터 격리
- **자동 위치 계산**: GPS 좌표 → Geography 타입 자동 변환
- **Release 스냅샷**: Story 상태를 JSONB로 동결하여 불변 보존
- **변환 상태 추적**: 3D 데이터 변환 진행 상황 저장

## 개발 로드맵

> 상세 로드맵: [docs/ROADMAP.md](docs/ROADMAP.md)

### 완료된 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| 1-8 | 프로젝트 초기화, UI, 3D 뷰어, 데이터 관리, 백엔드 연동 | ✅ 완료 |
| 9 | 3D 데이터 변환 파이프라인 (E57→PLY, OBJ→GLB) | ✅ 완료 |
| 10 | 3D 어노테이션 (레이캐스팅, 카메라 이동) | ✅ 완료 |
| v2 | **3축 아키텍처** (Assets/Story/Publish) 전환 | ✅ 완료 |
| v2.1 | **표현 체계 재설계** (4종 Entry, 항상 Cesium, 말풍선 팝업) | ✅ 완료 |
| - | 인증 시스템, 개발/운영 환경 분리, CI/CD | ✅ 완료 |

### 향후 계획

| Phase | 영역 | 우선순위 |
|-------|------|---------|
| 3D Tiles 확장 | GLTF/GLB/PLY/LAS → 3D Tiles 변환 | High |
| 사용자 경험 | 좌표 검증 UI, 변환 진행률, 반응형 | Medium |
| 성능 최적화 | 대용량 변환, Web Worker, 텍스처 LOD | Medium |
| 서버 인프라 | 리소스 튜닝, 백업, 모니터링 | High |

## 알려진 제한사항

| 기능 | 제한사항 | 해결 방법 |
|------|----------|----------|
| **E57 좌표계** | 파일에 올바른 WGS84 좌표가 저장되어 있어야 함 | 좌표계가 불명확한 경우 로컬 좌표로 처리 |
| **파일 크기** | 5GB 이상 파일 업로드 불가 | docker-compose.yml FILE_SIZE_LIMIT 변경 |
| **OBJ 관련 파일** | OBJ+MTL+텍스처를 각각 별도 업로드 | 동시 업로드 필요 |
| **GPS 미지정 Entry** | Cesium 마커 미표시, 패널 목록에만 존재 | "위치 지정" 버튼으로 지도 클릭 GPS 지정 |
| **변환 시간** | 대용량 E57 변환에 수 분 소요 | 진행률 표시로 UX 개선 |

## 유지보수

### 고아 파일 정리

OBJ 파일과 연관 파일(MTL, 텍스처) 삭제 시 일부 DB 레코드가 남을 수 있습니다. 정기적으로 정리가 필요합니다.

**방법 1: UI에서 정리**
1. **Assets** 페이지 이동
2. **관리** 탭 클릭
3. **검사 실행** 버튼 클릭
4. 고아 DB 레코드/Storage 파일 확인
5. **모두 삭제** 버튼으로 정리

**방법 2: SQL로 직접 정리**
```sql
-- 고아 DB 레코드 확인 (Storage에 파일 없는 레코드)
SELECT id, name, storage_path FROM files
WHERE storage_path NOT IN (SELECT name FROM storage.objects WHERE bucket_id = 'spatial-files');

-- 고아 레코드 삭제
DELETE FROM files WHERE id IN (
  SELECT id FROM files
  WHERE storage_path NOT IN (SELECT name FROM storage.objects WHERE bucket_id = 'spatial-files')
);
```

### integrity_logs 테이블 생성

무결성 검사 로그를 저장하려면 테이블이 필요합니다. Docker 재시작 시 자동 생성되지만, 수동으로 생성하려면:

```sql
CREATE TABLE IF NOT EXISTS public.integrity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  orphaned_records INTEGER DEFAULT 0,
  orphaned_files INTEGER DEFAULT 0,
  valid_files INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 화면 구성

### 대시보드 (`/`)
- 최근 Story 목록
- 최근 업로드 에셋
- 3D 뷰어 미리보기 (파일 클릭 시)

### 데이터 보관함 (`/assets`)
- 폴더 트리 네비게이션
- 파일 그리드/리스트 뷰
- 드래그 앤 드롭 업로드
- 3D 변환 상태 표시

### Story 목록 (`/story`)
- Story 카드 그리드 (제목, 설명, 상태, 태그)
- Story 생성/편집/삭제

### Story 워크스페이스 (`/story/:storyId`, 전체화면)
- **좌측 패널** (SceneNavigator): Scene 목록 + 에셋 브라우저 (드래그 지원)
- **중앙 캔버스** (CesiumWorkspaceCanvas): 항상 Cesium 지구본
  - 타입별 색상 마커 (spatial=blue, visual=green, document=purple, note=amber)
  - spatial Entry: 3D 오브젝트 로드 + 마커
  - 마커 클릭 → 말풍선 팝업 (EntryBalloonPopup)
  - 에셋 드래그&드롭 → 드롭 위치 GPS로 Entry 생성
  - "위치에 추가" → 지도 클릭 → Entry 생성 다이얼로그
- **우측 패널** (SceneDetailPanel): Scene 메타 편집, Entry CRUD, GPS 상태

### 발행 목록 (`/publish`)
- Release 카드 그리드 (버전, 라벨, Scene/Entry 수)
- Release 생성 다이얼로그 (Scene 선택 발행)

### Release 상세 (`/publish/:releaseId`)
- 읽기 전용 Cesium 뷰어 + 마커 + 말풍선 팝업
- Scene/Entry 네비게이션

### 공유 페이지 (`/shared/:token`, 인증 불필요)
- 공유 링크로 Release 열람

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
