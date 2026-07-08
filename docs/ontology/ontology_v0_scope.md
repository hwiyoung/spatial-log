# SAMS Ontology v0 Scope

## Purpose

SAMS ontology v0 is a semantic contract for the values that already drive search,
relations, upload suggestions, Detail, Project, and the Core 3D Spatial Relationship
View.

It does not replace STAC, pgSTAC, PostGIS, or the current API shape. STAC remains
the storage and discovery model. Ontology v0 adds stable concept IDs, aliases,
hierarchies, and relation rules around existing STAC fields so that strings and
enums do not carry hidden product meaning alone.

## Problems v0 Solves

1. Search misses caused by target/site spelling variants.
   - Example: `다보탑`, `Dabotap`, `dabo_tap`, and `불국사 다보탑` should resolve to
     the same target concept when the project knows they are the same physical
     target.

2. Category filters that cannot express broader intent.
   - Example: a user asking for "3D data" should include `pointcloud`, `3d_model`,
     and `3d_tiles` without hard-coding that expansion separately in every UI or
     API path.

3. Relation suggestions hidden in code.
   - Example: `pointcloud -> 3d_model -> 3d_tiles` derivation rules should be
     visible as a domain rule, not only as a Python constant.

4. Document relations that are too coarse.
   - Example: reports, drawings, field notes, quality reports, and delivery
     manifests can all be `document`, but they should not have identical meaning
     in search and relation suggestions.

5. 3D relation view semantics.
   - The 3D view should not only draw lines. It needs stable meanings for item
     category, relation type, status, project/site context, and selected-item
     1-depth relations.

## In Scope

- Controlled vocabulary for asset categories.
- Controlled vocabulary for broader category groups.
- Controlled vocabulary for relation types and inverse relations.
- Controlled vocabulary for processing levels.
- Initial document type vocabulary.
- Initial target/site concept pattern.
- Mapping from existing STAC fields to v0 semantic concepts.
- Machine-readable YAML files that can later be consumed by search expansion and
  upload suggestion logic.

## Out Of Scope For v0

- Replacing STAC JSON with RDF as the source of truth.
- Adding a graph database.
- Replacing pgSTAC/PostGIS spatial search with GeoSPARQL.
- Running OWL reasoning in production request paths.
- Full external linked-data integration.
- Full provenance graph for every worker operation.
- Changing existing item IDs, collection IDs, or current API payloads.

## Design Constraints

- Existing `properties.data_category` values remain valid.
- Existing `links[].rel` values remain valid.
- Existing Explorer, Detail, Project, Upload, and MetadataCompletion contracts stay
  compatible.
- Ontology metadata must be additive.
- Any future runtime use should fail open: a missing concept mapping must not make
  an otherwise valid STAC Item unusable.

## Standards Alignment

- STAC remains the primary catalog model for spatiotemporal assets, assets, and
  relationship links.
- SKOS is the reference model for concept schemes, labels, aliases, and
  broader/narrower category relationships.
- PROV-O is reserved for a later provenance layer around upload, conversion,
  thumbnail generation, and derived assets.
- GeoSPARQL is reserved for a later RDF spatial query/export track, not v0 runtime
  search.
- SHACL is reserved for future RDF/JSON-LD validation if the vocabulary is exported
  as RDF.

## v0 Success Criteria

1. The repository has a single documented source for current semantic values.
2. `data_category` values can be mapped to stable concept IDs.
3. Relation types and inverse relations can be mapped to stable relation IDs.
4. The existing derivation suggestion chain can be represented outside code.
5. The user can review target/site/document vocabulary gaps before runtime changes.

## User Input Needed Before Runtime Integration

- Canonical site names and known aliases for the first real projects.
- Canonical target names and known aliases for common physical targets.
- Document type names used by the team in real deliverables.
- Which relation suggestions should be auto-selected, user-confirmed, or never
  suggested.
- Whether broader category filters should appear in Explorer v1 or remain an API
  helper first.
