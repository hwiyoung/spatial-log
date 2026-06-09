# SAMS 회의 도출 수정사항 및 Phase 진행상황 업데이트

2026-06-05 회의 반영본 · Explorer / 3D GIS / Upload 테스트 계획

## 요약

- **핵심 판단**: Phase 0~6D는 Explorer Mock UX v1 checkpoint로 완료되었고, Phase 7B pseudo-3D designed Beta는 기능 gate를 통과했지만 제품/디자인 gate에서 3D감이 부족했다.
- **현재 3D GIS 상태**: Phase 7C에서 Three.js true 3D interaction spike를 완료했고, Phase 7D에서 MapLibre 배경지도 위에 Three.js object를 얹는 map-grounded 3D 방향을 검증했다. Phase 7D-S에서는 깜빡임, hover churn, scene rebuild 문제를 줄이는 안정화 checkpoint를 완료했다.
- **현재 제품 방향**: Explorer 기본 화면은 계속 2D map/list/filter이다. 3D GIS는 선택형 Beta이며, global Relationship Graph는 Explorer 기본 화면으로 되돌리지 않는다.
- **남은 핵심 요구**: 2026-06-05 회의에서 추가된 3D model boundary, drone coverage, GIS 형식 자동 분류, scale/LOD, relation highlight, time-series highlight, parsing failure diagnostics는 후속 phase로 분리한다.
- **다음 우선순위**: Phase 7E는 안정화된 map-grounded renderer 위에 coverage/boundary/LOD를 얹을 수 있는지 검증한다. 관계/시계열 하이라이트는 그 다음 3D interaction phase로 넘기고, upload/자동분류/파싱 실패 진단은 Phase 10D~10E로 넘긴다.

## 1. 2026-06-05 회의 반영 핵심 수정사항

| 구분 | 반영 내용 | 현재 처리 |
|---|---|---|
| 3D 모델 면적·부피·바운더리 | 정사영상, 3D 모델, 드론 데이터는 면적/부피 산출 방식이 다르므로 데이터 유형별 coverage/boundary/volume 정책이 필요하다. | Phase 7E 후보. Phase 7D-S까지는 renderer 기반 안정화만 완료 |
| 드론 데이터 커버리지 | 드론 사진을 단순 포인트로만 보여주면 범위가 혼란스러울 수 있다. 드론 사진/정사영상/비행 궤도는 point, line, polygon/coverage로 구분해 표출해야 한다. | Phase 7E 후보 |
| GIS 형식 자동 분류 | POI와 드론 사진은 point, 비행 궤도는 line 또는 polygon, 정사영상/3D 모델은 coverage/footprint로 자동 분류하는 ingestion 규칙이 필요하다. | Phase 10E 후보 |
| 스케일별 표출 | 2D에서는 icon 중심, 3D에서는 zoom level에 따라 실제 데이터 형태 또는 icon으로 전환하는 LOD/scale 정책이 필요하다. | Phase 7E 후보 |
| 관계 시각화 강화 | 클릭 시 관련 데이터 하이라이트, 멀리 떨어진 노드 간 edge 가시성, relation focus mode, 시간 순서 하이라이트가 필요하다. | 선택 item 1-depth는 완료. long edge/time-series는 후속 |
| 실패 사유·메타데이터 | 데이터 파싱 실패, preview 실패, 변환 실패의 사유를 기록하고 UI에서 확인 가능하게 해야 한다. | preview diagnostics는 완료. upload/parser diagnostics는 Phase 10E 후보 |
| 실데이터 업로드 테스트 | 페인기 데이터 전체를 우선 업로드해 실제 사용성 테스트를 진행하고, 추가 데이터는 직접 업로드·수정하면서 피드백을 수집한다. | Phase 10D 후보 |
| 프로젝트 단위 연계 | 여러 프로젝트에 할당되는 데이터는 custom field 또는 multi-project assignment 정책이 필요하다. 공간적으로 다른 데이터는 별도 project로 묶되 relation으로 연결한다. | Phase 9B / 11C 후보 |
| 후속 회의 준비 | 후속 회의 전까지 3D GIS 감각 검증과 실데이터 테스트가 가능한 상태를 만드는 것이 좋다. | 3D GIS renderer 감각 검증은 7C~7D-S까지 진행. 실데이터 테스트는 후속 |

