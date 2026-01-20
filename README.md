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
- **이미지**: 드론/스마트폰 촬영 이미지

## 기술 스택

### Frontend
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Icons**: Lucide React

### 3D Engine
- **Three.js** (react-three-fiber): 일반 3D 모델 렌더링
- **CesiumJS** (Resium): 지리공간 데이터 가시화

### Backend (예정)
- TBD (Node.js/FastAPI + PostgreSQL/PostGIS)

## 시작하기

### 사전 요구사항
- Docker & Docker Compose (권장)
- 또는 Node.js 18+ / npm

### Docker로 실행 (권장)

```bash
# 저장소 클론
git clone https://github.com/hwiyoung/spatial-log.git
cd spatial-log

# 개발 서버 실행
docker compose up

# 백그라운드 실행
docker compose up -d

# 종료
docker compose down
```

브라우저에서 http://localhost:5174 접속

### 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 프로덕션 빌드

```bash
# Docker 프로덕션 빌드
docker build --target production -t spatial-log:prod .
docker run -p 80:80 spatial-log:prod

# 또는 로컬 빌드
npm run build
npm run preview
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
│   ├── data/                   # Mock 데이터
│   ├── hooks/                  # 커스텀 훅
│   ├── stores/                 # Zustand 스토어
│   ├── types/                  # TypeScript 타입 정의
│   ├── utils/                  # 유틸리티 함수
│   ├── App.tsx
│   └── main.tsx
├── Dockerfile                  # Docker 설정 (dev/prod)
├── docker-compose.yml          # Docker Compose 설정
├── nginx.conf                  # 프로덕션 Nginx 설정
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

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
- [ ] Resium 통합 (지리공간 데이터)
- [x] 뷰어 모드 전환 (Grid/Map)
- [ ] 파일 포맷 지원 (OBJ, FBX, PLY, LAS, GLTF)

### Phase 5: 데이터 관리
- [ ] 파일 업로드 (드래그 앤 드롭)
- [ ] 폴더 구조 CRUD
- [ ] 파일 메타데이터 관리
- [ ] 클라이언트 스토리지 (IndexedDB)

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
- [ ] REST API 설계 및 구현
- [ ] 사용자 인증 (JWT)
- [ ] 데이터베이스 연동 (PostgreSQL + PostGIS)
- [ ] 파일 스토리지

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
