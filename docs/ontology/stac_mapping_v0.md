# STAC Mapping v0

Ontology v0 is additive. Existing STAC fields stay authoritative for current
runtime behavior.

## Field Mapping

| Semantic meaning | Current STAC field | v0 concept mapping | Required now |
| --- | --- | --- | --- |
| asset category | `properties.data_category` | asset category concept with same ID where possible | yes, existing |
| broader category | derived from `properties.data_category` | category group concepts | no |
| item relation | `links[].rel` | relation type concept | yes, existing |
| relation target | `links[].href` | target Item reference | yes, existing |
| item status | `properties.sams:status` and legacy `properties.status` | status concept | yes, existing |
| collection status | Collection `summaries.sams:status` / `properties.status` | collection status concept | yes, existing |
| processing level | `properties.processing:level` | processing level concept | no |
| project site | `properties.project:site`, Collection `project:site` | site concept | no |
| physical target | `properties.target` | target concept | no |
| document subtype | `properties.document:type` | document type concept | no |
| ontology version | none yet | vocabulary version string | no |

## Additive Field Candidates

These should be added only after the vocabulary is reviewed against real projects.

```json
{
  "properties": {
    "sams:category_concept": "pointcloud",
    "sams:site_concept": "bulguksa",
    "sams:target_concept": "bulguksa_dabotap",
    "document:type": null,
    "sams:ontology_version": "0.1.0"
  }
}
```

## Search Expansion Rules

Search expansion should happen before STAC search and should still send normal
STAC-compatible filters.

Examples:

| User intent | Expansion |
| --- | --- |
| category group `three_dimensional_asset` | `data_category IN pointcloud, 3d_model, 3d_tiles` |
| target alias `Dabotap` | `sams:target_concept = bulguksa_dabotap` when available, otherwise keyword fallback |
| document type `survey_report` | `data_category = document` plus `document:type = survey_report` when available |

## Relation Mapping Rules

When a user or suggestion adds a relation, the stored STAC link remains simple:

```json
{
  "rel": "derived_from",
  "href": "./source-pointcloud",
  "type": "application/geo+json"
}
```

The ontology layer supplies:

- display labels
- inverse relation
- allowed category pairs
- suggestion confidence
- whether relation is symmetric
- whether relation is eligible for upload suggestion

## Backward Compatibility

Items without concept fields remain valid. Runtime logic should resolve concepts
in this order:

1. explicit `sams:*_concept` field, if present
2. direct mapping from existing STAC value
3. alias lookup for target/site text, if configured
4. unknown concept fallback

## Validation Strategy

v0 should use lightweight application validation first:

- unknown `data_category` -> warn, do not fail
- unknown `links[].rel` -> warn for user relation UI, ignore system links
- relation pair not in allowed rules -> require user confirmation
- ambiguous target alias -> ask user to choose or fall back to text search

SHACL/RDF validation can be added later if the vocabulary is exported as RDF.