## 2. 통합 Phase 정의

| Phase | 의미적 이름 | 쉬운 설명 | 현재 상태 |
|---|---|---|---|
| 0 | Mock으로 안전하게 실험하기 | 실제 운영 데이터 없이 회의 수정사항을 클릭 검증할 수 있게 mock 프로젝트/아이템을 만든다. | 완료 |
| 1 | 지도와 목록을 같은 결과로 묶기 | Explorer의 기본 뼈대를 2D 지도 + 결과 목록 + 필터로 고정하고 같은 visibleItems가 지도와 목록에 보이게 한다. | 완료 |
| 2 | 상태/프로젝트/이름을 바로 보이게 하기 | Draft, Published, 프로젝트명, 사이트, 사람이 읽는 이름을 Detail 진입 전 목록/지도/패널에서 보이게 한다. | 완료 |
| 3 | 클릭하면 판단 가능한 오른쪽 패널 | Item 클릭 시 preview, 원본명, 프로젝트, Draft 사유, metadata gaps, spatial state, relation summary를 보여준다. | 완료 |
| 4 | 선택 데이터의 관계만 지도에서 보기 | 전체 그래프가 아니라 선택 Item의 1-depth 관계만 지도 위 선/하이라이트로 표시한다. | 완료 |
| 5 | 3D GIS Beta 계약 검증 | 2D 기본 화면을 유지한 채, 같은 필터/선택/패널/관계 의미가 3D-ish 화면에서도 유지되는지 검증한다. | 완료 - Beta |
| 6A | 미리보기 상태 정의 | available/pending/missing/failed와 데이터 유형별 preview/viewer 계약을 정의한다. | 완료 |
| 6B | 미리보기 버튼이 여는 ViewerShell | preview action 클릭 시 유형별 가벼운 shell이 열리게 한다. 실제 heavy viewer는 붙이지 않는다. | 완료 |
| 6C | 이미지/정사영상 source 연결 | image/orthoimage에 한해 preview asset source를 정규화하고 안전한 loading/fallback을 검증한다. | 완료 |
| 6D | 이미지/정사영상 보기 편의성과 진단 | zoom/reset, source diagnostics, unsupported MIME, mock:// 차단 등 운영 전 진단을 강화한다. | 완료 |
| 6E | 운영 preview delivery 계약 | signed URL, auth, proxy, preview generation backend를 다룬다. 필요 시 착수하는 조건부 Phase다. | 조건부 후속 |
| 7A | 디자인된 3D GIS 설계/격차 분석 | 현재 pseudo-3D Beta와 목표 3D GIS 디자인 사이의 차이를 정리하고 7B 구현 범위를 확정한다. | 완료 |
| 7B | 선택 중심 3D GIS Beta 구현 | 선택 asset 중심 focus, hover, legend, zSource, relation focus를 pseudo-3D 위에서 구현한다. | 기술 완료 / 디자인 부분완료 |
| 7C | True 3D Renderer Spike | Three.js true 3D renderer로 orbit/zoom/depth/ray picking/selected relation line을 검증한다. | 완료 - spike |
| 7D | Map-grounded 3D GIS Grounding | MapLibre 배경지도 위에 Three.js asset object를 얹어 georeferenced 3D 방향을 검증한다. | 완료 - spike |
| 7D-S | Map-grounded 3D Renderer Stability | custom layer flicker, scene rebuild, hover jitter, depth/transparency 문제를 줄여 다음 geometry phase의 기반을 안정화한다. | 완료 - 안정화 |
| 7E | Coverage / Boundary / LOD | drone coverage, 3D model footprint/boundary, scale별 icon/object 전환 정책을 map-grounded 3D 위에서 검증한다. | 다음 후보 |
| 7F | 3D 관계·시계열 하이라이트 | long edge, off-screen relation hint, prev/next time-series highlight를 3D GIS와 Detail 흐름으로 나눈다. | 후속 후보 |
| 8A | Draft 보완 화면 | Draft Item의 누락 메타데이터를 입력하고 보완하는 편집 흐름을 만든다. | 예정 |
| 8B | Published 전환 기준 | 어떤 조건이 충족돼야 Draft를 Published로 바꿀 수 있는지 품질 규칙을 정한다. | 예정 |
| 9A | 프로젝트 정보 편집 | 개요, 기간, 발주처, PM, 기본 좌표계 등 프로젝트 정보를 수정할 수 있게 한다. | 예정 |
| 9B | 프로젝트-에셋 연결/미할당 정리 | Project에서 에셋을 담고, upload-* 빈 프로젝트 문제와 Unassigned 정책을 정리한다. | 예정 |
| 9C | 프로젝트 대시보드/지도/타임라인 | Project 현황, 공간 지도, Draft 탭, 전체 목록, timeline/lineage를 통합한다. | 예정 |
| 10A | Upload 완료 후 이동/보완 | 업로드 완료 후 Detail, Project, metadata 보완 화면으로 자연스럽게 이동한다. | 예정 |
| 10B | 대용량 업로드 안정화 | 413 에러, 업로드 개수/용량 제한, chunking/분할 업로드 정책을 정리한다. | 예정 |
| 10C | 업로드 중 관계/메타데이터 복사 | Upload 단계에서 관계 설정, 기존 데이터에서 metadata 가져오기, 시계열 입력을 지원한다. | 예정 |
| 10D | 실데이터 업로드 사용성 테스트 | 페인기 등 실제 데이터 묶음을 업로드해 사용성·성능·실패 사유를 수집한다. | 신규 우선 |
| 10E | 데이터 형태 자동 분류와 파싱 실패 진단 | 업로드 시 point/line/polygon/coverage를 추정하고 실패 사유를 기록한다. | 신규 예정 |
| 11A | 관계 생성/수정 UI | 사용자가 derived_from, related, describedby, prev/next 등을 직접 연결/수정한다. | 예정 |
| 11B | Detail mini graph / 다단계 관계 | Detail에서 현재 Item 중심 관계 그래프와 2-hop 이상 관계 탐색을 제공한다. | 예정 |
| 11C | 실제 Relation API 연결 | mockRelations가 아니라 실제 STAC links/relation endpoint와 연결한다. | 예정 |
| 12A | 운영 Preview Backend 계약 | thumbnail/overview/preview asset delivery, signed URL, auth, proxy 정책을 구현 단계로 넘긴다. | 예정 |
| 12B | 유형별 Production Viewer Pilot | PDF, video, 3D model, panorama, point cloud, 3D Tiles를 우선순위별로 실제 viewer와 연결한다. | 예정 |
| 12C | Thumbnail/Preview 생성 Worker | 썸네일 자동 생성, AI 추천/수동 지정, point cloud/3D model/3D Tiles 변환 pipeline을 다룬다. | 예정 |
| 13 | 권한/운영 정책 | 관리자/뷰어, 다운로드 제한, 로컬 설치형/웹 서비스형 운영 정책을 정리한다. | 예정 |

