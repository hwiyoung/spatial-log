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

## Not Changed

- relation suggestions still use the existing suggestion logic.
- accepted links are unchanged.
- no concept fields are written to Items.
- no UI control is added.
- no existing uploaded data is touched.

## Next Gate

The next safe continuation is to show these annotations in a developer/debug
surface or use them in suggestion scoring as dry-run comparison. Using them to
auto-fill `target` or write `sams:target_concept` remains gated.
