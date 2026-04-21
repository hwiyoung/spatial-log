# SAMS UI/UX 개선 및 기능 추가 — 구현 계획서

**작성일**: 2026-04-10
**기반**: 사용자 직접 테스트 피드백 13건

---

## 변경사항 요약

| # | 항목 | 분류 | 영향 범위 | 난이도 |
|---|------|------|-----------|--------|
| 1 | 사이드바 기본 너비 확대 | UI | SearchSidebar.jsx | 낮음 |
| 2 | 사이드바 너비 드래그 조절 | UI | Explorer.jsx, SearchSidebar.jsx | 중간 |
| 3 | 아이템 클릭 시 bbox 줌인 | UI | MapView.jsx | 낮음(이미 구현됨, 검증 필요) |
| 4 | 전반적인 폰트 크기 키우기 | UI | index.css, 각 컴포넌트 | 중간 |
| 5 | 좌측 상단 로고 클릭 → 새로고침 | UI | App.jsx | 낮음 |
| 6 | 프로젝트 추가(생성) 기능 | 기능 | Project.jsx (이미 구현됨, 검증 필요) |  낮음 |
| 7 | 업로드 UX 재설계: 폴더/개별 | UX | Upload.jsx | 중간 |
| 8 | 업로드 후 Item 목록에 반영 | 기능 | Upload.jsx, upload.py | 중간 |
| 9 | 썸네일 표출 개선 | 기능 | ResultList, PreviewPanel, thumbnail.py | 중간 |
| 10 | bbox 좌표 EPSG:4326 변환 표시 | UI | PreviewPanel.jsx, Detail.jsx | 낮음 |
| 11 | 아이템/프로젝트 삭제 기능 | 기능 | (이미 구현됨, 검증 필요) | 낮음 |
| 12 | 드론 사진 폴더 업로드 | 기능 | (이미 구현됨, 검증 필요) | 낮음 |
| 13 | 베이스맵 위 포인트 가시성 향상 | UI | MapView.jsx | 낮음 |

---

## 그룹 A: 이미 구현되어 있어 검증만 필요한 항목