## 3. 수정사항-Phase 매칭 및 현재상황 확인

| 회의 도출 수정사항(쉬운 용어) | 개발 Phase | 의미 | 완료여부 |
|---|---|---|---|
| 사람이 알아볼 수 있는 파일명 보여주기 | Phase 2 | 목록/패널에서 title/display name/original filename을 우선 표시 | 완료, mock 기준 |
| 프로젝트명과 사이트를 바로 보기 | Phase 2 / 3 | Explorer 목록/패널에서 project/site/unassigned 표시 | 완료, mock 기준 |
| Draft 파일을 빨리 찾기 | Phase 2 | Draft filter, Draft badge, status count 표시 | 완료, mock 기준 |
| Draft인 이유와 빠진 정보 보기 | Phase 3 | draft reason, missing fields, metadata gaps 표시 | 완료, 편집은 후속 |
| Draft를 수정해서 Published로 전환하기 | Phase 8A~8B | metadata 보완 폼, 품질 조건, Published 전환 | 미구현 |
| Explorer를 지도 중심으로 쓰기 | Phase 1 | map/list가 같은 visibleItems를 공유 | 완료 |
| 위치 없는 문서도 숨기지 않기 | Phase 1 / 3 | fallback marker와 spatial summary | 완료, mock 기준 |
| 3D 모델 바운더리/범위 확인 | Phase 7E | 3D model footprint, bbox, boundary 표시 정책 | 다음 후보 |
| 드론 데이터 커버리지 보기 | Phase 7E / 10E | drone photo point, flight line, coverage polygon/footprint 표출 | 다음 후보 |
| GIS 형식 자동 분류 | Phase 10E | upload/ingestion 시 point/line/polygon/coverage 자동 판정 | 미구현 |
| 스케일별 표출 방식 | Phase 7E | zoom level에 따라 icon/cluster/coverage/object 전환 | 다음 후보 |
| 관계를 전체 그래프로 덮지 않기 | Planning / Phase 4 | global graph 폐기, selected overlay로 제한 | 완료 |
| 선택한 데이터의 관계만 보기 | Phase 4 / 7B~7D-S | selected Item 1-depth relation overlay | 완료, mock 기준 |
| 관계 클릭 하이라이트 강화 | Phase 7F / 11B | 3D/2D에서 관련 데이터 하이라이트와 edge 가시성 개선 | 부분완료, 후속 필요 |
| 멀리 떨어진 노드 간 관계 가시성 | Phase 7F | long edge, off-screen hint, focus line 후보 | 미구현 |
| 시간 순서 추적 | Phase 7F / 11B | prev/next 또는 시계열 데이터를 icon/edge highlight로 표시 | 미구현 |
| 실패 사유 및 메타데이터 표출 | Phase 3 / 6A~6D / 10E | preview 실패는 구현, parsing/upload 실패 사유는 후속 | 부분완료 |
| 3D GIS 관계형 화면 만들기 | Phase 5 / 7A~7D-S | pseudo-3D, true 3D, map-grounded 3D, stability checkpoint까지 진행 | 부분완료 |
| 3D GIS를 기본 화면으로 만들지 않기 | Phase 5~7D-S | 2D map/list 기본, 3D는 선택형 Beta | 완료/유지 |
| image/ortho preview 확대/진단 보기 | Phase 6C~6D | preview source, zoom/reset, diagnostics | 완료 |
| 3D 데이터는 저해상도라도 3D 형태 유지 | Phase 7C~7E / 12B | overview는 3D object, production viewer는 별도 | spike 완료, 후속 필요 |
| 2D 데이터는 아이콘화 | Phase 7E | image/document/video 등은 scale에 따라 icon/card로 표현 | 예정 |
| Upload 후 Draft/보완/Project 이동 | Phase 10A | 업로드 완료 후 Detail/Edit/Project CTA | 미구현 |
| 실데이터 전체 업로드 테스트 | Phase 10D | 페인기 데이터 업로드, 실패/성능/UX 피드백 수집 | 신규 우선 |
| 대용량 업로드 413 문제 | Phase 10B | chunking, 제한 안내, 분할 업로드 정책 | 미구현 |
| 프로젝트 편집 | Phase 9A | 개요, 기간, 발주처, PM 수정 | 미구현 |
| Project에서 에셋 직접 담기 | Phase 9B | asset 연결/중복 프로젝트 할당 | 미구현 |
| 여러 프로젝트에 할당되는 데이터 관리 | Phase 9B / 11C | multi-project assignment 또는 custom field 정책 | 미구현 |
| thumbnail/preview 생성 backend | Phase 12C | 썸네일 자동 생성, 변환 worker, 수동 지정 | 미구현 |
| 사용자 권한/운영 | Phase 13 | 관리자/뷰어/다운로드 제한, 로컬/웹 운영 | 미구현 |

