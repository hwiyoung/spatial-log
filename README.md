# Spatial Log

3D 모델, 3D 스캔, 드론 이미지, 스마트폰 이미지 등 다양한 공간 데이터를 업로드, 가시화, 관리하고 어노테이션을 작성할 수 있는 **3D 공간정보 플랫폼**입니다.

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **데이터 관리** | 폴더 기반 파일 업로드, 정리, 검색 |
| **3D 가시화** | Three.js + CesiumJS 하이브리드 뷰어 |
| **프로젝트 관리** | 데이터셋 그룹화, 에셋 연결, 협업 |
| **어노테이션** | 2D/3D 맵 기반 이슈 트래킹 |

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
- **Three.js** (react-three-fiber): 일반 3D 모델 렌더링
- **CesiumJS** (순수 API): 3D 지구본 가시화 (OpenStreetMap 타일)
- **Leaflet** (react-leaflet): 2D 맵 가시화

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
│ API: 8100           │ API: 8101                     │
│ Converter: 8200     │ Converter: 8201               │
│ Studio: 3101        │ (비노출)                       │
│ 데이터: /data/      │ 데이터: /data/prod/           │
└─────────────────────┴───────────────────────────────┘
```

### 운영 환경 실행

```bash
# 1. 운영 환경 변수 파일 생성
cp .env.prod.example .env.prod
# .env.prod 파일을 편집하여 SITE_URL 등 설정

# 2. 운영 환경 시작
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 3. 상태 확인
docker compose -f docker-compose.prod.yml ps
```

### 환경별 접속 URL

| 환경 | 프론트엔드 | API | 변환 서비스 |
|------|-----------|-----|------------|
| **개발** | http://서버IP:5174 | http://서버IP:8100 | http://서버IP:8200 |
| **운영** | http://서버IP:8090 | http://서버IP:8101 | http://서버IP:8201 |

### 코드 수정 시 동작

- **개발 환경**: Vite 핫 리로드로 즉시 반영
- **운영 환경**: Docker 이미지로 고정, 재빌드 전까지 변경 없음

```bash
# 운영 환경 업데이트 (재빌드)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
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

> 환경변수 `VITE_SUPABASE_URL`이 설정되지 않으면 자동으로 로컬 스토리지 모드로 동작합니다.

### 프로덕션 빌드

```bash
# Docker 프로덕션 빌드
docker build --target production -t spatial-log:prod .
docker run -p 80:80 spatial-log:prod

# 또는 로컬 빌드
npm run build
npm run preview
```

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

다른 PC에서 접속할 경우 `.env`와 `docker-compose.yml`의 URL을 서버 IP로 변경:

```bash
# .env
VITE_SUPABASE_URL=http://192.168.x.x:8100

# docker-compose.yml의 app 서비스
environment:
  - VITE_SUPABASE_URL=http://192.168.x.x:8100
```

### 파일 업로드 제한

기본 파일 크기 제한은 **1GB** 입니다. 변경하려면 `docker-compose.yml`:

```yaml
storage:
  environment:
    FILE_SIZE_LIMIT: 1073741824  # 바이트 단위 (1GB)
```

## 프로젝트 구조

