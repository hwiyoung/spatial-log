# Phase 3 Read-Only Search PoC

Date: 2026-07-07

## Purpose

Phase 3 turns ontology v0 into an opt-in search helper without changing existing
Explorer search, upload registration, STAC storage, or uploaded data.

## Scope

Implemented:

- category concept expansion:
  - `three_dimensional_asset` -> `pointcloud`, `3d_model`, `3d_tiles`
  - `raster_asset` -> `orthoimage`, `image`, `panorama`, `video`
  - `documentation_asset` -> `document`
- site/target alias resolution for the `bulguksa-2024` seed.
- read-only STAC search body generation.
- opt-in read-only search execution through SAMS API.
- relation policy lookup for authoring guardrails.

Not implemented:

- no STAC Item mutation
- no pgSTAC migration or backfill
- no MinIO/S3 object changes
- no Explorer default filter change
- no upload registration behavior change

## API

All endpoints are under `/api/ontology` and report `side_effects: none` where
applicable.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ontology/categories/{concept_id}/expand` | Expand a broader category concept into concrete `data_category` values. |
| `GET /api/ontology/resolve?text=...&kind=target` | Resolve a site or target alias into a concept ID. |
| `GET /api/ontology/relations/{rel}/policy` | Inspect relation authoring/suggestion policy. |
| `POST /api/ontology/search-preview` | Build the STAC `/search` body without executing it. |
| `POST /api/ontology/search` | Execute the expanded search against STAC, read-only. |

## Example

Request:

```json
{
  "category_concept": "three_dimensional_asset",
  "site_text": "Bulguksa Temple",
  "target_text": "Dabotap",
  "collection_id": "bulguksa-2024"
}
```

Search preview output includes:

```json
{
  "resolved": {
    "data_categories": ["pointcloud", "3d_model", "3d_tiles"],
    "site": {"concept_id": "bulguksa"},
    "target": {"concept_id": "bulguksa_dabotap"}
  },
  "stac_search": {
    "collections": ["bulguksa-2024"],
    "filter-lang": "cql2-json"
  },
  "side_effects": "none"
}
```

## Safety Notes

- The existing frontend still calls `/stac/search` directly.
- `/api/ontology/search` is opt-in and read-only.
- Current uploaded Items are only read by STAC search.
- Concept fields such as `sams:site_concept` and `sams:target_concept` are used
  as future-compatible filter candidates, but they are not written in this phase.

## Next Gate

The next safe continuation is Phase 4: use the same helper in upload analysis
suggestion as a dry-run annotation only. Actual registration writes remain gated.
