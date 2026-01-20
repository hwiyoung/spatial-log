# Spatial Log

3D 모델, 3D 스캔, 드론 이미지, 스마트폰 이미지 등 다양한 공간 데이터를 업로드, 가시화, 관리하고 어노테이션을 작성할 수 있는 **3D 공간정보 플랫폼**입니다.

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **데이터 관리** | 폴더 기반 파일 업로드, 정리, 검색 |
| **3D 가시화** | Three.js + CesiumJS 하이브리드 뷰어 |
| **프로젝트 관리** | 데이터셋 그룹화 및 협업 |
| **어노테이션** | 3D 좌표 기반 이슈 트래킹 |

## 지원 데이터

- **드론 매핑**: Orthomosaic, DSM, 3D 모델
- **3D 스캔**: 포인트 클라우드 (LAS, PLY, E57)
- **3D 모델**: OBJ, FBX, GLTF/GLB
- **이미지**: 드론/스마트폰 촬영 이미지 (EXIF GPS 지원)

## 기술 스택

### Frontend
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Icons**: Lucide React

### 3D Engine
- **Three.js** (react-three-fiber): 일반 3D 모델 렌더링
- **CesiumJS** (Resium): 지리공간 데이터 가시화

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

# 프론트엔드 환경변수
VITE_SUPABASE_URL=http://localhost:8100
VITE_SUPABASE_ANON_KEY=your-anon-key

# Cesium Ion 토큰 (선택사항 - 3D 지형용)
VITE_CESIUM_ION_TOKEN=your-cesium-token
```

## 프로젝트 구조

```
spatial-log/
├── public/                     # 정적 에셋
├── src/
│   ├── components/
│   │   ├── common/             # Button, Modal, Card, Input
│   │   ├── layout/             # Sidebar, Header, MainLayout
│   │   ├── viewer/             # Viewer3D, ViewerToolbar
│   │   └── dashboard/          # ProjectCard, AssetCard
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
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
│   │   └── exifParser.ts       # EXIF 메타데이터 파서
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
| `files` | 파일 메타데이터 (GPS, EXIF 포함) |
| `annotations` | 3D 어노테이션 |

### 주요 기능
- **PostGIS 확장**: 공간 쿼리 지원
- **Row Level Security (RLS)**: 사용자별 데이터 격리
- **자동 위치 계산**: GPS 좌표 → Geography 타입 자동 변환

## 개발 로드맵

### Phase 1: 프로젝트 초기화
- [x] UI 프로토타입 (3DPlatformUI.jsx)
- [x] Vite + React + TypeScript 프로젝트 구성
- [x] Tailwind CSS 설정
- [x] ESLint + Prettier 설정
- [x] Docker 환경 구성

### Phase 2: UI 컴포넌트 분리
- [x] 레이아웃 컴포넌트 (Sidebar, Header, MainLayout)
- [x] 공통 컴포넌트 (Button, Modal, Card, Input)
- [x] 페이지 라우팅 (React Router v6)
- [x] 다크 테마 시스템

### Phase 3: 페이지 구현
- [x] Dashboard 페이지
- [x] Projects 페이지
- [x] Assets 페이지
- [x] Annotations 페이지

### Phase 4: 3D 뷰어 통합
- [x] react-three-fiber 통합 (3D 모델)
- [x] Resium 통합 (지리공간 데이터)
- [x] 뷰어 모드 전환 (Grid/Map)
- [x] 파일 포맷 지원 (OBJ, FBX, PLY, LAS, GLTF)

### Phase 5: 데이터 관리
- [x] 파일 업로드 (드래그 앤 드롭)
- [x] 폴더 구조 CRUD
- [x] 파일 메타데이터 관리
- [x] 클라이언트 스토리지 (IndexedDB)
- [x] EXIF/GPS 메타데이터 추출

### Phase 6: 프로젝트 시스템
- [ ] 프로젝트 CRUD
- [ ] 에셋 연결 및 관리
- [ ] 프로젝트 설정

### Phase 7: 어노테이션 시스템
- [ ] 3D 좌표 기반 마커 생성
- [ ] 이슈 CRUD (제목, 설명, 우선순위, 상태)
- [ ] 마커-뷰어 연동
- [ ] 필터링 및 검색

### Phase 8: 백엔드 연동
- [x] Supabase 로컬 환경 구성
- [x] 데이터베이스 스키마 설계 (PostgreSQL + PostGIS)
- [x] API 추상화 레이어 (Supabase/로컬 스토리지)
- [x] 사용자 인증 (Supabase Auth)
- [x] 파일 스토리지 (Supabase Storage)
- [ ] 클라우드 Supabase 배포

## 화면 구성

### 대시보드
- 최근 프로젝트 목록
- 최근 업로드 데이터
- 3D 뷰어 미리보기

### 프로젝트
- 프로젝트 카드 그리드
- 프로젝트 생성/편집
- 팀원 관리

### 데이터 보관함
- 폴더 트리 네비게이션
- 파일 그리드/리스트 뷰
- 드래그 앤 드롭 업로드

### 어노테이션
- 이슈 목록 (필터링, 정렬)
- 분포 맵 시각화
- 이슈 상세 패널

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
