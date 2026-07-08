from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from sams.main import app

client = TestClient(app)


def test_category_expansion_endpoint_is_read_only():
    resp = client.get("/api/ontology/categories/three_dimensional_asset/expand")

    assert resp.status_code == 200
    body = resp.json()
    assert body["data_categories"] == ["pointcloud", "3d_model", "3d_tiles"]
    assert body["side_effects"] == "none"


def test_resolve_target_alias_endpoint():
    resp = client.get("/api/ontology/resolve", params={
        "text": "dabo_tap",
        "kind": "target",
        "site_concept": "bulguksa",
    })

    assert resp.status_code == 200
    assert resp.json()["match"]["concept_id"] == "bulguksa_dabotap"


def test_search_preview_does_not_execute_search():
    resp = client.post("/api/ontology/search-preview", json={
        "category_concept": "three_dimensional_asset",
        "site_text": "경주불국사",
        "target_text": "Dabotap",
        "collection_id": "bulguksa-2024",
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["side_effects"] == "none"
    assert body["resolved"]["data_categories"] == ["pointcloud", "3d_model", "3d_tiles"]
    assert body["resolved"]["site"]["concept_id"] == "bulguksa"
    assert body["resolved"]["target"]["concept_id"] == "bulguksa_dabotap"
    assert body["stac_search"]["filter-lang"] == "cql2-json"


def test_concept_write_dry_run_reports_existing_item_candidates():
    with (
        patch("sams.routers.ontology.stac.get_collection", new_callable=AsyncMock) as mock_get_collection,
        patch("sams.routers.ontology.stac.get_collection_items", new_callable=AsyncMock) as mock_get_items,
    ):
        mock_get_collection.return_value = {
            "id": "bulguksa-2024",
            "summaries": {"project:site": "경주 불국사"},
        }
        mock_get_items.return_value = [{
            "id": "bg-dabotap-pc-20240312",
            "collection": "bulguksa-2024",
            "properties": {
                "data_category": "pointcloud",
                "target": "Dabotap",
            },
        }]

        resp = client.post("/api/ontology/concept-write-dry-run", json={
            "collection_id": "bulguksa-2024",
            "include_unmatched": False,
        })

    assert resp.status_code == 200
    body = resp.json()
    assert body["side_effects"] == "none"
    assert body["summary"]["items_scanned"] == 1
    assert body["summary"]["items_with_write_candidates"] == 1
    assert body["summary"]["fields"]["sams:site_concept"]["would_write"] == 1
    assert body["summary"]["fields"]["sams:target_concept"]["would_write"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["site"]["source_field"] == "collection.summaries.project:site"
    assert item["site"]["used_collection_context"] is True
    assert item["target"]["proposed_concept"] == "bulguksa_dabotap"
    assert item["would_write"] == {
        "sams:site_concept": "bulguksa",
        "sams:target_concept": "bulguksa_dabotap",
    }
    mock_get_collection.assert_awaited_once_with("bulguksa-2024")
    mock_get_items.assert_awaited_once_with("bulguksa-2024", limit=1000)


@patch("sams.routers.ontology.stac.search_items", new_callable=AsyncMock)
def test_ontology_search_is_opt_in_read_only_stac_search(mock_search):
    mock_search.return_value = [{"id": "bg-dabotap-pc-20240312"}]

    resp = client.post("/api/ontology/search", json={
        "category_concept": "three_dimensional_asset",
        "target_text": "Dabotap",
        "collection_id": "bulguksa-2024",
    })

    assert resp.status_code == 200
    body = resp.json()
    assert body["numberReturned"] == 1
    assert body["ontology"]["side_effects"] == "none"
    mock_search.assert_awaited_once()