```
spatial-log/
├── public/                     # 정적 에셋
├── src/
│   ├── components/
│   │   ├── common/             # Button, Modal, Card, Input, ConversionStatus
│   │   ├── layout/             # Sidebar, Header, MainLayout
│   │   ├── viewer/             # ThreeCanvas, ModelViewer, GeoViewer
│   │   ├── dashboard/          # ProjectCard, AssetCard
│   │   ├── project/            # AssetLinkModal
│   │   ├── annotation/         # AnnotationModal, AnnotationMapView
│   │   └── admin/              # IntegrityChecker, DevConsole
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectDetail.tsx   # 프로젝트 상세 (에셋, 어노테이션, 3D 뷰어)
│   │   ├── Assets.tsx          # 데이터 관리 + 변환 상태 표시
│   │   └── Annotations.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Supabase 클라이언트
│   │   └── database.types.ts   # 데이터베이스 타입 정의
│   ├── services/
│   │   ├── api.ts              # API 추상화 레이어
│   │   └── conversionService.ts # 변환 서비스 API 클라이언트
│   ├── hooks/                  # 커스텀 훅
│   ├── stores/
│   │   └── assetStore.ts       # 파일/폴더 상태 관리 (변환 트리거 포함)
│   ├── types/                  # TypeScript 타입 정의
│   ├── utils/
│   │   ├── storage.ts          # 로컬 스토리지 (IndexedDB)
│   │   ├── exifParser.ts       # EXIF 메타데이터 파서
│   │   ├── modelLoader.ts      # 3D 모델 로더 (자동 스케일링 포함)
│   │   └── texturePreloader.ts # 텍스처 프리로딩 유틸리티
│   ├── App.tsx
│   └── main.tsx
├── services/
│   └── spatial-converter/      # 3D 데이터 변환 서비스
│       ├── converter.py        # 변환 로직 (PDAL, obj2gltf)
│       ├── server.py           # FastAPI 서버
│       ├── Dockerfile          # 변환 서비스 컨테이너
│       └── requirements.txt
├── supabase/
│   ├── schema.sql              # 데이터베이스 스키마 (변환 상태 컬럼 포함)
│   └── kong.yml                # API Gateway 설정
├── Dockerfile                  # 프론트엔드 Docker 설정
├── docker-compose.yml          # Docker Compose (앱 + Supabase + Converter)
├── nginx.conf                  # 프로덕션 Nginx 설정
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## 데이터베이스 스키마

### 테이블

| 테이블 | 설명 |
|--------|------|
| `projects` | 프로젝트 정보 |
| `folders` | 폴더 계층 구조 |
| `files` | 파일 메타데이터 (GPS, EXIF, 변환 상태, 공간 정보 포함) |
| `annotations` | 3D 어노테이션 |
| `integrity_logs` | 무결성 검사 로그 |

### files 테이블 주요 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `conversion_status` | VARCHAR | 'pending', 'converting', 'ready', 'failed' |
| `conversion_progress` | INTEGER | 변환 진행률 (0-100) |
| `converted_path` | TEXT | 변환된 파일 경로 |
| `metadata` | JSONB | 공간 정보 (spatialInfo: epsg, bbox, center, ...) |

### 주요 기능
- **PostGIS 확장**: 공간 쿼리 지원
- **Row Level Security (RLS)**: 사용자별 데이터 격리
- **자동 위치 계산**: GPS 좌표 → Geography 타입 자동 변환
- **프로젝트-에셋 연결**: files.project_id 외래키
- **변환 상태 추적**: 3D 데이터 변환 진행 상황 저장

## 개발 로드맵

### Phase 1: 프로젝트 초기화 ✅
- [x] UI 프로토타입 (3DPlatformUI.jsx)
- [x] Vite + React + TypeScript 프로젝트 구성
- [x] Tailwind CSS 설정
- [x] ESLint + Prettier 설정
- [x] Docker 환경 구성

### Phase 2: UI 컴포넌트 분리 ✅
- [x] 레이아웃 컴포넌트 (Sidebar, Header, MainLayout)
- [x] 공통 컴포넌트 (Button, Modal, Card, Input)
- [x] 페이지 라우팅 (React Router v6)
- [x] 다크 테마 시스템

### Phase 3: 페이지 구현 ✅
- [x] Dashboard 페이지
- [x] Projects 페이지
- [x] Assets 페이지
- [x] Annotations 페이지

### Phase 4: 3D 뷰어 통합 ✅
- [x] react-three-fiber 통합 (3D 모델)
- [x] CesiumJS 순수 API 통합 (지리공간 데이터, React 18 호환)
- [x] 뷰어 모드 전환 (Grid/Map)
- [x] 파일 포맷 지원 (GLTF, GLB, OBJ, FBX, PLY, LAS)
- [x] **E57 서버 사이드 변환 (PLY)** - 브라우저 파싱 대신 PDAL 사용
- [x] OBJ Z-up → Y-up 좌표계 자동 변환
- [x] WebGL 컨텍스트 손실 복구 처리 (타임아웃 기반 에러 표시)
- [x] WGS84 좌표 모델 자동 스케일링 (Three.js)

### Phase 5: 데이터 관리 ✅
- [x] 파일 업로드 (드래그 앤 드롭)
- [x] 대용량 파일 지원 (최대 1GB)
- [x] 폴더 구조 CRUD
- [x] 파일 메타데이터 관리
- [x] 클라이언트 스토리지 (IndexedDB)
- [x] EXIF/GPS 메타데이터 추출

### Phase 6: 프로젝트 시스템 ✅
- [x] 프로젝트 CRUD
- [x] 프로젝트 목록/그리드 뷰
- [x] 에셋-프로젝트 연결 (AssetLinkModal)
- [x] 프로젝트 상세 페이지 (ProjectDetail.tsx)
- [x] 프로젝트 내 3D 뷰어 통합
- [x] 에셋 연결/해제 기능

### Phase 7: 어노테이션 시스템 ✅
- [x] 이슈 CRUD (제목, 설명, 우선순위, 상태)
- [x] 분포 맵 시각화
- [x] 필터링 및 검색
- [x] 맵에서 클릭으로 위치 지정
- [x] 맵 드래그 이동
- [x] **맵 휠 줌 (Leaflet 기반 2D 맵)**
- [x] **2D/3D 맵 토글 (Leaflet + CesiumJS)**
- [ ] 3D 좌표 기반 마커 생성 (ThreeCanvas 레이캐스팅)
- [ ] 마커-뷰어 연동 (CameraController)

### Phase 8: 백엔드 연동 ✅
- [x] Supabase 로컬 환경 구성 (Docker Compose)
- [x] 데이터베이스 스키마 설계 (PostgreSQL + PostGIS)
- [x] API 추상화 레이어 (Supabase/로컬 스토리지 자동 전환)
- [x] 사용자 인증 (Supabase Auth, 자동 확인)
- [x] 파일 스토리지 (Supabase Storage, 1GB 지원)
- [x] RLS 정책 설정 (개발 환경에서는 비활성화)
- [ ] 클라우드 Supabase 배포

### Phase 9: 3D 데이터 변환 파이프라인 ✅
- [x] 변환 서비스 Docker 컨테이너 구축 (PDAL + Node.js)
- [x] E57 → PLY 변환 (PDAL, 다운샘플링, 높이 기반 색상)
- [x] OBJ → GLB 변환 (obj2gltf + gltf-transform 압축)
- [x] OBJ 텍스처 복사 (Supabase 스토리지 파일명 매칭)
- [x] WGS84 좌표 변환 (경위도 → 로컬 미터)
- [x] 좌표계 자동 감지 (WGS84, Korea TM, 로컬)
- [x] 변환 상태 DB 저장 및 프론트엔드 표시
- [x] GLB Entity 직접 로드 + 방향 조정 슬라이더
- [x] 변환 완료 시 자동 미리보기 지원

### Phase 10: 3D 어노테이션 완성 ✅
- [x] 모델 표면 클릭 마커 생성 (SceneRaycaster 연결)
- [x] 포인트 클라우드 클릭 지원 (raycaster threshold 조정)
- [x] 어노테이션 선택 시 카메라 자동 이동 (CameraFlyTo)
- [x] 마커 호버 프리뷰 및 선택 하이라이트

### Phase 11: 3D Tiles 확장 📋
- [ ] GLTF/GLB → 3D Tiles 변환 (gltf-transform 바운딩 박스)
- [ ] FBX → 3D Tiles 변환 (Assimp/Blender CLI)
- [ ] PLY/LAS → 3D Tiles 포인트 클라우드 (pnts 형식)
- [ ] 좌표계 선택 UI (EPSG 코드 검색/선택)

### Phase 12: 사용자 경험 개선 📋
- [ ] 좌표 검증 UI (지도에서 위치 확인 및 수정)
- [ ] 변환 진행률 개선 (단계별 상태, 취소 기능)
- [ ] 에러 메시지 개선 (해결 방법 제안)
- [ ] 반응형 UI (모바일/태블릿 지원)

### Phase 13: 성능 최적화 📋
- [ ] 대용량 파일 변환 최적화 (PDAL 스트리밍)
- [ ] 청크 기반 처리 (분할 업로드, 재시작 가능)
- [ ] Web Worker 백그라운드 처리
- [ ] 텍스처 LOD (점진적 고해상도 로드)

### Phase 14: 인증 시스템 완성 📋
- [ ] RLS 정책 활성화 및 테스트
- [ ] 로그인/회원가입 UI 구현
- [ ] 소셜 로그인 (Google, GitHub)
- [ ] 프로젝트 공유 및 권한 관리

### Phase 15: 클라우드 배포 📋
- [ ] Supabase 클라우드 연동
- [ ] 변환 서비스 클라우드 배포 (Cloud Run / Lambda)
- [ ] CI/CD 파이프라인 구축
- [ ] 모니터링 및 에러 추적 (Sentry)

## 알려진 제한사항 및 TODO

### 🟢 해결 완료 (Resolved)

| 기능 | 증상 | 해결 방법 |
|------|------|----------|
| **E57 가시화** | "maximum call stack size exceeded" 에러 | 서버사이드 PDAL 변환 (E57 → PLY) |
| **OBJ Cesium 가시화** | 지리 좌표에 모델 미표시 | GLB Entity 직접 로드 (3D Tiles보다 간단) |
| **OBJ 모델 방향** | Cesium에서 모델 방향이 맞지 않음 | 방향 조정 슬라이더 (0-360°) 추가 |
| **WGS84 좌표 모델** | Three.js에서 매우 작게 렌더링 | 자동 스케일링 로직 추가 |
| **어노테이션 맵 휠 줌** | 맵 콘텐츠가 아닌 패널 전체가 줌됨 | Leaflet 라이브러리 도입 |
| **Resium React 18 호환** | `recentlyCreatedOwnerStacks` 에러 | CesiumJS 순수 API로 교체 |
| **Cesium Ion 토큰 만료** | 401 Unauthorized 에러 | OpenStreetMap 타일 사용 |
| **WebGL 컨텍스트 손실** | 정상 동작에도 에러 표시 | 타임아웃 기반 에러 표시 |

### 🟡 부분 해결 / 테스트 필요 (Partial)

| 기능 | 현재 상태 | 테스트 필요 사항 |
|------|----------|-----------------|
| **E57 좌표 추출** | 좌표계 자동 감지 구현 | 다양한 E57 파일로 검증 필요 (일부 파일에서 좌표 오류) |
| **OBJ Three.js 미리보기** | GLB 변환 + 자동 스케일링 | WGS84 좌표 OBJ 파일 테스트 필요 |
| **OBJ Cesium 가시화** | GLB Entity 직접 로드, 방향 조정 슬라이더 | 위치/방향 정확도 검증 필요 |
| **OBJ 텍스처** | Supabase 스토리지 파일명 매칭 수정 | OBJ+MTL+텍스처 재업로드 후 변환 테스트 필요 |
| **텍스처 프리로딩** | 프리로딩 유틸리티 구현 | OBJ+MTL+텍스처 로딩 성능 측정 필요 |

### 🔴 미해결 (TODO)

| 기능 | 설명 | 우선순위 |
|------|------|---------|
| **다른 포맷 지리 가시화** | GLTF, GLB, FBX, PLY, LAS의 Cesium 지원 | Medium |
| **포인트 클라우드 3D Tiles** | PLY/LAS → 3D Tiles 변환 (pnts 형식) | Medium |
| **E57 좌표 신뢰도** | 비표준 좌표계 E57 파일 처리 개선 | Low |
| **대용량 파일 처리** | 500MB+ 파일 변환 최적화 | Low |

### 🟠 제한사항 (Known Limitations)

| 기능 | 제한사항 | 해결 방법 |
|------|----------|----------|
| **E57 좌표계** | 파일에 올바른 WGS84 좌표가 저장되어 있어야 함 | 좌표계가 불명확한 경우 로컬 좌표로 처리 |
| **파일 크기** | 1GB 이상 파일 업로드 불가 | docker-compose.yml FILE_SIZE_LIMIT 변경 |
| **OBJ 관련 파일** | 각각 별도 DB 레코드로 저장 | 정상 동작, 자동 그룹핑 예정 |
| **고아 파일** | OBJ 삭제 시 MTL/텍스처 레코드가 남을 수 있음 | **Assets > 관리 탭 > 무결성 검사** |
| **변환 시간** | 대용량 E57 변환에 수 분 소요 | 진행률 표시로 UX 개선 |

### 향후 개선 방향

상세 계획은 **Phase 10-15**를 참조하세요.

| Phase | 영역 | 우선순위 |
|-------|------|---------|
| **10** | 3D 어노테이션 완성 | High |
| **11** | 3D Tiles 확장 | High |
| **12** | 사용자 경험 개선 | Medium |
| **13** | 성능 최적화 | Medium |
| **14** | 인증 시스템 완성 | High (Production) |
| **15** | 클라우드 배포 | High (Production) |

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

### 대시보드
- 최근 프로젝트 목록
- 최근 업로드 데이터
- 3D 뷰어 미리보기 (파일 클릭 시)

### 프로젝트
- 프로젝트 카드 그리드
- 프로젝트 생성/편집
- 프로젝트 상세 페이지
  - 에셋 탭: 연결된 파일 목록, 파일 추가/연결 해제
  - 어노테이션 탭: 프로젝트 관련 어노테이션
  - 3D 뷰어 탭: 선택한 에셋 3D 미리보기

### 데이터 보관함
- 폴더 트리 네비게이션
- 파일 그리드/리스트 뷰
- 드래그 앤 드롭 업로드

### 어노테이션
- 이슈 목록 (필터링, 정렬)
- 2D/3D 맵 토글
  - 2D 맵: Leaflet 기반 (휠 줌 지원)
  - 3D 맵: CesiumJS 기반 지구본
- 이슈 상세 패널

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
