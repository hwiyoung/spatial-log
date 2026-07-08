# Ontology v0 User Input Template

이 문서는 온톨로지 v0를 실제 데이터에 맞추기 위해 사용자가 제공하면 좋은
정보를 정리하는 양식이다. 모든 항목이 한 번에 필요하지는 않다. 첫 실데이터
프로젝트 1-2개만 기준으로 채워도 PoC를 시작할 수 있다.

## 1. Canonical Sites

프로젝트/현장 단위의 공식 명칭과 별칭.

| Site concept ID | 공식 한글명 | 공식 영문명 | 별칭/표기 흔들림 | 비고 |
| --- | --- | --- | --- | --- |
| `bulguksa` | 경주 불국사 | Bulguksa Temple | 불국사, Bulguksa, gyeongju-bulguksa | 예시 |

## 2. Canonical Targets

실제 물리 대상 또는 반복적으로 검색/관계 연결되는 세부 대상.

| Target concept ID | Site concept ID | 공식 한글명 | 공식 영문명 | 별칭/파일명 패턴 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `bulguksa_dabotap` | `bulguksa` | 불국사 다보탑 | Dabotap Pagoda | 다보탑, Dabotap, dabo_tap, dabotap | 예시 |

## 3. Document Types Used By The Team

`document` 안에서 실제로 구분해야 하는 문서 유형.

Canonical field: `properties.document:type`

| Concept ID | 문서 유형 후보 | 실제 팀 표현 | 검색/관계에서 구분 필요 여부 | 예시 파일명 |
| --- | --- | --- | --- | --- |
| `survey_report` | 조사/실측 보고서 |  |  |  |
| `excavation_report` | 발굴 조사 보고서 |  |  |  |
| `analysis` | 분석 문서 |  |  |  |
| `permit` | 인허가 문서 |  |  |  |
| `plan` | 계획서 |  |  |  |
| `drawing` | 도면 |  |  |  |
| `bibliography` | 참고문헌 |  |  |  |
| `specification` | 시방서/사양서 |  |  |  |
| `meeting_minutes` | 회의록 |  |  |  |
| `photograph_log` | 사진 대장 |  |  |  |
| `quality_report` | 품질/정확도 보고서, SAMS extension 후보 |  |  |  |
| `delivery_manifest` | 납품 목록, SAMS extension 후보 |  |  |  |

## 4. Relation Suggestion Policy

자동제안이 너무 적극적이면 노이즈가 생긴다. 아래 정책을 먼저 정한다.

| Relation | 현재 후보 정책 | 사용자가 결정할 것 |
| --- | --- | --- |
| `derived_from` | 후보가 1개일 때 기본 수락 가능, N:M이면 확인 필요 | 어떤 category pair를 허용할지 |
| `related` | 같은 target의 다른 유형이면 후보 제안 | 기본 체크 여부 |
| `describedby` | document와 나머지 전조합이라 노이즈 가능 | 어떤 문서 유형만 제안할지 |
| `prev` / `next` | 업로드 단계에서는 자동 제안 보류 | time series 자동제안이 필요한지 |

## 5. Broader Filter Decisions

Explorer나 API에서 상위 개념 필터를 노출할지 결정한다.

| Broader concept | 포함 category | UI 노출 여부 | 비고 |
| --- | --- | --- | --- |
| `three_dimensional_asset` | `pointcloud`, `3d_model`, `3d_tiles` |  | "3D 데이터" 필터 후보 |
| `raster_asset` | `orthoimage`, `image`, `panorama`, `video` |  |  |
| `documentation_asset` | `document` |  |  |

## 6. First PoC Dataset

온톨로지 v0 PoC에 쓸 작은 데이터셋.

| 항목 | 값 |
| --- | --- |
| Collection ID |  |
| Site |  |
| Target 1 |  |
| Target 2 |  |
| 포함 데이터 유형 |  |
| 포함 문서 유형 |  |
| 검증하고 싶은 검색 문장 |  |
| 검증하고 싶은 관계 제안 |  |

## Minimum Input For PoC

PoC 시작에 필요한 최소 입력은 아래 3가지다.

1. 첫 프로젝트의 site 1개와 alias 목록.
2. target 3-5개와 alias/파일명 패턴.
3. `derived_from`, `related`, `describedby` 중 자동제안에서 가장 조심해야 할 관계.
