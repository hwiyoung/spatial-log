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

| 포맷 | 지원 상태 | 비고 |
|------|----------|------|
| **GLTF/GLB** | ✅ 완전 지원 | 권장 포맷 |
| **OBJ** | ✅ 완전 지원 | Z-up → Y-up 자동 변환 |
| **FBX** | ✅ 완전 지원 | 스케일 자동 조정 |
| **PLY** | ✅ 완전 지원 | 메시/포인트 클라우드 자동 감지 |
| **LAS** | ✅ 완전 지원 | 포인트 클라우드, 높이 기반 색상 |
| **E57** | ❌ 미지원 | 업로드 가능, 가시화 불가 → **CloudCompare로 PLY/LAS 변환 필수** |
| **이미지** | ✅ 완전 지원 | JPEG, PNG, TIFF (EXIF GPS 추출) |

### E57 파일 참고사항
E57 포맷은 압축된 바이너리 데이터(Huffman, CRC32)를 포함하여 **웹 브라우저에서 가시화가 불가능**합니다.
현재 상태: 업로드는 가능하나 3D 미리보기 시 에러 발생 ("maximum call stack size exceeded")

**해결 방법**:
1. [CloudCompare](https://www.cloudcompare.org/) 다운로드 (무료)
2. E57 파일 열기 → File → Save As → **PLY** 또는 **LAS** 선택
3. 변환된 파일 업로드

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
| **Email UI** | http://localhost:9005 | 테스트 이메일 확인 (Inbucket) |

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
│   │   ├── common/             # Button, Modal, Card, Input
│   │   ├── layout/             # Sidebar, Header, MainLayout
│   │   ├── viewer/             # Viewer3D, ThreeCanvas, MapView
│   │   ├── dashboard/          # ProjectCard, AssetCard
│   │   ├── project/            # AssetLinkModal
│   │   └── annotation/         # AnnotationModal, AnnotationMapView, AnnotationMapView3D
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectDetail.tsx   # 프로젝트 상세 (에셋, 어노테이션, 3D 뷰어)
│   │   ├── Assets.tsx
│   │   └── Annotations.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Supabase 클라이언트
│   │   └── database.types.ts   # 데이터베이스 타입 정의
│   ├── services/
│   │   └── api.ts              # API 추상화 레이어
│   ├── hooks/                  # 커스텀 훅
│   ├── stores/                 # Zustand 스토어
│   ├── types/                  # TypeScript 타입 정의
│   ├── utils/
│   │   ├── storage.ts          # 로컬 스토리지 (IndexedDB)
│   │   ├── exifParser.ts       # EXIF 메타데이터 파서
│   │   └── modelLoader.ts      # 3D 모델 로더 (GLTF, OBJ, FBX, PLY, LAS, E57)
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── schema.sql              # 데이터베이스 스키마
│   └── kong.yml                # API Gateway 설정
├── Dockerfile                  # Docker 설정 (dev/prod)
├── docker-compose.yml          # Docker Compose (앱 + Supabase)
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
| `files` | 파일 메타데이터 (GPS, EXIF, project_id 포함) |
| `annotations` | 3D 어노테이션 |

### 주요 기능
- **PostGIS 확장**: 공간 쿼리 지원
- **Row Level Security (RLS)**: 사용자별 데이터 격리
- **자동 위치 계산**: GPS 좌표 → Geography 타입 자동 변환
- **프로젝트-에셋 연결**: files.project_id 외래키

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
- [ ] **E57 가시화 (파싱 에러 - 변환 필요)**
- [x] OBJ Z-up → Y-up 좌표계 자동 변환
- [x] WebGL 컨텍스트 손실 복구 처리 (타임아웃 기반 에러 표시)

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

## 알려진 제한사항 및 TODO

### 🔴 해결 필요 (Critical)

| 기능 | 증상 | 원인 분석 | TODO |
|------|------|----------|------|
| **E57 가시화** | "maximum call stack size exceeded" 에러 발생 | 샘플링 파서의 재귀/반복 로직 문제 또는 메모리 초과 | libE57 WebAssembly 포팅 검토 또는 서버사이드 변환 |
| **OBJ 텍스처 로딩 성능** | OBJ+MTL+텍스처 미리보기 시 텍스처 가시화가 매우 느림 (5MB 파일 30초+) | Three.js MTLLoader의 텍스처 로딩이 렌더링 시점에 동기적으로 발생, blob URL 매핑 오버헤드 | 텍스처 프리로딩 비동기 처리, Worker 기반 로딩 검토 |

### 🟢 해결 완료 (Resolved)

| 기능 | 증상 | 해결 방법 |
|------|------|----------|
| **어노테이션 맵 휠 줌** | 맵 콘텐츠가 아닌 패널 전체가 줌됨 | Leaflet 라이브러리 도입으로 해결 |
| **Resium React 18 호환** | `recentlyCreatedOwnerStacks` 에러 | Resium 제거, CesiumJS 순수 API로 교체 |
| **Cesium Ion 토큰 만료** | 401 Unauthorized 에러 | OpenStreetMap 타일로 교체 (토큰 불필요) |
| **대시보드 미리보기 401** | Supabase Storage signed URL 에러 | Blob URL 직접 다운로드 방식으로 변경 |
| **WebGL 컨텍스트 손실** | 정상 동작에도 에러 표시 | 타임아웃 기반 에러 표시, 모델 로드 성공 시 숨김 |

### 🟡 제한사항 (Known Limitations)

| 기능 | 제한사항 | 해결 방법 |
|------|----------|----------|
| E57 포맷 | 압축된 E57 파일은 웹에서 파싱 불가 | **CloudCompare로 PLY/LAS 변환 후 업로드** |
| 파일 크기 | 1GB 이상 파일 업로드 불가 | 파일 분할 또는 docker-compose.yml FILE_SIZE_LIMIT 변경 |
| OBJ 관련 파일 | OBJ+MTL+텍스처 업로드 시 각각 별도 DB 레코드로 저장됨 | 정상 동작, 관리 탭에서 실제보다 많은 파일 수 표시됨 |
| 고아 파일 발생 | OBJ 삭제 시 연관 파일(MTL, 텍스처) DB 레코드가 남을 수 있음 | **Assets > 관리 탭 > 무결성 검사 > "모두 삭제" 클릭** |
| 파일 수 불일치 | DB 레코드 수와 Storage 파일 수가 다를 수 있음 | 무결성 검사로 고아 레코드/파일 확인 및 정리 |

### 향후 개선 방향

1. **E57 지원 개선**
   - 옵션 1: 서버사이드에서 PDAL/CloudCompare로 자동 변환
   - 옵션 2: libE57Format을 WebAssembly로 컴파일하여 브라우저에서 직접 파싱
   - 옵션 3: E57 업로드 시 변환 안내 UI 개선

2. **OBJ 로딩 성능 개선**
   - Web Worker 기반 텍스처 프리로딩
   - 텍스처 캐싱 시스템 도입
   - 저해상도 프록시 텍스처 사용 (LOD)

3. **파일 관리 개선**
   - OBJ+MTL+텍스처를 단일 에셋으로 그룹화하여 표시
   - 연관 파일 cascade 삭제 안정성 강화
   - 자동 고아 파일 정리 스케줄러

4. **3D 어노테이션 완성**
   - ThreeCanvas 전체 씬 레이캐스팅 (모델 표면 클릭)
   - 포인트 클라우드 클릭 지원 (raycaster.params.Points.threshold)
   - CameraController: 어노테이션 선택 시 카메라 자동 이동
   - AnnotationMarker3D: 3D 공간 마커 렌더링

5. **클라우드 배포**
   - Supabase 클라우드 프로젝트 생성
   - 환경변수 업데이트
   - 스토리지 버킷 설정

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
