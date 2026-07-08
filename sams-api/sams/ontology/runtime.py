"""Small runtime helpers for the ontology v0 PoC.

The YAML vocabulary remains the human-reviewable source. This module mirrors the
reviewed subset that is safe to test without adding a YAML dependency or changing
API/database behavior.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal


VERSION = "0.1.0"
DOCUMENT_TYPE_FIELD = "properties.document:type"

ASSET_CATEGORIES = (
    "pointcloud",
    "3d_model",
    "3d_tiles",
    "orthoimage",
    "image",
    "panorama",
    "video",
    "document",
    "unknown",
)

CATEGORY_GROUPS: dict[str, tuple[str, ...]] = {
    "spatial_asset": (
        "pointcloud",
        "3d_model",
        "3d_tiles",
        "orthoimage",
        "image",
        "panorama",
        "video",
    ),
    "three_dimensional_asset": ("pointcloud", "3d_model", "3d_tiles"),
    "raster_asset": ("orthoimage", "image", "panorama", "video"),
    "documentation_asset": ("document",),
    "derived_asset": ("3d_model", "3d_tiles", "orthoimage"),
}


@dataclass(frozen=True)
class ConceptMatch:
    scheme: Literal["site", "target"]
    concept_id: str
    label_ko: str
    label_en: str


@dataclass(frozen=True)
class ConceptFieldProposal:
    field: Literal["sams:site_concept", "sams:target_concept"]
    source_field: str | None
    source_label: str | None
    existing_concept: str | None
    proposed_concept: str | None
    proposed_label_ko: str | None
    confidence: float
    status: Literal["would_write", "already_present", "no_source", "unresolved", "ambiguous", "conflict"]
    used_collection_context: bool
    candidates: tuple[ConceptMatch, ...]
    notes: tuple[str, ...]


@dataclass(frozen=True)
class ConceptWriteDryRunItem:
    item_id: str
    collection_id: str | None
    data_category: str | None
    site: ConceptFieldProposal
    target: ConceptFieldProposal
    would_write: dict[str, str]
    safe_to_write: bool
    notes: tuple[str, ...]


@dataclass(frozen=True)
class RelationPolicy:
    rel: str
    inverse: str | None
    primary_authoring: bool
    generated_reverse_only: bool
    upload_suggestion_eligible: bool


@dataclass(frozen=True)
class SearchExpansion:
    category_concept: str | None
    data_categories: tuple[str, ...]
    site: ConceptMatch | None
    target: ConceptMatch | None
    stac_search: dict[str, object]
    notes: tuple[str, ...]


SITE_CONCEPTS: dict[str, dict[str, object]] = {
    "bulguksa": {
        "label_ko": "경주 불국사",
        "label_en": "Bulguksa Temple",
        "aliases": (
            "불국사",
            "경주불국사",
            "경주 불국사",
            "Bulguksa",
            "Bulguksa Temple",
            "gyeongju-bulguksa",
        ),
    },
    "sogang_bridge": {
        "label_ko": "서강대교",
        "label_en": "Sogang Bridge",
        "aliases": (
            "서강대교",
            "Sogang Bridge",
            "sogang_bridge",
            "sogang-bridge",
        ),
    },
    "seongsu_dong": {
        "label_ko": "성수동",
        "label_en": "Seongsu-dong",
        "aliases": (
            "성수동",
            "Seongsu-dong",
            "Seongsu dong",
            "seongsu_dong",
        ),
    },
    "kp_dormitory": {
        "label_ko": "본기숙사",
        "label_en": "KP Dormitory",
        "broader": ("seongsu_dong",),
        "aliases": (
            "본기숙사",
            "KP_dormitory",
            "KP Dormitory",
            "K성수 본기숙사",
        ),
    },
}

TARGET_CONCEPTS: dict[str, dict[str, object]] = {
    "bulguksa_dabotap": {
        "site": "bulguksa",
        "label_ko": "다보탑",
        "label_en": "Dabotap Pagoda",
        "aliases": (
            "다보탑",
            "불국사 다보탑",
            "Dabotap",
            "Dabotap Pagoda",
            "dabo_tap",
            "dabotap",
        ),
    },
    "bulguksa_seokgatap": {
        "site": "bulguksa",
        "label_ko": "석가탑",
        "label_en": "Seokgatap Pagoda",
        "aliases": (
            "석가탑",
            "불국사 석가탑",
            "Seokgatap",
            "Seokgatap Pagoda",
            "seokgatap",
        ),
    },
    "bulguksa_daeungjeon": {
        "site": "bulguksa",
        "label_ko": "대웅전",
        "label_en": "Daeungjeon Hall",
        "aliases": (
            "대웅전",
            "불국사 대웅전",
            "Daeungjeon",
            "Daeungjeon Hall",
            "main_hall",
            "daeungjeon",
        ),
    },
    "bulguksa_overview": {
        "site": "bulguksa",
        "label_ko": "불국사 전경",
        "label_en": "Bulguksa Site Overview",
        "aliases": ("전경", "불국사 전경", "site overview", "overview"),
    },
    "bulguksa_all": {
        "site": "bulguksa",
        "label_ko": "불국사 전체",
        "label_en": "Bulguksa Whole Site",
        "aliases": ("전체", "불국사 전체", "whole site", "all", "site"),
    },
    "seongsu_emart": {
        "site": "seongsu_dong",
        "label_ko": "이마트",
        "label_en": "E-Mart Seongsu",
        "aliases": (
            "이마트",
            "성수 이마트",
            "이마트 성수",
            "Emart",
            "E-Mart",
            "E-Mart Seongsu",
        ),
    },
}

RELATION_POLICIES: dict[str, RelationPolicy] = {
    "derived_from": RelationPolicy("derived_from", "has_derived", True, False, True),
    "has_derived": RelationPolicy("has_derived", "derived_from", False, True, False),
    "related": RelationPolicy("related", "related", True, False, True),
    "describedby": RelationPolicy("describedby", "describes", True, False, True),
    "describes": RelationPolicy("describes", "describedby", True, False, False),
    "prev": RelationPolicy("prev", "next", True, False, False),
    "next": RelationPolicy("next", "prev", True, False, False),
}


def expand_category_concept(concept_id: str | None) -> tuple[str, ...]:
    """Return concrete `data_category` values for a category or broader group."""
    if not concept_id:
        return ()
    concept = concept_id.strip()
    if concept in CATEGORY_GROUPS:
        return CATEGORY_GROUPS[concept]
    if concept in ASSET_CATEGORIES:
        return (concept,)
    return ()


def broader_category_concepts(category: str | None) -> tuple[str, ...]:
    """Return broader category concepts containing a concrete data category."""
    if not category:
        return ()
    return tuple(
        concept_id
        for concept_id, categories in CATEGORY_GROUPS.items()
        if category in categories
    )


def resolve_site_alias(text: str | None) -> ConceptMatch | None:
    """Resolve a site label/alias into a stable site concept."""
    return _resolve_alias(text, "site", SITE_CONCEPTS)


def find_site_alias_candidates(text: str | None) -> tuple[ConceptMatch, ...]:
    """Return all exact site alias candidates for ambiguity-aware dry-runs."""
    return _find_alias_matches(text, "site", SITE_CONCEPTS)


def resolve_site_alias_in_text(text: str | None) -> ConceptMatch | None:
    """Resolve a site concept when an alias appears inside a longer text."""
    return _resolve_alias_in_text(text, "site", SITE_CONCEPTS)


def resolve_target_alias(text: str | None, *, site_concept: str | None = None) -> ConceptMatch | None:
    """Resolve a target label/alias, optionally constrained by site concept."""
    return _resolve_alias(text, "target", _target_concepts_for_site(site_concept))


def find_target_alias_candidates(
    text: str | None,
    *,
    site_concept: str | None = None,
) -> tuple[ConceptMatch, ...]:
    """Return all exact target alias candidates for ambiguity-aware dry-runs."""
    return _find_alias_matches(text, "target", _target_concepts_for_site(site_concept))


def resolve_target_alias_in_text(text: str | None, *, site_concept: str | None = None) -> ConceptMatch | None:
    """Resolve a target concept when an alias appears inside a longer text."""
    return _resolve_alias_in_text(text, "target", _target_concepts_for_site(site_concept))


def build_item_concept_write_dry_run(
    item: dict,
    *,
    collection: dict | None = None,
) -> ConceptWriteDryRunItem:
    """Build a read-only concept-field write proposal for one existing STAC Item."""
    props = item.get("properties") or {}
    collection_summaries = (collection or {}).get("summaries") or {}
    collection_id = _first_text(item.get("collection"), (collection or {}).get("id"))

    item_site_label = _first_text(props.get("project:site"), props.get("project_site"))
    collection_site_label = _first_text(
        collection_summaries.get("project:site"),
        (collection or {}).get("properties", {}).get("project:site") if isinstance((collection or {}).get("properties"), dict) else None,
    )
    site_label = item_site_label or collection_site_label
    site_source = "properties.project:site" if item_site_label else (
        "collection.summaries.project:site" if collection_site_label else None
    )
    site_used_collection = item_site_label is None and collection_site_label is not None
    site_confidence = 0.95 if item_site_label else 0.85
    site = _concept_field_proposal(
        field="sams:site_concept",
        source_field=site_source,
        source_label=site_label,
        existing_concept=_clean_text(props.get("sams:site_concept")),
        candidates=find_site_alias_candidates(site_label),
        confidence=site_confidence,
        used_collection_context=site_used_collection,
    )

    site_context = site.proposed_concept or site.existing_concept
    target_label = _first_text(props.get("target"), props.get("target:name"))
    target_confidence = 0.9 if site_context else 0.75
    target = _concept_field_proposal(
        field="sams:target_concept",
        source_field="properties.target" if target_label else None,
        source_label=target_label,
        existing_concept=_clean_text(props.get("sams:target_concept")),
        candidates=find_target_alias_candidates(target_label, site_concept=site_context),
        confidence=target_confidence,
        used_collection_context=site_used_collection and bool(site_context),
    )

    would_write = {
        proposal.field: str(proposal.proposed_concept)
        for proposal in (site, target)
        if proposal.status == "would_write" and proposal.proposed_concept
    }
    blocking = {site.status, target.status} & {"ambiguous", "conflict"}
    notes: list[str] = []
    if site_used_collection:
        notes.append("site concept resolved from Collection context")
    if target_label and not site_context:
        notes.append("target resolved without site context")

    return ConceptWriteDryRunItem(
        item_id=str(item.get("id") or ""),
        collection_id=collection_id,
        data_category=_clean_text(props.get("data_category")),
        site=site,
        target=target,
        would_write=would_write,
        safe_to_write=bool(would_write) and not blocking,
        notes=tuple(notes),
    )


def summarize_concept_write_dry_run(items: tuple[ConceptWriteDryRunItem, ...]) -> dict[str, object]:
    """Summarize read-only concept-field write proposals."""
    field_summary: dict[str, dict[str, int]] = {
        "sams:site_concept": _empty_field_summary(),
        "sams:target_concept": _empty_field_summary(),
    }
    items_with_write_candidates = 0
    safe_to_write = 0

    for item in items:
        if item.would_write:
            items_with_write_candidates += 1
        if item.safe_to_write:
            safe_to_write += 1
        for proposal in (item.site, item.target):
            field_summary[proposal.field][proposal.status] += 1

    return {
        "items_scanned": len(items),
        "items_with_write_candidates": items_with_write_candidates,
        "safe_to_write": safe_to_write,
        "fields": field_summary,
        "side_effects": "none",
    }


def get_relation_policy(rel: str | None) -> RelationPolicy | None:
    if not rel:
        return None
    return RELATION_POLICIES.get(rel)


def inverse_relation(rel: str | None) -> str | None:
    policy = get_relation_policy(rel)
    return policy.inverse if policy else None


def should_offer_relation_for_authoring(rel: str | None) -> bool:
    policy = get_relation_policy(rel)
    return bool(policy and policy.primary_authoring and not policy.generated_reverse_only)


def build_search_expansion(
    *,
    category_concept: str | None = None,
    site_text: str | None = None,
    target_text: str | None = None,
    collection_id: str | None = None,
    limit: int = 100,
) -> SearchExpansion:
    """Build an opt-in STAC search body from ontology concepts and aliases.

    This is read-only: it returns a normal STAC `/search` request body and does
    not mutate Items or write concept fields.
    """
    data_categories = expand_category_concept(category_concept)
    site = resolve_site_alias(site_text)
    target = resolve_target_alias(target_text, site_concept=site.concept_id if site else None)
    filters: list[dict[str, object]] = []
    notes: list[str] = []

    if category_concept and not data_categories:
        notes.append(f"unknown category concept: {category_concept}")
    elif data_categories:
        filters.append(_or_filter([
            _eq_filter("data_category", category)
            for category in data_categories
        ]))

    if site_text and not site:
        notes.append(f"site alias not resolved, using text fallback: {site_text}")
        filters.append(_like_filter("project:site", site_text))
    elif site:
        filters.append(_or_filter([
            _eq_filter("sams:site_concept", site.concept_id),
            *[_like_filter("project:site", term) for term in _site_terms(site.concept_id, site_text)],
        ]))

    if target_text and not target:
        notes.append(f"target alias not resolved, using text fallback: {target_text}")
        filters.append(_like_filter("target", target_text))
    elif target:
        filters.append(_or_filter([
            _eq_filter("sams:target_concept", target.concept_id),
            *[_like_filter("target", term) for term in _target_terms(target.concept_id, target_text)],
        ]))

    capped_limit = max(1, min(limit, 200))
    if capped_limit != limit:
        notes.append(f"limit capped to {capped_limit}")

    stac_search: dict[str, object] = {"limit": capped_limit}
    if collection_id:
        stac_search["collections"] = [collection_id]
    if filters:
        stac_search["filter"] = _and_filter(filters)
        stac_search["filter-lang"] = "cql2-json"

    return SearchExpansion(
        category_concept=category_concept,
        data_categories=data_categories,
        site=site,
        target=target,
        stac_search=stac_search,
        notes=tuple(notes),
    )


def _resolve_alias(
    text: str | None,
    scheme: Literal["site", "target"],
    concepts: dict[str, dict[str, object]],
) -> ConceptMatch | None:
    matches = _find_alias_matches(text, scheme, concepts)
    if len(matches) == 1:
        return matches[0]
    return None


def _resolve_alias_in_text(
    text: str | None,
    scheme: Literal["site", "target"],
    concepts: dict[str, dict[str, object]],
) -> ConceptMatch | None:
    exact = _resolve_alias(text, scheme, concepts)
    if exact:
        return exact
    if text is None:
        return None

    matches = _find_alias_matches(text, scheme, concepts, contains=True)
    if len(matches) == 1:
        return matches[0]
    return None


def _find_alias_matches(
    text: str | None,
    scheme: Literal["site", "target"],
    concepts: dict[str, dict[str, object]],
    *,
    contains: bool = False,
) -> tuple[ConceptMatch, ...]:
    if text is None:
        return ()

    haystack = _normalize_alias(text)
    if not haystack:
        return ()

    matches: list[ConceptMatch] = []
    for concept_id, spec in concepts.items():
        aliases = (
            concept_id,
            spec["label_ko"],
            spec["label_en"],
            *spec.get("aliases", ()),
        )
        normalized_aliases = {
            _normalize_alias(str(alias))
            for alias in aliases
            if _normalize_alias(str(alias))
        }
        matched = (
            any(alias in haystack for alias in normalized_aliases)
            if contains
            else haystack in normalized_aliases
        )
        if matched:
            matches.append(ConceptMatch(
                scheme=scheme,
                concept_id=concept_id,
                label_ko=str(spec["label_ko"]),
                label_en=str(spec["label_en"]),
            ))
    return tuple(matches)


def _target_concepts_for_site(site_concept: str | None) -> dict[str, dict[str, object]]:
    if not site_concept:
        return TARGET_CONCEPTS
    return {
        concept_id: spec
        for concept_id, spec in TARGET_CONCEPTS.items()
        if spec.get("site") == site_concept
    }


def _concept_match_by_id(
    scheme: Literal["site", "target"],
    concept_id: str | None,
) -> ConceptMatch | None:
    if not concept_id:
        return None
    concepts = SITE_CONCEPTS if scheme == "site" else TARGET_CONCEPTS
    spec = concepts.get(concept_id)
    if not spec:
        return None
    return ConceptMatch(
        scheme=scheme,
        concept_id=concept_id,
        label_ko=str(spec["label_ko"]),
        label_en=str(spec["label_en"]),
    )


def _concept_field_proposal(
    *,
    field: Literal["sams:site_concept", "sams:target_concept"],
    source_field: str | None,
    source_label: str | None,
    existing_concept: str | None,
    candidates: tuple[ConceptMatch, ...],
    confidence: float,
    used_collection_context: bool,
) -> ConceptFieldProposal:
    scheme: Literal["site", "target"] = "site" if field == "sams:site_concept" else "target"
    notes: list[str] = []
    match = candidates[0] if len(candidates) == 1 else None
    existing_match = _concept_match_by_id(scheme, existing_concept)

    if not source_label:
        status = "already_present" if existing_concept else "no_source"
        proposed_concept = existing_concept
        proposed_label = existing_match.label_ko if existing_match else None
        proposal_confidence = 1.0 if existing_concept else 0.0
    elif not candidates:
        status = "unresolved"
        proposed_concept = None
        proposed_label = None
        proposal_confidence = 0.0
    elif len(candidates) > 1:
        status = "ambiguous"
        proposed_concept = None
        proposed_label = None
        proposal_confidence = 0.0
    elif existing_concept and existing_concept != match.concept_id:
        status = "conflict"
        proposed_concept = match.concept_id
        proposed_label = match.label_ko
        proposal_confidence = confidence
        notes.append(f"existing concept differs from resolved {field}")
    elif existing_concept:
        status = "already_present"
        proposed_concept = existing_concept
        proposed_label = match.label_ko
        proposal_confidence = 1.0
    else:
        status = "would_write"
        proposed_concept = match.concept_id
        proposed_label = match.label_ko
        proposal_confidence = confidence

    return ConceptFieldProposal(
        field=field,
        source_field=source_field,
        source_label=source_label,
        existing_concept=existing_concept,
        proposed_concept=proposed_concept,
        proposed_label_ko=proposed_label,
        confidence=proposal_confidence,
        status=status,
        used_collection_context=used_collection_context,
        candidates=candidates,
        notes=tuple(notes),
    )


def _empty_field_summary() -> dict[str, int]:
    return {
        "would_write": 0,
        "already_present": 0,
        "no_source": 0,
        "unresolved": 0,
        "ambiguous": 0,
        "conflict": 0,
    }


def _first_text(*values: object) -> str | None:
    for value in values:
        text = _clean_text(value)
        if text:
            return text
    return None


def _clean_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_alias(value: str) -> str:
    return re.sub(r"[\s_-]+", "", value.casefold().strip())


def _site_terms(concept_id: str, original_text: str | None) -> tuple[str, ...]:
    return _concept_terms(SITE_CONCEPTS[concept_id], original_text)


def _target_terms(concept_id: str, original_text: str | None) -> tuple[str, ...]:
    return _concept_terms(TARGET_CONCEPTS[concept_id], original_text)


def _concept_terms(spec: dict[str, object], original_text: str | None) -> tuple[str, ...]:
    values = [
        original_text,
        str(spec["label_ko"]),
        str(spec["label_en"]),
        *[str(alias) for alias in spec.get("aliases", ())],
    ]
    seen: set[str] = set()
    terms: list[str] = []
    for value in values:
        if not value:
            continue
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        terms.append(value)
    return tuple(terms)


def _property(name: str) -> dict[str, str]:
    return {"property": name}


def _eq_filter(field: str, value: str) -> dict[str, object]:
    return {"op": "=", "args": [_property(field), value]}


def _like_filter(field: str, value: str) -> dict[str, object]:
    return {"op": "like", "args": [_property(field), f"%{value}%"]}


def _or_filter(filters: list[dict[str, object]]) -> dict[str, object]:
    compact = [f for f in filters if f]
    if len(compact) == 1:
        return compact[0]
    return {"op": "or", "args": compact}


def _and_filter(filters: list[dict[str, object]]) -> dict[str, object]:
    compact = [f for f in filters if f]
    if len(compact) == 1:
        return compact[0]
    return {"op": "and", "args": compact}
