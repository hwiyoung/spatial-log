# Phase 2 Vocabulary Decisions

Date: 2026-07-07

## Purpose

This records the accepted ontology v0 decisions after the Phase 1 semantic audit.
The goal is to make the smallest useful runtime-facing contract without changing
the STAC storage model or Explorer UI behavior yet.

## Decisions

### D1. First Seed Dataset

Use the live local STAC Collection `bulguksa-2024` as the first ontology seed.

Reason:

- It has a real site value: `경주 불국사`.
- It has repeated physical targets: `다보탑`, `석가탑`, `대웅전`, `전경`, `전체`.
- It contains multiple categories: `pointcloud`, `3d_model`, `orthoimage`,
  `video`, and `document`.
- It already includes relation examples in the local STAC data.

The seed lives in `docs/ontology/seeds/bulguksa_2024_seed.yml`.

### D2. Document Type Field

Use `properties.document:type` as the canonical document subtype field.

Reason:

- The STAC metadata design already names `document:type`.
- A new `properties.sams:document_type` field would duplicate the same meaning.
- `document:type` keeps the subtype attached to document metadata while
  `properties.data_category = document` remains the coarse category.

SAMS-specific document types such as `quality_report` and `delivery_manifest`
remain extension candidates until real deliverables confirm they are needed.

### D3. Reverse Relation Authoring

Keep `has_derived` in the vocabulary and stored STAC links for backward
compatibility, but do not offer it as a primary authoring option.

Runtime policy:

- Users and upload suggestions should author `derived_from`.
- The reverse `has_derived` link can be generated, displayed, and deleted as the
  paired reverse relation.
- Existing Items that already carry `has_derived` remain valid.

`describes` remains a primary authoring option for now because current Detail UI
and backend behavior allow document-to-item authoring. That can be reviewed
separately after relation UX is tightened.

### D4. Broader Category Filters

Start with API/helper-level expansion only. Do not add a new Explorer control yet.

First supported expansion:

| Concept ID | Expands to |
| --- | --- |
| `three_dimensional_asset` | `pointcloud`, `3d_model`, `3d_tiles` |
| `raster_asset` | `orthoimage`, `image`, `panorama`, `video` |
| `documentation_asset` | `document` |
| `spatial_asset` | `pointcloud`, `3d_model`, `3d_tiles`, `orthoimage`, `image`, `panorama`, `video` |

Reason:

- Search semantics can be tested without UI churn.
- Explorer can later consume the same expansion if the PoC proves useful.

### D5. Runtime Integration Boundary

Add a pure Python helper and tests first. Do not wire ontology into API routes or
database writes in this phase.

Reason:

- The helper proves category expansion, alias resolution, and relation authoring
  policy without changing production behavior.
- Runtime STAC field writes should wait until site/target aliases are reviewed
  against more than one real project.

## Phase 2 Output

- `sams-api/sams/ontology/vocabulary.yml` uses `properties.document:type`.
- `sams-api/sams/ontology/relation_rules.yml` marks `has_derived` as generated
  reverse only.
- `docs/ontology/seeds/bulguksa_2024_seed.yml` provides the first site/target
  alias seed.
- `sams-api/sams/ontology/runtime.py` provides a minimal PoC helper for search
  expansion, alias resolution, and relation policy checks.
- `sams-api/tests/test_ontology_runtime.py` covers the helper behavior.

## Next Gate

Before wiring this into real API search or upload suggestions, review:

1. Whether the `bulguksa-2024` aliases match team terminology.
2. Which document types are actually used in deliverables.
3. Whether `describes` should remain authorable or become generated reverse like
   `has_derived`.