## 4. 현재 진행상황 판단

| 영역 | 진행 판단 | 설명 |
|---|---|---|
| Explorer Mock UX | 높음 | Phase 0~6D로 지도/목록/필터/패널/관계/preview contract가 mock 기준 안정화됨 |
| 3D GIS renderer | 중간 이상 | Phase 7C true 3D, Phase 7D map-grounded 3D, Phase 7D-S 안정화까지 진행. coverage/boundary/LOD 전 단계 기반은 마련됨 |
| 3D GIS product UX | 중간 | georeferenced 방향은 맞지만 browser visual QA와 coverage/boundary/LOD가 남아 있음 |
| Preview / Viewer | 중간 | image/ortho는 source·diagnostics까지 완료. production viewer/backend는 후속 |
| 관계 시각화 | 중간 | 선택 Item 1-depth는 구현. long edge, temporal highlight, relation authoring은 후속 |
| Upload / 실데이터 테스트 | 낮음 | mock 중심 검증에서 실데이터 upload/parsing/failure diagnostics 단계로 이동해야 함 |
| Project 관리 | 낮음 | Explorer 표시 수준은 됐지만 Project edit/asset assignment/dashboard는 후속 |
| Backend / 권한 / 운영 | 낮음 | preview generation, large upload, signed URL/auth, 권한은 후속 |

