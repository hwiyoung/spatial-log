# Phase 5 Concept Write Dry-Run

Date: 2026-07-08

## Purpose

Phase 5 reports which ontology concept sibling fields could be added to existing
STAC Items without writing anything.

This phase exists because `project:site` and `target` are human labels. Before
persisting stable IDs such as `sams:site_concept` and `sams:target_concept`, SAMS
needs a reviewable report that shows the proposed concept, source label,
confidence, and ambiguity status.

## Endpoint

`POST /api/ontology/concept-write-dry-run`

Request:

```json
{
  "collection_id": "bulguksa-2024",
  "limit": 1000,
  "include_unmatched": false
}
```

Fields:

| Field | Meaning |
| --- | --- |
| `collection_id` | Optional Collection scope. If omitted, all Collections are scanned. |
| `limit` | Per-Collection Item read limit. |
| `include_unmatched` | When `false`, response items are limited to actionable proposals, ambiguity, or conflicts. |

The endpoint returns:

- `summary.items_scanned`
- per-field counts for `would_write`, `already_present`, `no_source`,
  `unresolved`, `ambiguous`, and `conflict`
- Item-level `site` and `target` proposals
- `would_write` preview map
- `safe_to_write` boolean
- `side_effects: "none"`

## Matching Policy

For `sams:site_concept`:

1. Use `properties.project:site` when present.
2. Otherwise use Collection `summaries.project:site`.
3. Match only known site aliases.

For `sams:target_concept`:

1. Use `properties.target`.
2. Constrain target aliases by the resolved site concept when available.
3. Report conflicts when an existing concept field disagrees with the resolved
   label.

## Safety Boundary

This endpoint does not call STAC update APIs, pgSTAC write helpers, upload
registration, or relation mutation code.

It is a review surface only. Existing Items remain unchanged.

## Operator Review UI

`/ontology` is labeled "표준화 검수" in the product UI. It turns this dry-run
response into a local operator workflow:

- standard ID rationale: stable IDs let SAMS group the same site/target even when
  human labels differ by spelling, language, or abbreviation.
- auto-match filters: all, ID matched, label without ID, missing label,
  duplicate/conflicting candidate
- operator-decision filters: unreviewed, match confirmed, standard ID to add,
  label input needed, review later
- workflow lanes: ID matched, label without ID, missing label,
  duplicate/conflicting candidate, no action needed
- per-Item review decision and note
- CSV export of the currently visible queue

Review decisions and notes are stored only in the browser `localStorage`. They
are not submitted to SAMS API and do not write STAC Items.

## Next Decision

After reviewing the report on live data, decide whether concept sibling writes
should be allowed for:

- future uploads only
- selected Collections only
- explicit admin-approved backfill batches

Until then, `project:site` and `target` remain the authoritative human labels.
