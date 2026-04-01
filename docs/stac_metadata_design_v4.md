# STAC 메타데이터 설계서 v4.0

> 원본: stac_metadata_design_v4.xlsx
> Claude Code가 xlsx를 직접 읽을 수 없으므로 마크다운으로 변환한 문서입니다.
> 시트: v4.0 변경사항, 개요, Collection 메타데이터, 공통 메타데이터, 3D 모델, 3D Tiles, 포인트 클라우드, 정사영상, 원본 이미지, 파노라마, 동영상, 문헌정보, 크로스체크


---

## v4.0 변경사항

**STAC 메타데이터 v4.0 — 설계 점검 반영**

**빈틈 3건 + 불일치 5건 중 메타데이터에 영향을 주는 사항 반영**

| # | 범주 | 변경 내용 | 상세 | 상태 |
| --- | --- | --- | --- | --- |
| 1 | 빈틈 해소 | Collection 메타데이터 시트 신규 추가 | STAC Collection 스펙 + 프로젝트 관리용 확장. / id, title, description, extent, license / + project:client, project:period, / expected_deliverables, status | 추가 |
| 2 | 빈틈 해소 | links rel 타입 확정 + 시계열 rel 추가 | 공통 메타데이터 links 비고 업데이트. / prev/next (IANA 표준) 추가. / "같은 대상의 이전/다음 시점" 용도 명시 | 수정 |
| 3 | 빈틈 해소 | Draft→Published 전환 경로 명시 | properties.status 비고에 / "Project 페이지에서 Draft 목록 확인 → / 메타데이터 보완 → Published 전환" 흐름 명시 | 수정 |
| 4 | 불일치 수정 | 단건 와이어프레임 동기화 필요 표시 | 단건 와이어프레임이 v3.1 이전 필드명 사용. / 다음 와이어프레임 업데이트 시 반영 예정 | 예정 |
| 5 | 구조 개선 | 크로스체크 시트에 Collection 필드 추가 | Collection 수준 필드가 / 유형별로 어떻게 적용되는지 매트릭스에 반영 | 수정 |


---

## 개요

STAC 메타데이터 설계서 v4.0
버전 | v4.0 — 설계 전수 점검 반영 (빈틈 3건, 불일치 5건 처리)
누적 | v2.0(6건) + v3.0(16건) + v3.1(11건) + v4.0(5건) = 38건
v4.0 핵심 변경
  1. Collection 시트 추가 | ⭐ 프로젝트 수준 메타데이터 정의 (신규)
  2. links rel 확정 | 시계열용 prev/next 추가, 전체 rel 목록 확정
  3. Draft 전환 경로 | status 필드에 전환 흐름 명시
시트 구성 (13개)
  v4.0 변경사항 | 이번 변경 5건
  개요 | 이 시트
  ⭐ Collection 메타데이터 | 신규. 프로젝트 수준 정의
  공통 메타데이터 | STAC Item Core + 확장 + Asset
  3D 모델 ~ 문헌정보 | 8개 유형별 전용 메타데이터
  크로스체크 | 유형 × 필드 매트릭스

---

## Collection 메타데이터

