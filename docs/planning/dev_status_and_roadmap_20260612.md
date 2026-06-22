# SAMS 개발 현황 및 실데이터 업로드 베타 준비 현황 (2026-06-22)

> 목적: 현재 구현 상태를 실데이터 업로드 검증 관점에서 정리하고, 내부 베타 전에 무엇을 확인해야 하는지 한눈에 보이게 한다.
> 기준: 내부망 검증, 브라우저 업로드, 수백 GB급 실데이터, read-write 기능 검증.

---

## 0. 현재 결론

SAMS는 새 기능을 크게 늘릴 단계가 아니라, **실데이터를 실제 브라우저로 업로드하면서 보관·검색·수정 흐름이 깨지지 않는지 검증할 단계**다.

- 백엔드 엔진(자동 채움, STAC 등록, 업로드, 관계, 이력)은 대부분 구현돼 있다.
- 프론트엔드 주요 화면(Explorer, Detail, Project, Upload, MetadataCompletion)은 비-mock 모드에서 실 API와 연결돼 있다.
- 이번 내부 베타의 통과 기준은 **3D 관계뷰를 제외한 전 기능**이다.
- 3D 관계뷰는 v1 핵심 방향이지만, 이번 실데이터 업로드 베타에서는 **Beta 토글 + 검증 제외/실험 기능 라벨**로 둔다.
- 가장 큰 리스크는 **수백 GB 브라우저 업로드**와 **수정/삭제/move/related link 변경 같은 변경 경로**다.

---

## 1. 이번 내부 베타 컷

| 항목 | 결정 |
|---|---|
| 대상 | 내부 검증자 |
| 네트워크 | 내부망 |
| 기본 스택 | 정식 `sams-*` 스택 |
| 예외 스택 | 대용량 업로드 위험을 분리해야 하면 `sams-hwiyoung-*` 등 별도 테스트 스택 사용 가능 |
| 업로드 방식 | 브라우저 업로드 |
| 실데이터 유형 | 3D Tiles, 포인트 클라우드, 원본 이미지 |
| 데이터 크기 | 수백 GB |
| 검증 범위 | 3D 관계뷰를 제외한 read-write 전 기능 |
| 포함 변경 경로 | 속성 수정, 위치 수정, status 변경, move, delete, related link 추가/삭제 |
| 산출물 | 내부 베타 검증 리포트 |
| 3D 관계뷰 | 화면에는 남기되 `Beta`, `검증 제외`, `실험 기능` 라벨을 명확히 표시 |

이번 컷은 외부 공개 베타가 아니다. 공인 도메인, 외부 TLS, 외부 클라이언트 계정, 외부망 presigned endpoint 검증은 다음 단계로 분리한다.

---

## 2. 현재 진행 상황

| 영역 | 현재 상태 | 실데이터 업로드 전 확인할 것 |
|---|---|---|
| 자동 채움 파이프라인 | bundle/detect/extract/inherit/suggest/thumbnail 흐름 구현. 실패해도 등록을 계속하는 graceful degradation 있음. | 3D Tiles, 포인트 클라우드, 원본 이미지에서 자동 채움률과 수동 입력 셀 수를 측정한다. |
| STAC 등록 | analyze -> register -> pgSTAC 등록, S3 저장, 링크 생성 흐름 구현. | Collection/Item/Asset 필드가 실데이터에서 STAC v4 설계와 맞는지 확인한다. |
| 대용량 업로드 | 프론트 Upload가 단건/벌크/폴더 재귀와 presigned 직행 경로를 갖고 있음. | 수백 GB 브라우저 업로드에서 타임아웃, 중단, 재시도, 브라우저 메모리, 진행률 복구를 확인한다. |
| Explorer/Detail/Project | 비-mock 모드에서 실 API와 연결. 지도/list/filter/detail/관계/이력 화면이 존재. | 업로드된 실 Item이 Explorer와 Detail에서 빠짐없이 보이고 검색/필터가 동작하는지 확인한다. |
| 변경 경로 | status, related, properties, location, move, delete API가 wired. | 자동 테스트가 부족하므로 수동 검증 리포트에서 필수 통과 항목으로 다룬다. |
| 운영 구성 | 정식 스택과 내부 테스트 스택을 분리해서 운용할 수 있음. nginx/prod frontend/test router/CORS/백업 정리가 진행 중. | 실제 업로드 전 스택·볼륨·DB·MinIO 버킷이 검증 대상과 분리돼 있는지 확인한다. |
| 썸네일 | 일반 이미지/영상/문서 흐름이 있고, 3D Tiles는 렌더 대신 placeholder 방식으로 보완 중. | 실 UI에서 thumbnail 상태가 available/pending/missing/failed 중 올바르게 보이는지 확인한다. |
| 3D 관계뷰 | deck.gl 기반 Beta 방향으로 정리 중. | 이번 베타의 통과 기준에서는 제외한다. 단, 토글 라벨과 기본 진입점은 확인한다. |

