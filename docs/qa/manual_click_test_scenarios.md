# Manual Click Test Scenarios

Date: 2026-06-02

## Preconditions

Run the frontend and open Explorer with mock mode:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000/?mock=1
```

Docker Compose equivalent:

```bash
docker compose up -d --build frontend
```

Open:

```text
http://localhost:3000/?mock=1
```

If Docker Compose uses feature-stack port overrides, use the configured host ports. The current `sams-hwiyoung` stack commonly exposes:

```text
http://localhost:13000/?mock=1
http://localhost:17800/?mock=1
```

Build/fixture verification should be run inside the active Compose service:

```bash
docker compose exec -T frontend npm run build -- --outDir /tmp/spatial-log-frontend-build --emptyOutDir
docker compose exec -T frontend node --input-type=module - <<'NODE'
import { mockItems } from './src/mocks/fixtures/mockItems.js'
import { mockCollections } from './src/mocks/fixtures/mockCollections.js'
console.log(mockCollections.length, mockItems.length)
NODE
```

## Scenarios

| # | Scenario | Click / Input | Expected Result |
| --- | --- | --- | --- |
| 1 | Mock Demo Mode 켜기 | Open `/?mock=1`. | Mock Demo Mode badge is visible; 24 mock results load. |
| 2 | Explorer에서 전체 mock item 확인 | Clear filters. | Sidebar result count is 24; map shows spatial/fallback markers. |
| 3 | Draft만 보기 필터 클릭 | Click `Draft` status chip. | Result count is 9; Draft badges remain visible in list/panel. |
| 4 | 성수동 프로젝트만 보기 | Click `성수동 오피스 리노베이션`. | Result count is 8; only Seongsu Items remain. |
| 5 | 불국사 프로젝트만 보기 | Click `2024 경주 불국사 정밀실측`. | Result count is 8; only Bulguksa Items remain. |
| 6 | Unassigned만 보기 | Click `Unassigned Inbox`. | Result count is 8; missing metadata cases are visible. |
| 7 | 지도 marker 클릭 | Click any marker. | Right Context/Preview Panel opens for the same Item. |
| 8 | 목록 item 클릭 | Click the same or another list row. | Same panel opens and marker selection changes. |
| 9 | geometry 없는 document 확인 | Filter `문헌정보`; click `성수동 리노베이션 인허가 메모` or `불국사 정밀실측 보고서`. | Document appears via fallback marker; panel shows original filename and metadata state. |
| 10 | bbox만 있는 item 확인 | Click `성수동 로비 BIM 모델` or `다보탑 포토그래메트리 모델`. | Marker is derived from bbox center; panel shows `3d_model`. |
| 11 | preview failed item 확인 | Search `failed` or click `대웅전 전면 파노라마` / `불국사 현장 점검 영상`. | Panel shows `Preview failed` and failure reason when available. |
| 12 | Draft 사유 확인 | Click any Draft item with gaps. | Panel shows Draft reason and metadata gaps. |
| 13 | relation이 있는 item 선택 | Click `다보탑 LiDAR 정밀 스캔` or `계약서 초안`. | Panel shows relation count. |
| 14 | relation target이 현재 결과 밖에 있는 warning 확인 | Click `다보탑 LiDAR 정밀 스캔`, `성수동 안전 점검 영상`, or `계약서 초안`. | Panel shows missing relation target warning IDs. |
| 15 | 0건 검색 결과 empty state 확인 | Search `no-result-keyword`. | Result count is 0; list shows empty state and map markers are cleared. |

## Current Scope Notes

- Phase 0 does not implement real selected relation overlay lines.
- Phase 0 does not implement real 3D Tiles, point cloud, model, panorama, video, or document viewers.
- Relationship Graph Beta must not appear as the default Explorer screen.