**Collection 메타데이터 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STAC Collection Core |  |  |  |  |  |  |  |
| id | Collection 고유 식별자 | string | 필수 | B | Collection ID | bulguksa-2024-survey | ⭐v4 신규. 규칙: {site}-{year}-{purpose} |
| type | 고정값 | string | 필수 | 자동 | — | Collection | 고정값 |
| stac_version | STAC 버전 | string | 필수 | 자동 | — | 1.0.0 | 고정값 |
| title | 프로젝트 제목 | string | 필수 | B | 프로젝트명 | 2024 경주 불국사 정밀실측 | 사용자 입력 |
| description | 프로젝트 설명 | string | 필수 | B | 설명 | 2024년 봄 조사 캠페인에서 / 취득된 모든 공간 데이터 |  |
| license | 라이선스 | string | 권장 | C | 라이선스 | CC-BY-4.0 | SPDX 표기 |
| extent.spatial.bbox | 공간 범위 | array[array[number]] | 필수 | 자동/B | 공간 범위 | [[-122.5,37.5,-122.0,38.0]] | 소속 Item 등록 시 자동 갱신 / 또는 수동 초기 설정 |
| extent.temporal.interval | 시간 범위 | array[array[string]] | 필수 | 자동/B | 기간 | [["2024-03-10","2024-03-20"]] | 소속 Item 등록 시 자동 갱신 |
| links | 관련 링크 | array[Link] | 권장 | 자동 | 링크 | [{"rel":"self",...}] | self, root, items 등 자동생성 |
| stac_extensions | 사용 확장 목록 | array[string] | 필수 | 자동 | 확장 | ["https://...pointcloud/..."] | 소속 Item의 확장 자동 집계 |
| ⭐v4 프로젝트 관리 확장 (project:) |  |  |  |  |  |  |  |
| project:client | 발주처/클라이언트 | string | 권장 | B | 발주처 | 문화재청 | ⭐v4 신규 |
| project:period_start | 사업 시작일 | date | 권장 | B | 시작일 | 2024-03-01 | ⭐v4 신규. YYYY-MM-DD |
| project:period_end | 사업 종료일 | date | 권장 | B | 종료일 | 2024-06-30 | ⭐v4 신규 |
| project:manager | 프로젝트 관리자 | string | 권장 | B | PM | 홍길동 | ⭐v4 신규 |
| project:site | 대상 사이트 | string | 필수 | B | 사이트 | 경주 불국사 | Item의 project:site와 동일 값 |
| project:default_epsg | 기본 좌표계 | integer | 권장 | B | 기본 좌표계 | 5186 | ⭐v4 신규. 이 Collection의 / 기본 좌표계. 새 Item 등록 시 / 초기값으로 사용 |
| ⭐v4 산출물 관리 (expected_deliverables) |  |  |  |  |  |  |  |
| expected_deliverables | 예상 산출물 목록 | array[object] | 권장 | B | 예상 산출물 | [{"category":"pointcloud", / "count":3,"description": / "다보탑, 석가탑, 대웅전 스캔"}] | ⭐v4 신규. 각 객체: / category: data_category enum 값 / count: 예상 수량 / description: 설명 / 대시보드에서 등록 현황 대비 표시 |
| expected_total | 예상 총 산출물 수 | integer | 선택 | 자동 | 예상 총수 | 12 | ⭐v4 신규. expected_deliverables에서 / 자동 합산 |
| ⭐v4 시스템 관리 |  |  |  |  |  |  |  |
| status | Collection 상태 | string (enum) | 필수 | 자동/B | 상태 | active | ⭐v4 신규. / enum: planning, active, completed, archived / planning: 사업 준비 중 / active: 데이터 등록 진행 중 / completed: 등록 완료 / archived: 장기 보관 |
| created | 생성일 | datetime | 필수 | 자동 | 생성일 | 2024-03-01T10:00:00Z | 시스템 자동 |
| updated | 수정일 | datetime | 필수 | 자동 | 수정일 | 2024-04-15T14:00:00Z | 시스템 자동 |


---

## 공통 메타데이터