---

## 3. 내부 베타 검증 범위

### 포함

1. Collection 생성과 기본값 설정
2. 브라우저 기반 실데이터 업로드
3. analyze 결과 확인
4. MetadataCompletion에서 필수값 보완
5. register/publish
6. Explorer 지도/list/filter/search 확인
7. Detail 메타데이터, 원본 다운로드, preview 상태 확인
8. Project dashboard와 Collection별 상태 확인
9. status 변경
10. properties/location 수정
11. related link 추가/삭제
12. move
13. delete
14. history/timeline 표시
15. DB와 MinIO 저장 결과의 정합성 확인

### 제외

1. 3D 관계뷰의 실데이터 통과 판정
2. production 3D Tiles viewer
3. production point cloud viewer
4. 모델/포인트클라우드 변환 파이프라인
5. 외부 공유 링크
6. 외부 공개망/TLS/named client 계정 검증

3D는 제품 방향상 핵심이지만, 이번 내부 베타에서는 업로드·보관·검색·수정 안정화가 먼저다.

---

## 4. 실데이터 업로드 실행 순서

### A. 업로드 전 준비

| 체크 | 내용 | 완료 기준 |
|---|---|---|
| 스택 선택 | 기본은 `sams-*`, 위험 분리 필요 시 테스트 스택 사용 | 검증 리포트에 사용 스택 기록 |
| 저장소 분리 | DB, MinIO bucket/data root, volume, host port 확인 | 정식 데이터와 테스트 데이터가 섞이지 않음 |
| 백업 | 업로드 전 DB dump와 MinIO snapshot 확보 | 복구 위치와 명령 기록 |
| 브라우저 경로 | 내부망에서 프론트, API, STAC, presigned upload 경로 접근 확인 | 동일 브라우저에서 small upload 성공 |
| 3D Beta 표시 | 3D 관계뷰 토글에 Beta/검증 제외 라벨 표시 | 기본 진입점은 2D Explorer/List |

### B. 소형 스모크

1. 테스트 Collection 1개 생성
2. 작은 3D Tiles 샘플 1개 업로드
3. 작은 point cloud 샘플 1개 업로드
4. 원본 이미지 소량 업로드
5. analyze -> register -> Explorer -> Detail 확인
6. status/properties/related/move/delete 각각 1회 수행

소형 스모크가 실패하면 수백 GB 업로드로 넘어가지 않는다.

### C. 대표 실데이터 배치 업로드

| 배치 | 데이터 | 확인할 핵심 |
|---|---|---|
| 1 | 3D Tiles bundle | tileset.json 인식, bundle grouping, asset href, bbox/geometry, thumbnail/preview 상태 |
| 2 | 포인트 클라우드 | LAS/LAZ/E57 감지, CRS 추출, bbox, point count 등 pc 필드 |
| 3 | 원본 이미지 폴더 | EXIF/GPS, 촬영 시각, 이미지셋 grouping, thumbnail 생성, 대량 파일 UI 진행률 |

처음부터 전체 수백 GB를 한 번에 넣지 않는다. 대표 배치가 통과한 뒤 전체 업로드로 확장한다.

### D. 전체 업로드

1. 업로드 시작 시각, 브라우저, 네트워크, 스택, 데이터 경로 기록
2. 진행률이 멈추는 구간 기록
3. 실패 파일과 재시도 결과 기록
4. register 이후 Item 수, Asset 수, Collection summary 확인
5. MinIO 저장량과 DB Item 수의 대략 정합성 확인

---

## 5. 검증 리포트 양식

아래 양식을 그대로 복사해서 내부 베타 1회 실행마다 채운다.

