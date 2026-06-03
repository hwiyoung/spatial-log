# Mock Data Scenarios

Date: 2026-06-02

## Purpose

These scenarios make Explorer clickable before real operating data exists. The fixture is intentionally shaped like STAC Collections and Items so the UI can later swap mock data for real API responses with minimal changes.

## Projects

| Collection ID | Project | Purpose |
| --- | --- | --- |
| `seongsu-office-renovation` | 성수동 오피스 리노베이션 | Urban building renovation assets with Draft and preview failure cases. |
| `gyeongju-bulguksa-2024` | 2024 경주 불국사 정밀실측 | Cultural heritage survey assets with time/relation warning cases. |
| `unassigned-inbox` | Unassigned Inbox | System-reserved unassigned assets with missing project/location metadata. |

## Item Coverage

- Item count: 24.
- Each `data_category` has 3 Items: `pointcloud`, `3d_model`, `3d_tiles`, `orthoimage`, `image`, `panorama`, `video`, `document`.
- Status distribution:
  - `draft`: 9
  - `published`: 9
  - `archived`: 2
  - `unknown`: 4
- Preview distribution:
  - `available`: 10
  - `pending`: 4
  - `missing`: 5
  - `failed`: 5

## Spatial Coverage

The fixture includes:

- Items with full `geometry` and `bbox`.
- Items with `bbox` but no geometry.
- Items with neither `geometry` nor `bbox`, using `properties["mock:fallback_center"]` only for demo marker placement.
- Document/video cases that prove non-spatial assets still appear in Explorer and are not silently hidden.

## Metadata Edge Cases

The fixture includes:

- Project assigned and unassigned Items.
- Human-readable `title` / `display_name` values that differ from `originalFilename`.
- Missing required fields using `missingRequiredFields`.
- User-facing gaps using `metadataGaps`.
- `draftReason` values for Draft review.
- Missing thumbnail and failed preview cases.

## Relation Coverage

The fixture covers all planned rel values:

- `derived_from`
- `related`
- `describedby`
- `describes`
- `prev`
- `next`

Some relation targets intentionally point outside the current mock result set:

- `seongsu-video-safety-2023`
- `bulguksa-pointcloud-dabotap-2022`
- `bulguksa-pointcloud-dabotap-2026-plan`
- `inbox-document-outside-search`

These verify the warning UX for links that are resolvable in metadata but not loaded in the current result set.

## Fixture Files

- `frontend/src/mocks/fixtures/mockCollections.js`
- `frontend/src/mocks/fixtures/mockItems.js`
- `frontend/src/mocks/fixtures/mockRelations.js`
- `frontend/src/mocks/fixtures/mockPreviewAssets.js`
- `frontend/src/mocks/mockExplorerDataSource.js`
