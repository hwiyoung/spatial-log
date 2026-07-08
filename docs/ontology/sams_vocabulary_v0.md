# SAMS Vocabulary v0

This document is the human-readable version of
`sams-api/sams/ontology/vocabulary.yml`.

## Naming

Stable concept IDs use lowercase snake case. They are not display labels and should
not be translated. Display text belongs in `label_ko` and `label_en`.

## Concept Schemes

### Asset Category

Asset category concepts map directly to existing `properties.data_category`
values. They are stable wrappers around the current enum, not replacements for it.

| Concept ID | STAC value | Korean label | Broader concepts |
| --- | --- | --- | --- |
| `pointcloud` | `pointcloud` | 포인트 클라우드 | `three_dimensional_asset`, `spatial_asset` |
| `3d_model` | `3d_model` | 3D 모델 | `three_dimensional_asset`, `spatial_asset`, `derived_asset` |
| `3d_tiles` | `3d_tiles` | 3D Tiles | `three_dimensional_asset`, `spatial_asset`, `derived_asset` |
| `orthoimage` | `orthoimage` | 정사영상 | `raster_asset`, `spatial_asset`, `derived_asset` |
| `image` | `image` | 원본 이미지 | `raster_asset`, `spatial_asset` |
| `panorama` | `panorama` | 파노라마 | `raster_asset`, `spatial_asset` |
| `video` | `video` | 동영상 | `raster_asset`, `spatial_asset` |
| `document` | `document` | 문헌정보 | `documentation_asset` |
| `unknown` | `unknown` | 미분류 | none |

### Category Group

Group concepts are for search/filter expansion.

| Concept ID | Korean label | Narrower concepts |
| --- | --- | --- |
| `spatial_asset` | 공간 산출물 | all located assets |
| `three_dimensional_asset` | 3D 공간 데이터 | `pointcloud`, `3d_model`, `3d_tiles` |
| `raster_asset` | 영상/래스터 데이터 | `orthoimage`, `image`, `panorama`, `video` |
| `documentation_asset` | 문서 산출물 | `document` |
| `derived_asset` | 파생 산출물 | `3d_model`, `3d_tiles`, `orthoimage` |

### Relation Type

Relation concepts map to `links[].rel`.

| Concept ID | STAC rel | Korean label | Inverse | Symmetric | Primary authoring |
| --- | --- | --- | --- | --- | --- |
| `derived_from` | `derived_from` | 원본에서 파생 | `has_derived` | no | yes |
| `has_derived` | `has_derived` | 파생 산출물 보유 | `derived_from` | no | no, generated reverse |
| `related` | `related` | 관련/동시취득 | `related` | yes | yes |
| `describedby` | `describedby` | 설명 문서 | `describes` | no | yes |
| `describes` | `describes` | 설명 대상 | `describedby` | no | yes, existing UI |
| `prev` | `prev` | 이전 시점 | `next` | no | yes, manual only |
| `next` | `next` | 다음 시점 | `prev` | no | yes, manual only |

### Processing Level

Processing level concepts map to `properties.processing:level`.

| Concept ID | Korean label |
| --- | --- |
| `raw` | 원본 |
| `processed` | 처리됨 |
| `derived` | 파생됨 |
| `final` | 최종본 |

### Document Type

Document type is a subtype concept for `properties.data_category = document`.
The canonical field follows the current STAC metadata design.

Candidate field:

- `properties.document:type`

| Concept ID | Korean label |
| --- | --- |
| `survey_report` | 조사/실측 보고서 |
| `excavation_report` | 발굴 조사 보고서 |
| `analysis` | 분석 문서 |
| `permit` | 인허가 문서 |
| `plan` | 계획서 |
| `drawing` | 도면 |
| `bibliography` | 참고문헌 |
| `specification` | 시방서/사양서 |
| `meeting_minutes` | 회의록 |
| `photograph_log` | 사진 대장 |
| `quality_report` | 품질/정확도 보고서, SAMS extension candidate |
| `delivery_manifest` | 납품 목록, SAMS extension candidate |
| `unknown_document` | 문서 유형 미상 |

## Site Concepts

Site concepts are stable IDs for `properties.project:site` and Collection
`summaries.project:site` labels. The human label remains in STAC; the concept ID
is an additive sibling.

| Concept ID | Korean label | Broader site | Notes |
| --- | --- | --- | --- |
| `bulguksa` | 경주 불국사 | none | mock/seed Collection |
| `sogang_bridge` | 서강대교 | none | real-data site concept |
| `seongsu_dong` | 성수동 | none | real-data area/site concept |
| `kp_dormitory` | 본기숙사 | `seongsu_dong` | KP dormitory is inside Seongsu-dong |

Deferred alias:

- `성수` is not yet an alias of `seongsu_dong`; it remains a review item until
  project labels prove it is the same site scope.

## Target Concepts

Target concepts are stable IDs for `properties.target` labels. They are scoped by
site whenever possible.

| Concept ID | Site | Korean label | Notes |
| --- | --- | --- | --- |
| `bulguksa_dabotap` | `bulguksa` | 다보탑 | mock/seed target |
| `bulguksa_seokgatap` | `bulguksa` | 석가탑 | mock/seed target |
| `bulguksa_daeungjeon` | `bulguksa` | 대웅전 | mock/seed target |
| `bulguksa_overview` | `bulguksa` | 불국사 전경 | mock/seed target |
| `bulguksa_all` | `bulguksa` | 불국사 전체 | mock/seed target |
| `seongsu_emart` | `seongsu_dong` | 이마트 | real-data target concept |

## Runtime Additions To Consider Later

These fields are additive and should not be required in v0:

| Field | Meaning |
| --- | --- |
| `properties.sams:category_concept` | stable concept ID for `data_category` |
| `properties.sams:target_concept` | stable target concept ID |
| `properties.sams:site_concept` | stable site concept ID |
| `properties.document:type` | document subtype concept ID |
| `properties.sams:ontology_version` | vocabulary version used at registration/update |