**공통 메타데이터 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STAC Item Core |  |  |  |  |  |  |  |
| id | 고유 식별자 | string | 필수 | 자동 | Item ID | bulguksa-dabotap-pc-20240312 | 규칙: {site}-{target}-{category}-{date} |
| type | GeoJSON 타입 | string | 필수 | 자동 | — | Feature | 고정값 |
| stac_version | STAC 버전 | string | 필수 | 자동 | — | 1.0.0 | 고정값 |
| geometry | 공간 범위 | GeoJSON | 필수 | A/B | 위치/범위 | {"type":"Polygon",...} | 자동추출 가능 시 A. / 문헌: 지도 클릭(B) |
| bbox | 바운딩 박스 | array[number] | 필수 | A | 바운딩 박스 | [129.33,35.79,12.0, / 129.34,35.80,25.5] | 3D=6값, 2D=4값 |
| properties.datetime | 취득 일시 | datetime (ISO8601) | 필수 | A/B | 취득 일시 | 2024-03-12T09:30:00Z | EXIF/헤더 자동추출 시 A |
| properties.start_datetime | 시작 일시 | datetime (ISO8601) | 조건부 | B | 시작 일시 | 2024-03-12T09:00:00Z | datetime=null일 때 필수 |
| properties.end_datetime | 종료 일시 | datetime (ISO8601) | 조건부 | B | 종료 일시 | 2024-03-12T11:30:00Z | datetime=null일 때 필수 |
| properties.created | 등록일 | datetime (ISO8601) | 필수 | 자동 | 등록일 | 2024-04-01T10:00:00Z | 시스템 자동 |
| properties.updated | 수정일 | datetime (ISO8601) | 필수 | 자동 | 수정일 | 2024-04-05T14:20:00Z | 시스템 자동 |
| collection | 소속 Collection | string | 필수 | B | Collection | bulguksa-2024-survey | 드롭다운. Collection 메타데이터 참조 |
| links | 관련 리소스 | array[Link] | 권장 | B (Step3) | 연관관계 | [{"rel":"derived_from",...}] | ⭐v4 확정. 사용할 rel 값: / — STAC 표준: self, root, parent, /   collection, item / — 계보: derived_from / — 동시취득: related / — 문서참조: describedby, describes / — ⭐시계열: prev, next /   (IANA 표준. 같은 대상의 /   이전/다음 시점 데이터 연결) / 시스템이 양방향 링크 자동 생성 |
| assets | 파일 링크 맵 | map[string, Asset] | 필수 | 자동 | 파일 정보 | {"data":{"href":"s3://..."}} | 업로드 시 자동 |
| 프로젝트 공통 확장 (project:) |  |  |  |  |  |  |  |
| properties.data_category | 데이터 유형 | string (enum) | 필수 | A/B | 데이터 유형 | pointcloud | enum: 3d_model, 3d_tiles, pointcloud, / orthoimage, image, panorama, video, document |
| properties.project:name | 프로젝트명 | string | 필수 | B | 프로젝트명 | 2024 경주 문화재 정밀조사 | Collection title과 동일하게 / 자동완성 가능 |
| properties.project:site | 대상 사이트 | string | 필수 | B | 대상 사이트 | 경주 불국사 | Collection site에서 자동완성 |
| properties.project:campaign | 캠페인 ID | string | 권장 | C | 캠페인 | campaign-2024-spring | 반복 조사 구분 |
| properties.provider | 취득 기관 | string | 권장 | B | 취득 기관 | (주)공간정보기술 |  |
| properties.license | 라이선스 | string | 권장 | C | 라이선스 | CC-BY-4.0 |  |
| properties.description | 데이터 설명 | string | 권장 | B | 설명 | 다보탑 LiDAR 스캔 |  |
| properties.processing:level | 처리 단계 | string (enum) | 선택 | C | 처리 단계 | processed | enum: raw, processed, derived, final |
| 좌표계 공통 (proj: STAC 공식 확장) |  |  |  |  |  |  |  |
| properties.proj:epsg | 좌표계 EPSG | integer | 필수 | A/B | 좌표계 | 5186 | 전 유형 공통. / Collection의 default_epsg로 / 초기값 자동완성 가능 |
| properties.proj:wkt2 | WKT2 문자열 | string | 조건부 | B | WKT 좌표계 | PROJCRS["Korea 2000..."] | EPSG 없는 로컬 좌표계일 때 |
| 시스템 관리 필드 |  |  |  |  |  |  |  |
| properties.status | 등록 상태 | string (enum) | 필수 | 자동/B | 상태 | published | enum: draft, published, archived / ⭐v4 보완: Draft→Published 전환 경로: / Project 페이지 → Draft 목록 → / 클릭하여 메타데이터 보완 → / Published로 전환 |
| Asset 객체 공통 구조 |  |  |  |  |  |  |  |
| assets.{key}.href | 파일 URL | string (URI) | 필수 | 자동 | 파일 경로 | s3://archive/dabotap.las |  |
| assets.{key}.type | MIME 타입 | string | 필수 | 자동 | MIME | application/octet-stream | 자동판별 |
| assets.{key}.title | 표시 제목 | string | 권장 | B | 파일 제목 | 다보탑 포인트클라우드 |  |
| assets.{key}.roles | 역할 | array[string] | 권장 | 자동 | 역할 | ["data"] | 표준: data, thumbnail, overview, / preview, compressed, converted, metadata |
| assets.{key}.file:size | 크기 (bytes) | integer | 권장 | A | 파일 크기 | 2147483648 | 자동추출 |
| assets.{key}.file:checksum | 체크섬 | string | 선택 | 자동 | 체크섬 | sha256:abc123... | 자동생성 |


