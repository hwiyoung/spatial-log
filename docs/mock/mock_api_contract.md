# Mock API Contract

Date: 2026-06-02

## Goal

Explorer must be verifiable without backend/API availability, while preserving the response shape expected from the real STAC/SAMS APIs.

## Mock Mode

Supported entry points:

- Query string: `/?mock=1`
- Vite env for local dev: `VITE_USE_MOCKS=true npm run dev`

The UI must show a visible `Mock Demo Mode` badge whenever mock data is active.

## Current Implementation

The current Phase 0 implementation uses a local mock data source:

- `frontend/src/mocks/mockExplorerDataSource.js`
- No MSW dependency is installed.
- No Docker, DB, or API schema changes are required.

MSW can be added later if route-level API interception is needed for Detail/Project/Upload flows. Do not add it until there is a screen that needs browser-level request interception.

## Logical Endpoints

| Logical endpoint | Current repo mount | Method | Response shape |
| --- | --- | --- | --- |
| `/stac/search` | Vite proxy rewrites `/stac/search` to STAC `/search` | `POST` | FeatureCollection-like object with `features`. |
| `/collections` | `/stac/collections` in frontend service | `GET` | `{ collections: Collection[] }`. |
| `/collections/:id` | `/stac/collections/:id` | `GET` | One STAC Collection-like object. |
| `/items/:id` | `/stac/collections/:collectionId/items/:itemId` | `GET` | One STAC Item-like Feature. |
| `/items/:id/relations` | Future SAMS API, likely `/api/items/:id/related` | `GET` | 1-depth relation array with missing target flags. |

## Search Response Contract

Explorer expects:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "item-id",
      "collection": "collection-id",
      "geometry": {},
      "bbox": [127.0, 37.0, 127.1, 37.1],
      "properties": {
        "display_name": "Human label",
        "project:name": "Project",
        "project:site": "Site",
        "data_category": "pointcloud",
        "status": "draft",
        "previewStatus": "available",
        "originalFilename": "raw_file.laz"
      },
      "assets": {},
      "links": []
    }
  ]
}
```

## Relation Response Contract

The selected Item relation overlay should consume:

```json
{
  "itemId": "source-item",
  "relations": [
    {
      "sourceId": "source-item",
      "sourceCollectionId": "collection-a",
      "rel": "derived_from",
      "targetId": "target-item",
      "targetCollectionId": "collection-b",
      "title": "Readable target label",
      "href": "/stac/collections/collection-b/items/target-item",
      "missingTarget": false
    }
  ]
}
```

## Replacement Rule

The screen boundary should not change when replacing mock data with real data. If the real API lacks a field, normalize it in a data source adapter before it reaches the React components.