## 5. 이제 무엇을 개발해야 하는가

| 우선순위 | 개발 항목 | 이유 | 기대 산출물 |
|---|---|---|---|
| 1 | Phase 7E Coverage / Boundary / LOD | map-grounded renderer가 안정화되었으므로, 회의에서 제기된 drone coverage, 3D model footprint, scale별 표출을 검증할 차례다. | coverage/boundary mock policy, object/icon LOD, footprint/coverage overlay, browser QA |
| 2 | Phase 10D 실데이터 업로드 테스트 | 설계·mock 검증만으로는 사용성을 판단하기 어렵다. 실제 데이터를 올려야 한다. | 페인기 데이터 upload test, failure reason 수집, 성능/UX 피드백 목록 |
| 3 | Phase 10E 파싱/자동분류 진단 | 데이터 형태 자동 분류와 실패 사유 표시가 필요하다. | point/line/polygon/coverage 자동 판정, parser failure reason, metadata diagnostics |
| 4 | Phase 7F 3D 관계·시계열 interaction | 관계 클릭 하이라이트, 긴 edge 가시성, 시간 순서 추적 요구를 coverage/LOD 이후에 다룬다. | selected relation focus 개선, long-distance relation hint, prev/next temporal highlight |
| 5 | Phase 9 / 11 / 12 / 13 | Project, relation authoring, production viewer/backend, 권한/운영은 product hardening 단계다. | project edit, relation API, preview backend, auth/permission policy |

## 6. 권장 개발 순서

| 시점 | Phase | 해야 할 일 |
|---|---|---|
| 현재 checkpoint | 7D-S | map-grounded renderer flicker/stability 개선 내용을 유지하고 browser visual QA로 통과 기준을 확인한다. |
| 다음 3D GIS 작업 | 7E | coverage/boundary/LOD를 map-grounded 3D 위에 얹어도 안정적인지 검증한다. |
| 병행 준비 | 10D | 실데이터 upload test 체크리스트와 실패 유형 기록 양식을 준비한다. |
| 그 다음 | 10E | GIS 형식 자동 분류와 parsing failure diagnostics를 upload/ingestion 쪽으로 넘긴다. |
| 후속 | 7F / 11B | 3D relation highlight, long edge, time-series, Detail mini graph를 정리한다. |
| 중장기 | 9 / 12 / 13 | Project management, production viewer/backend, 권한/운영을 다룬다. |

## 7. Phase 7C~7D-S 완료 범위

### Phase 7C True 3D Renderer Spike

- Three.js true 3D renderer mode를 추가했다.
- perspective camera, orbit drag, wheel zoom, reset, keyboard fallback을 구현했다.
- category별 3D placeholder geometry를 만들었다.
- raycast hover/click picking을 구현했다.
- click selection은 기존 `onSelectItem(item)`과 Context Panel 흐름을 유지한다.
- relation은 `relationOverlayModel.visibleRelations` 기반 selected Item 1-depth만 표시한다.
- `three` dependency가 추가되었고, deck.gl/Cesium/Potree/model-viewer 등은 추가하지 않았다.

### Phase 7D Map-grounded 3D GIS

- MapLibre 배경지도 위에 Three.js object를 custom layer로 렌더링하는 spike를 추가했다.
- item 위치는 `getItemMapPosition(item)`과 Mercator transform을 사용해 지도 좌표에 연결한다.
- renderer mode는 `Map-grounded 3D`, `True 3D constellation`, `Pseudo fallback`으로 분리했다.
- hover/click은 screen-nearest fallback 전략을 사용한다.
- selected Item 1-depth relation line만 map-grounded layer에 표시한다.
- missing target은 fake node 없이 warning으로만 표시한다.
- Phase 7D에서는 새 dependency와 package/lockfile 변경이 없다.

### Phase 7D-S Map-grounded Renderer Stability

