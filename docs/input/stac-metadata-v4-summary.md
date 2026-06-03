# STAC Metadata v4 Summary for Explorer 3D Work

이 문서는 `stac_metadata_design_v4.xlsx`의 주요 내용을 Codex가 빠르게 읽기 위한 요약입니다. 원본 Excel은 같은 폴더에 포함되어 있습니다.

## 핵심 변경

- Collection 메타데이터 시트 추가: 프로젝트 수준 메타데이터 정의
- `links` 관계 확정: `derived_from`, `related`, `describedby`, `describes`, `prev`, `next` 포함
- Draft 전환 경로 명시: `properties.status`에서 `draft`, `published`, `archived` 관리

## Explorer 3D GIS Relationship View에 중요한 필드

### STAC Item Core

- `id`: Item 고유 식별자
- `type`: GeoJSON Feature
- `geometry`: 공간 범위
- `bbox`: 바운딩 박스. 2D는 4값, 3D는 6값 가능
- `properties.datetime`: 취득 일시
- `collection`: 소속 Collection/Project
- `assets`: 파일 링크 맵
- `links`: 관련 리소스/관계

### Relation links

우선 지원할 관계:

- `derived_from`: 계보/파생 관계. 방향성 있음.
- `related`: 동시취득 또는 일반 관련 관계. 보통 방향성 약함.
- `describedby`: 문서가 현재 Item을 설명함.
- `describes`: 현재 Item이 다른 Item/리소스를 설명함.
- `prev`: 같은 대상의 이전 시점 데이터.
- `next`: 같은 대상의 다음 시점 데이터.

### Project fields

- `properties.project:name`
- `properties.project:site`
- `properties.project:campaign`

### Data category

`properties.data_category` enum 후보:

- `3d_model`
- `3d_tiles`
- `pointcloud`
- `orthoimage`
- `image`
- `panorama`
- `video`
- `document`

### Status

`properties.status` enum 후보:

- `draft`
- `published`
- `archived`

Explorer 3D 관계도에서는 `draft`를 노드 테두리/배지/필터로 표현해야 합니다.

### Asset title

- `assets.{key}.title`: 사람이 읽을 수 있는 파일 표시 제목
- 이 값이 있으면 Explorer 노드/목록 label로 우선 사용합니다.
- 없으면 `properties.title`, `properties.description`, 원본 파일명, item id 순서로 fallback합니다.