---

## 3D 모델

**3D 모델 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3D 모델 전용 (3dmodel: 커스텀) |  |  |  |  |  |  |  |
| properties.3dmodel:format | 파일 포맷 | string (enum) | 필수 | A | 포맷 | obj | enum: obj, ply, fbx, gltf, glb, stl, dae |
| properties.3dmodel:vertex_count | 정점 수 | integer | 필수 | A | 정점 수 | 1250000 | 자동추출 |
| properties.3dmodel:face_count | 면 수 | integer | 필수 | A | 면 수 | 2500000 | 자동추출 |
| properties.3dmodel:has_texture | 텍스처 유무 | boolean | 필수 | A | 텍스처 유무 | true | 자동추출 |
| properties.3dmodel:has_normals | 법선 벡터 유무 | boolean | 권장 | A | 법선 유무 | true | 자동추출 |
| properties.3dmodel:texture_count | 텍스처 수 | integer | 권장 | A | 텍스처 수 | 4 | 자동추출 |
| properties.3dmodel:texture_resolution | 텍스처 해상도 | array[integer] | 권장 | A | 텍스처 해상도 | [4096, 4096] | [width, height] |
| properties.3dmodel:material_count | 머티리얼 수 | integer | 선택 | A | 머티리얼 수 | 3 | 자동추출 |
| properties.3dmodel:unit | 좌표 단위 | string (enum) | 조건부 | B | 좌표 단위 | meter | proj:epsg 없을 때만 필수 |
| properties.3dmodel:bounding_volume | 3D 범위 | object | 권장 | A | 3D 범위 | {"center":[x,y,z],...} | 자동추출 |
| properties.3dmodel:reconstruction_method | 생성 방법 | string (enum) | 권장 | B | 생성 방법 | photogrammetry | enum: photogrammetry, lidar_mesh, / manual_modeling, bim, scan_to_bim, / cad_conversion, reverse_engineering, hybrid |
| properties.3dmodel:software | 소프트웨어 | string | 선택 | C | 소프트웨어 | Agisoft Metashape 2.0 |  |
| properties.3dmodel:source_image_count | 원본 이미지 수 | integer | 선택 | C | 원본 이미지 | 450 | 포토그래메트리 시 |
| properties.3dmodel:lod | LOD | string | 선택 | C | LOD | LOD2 |  |
| 3D 모델 Asset |  |  |  |  |  |  |  |
| assets.model | 모델 본체 | Asset | 필수 | 자동 | 모델 | s3://.../dabotap.obj | roles: ["data"] |
| assets.material | 머티리얼 | Asset | 조건부 | 자동 | 머티리얼 | s3://.../dabotap.mtl |  |
| assets.texture_{n} | 텍스처 | Asset | 조건부 | 자동 | 텍스처 | s3://.../texture_0.jpg |  |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.png | roles: ["thumbnail"] |
| assets.glb_preview | 미리보기 | Asset | 선택 | 자동 | 미리보기 | s3://.../preview.glb | roles: ["preview"] |


---

## 3D Tiles