- custom layer `render()` 내부의 repaint 요청을 제거했다.
- scene signature guard로 불필요한 full rebuild를 줄였다.
- hover state와 tooltip projection은 `requestAnimationFrame`으로 throttle했다.
- hover 변화가 Three scene rebuild를 유발하지 않도록 분리했다.
- event listener, custom layer, Three renderer resource cleanup을 명확히 했다.
- transparent material depthWrite, relation line depthTest/renderOrder, object scale을 조정했다.
- coverage/boundary/LOD, time-series highlight, production viewer는 구현하지 않았다.

## 8. Phase 7E 개발 범위 초안

- drone photo: 기본 point marker, 묶음 단위는 photo-set coverage 또는 cluster 표현.
- drone flight path: line 또는 polygon/coverage 후보로 분류.
- orthoimage: footprint/coverage polygon 또는 ortho plate.
- 3D model: bbox/boundary/footprint를 relation·range 확인용 overlay로 사용.
- scale policy: zoom out에서는 icon/cluster, zoom in에서는 coverage/footprint/3D object를 단계적으로 표출.
- object/coverage layer가 MapLibre custom layer stability를 해치지 않는지 browser visual QA로 확인.
- 실제 production pointcloud/3D Tiles/model viewer는 여전히 제외.

## 9. 실데이터 업로드 및 자동분류 후속 범위

- Phase 10D: 페인기 등 실제 데이터 묶음을 upload하고, 실패 사유, parsing 결과, preview 상태, performance, UX 문제를 수집한다.
- Phase 10E: upload/ingestion 단계에서 point/line/polygon/coverage를 추정하고, 실패 사유를 UI에서 확인 가능하게 만든다.
- 실데이터 테스트에서 나온 geometry/coverage 품질 문제는 Phase 7E의 display policy와 다시 연결한다.

## 10. 회의/테스트 운영 계획

- 후속 회의 전까지 map-grounded 3D 안정화 상태와 coverage/boundary/LOD 후보 화면을 준비한다.
- 3D GIS QA는 build 성공만으로 판단하지 않고 30초 이상 pan/zoom/pitch/bearing visual QA를 포함한다.
- upload QA는 업로드 실패, parsing 실패, preview 실패, coverage 누락, relation 누락을 별도 이슈 유형으로 기록한다.
- 사용성 테스트 기준은 찾을 수 있는가, 관계를 이해할 수 있는가, 실패 사유를 알 수 있는가, 3D가 공간 이해에 도움이 되는가로 잡는다.

## 11. 기술 판단 참고

| 참고 | 문서에 반영한 의미 | URL |
|---|---|---|
| STAC Item 구조 | STAC Item은 GeoJSON Feature이며, thumbnail, asset links, relationship links를 포함할 수 있어 Explorer를 공간 asset map 중심으로 설계하는 근거가 된다. | https://stacspec.org/en/about/stac-spec/ |
| Three.js | Perspective camera, WebGLRenderer, Raycaster 등으로 실제 3D scene, camera, picking을 구현할 수 있어 Phase 7C spike 후보로 적합했다. | https://threejs.org/docs/ |
| MapLibre custom layer | MapLibre map render cycle과 WebGL canvas/context를 공유해 지도 위 georeferenced custom 3D layer를 만들 수 있다. | https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/ |
| deck.gl + MapLibre | MapLibre camera와 동기화되는 2D/3D geospatial layer 후보로 coverage/LOD 이후 비교 대상이다. | https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre |
| 3D Tiles | 대규모 3D geospatial content, point cloud, photogrammetry, building 등 production 3D viewer 단계의 장기 후보이다. | https://www.ogc.org/standards/3dtiles/ |

## 부록. 다음 회의에서 확인할 질문

- 3D model의 boundary/footprint는 어떤 경우에 필수로 표출해야 하는가?
- drone data는 사진 단위 point와 flight coverage 중 어느 수준을 기본으로 보여줄 것인가?
- coverage/footprint는 원본 metadata에서 읽을 것인가, upload 후 자동 생성할 것인가?
- scale/LOD 전환 기준은 zoom level, item count, data category 중 무엇을 우선할 것인가?
- relation highlight와 time-series highlight는 3D GIS에서 먼저 확정할지, Detail mini graph에서 먼저 확정할지 결정이 필요한가?
- 실데이터 upload test에서 가장 먼저 올릴 데이터 묶음과 성공 기준은 무엇인가?
- 여러 프로젝트에 걸친 데이터는 multi-project assignment로 처리할지, 별도 project group/custom field로 처리할지 결정이 필요한가?
