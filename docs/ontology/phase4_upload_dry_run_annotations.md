# Phase 4 Upload Dry-Run Annotations

Date: 2026-07-07

## Purpose

Phase 4 applies ontology v0 to upload analysis as advisory metadata only. It
does not change registration, relation acceptance, STAC Item properties, DB
state, or S3 objects.

## Implemented

Upload analysis `ManifestItem` now includes an optional `ontology` block:

```json
{
  "ontology": {
    "ontology_version": "0.1.0",
    "category_concept": "pointcloud",
    "broader_category_concepts": ["spatial_asset", "three_dimensional_asset"],
    "site_concept": "bulguksa",
    "site_label_ko": "경주 불국사",
    "target_concept": "bulguksa_dabotap",
    "target_label_ko": "다보탑",
    "target_match_source": "file_path",
    "side_effects": "none"
  }
}
```

Current sources:

- `detected_category` -> category concept and broader groups.
- Collection `project:site` -> site concept.
- upload file path/name -> target concept alias match.

## Safety Guard

`/api/upload/register` explicitly excludes `ontology` and
`ontology_annotations` from STAC Item properties. Even if a client sends the
analysis annotation back in a register request, it is not persisted.

## Upload Review UI

The Upload review screen now surfaces these advisory annotations before Draft
registration:

- shows how many rows have site/target standard ID candidates
- shows candidate Site/Target IDs per row
- lets the operator mark a candidate as confirmed or deferred
- keeps those decisions in the upload task's browser-local state only
- shows in the registration summary that standard ID candidates are not saved by default
- warns that automatic registration skips candidate confirmation and still does
  not save standard IDs

This is an operator review aid. Phase 4 itself does not add
`sams:site_concept`, `sams:target_concept`, or `sams:ontology_version` to the
register payload. Phase 7 adds a disabled-by-default gated path.

## Not Changed

- relation suggestions still use the existing suggestion logic.
- accepted links are unchanged.
- no concept fields are written to Items.
- no existing uploaded data is touched.

## Next Gate

The next safe continuation is Phase 7 upload concept payload dry-run: show which
confirmed candidates would become `sams:site_concept`,
`sams:target_concept`, and `sams:ontology_version` fields later, with writes
still disabled unless `ONTOLOGY_CONCEPT_WRITE_ENABLED=true`. Using them to
auto-fill `target` remains gated.
