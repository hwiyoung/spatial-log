"""Dry-run ontology annotations for upload analysis manifests."""

from __future__ import annotations

from sams.models.manifest import Manifest, OntologyAnnotation
from sams.ontology.runtime import (
    VERSION,
    ASSET_CATEGORIES,
    broader_category_concepts,
    resolve_site_alias_in_text,
    resolve_target_alias_in_text,
)


def annotate_manifest_ontology(
    manifest: Manifest,
    collection_defaults: dict | None = None,
) -> Manifest:
    """Attach read-only ontology hints to analyze output.

    The annotations are intentionally advisory. They are not written by register
    and do not change relation suggestions or required-field validation.
    """
    collection_defaults = collection_defaults or {}
    site_text = collection_defaults.get("project:site")
    site = resolve_site_alias_in_text(site_text)

    for item in manifest.manifest:
        category = item.detected_category if item.detected_category in ASSET_CATEGORIES else None
        target = resolve_target_alias_in_text(
            item.file_path,
            site_concept=site.concept_id if site else None,
        )
        item.ontology = OntologyAnnotation(
            ontology_version=VERSION,
            category_concept=category,
            broader_category_concepts=list(broader_category_concepts(category)),
            site_concept=site.concept_id if site else None,
            site_label_ko=site.label_ko if site else None,
            target_concept=target.concept_id if target else None,
            target_label_ko=target.label_ko if target else None,
            target_match_source="file_path" if target else None,
            side_effects="none",
        )

    return manifest
