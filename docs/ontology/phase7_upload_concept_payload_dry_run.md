# Phase 7 Upload Concept Payload Dry-Run

Date: 2026-07-08

## Purpose

This phase previews which standard ID fields would be added to new uploads and
adds a disabled-by-default write gate for controlled validation.

The goal is to validate the storage contract before enabling persistence:

- operators can confirm or defer upload-time site/target ID candidates
- confirmed candidates produce a visible write preview
- the preview remains outside the actual `/api/upload/register` payload while
  the flag is OFF
- existing human labels stay authoritative

## Candidate Fields

For now, the upload write preview is limited to:

| Field | Source | Stored by default? |
| --- | --- | --- |
| `sams:site_concept` | confirmed upload `ontology.site_concept` | No |
| `sams:target_concept` | confirmed upload `ontology.target_concept` | No |
| `sams:ontology_version` | upload `ontology.ontology_version` | No |

The preview intentionally does not include `sams:category_concept`.
`data_category` is already stored and the category concept can be derived from it.
Keeping this phase focused on operator-confirmed site/target IDs reduces write
risk.

## Feature Flag

Concept writes are gated by:

```env
ONTOLOGY_CONCEPT_WRITE_ENABLED=false
```

Default is OFF in code, `docker-compose.yml`, and `.env.example`.

When OFF:

- the Upload UI shows confirmed candidates as dry-run only.
- the frontend does not attach concept fields to `/api/upload/register` items.
- the backend strips ontology concept fields even if a client sends them.

When ON:

- only rows marked `confirmed` in Upload review can attach concept fields.
- automatic registration still writes no concept fields because it skips
  confirmation.
- the backend still allows only `sams:site_concept`, `sams:target_concept`, and
  `sams:ontology_version`.

## UI Behavior

In Upload review:

1. Standard ID candidates are shown per row.
2. The operator can mark each row as `confirmed` or `deferred`.
3. Only non-excluded rows marked `confirmed` enter the write dry-run preview.
4. The preview shows the exact fields that would be added.
5. The registration summary states whether confirmed candidates are included in
   the current register payload.

Automatic registration still skips candidate confirmation. No dry-run preview is
shown before automatic registration because the review screen is bypassed; no
concept fields are written in that path.

## Safety Boundary

This phase adds safe wiring but keeps writes disabled by default. It does not
change:

- existing uploaded data
- ontology review localStorage state

The backend register route filters out `ontology` and `ontology_annotations` if
they are sent accidentally. It also treats `sams:*_concept` and
`sams:ontology_version` as gated fields:

- OFF: drop them.
- ON: keep only allowlisted fields and only string values.
- Always blocked: unallowlisted ontology concept fields such as
  `sams:category_concept`.

## Smoke Result

Date: 2026-07-08

An isolated ON-mode smoke test registered one metadata-only Item in temporary
Collection `ontology-smoke-20260708145815`, then audited it through the STAC API.

Observed properties:

| Property | Result |
| --- | --- |
| `project:site` | preserved as `성수` |
| `target` | preserved as `성수 이마트` |
| `sams:site_concept` | saved as `seongsu_dong` |
| `sams:target_concept` | saved as `seongsu_emart` |
| `sams:ontology_version` | saved as `0.1.0` |
| `sams:category_concept` | blocked |

The live API policy remained OFF after the smoke test:
`ontology_concept_write_enabled=false`.

The temporary smoke Collection was deleted after audit; follow-up STAC lookup
returned 404.

## Next Gate

Before turning the flag on in a live environment, decide:

- whether writes are allowed only for new uploads or also for selected backfills
- whether both `site` and `target` are required, or either field can be written
- where confirmation decisions should persist after browser refresh
- how to audit written fields after registration

Recommended next implementation is a product decision on whether to enable this
flag for actual new uploads, and whether confirmation decisions need server-side
persistence before doing so.