### #3 아이템 클릭 시 bbox 줌인
**현재 상태**: [MapView.jsx:54-76](frontend/src/components/MapView.jsx#L54-L76)에 `selectedId` 변경 시 `fitBounds`/`flyTo` 로직 구현됨.
- bbox 있고 유효 → `fitBounds([[w,s],[e,n]], {padding:80, maxZoom:18})`
- bbox가 점 수준 → `flyTo({zoom:16})`
- bbox 없으면 geometry center로 이동

**검증 항목**:
- Explorer에서 ResultList 아이템 클릭 → 지도 줌인 동작 확인
- 다양한 bbox 크기(넓은 영역 / 좁은 점 / bbox 없음)에서 정상 동작 확인
- 줌인 후 다른 아이템 클릭 시 해당 위치로 이동 확인

**판단**: 동작하면 완료, 안 되면 디버깅.

### #6 프로젝트 추가(생성) 기능
**현재 상태**: [Project.jsx](frontend/src/pages/Project.jsx)에 `CreateModal` 컴포넌트 구현됨.
- "+ 새 프로젝트" 버튼 → 모달 → id/title/description/site/client/manager/default_epsg 입력 → `collectionApi.create()` 호출
- 백엔드 `collections.py`에서 pgSTAC `create_collection()` SQL 함수 직접 호출

**검증 항목**:
- Project 페이지에서 "새 프로젝트" 버튼 존재 및 클릭 시 모달 표시
- 필수 필드(id, title) 입력 후 생성 → 목록에 반영
- 생성 후 Upload 페이지에서 Collection 선택 목록에 표시

**판단**: 동작하면 완료, 안 되면 디버깅.

### #11 아이템/프로젝트 삭제 기능
**현재 상태**: 
- Item 삭제: [items.py:273-336](sams-api/sams/routers/items.py#L273-L336) — pgSTAC 직접 DELETE + S3 파일 정리
- Collection 삭제: [collections.py:284-344](sams-api/sams/routers/collections.py#L284-L344) — 하위 Item + S3 전체 삭제
- UI: Detail 페이지, PreviewPanel, Project 페이지에 삭제 버튼 존재

**검증 항목**:
- 각 삭제 버튼 존재 및 확인 대화상자 표시
- 삭제 후 목록에서 사라지는지 확인
- S3 파일도 함께 삭제되는지 확인 (MinIO 콘솔)

**판단**: 동작하면 완료, 안 되면 디버깅.

### #12 드론 사진 폴더 업로드
**현재 상태**: CHANGELOG에 기록됨 — 이미지 5장 초과 시 `image_set` 자동 번들링, ConvexHull bbox, 대표 썸네일 생성.

**검증 항목**:
- Upload 페이지에서 드론 이미지 폴더 선택/드래그 가능
- 5장 초과 시 하나의 Item으로 번들링
- bbox가 전체 GPS 위치의 ConvexHull로 생성
- Explorer에서 "날짜 ~ 날짜 · 크기 · N장" 형태 표시

**판단**: 동작하면 완료, 안 되면 디버깅.

---

## 그룹 B: UI/UX 개선 (신규 구현)

### #1 사이드바 기본 너비 확대

**현재**: [SearchSidebar.jsx:14](frontend/src/components/SearchSidebar.jsx#L14)에서 `width: 320, minWidth: 320`

**변경 계획**:
- 기본 너비 `320px` → `380px`로 변경
- `minWidth`도 동일하게 `380px`

**수정 파일**: `frontend/src/components/SearchSidebar.jsx`

---

### #2 사이드바 너비 드래그 조절

**현재**: 고정 너비, 조절 불가

**변경 계획**:
- Explorer.jsx에서 사이드바 너비를 `useState`로 관리 (기본 380px)
- 사이드바 우측 경계에 4px 드래그 핸들 추가
- `mousedown` → `mousemove` → `mouseup`으로 드래그 리사이즈
- 최소 280px, 최대 600px 제한
- 드래그 중 커서 `col-resize` 변경
- SearchSidebar가 `width` prop을 받아 적용

**수정 파일**: 
- `frontend/src/pages/Explorer.jsx` — 리사이즈 상태 및 핸들러
- `frontend/src/components/SearchSidebar.jsx` — width prop 수용

**구현 상세**:
```jsx
// Explorer.jsx에 추가
const [sidebarWidth, setSidebarWidth] = useState(380)
const [isResizing, setIsResizing] = useState(false)

// 드래그 핸들 (사이드바와 메인 영역 사이)
<div
  style={{ width: 4, cursor: 'col-resize', background: isResizing ? 'var(--ac)' : 'transparent' }}
  onMouseDown={startResize}
/>

// mousemove에서 clamp(280, 600)
```

---

### #4 전반적인 폰트 크기 키우기

**현재**: body 기본 `16px`이지만, 대부분 컴포넌트에서 `12px~14px`로 인라인 오버라이드.

**변경 계획** (전체적으로 2px씩 증가):

| 위치 | 현재 | 변경 |
|------|------|------|
| 검색 입력 (SearchSidebar) | 14px | 15px |
| 데이터 유형 라벨 | 12px | 13px |
| 유형 필터 버튼 | 12px | 13px |
| 프로젝트 라벨 | 12px | 13px |
| 프로젝트 목록 항목 | 12px | 13px |
| 결과 수 | 12px | 13px |
| 네비게이션 링크 (App.jsx) | 15px | 15px (유지) |
| 네비게이션 타이틀 | 18px | 18px (유지) |
| ResultList 항목 | 14px | 15px |
| ResultList 서브텍스트 | 12px | 13px |
| PreviewPanel 제목 | 16px | 17px |
| PreviewPanel 속성라벨 | 12px | 13px |
| PreviewPanel 속성값 | 13px | 14px |

**수정 파일**:
- `frontend/src/components/SearchSidebar.jsx`
- `frontend/src/components/ResultList.jsx`
- `frontend/src/components/PreviewPanel.jsx`

**원칙**: 네비게이션은 유지, 사이드바/목록/패널의 콘텐츠 텍스트만 1~2px 증가.

---

### #5 좌측 상단 로고 클릭 → 새로고침

**현재**: [App.jsx:29-31](frontend/src/App.jsx#L29-L31) — `<NavLink to="/">`로 Explorer 페이지 이동. 이미 Explorer에 있으면 아무 일도 안 일어남.

**변경 계획**:
- NavLink를 일반 클릭 핸들러로 변경
- 이미 `/`에 있으면 `window.location.reload()` 호출
- 다른 페이지에 있으면 `/`로 이동

**수정 파일**: `frontend/src/App.jsx`

**구현 상세**:
```jsx
import { useLocation, useNavigate } from 'react-router-dom'

// NavLink 대신:
<span
  onClick={() => {
    if (location.pathname === '/') window.location.reload()
    else navigate('/')
  }}
  style={{ cursor: 'pointer', ... }}
>
  SAMS <span>v0.1</span>
</span>
```

---

### #10 bbox 좌표 EPSG:4326 변환 표시

**현재**: bbox 좌표를 원본 그대로 표시. 투영좌표(5186 등)인 경우 `203809, 548465, ...` 같은 값이 표시되어 의미를 알기 어려움.

**분석**: bbox 변환은 이미 백엔드에서 처리됨.
- `extract.py`에서 `bbox_4326` 필드를 생성
- `upload.py` register에서 STAC Item의 `bbox` 필드에 4326 값을 사용
- 따라서 STAC Item의 `item.bbox`는 이미 4326일 것

**검증 필요**: 실제 등록된 Item의 bbox 값이 4326인지 확인.

**변경 계획**:
- bbox 표시 부분에 "EPSG:4326" 라벨 추가
- 원본 EPSG 좌표도 `properties`에 있으면 함께 표시 (접기/펼치기)
- 좌표 포맷: `경도 127.0234°, 위도 37.5123°` 형태로 사람이 읽기 쉽게

**수정 파일**: 
- `frontend/src/components/PreviewPanel.jsx`
- `frontend/src/pages/Detail.jsx`

---

### #13 베이스맵 위 Item 포인트 가시성 향상

**현재**: [MapView.jsx:94-104](frontend/src/components/MapView.jsx#L94-L104) — 24px 원형 마커, 카테고리 색상 배경 30% 투명도, 2px 테두리.

**문제**: OSM 베이스맵 위에서 작은 반투명 마커가 잘 안 보임.

**변경 계획**:
- 마커 크기: `24px` → `32px`
- 배경 불투명도 증가: `${cat.color}30` → `${cat.color}90`
- 테두리: `2px` → `2.5px`
- 그림자 추가: `box-shadow: 0 1px 4px rgba(0,0,0,0.5)`
- 아이콘 크기: `14px` → `16px`
- 호버/선택 시: `scale(1.4)` → `scale(1.5)` + 밝은 배경

**수정 파일**: `frontend/src/components/MapView.jsx`

---

## 그룹 C: 기능 변경/추가

### #7 업로드 UX 재설계: 폴더 업로드 / 개별 업로드

**현재**: "벌크 업로드 (3-step)" / "단건 업로드" 탭

**사용자 제안**: 
- "폴더 업로드" — 폴더 내부 전체를 읽어서 자동 업로드
- "개별 업로드" — 1개 또는 다수 파일 선택 가능

**변경 계획**:

#### 탭 이름 변경
- "벌크 업로드" → "폴더 업로드"
- "단건 업로드" → "개별 업로드"

#### 폴더 업로드 (기존 벌크 기반)
- 폴더 선택 또는 드래그 앤 드롭만 허용 (파일 개별 선택 제거)
- 폴더 구조 유지하여 서브폴더별 자동 번들링
- 3-Step 유지: 폴더 선택 → 분석 결과 확인 → 등록

#### 개별 업로드 (기존 단건 확장)
- 단일 파일 제한 해제 → 다수 파일 선택 가능
- 선택된 파일 목록 표시 + 개별 제거 가능
- 각 파일(또는 자동 번들)에 대해 분석 결과 표시
- 일괄 등록 또는 개별 등록 선택

**수정 파일**: `frontend/src/pages/Upload.jsx`

---

### #8 업로드 후 Item 목록에 반영

**현재 상황 분석**:
- 등록 시 `status: 'draft'`로 생성됨
- Explorer 검색은 STAC `/search` API 사용 — draft 아이템이 검색되는지 확인 필요
- pgSTAC `create_item()`으로 직접 등록하므로 DB에는 즉시 반영

**검증 필요**:
1. 업로드 후 Explorer에서 검색 시 새 아이템이 나오는지
2. Project 페이지의 아이템 목록에 나오는지
3. 안 나온다면 원인 파악 (status 필터? 캐싱? STAC API 동기화?)

**변경 계획** (검증 후 결정):
- 등록 완료 후 Explorer로 이동 시 자동 검색 새로고침
- 등록된 아이템의 Collection으로 필터링하여 바로 확인 가능
- 필요 시 등록 status를 `published`로 변경하는 옵션 제공

**수정 파일**: 
- `frontend/src/pages/Upload.jsx` — 등록 완료 후 네비게이션
- 필요 시 `sams-api/sams/routers/upload.py` — status 옵션

---

### #9 썸네일 표출 개선

**현재 상태**:
- 썸네일 생성: 6개 유형 지원 (정사영상, 포인트클라우드, 3D모델, 이미지, 동영상, PDF)
- 프론트에서 `item.assets?.thumbnail?.href`로 접근
- ResultList: 48x36px, PreviewPanel: 100% 너비 200px 높이

**검증 필요**:
1. 정사영상: 썸네일 생성 → S3 업로드 → href 설정 → 프론트 표시 전체 흐름
2. LAS/OBJ: matplotlib 산점도/와이어프레임 생성 확인
3. 썸네일 미생성 시 fallback 아이콘 정상 표시

**변경 계획** (검증 결과에 따라):
- 썸네일이 정상 생성·표시되면: 현재 상태 유지
- 특정 유형에서 실패하면: 해당 유형 디버깅
- LAS/OBJ 썸네일 품질 논의:
  - 현재: matplotlib 산점도(LAS), 와이어프레임(OBJ) — 상위 뷰
  - 개선안 A: 컬러 그라데이션 적용 (높이값 기반)
  - 개선안 B: 3D 뷰포인트에서 렌더링
  - 사용자와 논의 후 결정

**수정 파일**: 필요 시 `sams-api/sams/pipeline/thumbnail.py`

---

## 구현 순서

검증이 필요한 항목을 먼저 확인하고, 확인된 상태를 기반으로 수정을 진행합니다.

### Phase 1: 검증 (그룹 A)
1. Docker 컨테이너 기동 상태 확인
2. #3, #6, #11, #12 기존 구현 검증
3. #8 업로드 후 목록 반영 검증
4. #9 썸네일 흐름 검증
5. #10 bbox 4326 값 확인
6. 검증 결과 보고 → 사용자 확인

### Phase 2: UI 개선 (그룹 B) — 한 번에 적용
순서: #1 → #2 → #4 → #5 → #13 → #10

이 항목들은 상호 의존성이 낮아 한 번에 구현 가능.

| 수정 파일 | 관련 항목 |
|-----------|-----------|
| `index.css` | #4 |
| `App.jsx` | #5 |
| `SearchSidebar.jsx` | #1, #2, #4 |
| `Explorer.jsx` | #2 |
| `MapView.jsx` | #13 |
| `ResultList.jsx` | #4 |
| `PreviewPanel.jsx` | #4, #10 |
| `Detail.jsx` | #10 |

### Phase 3: 기능 변경 (그룹 C)
순서: #7 → #8 → #9

| 수정 파일 | 관련 항목 |
|-----------|-----------|
| `Upload.jsx` | #7, #8 |
| `upload.py` | #8 (필요 시) |
| `thumbnail.py` | #9 (필요 시) |

---

## 설계 문서 대조

| 규칙 | 검토 결과 |
|------|-----------|
| 자동 채움 우선 | #7~#9는 업로드 UX 개선으로, 메타데이터 자동 채움 흐름을 방해하지 않음 |
| STAC 표준 | bbox 4326 변환은 STAC 표준(bbox는 WGS84) 부합 |
| graceful degradation | 썸네일 실패 시 fallback 유지 |
| 양방향 링크 | 이번 작업 범위 외 |
| Asset href API 경유 | 기존 패턴 유지 |

---

## 리스크 및 주의사항

1. **#2 드래그 리사이즈**: 지도 컴포넌트 위에서 드래그 시 이벤트 충돌 가능 → `pointer-events: none` 오버레이로 방지
2. **#4 폰트 크기**: 사이드바 너비 확대(#1)와 동시 적용해야 레이아웃 깨지지 않음
3. **#7 업로드 재설계**: 기존 3-step 로직 재사용, 탭 이름과 입력 방식만 변경하여 최소 수정
4. **#8 Item 반영**: pgSTAC 검색 인덱싱 지연 가능성 확인 필요
