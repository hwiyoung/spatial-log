"""Read-only ontology helper endpoints.

These endpoints expose ontology v0 expansion and resolution as an opt-in layer.
They do not write STAC Items, mutate relations, or change the existing `/stac`
search path.
"""

from dataclasses import asdict
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from sams.ontology.runtime import (
    VERSION,
    ConceptWriteDryRunItem,
    build_item_concept_write_dry_run,
    build_search_expansion,
    expand_category_concept,
    get_relation_policy,
    resolve_site_alias,
    resolve_target_alias,
    summarize_concept_write_dry_run,
)
from sams.services import stac

router = APIRouter()


class OntologySearchRequest(BaseModel):
    category_concept: str | None = None
    site_text: str | None = None
    target_text: str | None = None
    collection_id: str | None = None
    limit: int = Field(100, ge=1, le=1000)


class ConceptWriteDryRunRequest(BaseModel):
    collection_id: str | None = None
    limit: int = Field(1000, ge=1, le=1000)
    include_unmatched: bool = True


def _match_dict(match) -> dict[str, str] | None:
    return asdict(match) if match else None


def _expansion_payload(req: OntologySearchRequest) -> dict[str, Any]:
    expansion = build_search_expansion(
        category_concept=req.category_concept,
        site_text=req.site_text,
        target_text=req.target_text,
        collection_id=req.collection_id,
        limit=req.limit,
    )
    return {
        "ontology_version": VERSION,
        "input": req.model_dump(),
        "resolved": {
            "category_concept": expansion.category_concept,
            "data_categories": list(expansion.data_categories),
            "site": _match_dict(expansion.site),
            "target": _match_dict(expansion.target),
        },
        "stac_search": expansion.stac_search,
        "notes": list(expansion.notes),
        "side_effects": "none",
    }


def _is_actionable_dry_run_item(item: ConceptWriteDryRunItem) -> bool:
    problem_statuses = {"ambiguous", "conflict"}
    return (
        bool(item.would_write)
        or item.site.status in problem_statuses
        or item.target.status in problem_statuses
    )


async def _dry_run_collections(collection_id: str | None) -> list[dict]:
    if collection_id:
        collection = await stac.get_collection(collection_id)
        if collection is None:
            raise HTTPException(status_code=404, detail=f"Collection '{collection_id}' not found")
        return [collection]
    return await stac.list_collections()


@router.get("/categories/{concept_id}/expand")
def expand_category(concept_id: str):
    """Expand a category concept into concrete `properties.data_category` values."""
    data_categories = expand_category_concept(concept_id)
    if not data_categories:
        raise HTTPException(status_code=404, detail=f"Unknown category concept: {concept_id}")
    return {
        "ontology_version": VERSION,
        "concept_id": concept_id,
        "data_categories": list(data_categories),
        "side_effects": "none",
    }


@router.get("/resolve")
def resolve_alias(
    text: str = Query(..., min_length=1),
    kind: Literal["site", "target"] = "target",
    site_concept: str | None = None,
):
    """Resolve a site or target alias into a stable concept ID."""
    match = (
        resolve_site_alias(text)
        if kind == "site"
        else resolve_target_alias(text, site_concept=site_concept)
    )
    return {
        "ontology_version": VERSION,
        "input": {"text": text, "kind": kind, "site_concept": site_concept},
        "match": _match_dict(match),
        "side_effects": "none",
    }


@router.get("/relations/{rel}/policy")
def relation_policy(rel: str):
    """Return authoring/suggestion policy for a relation type."""
    policy = get_relation_policy(rel)
    if not policy:
        raise HTTPException(status_code=404, detail=f"Unknown relation type: {rel}")
    return {
        "ontology_version": VERSION,
        "policy": asdict(policy),
        "side_effects": "none",
    }


@router.post("/search-preview")
def search_preview(req: OntologySearchRequest):
    """Return the expanded STAC `/search` body without executing the search."""
    return _expansion_payload(req)


@router.post("/concept-write-dry-run")
async def concept_write_dry_run(req: ConceptWriteDryRunRequest):
    """Report proposed concept sibling fields for existing Items without writing."""
    try:
        collections = await _dry_run_collections(req.collection_id)
        all_items: list[ConceptWriteDryRunItem] = []
        for collection in collections:
            collection_id = collection.get("id")
            if not collection_id:
                continue
            features = await stac.get_collection_items(collection_id, limit=req.limit)
            for feature in features:
                all_items.append(build_item_concept_write_dry_run(feature, collection=collection))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    visible_items = [
        item
        for item in all_items
        if req.include_unmatched or _is_actionable_dry_run_item(item)
    ]
    summary = summarize_concept_write_dry_run(tuple(all_items))
    summary["collections_scanned"] = len(collections)
    summary["items_returned"] = len(visible_items)

    return {
        "ontology_version": VERSION,
        "input": req.model_dump(),
        "summary": summary,
        "items": [asdict(item) for item in visible_items],
        "side_effects": "none",
    }


@router.post("/search")
async def ontology_search(req: OntologySearchRequest):
    """Execute an opt-in read-only STAC search using ontology expansion."""
    payload = _expansion_payload(req)
    search_body = payload["stac_search"]
    features = await stac.search_items(
        collections=search_body.get("collections"),
        filter_params={
            key: value
            for key, value in search_body.items()
            if key not in ("collections", "limit")
        },
        limit=search_body["limit"],
    )
    return {
        "type": "FeatureCollection",
        "features": features,
        "numberReturned": len(features),
        "ontology": payload,
    }