**3D Tiles (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3D Tiles 전용 |  |  |  |  |  |  |  |
| properties.3dtiles:version | 스펙 버전 | string | 필수 | A | 버전 | 1.1 | 자동추출 |
| properties.3dtiles:tile_format | 타일 포맷 | string (enum) | 필수 | A | 포맷 | glb | enum: b3dm, pnts, i3dm, cmpt, glb |
| properties.3dtiles:geometric_error | 기하 오차 | number | 필수 | A | 기하 오차 | 70.5 | 자동추출 |
| properties.3dtiles:total_tiles | 타일 수 | integer | 권장 | A | 타일 수 | 1523 | 자동추출 |
| properties.3dtiles:lod_levels | LOD 단계 | integer | 권장 | A | LOD | 5 |  |
| properties.3dtiles:total_size_bytes | 전체 크기 | integer | 권장 | A | 크기 | 524288000 | 자동추출 |
| properties.3dtiles:source_type | 원본 유형 | string (enum) | 권장 | B | 원본 유형 | photogrammetry_mesh | enum: photogrammetry_mesh, / lidar_pointcloud, bim, terrain, / cadastral, dem, hybrid |
| 3D Tiles Asset |  |  |  |  |  |  |  |
| assets.tileset | tileset.json | Asset | 필수 | 자동 | 타일셋 | s3://.../tileset.json | roles: ["metadata"] |
| assets.tiles_root | 타일 디렉토리 | Asset | 필수 | 자동 | 타일 | s3://.../tiles/ | roles: ["data"] |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.png |  |


---

## 포인트 클라우드

**포인트 클라우드 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 포인트 클라우드 (pc: STAC 공식 확장) |  |  |  |  |  |  |  |
| properties.pc:count | 포인트 수 | integer | 필수 | A | 포인트 수 | 15000000 | 자동추출 |
| properties.pc:type | 취득 방식 | string (enum) | 필수 | B | PC 유형 | lidar | enum: lidar, eopc, sonar, radar, other |
| properties.pc:encoding | 인코딩 | string (enum) | 필수 | A | 인코딩 | LASzip | enum: LAS, LAZ, LASzip, PCD, E57, PLY |
| properties.pc:schemas | 포인트 속성 | array[object] | 필수 | A | 속성 | [{"name":"X",...}] | 자동추출 |
| properties.pc:density | 밀도 | number | 권장 | A | 밀도 | 250.5 | 자동계산 |
| properties.pc:statistics | 통계 | array[object] | 선택 | A | 통계 | [{"name":"Z",...}] | 자동계산 |
| 포인트 클라우드 추가 (커스텀) |  |  |  |  |  |  |  |
| properties.pc:las_version | LAS 버전 | string | 권장 | A | LAS 버전 | 1.4 | 자동추출 |
| properties.pc:has_rgb | RGB 포함 | boolean | 권장 | A | RGB | true | 자동추출 |
| properties.pc:has_intensity | 강도 포함 | boolean | 권장 | A | 강도 | true | 자동추출 |
| properties.pc:scanner_model | 스캐너 | string | 권장 | C | 스캐너 | Leica RTC360 | 수동 |
| properties.pc:scan_positions | 스테이션 수 | integer | 선택 | C | 스테이션 | 12 |  |
| properties.pc:registration_error | 정합 오차(m) | number | 선택 | C | 정합 오차 | 0.003 | RMSE |
| properties.pc:classification_scheme | 분류 체계 | string | 선택 | C | 분류 | ASPRS LAS 1.4 |  |
| 포인트 클라우드 Asset |  |  |  |  |  |  |  |
| assets.data | 원본 | Asset | 필수 | 자동 | 원본 | s3://.../scan.las | roles: ["data"] |
| assets.compressed | 압축본 | Asset | 권장 | 자동 | 압축 | s3://.../scan.laz | roles: ["compressed"] |
| assets.copc | COPC | Asset | 선택 | 자동 | COPC | s3://.../scan.copc.laz | roles: ["converted"] |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.png |  |


---

## 정사영상

**정사영상 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 정사영상 (공식 확장) |  |  |  |  |  |  |  |
| properties.proj:shape | 픽셀 크기 | array[integer] | 필수 | A | 크기 | [20000, 25000] | [height, width] |
| properties.proj:transform | 어파인 | array[number] | 권장 | A | 어파인 | [0.05,0,129.33,...] | 자동추출 |
| properties.eo:bands | 밴드 | array[object] | 권장 | A | 밴드 | [{"name":"red"}] | 자동추출 |
| properties.eo:cloud_cover | 구름% | number | 선택 | C | 구름 | 5.2 |  |
| 정사영상 추가 |  |  |  |  |  |  |  |
| properties.ortho:gsd | GSD | number | 필수 | A/B | GSD | 0.05 | m/px |
| properties.ortho:bit_depth | 비트 심도 | integer | 권장 | A | 비트 | 8 | 자동추출 |
| properties.ortho:accuracy_h | 수평정확도 | number | 권장 | C | 수평 | 0.1 | RMSE |
| properties.ortho:accuracy_v | 수직정확도 | number | 선택 | C | 수직 | 0.15 |  |
| properties.ortho:software | 소프트웨어 | string | 선택 | C | SW | Pix4D 4.8 |  |
| properties.ortho:flight_altitude | 촬영고도 | number | 선택 | C | 고도 | 100 | m |
| 정사영상 Asset |  |  |  |  |  |  |  |
| assets.data | GeoTIFF | Asset | 필수 | 자동 | 원본 | s3://.../ortho.tif |  |
| assets.cog | COG | Asset | 권장 | 자동 | COG | s3://.../ortho_cog.tif |  |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.png |  |


---

## 원본 이미지

**원본 이미지 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 원본 이미지 |  |  |  |  |  |  |  |
| properties.image:camera_model | 카메라 | string | 필수 | A | 카메라 | Sony A7R IV | EXIF |
| properties.image:focal_length | 초점거리 | number | 권장 | A | 초점 | 35.0 | mm. EXIF |
| properties.image:resolution | 해상도 | array[integer] | 필수 | A | 해상도 | [9504, 6336] | [W,H] |
| properties.image:capture_type | 촬영유형 | string (enum) | 필수 | B | 유형 | ground | enum: aerial, ground, indoor, / underwater, vehicle |
| properties.image:has_geotag | GPS유무 | boolean | 필수 | A | GPS | true | EXIF |
| properties.image:orientation | 방향 | integer | 선택 | A | 방향 | 1 | 1~8 |
| properties.image:image_count | 이미지수 | integer | 권장 | A | 수 | 450 | 폴더 기반 |
| 원본 이미지 Asset |  |  |  |  |  |  |  |
| assets.data | 원본 | Asset | 필수 | 자동 | 원본 | s3://.../IMG_0001.jpg |  |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.jpg |  |


---

## 파노라마

**파노라마 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 파노라마 |  |  |  |  |  |  |  |
| properties.panorama:type | 투영 | string (enum) | 필수 | B | 투영 | equirectangular | enum: equirectangular, cubemap, cylindrical |
| properties.panorama:fov_horizontal | 수평화각 | number | 필수 | A/B | 수평 | 360 | ° |
| properties.panorama:fov_vertical | 수직화각 | number | 필수 | A/B | 수직 | 180 | ° |
| properties.panorama:resolution | 해상도 | array[integer] | 필수 | A | 해상도 | [11000, 5500] | [W,H] |
| properties.panorama:camera_height | 높이 | number | 권장 | C | 높이 | 1.6 | m |
| properties.panorama:capture_position | 카메라위치 | GeoJSON Point | 필수 | A/B | 좌표 | {"type":"Point",...} | geometry=커버범위, / capture_position=카메라좌표 |
| properties.panorama:heading | 방향 | number | 권장 | C | 방향 | 0 | ° 북기준 |
| properties.panorama:pitch | 틸트 | number | 선택 | C | 틸트 | 0 | ° |
| properties.panorama:camera_model | 장비 | string | 권장 | A/C | 장비 | Insta360 Pro 2 | EXIF |
| properties.panorama:software | 스티칭SW | string | 선택 | C | SW | PTGui 12 |  |
| properties.panorama:is_indoor | 실내여부 | boolean | 권장 | B | 실내 | true |  |
| 파노라마 Asset |  |  |  |  |  |  |  |
| assets.data | 파노라마 | Asset | 필수 | 자동 | 원본 | s3://.../panorama.jpg |  |
| assets.cubemap | 큐브맵 | Asset | 선택 | 자동 | 큐브맵 | s3://.../cubemap/ |  |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.jpg |  |


---

## 동영상

**동영상 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 동영상 |  |  |  |  |  |  |  |
| properties.video:duration | 재생시간 | number | 필수 | A | 시간 | 325.5 | 초. ffprobe |
| properties.video:codec | 코덱 | string | 필수 | A | 코덱 | h264 | 자동추출 |
| properties.video:resolution | 해상도 | array[integer] | 필수 | A | 해상도 | [3840, 2160] | [W,H] |
| properties.video:frame_rate | FPS | number | 필수 | A | FPS | 30 | 자동추출 |
| properties.video:total_frames | 프레임수 | integer | 선택 | A | 프레임 | 9765 | 자동계산 |
| properties.video:bitrate | 비트레이트 | number | 권장 | A | Mbps | 45.0 | 자동추출 |
| properties.video:has_audio | 오디오 | boolean | 필수 | A | 오디오 | true | 자동추출 |
| properties.video:audio_codec | 오디오코덱 | string | 선택 | A | 코덱 | aac |  |
| properties.video:capture_type | 촬영유형 | string (enum) | 필수 | B | 유형 | drone_flight | enum: drone_flight, walkthrough, / fixed, handheld, underwater, vehicle |
| properties.video:camera_model | 장비 | string | 권장 | A/C | 장비 | DJI Mavic 3 Pro |  |
| properties.video:trajectory | 경로 | GeoJSON LineString | 선택 | C | 경로 | {"type":"LineString",...} | 드론 |
| properties.video:flight_altitude | 비행고도 | number | 선택 | C | 고도 | 80 | m |
| 동영상 Asset |  |  |  |  |  |  |  |
| assets.data | 원본 | Asset | 필수 | 자동 | 원본 | s3://.../flight.mp4 |  |
| assets.preview | 미리보기 | Asset | 선택 | 자동 | 미리보기 | s3://.../720p.mp4 |  |
| assets.thumbnail | 썸네일 | Asset | 권장 | 자동 | 썸네일 | s3://.../thumb.jpg |  |
| assets.trajectory | 경로 | Asset | 선택 | 자동 | GPX | s3://.../flight.gpx |  |


---

## 문헌정보

**문헌정보 (v4.0)**

| 필드명 | 설명 | 데이터 타입 | 필수여부 | 입력 구역 | UI 라벨 | 예시값 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 공통 필드 적용 — 문헌의 위치 지정 |  |  |  |  |  |  |  |
| (공통) geometry | 대상 사이트 위치 | GeoJSON | 필수 | B | 위치 | Point or Polygon | 지도 클릭으로 지정 |
| (공통) bbox | 공간 범위 | array[number] | 필수 | B | 범위 | [129.33,35.79,...] | 4값(2D) |
| (공통) proj:epsg | 좌표계 | integer | 선택 | 자동 | 좌표계 | 4326 | WGS84 충분 |
| 문헌정보 |  |  |  |  |  |  |  |
| properties.document:type | 유형 | string (enum) | 필수 | B | 유형 | survey_report | enum: survey_report, excavation_report, / analysis, permit, plan, drawing, / bibliography, specification, / meeting_minutes, photograph_log |
| properties.document:format | 포맷 | string (enum) | 필수 | A | 포맷 | pdf | enum: pdf, hwp, docx, xlsx, pptx, jpg, png |
| properties.document:title | 제목 | string | 필수 | B | 제목 | 2024 불국사 보고서 |  |
| properties.document:authors | 저자 | array[string] | 필수 | B | 저자 | ["홍길동"] |  |
| properties.document:publisher | 발행기관 | string | 권장 | B | 발행 | 문화재청 |  |
| properties.document:publication_date | 발행일 | date | 권장 | B | 발행일 | 2024-06-15 | YYYY-MM-DD (시간 없음) |
| properties.document:pages | 페이지 | integer | 권장 | A | 페이지 | 156 | PDF 자동추출 |
| properties.document:language | 언어 | string | 필수 | B | 언어 | ko | ISO 639-1 |
| properties.document:abstract | 초록 | string | 권장 | B | 초록 | 본 보고서는... | 500자 이내 |
| properties.document:keywords | 키워드 | array[string] | 권장 | B | 키워드 | ["불국사","LiDAR"] |  |
| properties.document:spatial_coverage | 공간범위 | string | 권장 | B | 범위 | 경주 불국사 다보탑 일원 | 텍스트 |
| properties.document:isbn | ISBN | string | 선택 | C | ISBN | 978-89-1234-567-8 |  |
| 문헌정보 Asset |  |  |  |  |  |  |  |
| assets.data | 원본 | Asset | 필수 | 자동 | 원본 | s3://.../report.pdf |  |
| assets.fulltext | 전문 | Asset | 선택 | 자동 | 전문 | s3://.../report.txt | 검색 인덱싱용 |
| assets.thumbnail | 표지 | Asset | 권장 | 자동 | 썸네일 | s3://.../cover.png |  |


---

## 크로스체크

**필드 × 유형 크로스체크 (v4.0)**

**● 필수  ◐ 권장  ○ 선택  — 해당없음  ⚡ 자동추출**

| 필드명 | 타입 | 3D모델 | 3DTiles | PC | 정사 | 이미지 | 파노 | 영상 | 문헌 | 비고 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ⭐v4 Collection 수준 (모든 유형에 공통 적용) |  |  |  |  |  |  |  |  |  |  |
| Collection.title | string | ● | ● | ● | ● | ● | ● | ● | ● | 프로젝트명 |
| Collection.project:client | string | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | 발주처 |
| Collection.project:site | string | ● | ● | ● | ● | ● | ● | ● | ● |  |
| Collection.default_epsg | integer | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | Item 초기값 |
| Collection.expected_deliverables | array | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | 대시보드용 |
| Collection.status | enum | ● | ● | ● | ● | ● | ● | ● | ● |  |
| Item 공통 Core |  |  |  |  |  |  |  |  |  |  |
| geometry | GeoJSON | ●⚡ | ●⚡ | ●⚡ | ●⚡ | ●⚡ | ●⚡ | ●⚡ | ●수동 | 문헌=지도클릭 |
| bbox | array | ●⚡6 | ●⚡6 | ●⚡6 | ●⚡4 | ●⚡4 | ●⚡4 | ●⚡4 | ●수동4 |  |
| datetime | datetime | ● | ● | ● | ●⚡ | ●⚡ | ●⚡ | ●⚡ | ● | EXIF 가능 유형 |
| proj:epsg | integer | ● | ● | ● | ●⚡ | ○ | ○ | ○ | ○ |  |
| data_category | enum | ● | ● | ● | ● | ● | ● | ● | ● |  |
| project:name | string | ● | ● | ● | ● | ● | ● | ● | ● | Collection에서 자동완성 |
| project:site | string | ● | ● | ● | ● | ● | ● | ● | ● | Collection에서 자동완성 |
| description | string | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |  |
| processing:level | enum | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |  |
| status | enum | ● | ● | ● | ● | ● | ● | ● | ● | draft/published/archived |
| links (prev/next) | Link | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ⭐v4 시계열 rel 확정 |
| links (derived_from) | Link | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 계보 |
| links (related) | Link | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 동시취득 |
| 유형 고유 핵심 필드 |  |  |  |  |  |  |  |  |  |  |
| 3dmodel:vertex_count | int | ●⚡ | — | — | — | — | — | — | — |  |
| 3dmodel:face_count | int | ●⚡ | — | — | — | — | — | — | — |  |
| 3dmodel:has_texture | bool | ●⚡ | — | — | — | — | — | — | — |  |
| 3dmodel:reconstruction_method | enum | ◐ | — | — | — | — | — | — | — |  |
| 3dtiles:geometric_error | num | — | ●⚡ | — | — | — | — | — | — |  |
| 3dtiles:tile_format | enum | — | ●⚡ | — | — | — | — | — | — |  |
| pc:count | int | — | — | ●⚡ | — | — | — | — | — |  |
| pc:encoding | enum | — | — | ●⚡ | — | — | — | — | — |  |
| pc:las_version | str | — | — | ◐⚡ | — | — | — | — | — |  |
| ortho:gsd | num | — | — | — | ●⚡ | — | — | — | — |  |
| ortho:bit_depth | int | — | — | — | ◐⚡ | — | — | — | — |  |
| image:camera_model | str | — | — | — | — | ●⚡ | — | — | — | EXIF |
| image:capture_type | enum | — | — | — | — | ● | — | — | — |  |
| panorama:type | enum | — | — | — | — | — | ● | — | — |  |
| panorama:capture_position | Point | — | — | — | — | — | ● | — | — |  |
| video:duration | num | — | — | — | — | — | — | ●⚡ | — |  |
| video:codec | str | — | — | — | — | — | — | ●⚡ | — |  |
| video:capture_type | enum | — | — | — | — | — | — | ● | — |  |
| document:type | enum | — | — | — | — | — | — | — | ● |  |
| document:title | str | — | — | — | — | — | — | — | ● |  |
| document:authors | array | — | — | — | — | — | — | — | ● |  |