```md
# SAMS 내부 베타 검증 리포트

## 1. 실행 정보
- 날짜:
- 검증자:
- 사용 스택: sams-* / sams-hwiyoung-* / 기타
- 프론트 URL:
- 데이터 위치:
- 브라우저:
- 총 데이터 크기:
- Collection:

## 2. 요약
| 항목 | 결과 | 비고 |
|---|---|---|
| 소형 스모크 | PASS/FAIL |  |
| 3D Tiles 업로드 | PASS/FAIL |  |
| 포인트 클라우드 업로드 | PASS/FAIL |  |
| 원본 이미지 업로드 | PASS/FAIL |  |
| Explorer/Detail 확인 | PASS/FAIL |  |
| 변경 경로 확인 | PASS/FAIL |  |
| 저장소 정합성 | PASS/FAIL |  |
| 3D Beta 라벨 | PASS/FAIL | 통과 기준에는 미포함 |

## 3. 업로드 결과
| 데이터 유형 | 파일/폴더 수 | 크기 | 성공 | 실패 | 재시도 성공 | 소요 시간 |
|---|---:|---:|---:|---:|---:|---:|
| 3D Tiles |  |  |  |  |  |  |
| 포인트 클라우드 |  |  |  |  |  |  |
| 원본 이미지 |  |  |  |  |  |  |

## 4. 자동 채움 결과
| 데이터 유형 | 자동 채움이 잘 된 필드 | 수동 보완한 필드 | 실패/누락 필드 |
|---|---|---|---|
| 3D Tiles |  |  |  |
| 포인트 클라우드 |  |  |  |
| 원본 이미지 |  |  |  |

## 5. 변경 경로 검증
| 기능 | 결과 | 확인 내용 |
|---|---|---|
| status 변경 | PASS/FAIL |  |
| properties 수정 | PASS/FAIL |  |
| location 수정 | PASS/FAIL |  |
| related link 추가 | PASS/FAIL |  |
| related link 삭제 | PASS/FAIL |  |
| move | PASS/FAIL |  |
| delete | PASS/FAIL |  |
| history/timeline | PASS/FAIL |  |

## 6. 문제 목록
| 심각도 | 화면/API | 증상 | 재현 방법 | 임시 대응 | 후속 작업 |
|---|---|---|---|---|---|
| Blocker/Major/Minor |  |  |  |  |  |

## 7. 판정
- 전체 판정: GO / NO-GO
- GO 조건:
- NO-GO 사유:
- 다음 실행 전 필수 수정:
```

---

## 6. GO / NO-GO 기준

### GO

- 소형 스모크가 통과한다.
- 대표 3D Tiles, 포인트 클라우드, 원본 이미지가 브라우저로 업로드된다.
- 업로드 후 Explorer/Detail/Project에서 Item이 누락 없이 확인된다.
- status/properties/location/related/move/delete가 최소 1회씩 통과한다.
- 실패 파일이 있어도 실패 원인과 재시도 결과가 리포트에 남는다.
- DB와 MinIO 저장 결과가 크게 어긋나지 않는다.
- 3D 관계뷰는 Beta/검증 제외로 표시되어 사용자가 통과 기준으로 오해하지 않는다.

### NO-GO

- 브라우저 업로드가 대표 배치에서 반복 실패한다.
- register 실패 후 S3/DB에 불완전 데이터가 남는다.
- delete/move/status/related 변경 중 데이터 유실 또는 DB/S3 불일치가 발생한다.
- Explorer/Detail에서 등록된 Item을 찾을 수 없다.
- 정식 데이터와 테스트 데이터가 같은 DB/버킷/볼륨에 섞인다.
- 백업 없이 수백 GB 업로드를 진행해야 하는 상황이다.

---

## 7. 남은 리스크

1. **수백 GB 브라우저 업로드**: 네트워크 중단, 브라우저 메모리, presigned URL 만료, 재시도 정책이 실제 데이터에서 검증되지 않았다.
2. **변경 경로 자동 테스트 부족**: move/delete/properties/location/related/status는 구현돼 있지만 회귀 테스트가 부족하다.
3. **실파일 자동 채움률 미측정**: 더미 fixture가 아니라 실제 3D Tiles/point cloud/image에서 추출률을 봐야 한다.
4. **스택 혼선**: 정식 `sams-*`와 테스트 스택의 포트, 볼륨, DB, MinIO namespace가 섞이면 검증 결과를 신뢰할 수 없다.
5. **3D 범위 혼동**: 3D 관계뷰는 v1 핵심 방향이지만 이번 내부 베타의 통과 기준은 아니다.

---

## 8. develop 반영 전 체크

1. 이 문서가 내부 베타 기준으로 정리돼 있는지 확인한다.
2. 검증 리포트 양식 또는 별도 리포트 문서를 추가한다.
3. 3D 관계뷰 토글에 Beta/검증 제외 라벨을 반영한다.
4. 운영/배포 변경과 문서 변경을 커밋 단위로 분리한다.
5. 백엔드 테스트와 프론트 빌드를 실행한다.
6. `feature/hwiyoung`을 최신 `origin/develop` 기준으로 merge 가능 여부 확인 후 `develop`에 반영한다.

---

## 9. 참조 문서

- `docs/stac_metadata_design_v4.md` - STAC Collection/Item/Asset 필드 기준
- `docs/autofill_pipeline_spec.md` - 자동 채움 기준
- `docs/system_architecture.md` - API, 파일 서빙, 보안 기준
- `docs/frontend_contracts.md` - Explorer/preview/manual UI 계약
- `docs/adr/ADR-3d-relationship-deckgl.md` - deck.gl 기반 3D 관계뷰 방향
- `docs/adr/ADR-preview-asset-delivery-policy.md` - preview/asset 전달 정책
