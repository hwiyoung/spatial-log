from sams.ontology.runtime import (
    DOCUMENT_TYPE_FIELD,
    build_item_concept_write_dry_run,
    build_search_expansion,
    broader_category_concepts,
    expand_category_concept,
    get_relation_policy,
    inverse_relation,
    resolve_site_alias,
    resolve_site_alias_in_text,
    resolve_target_alias,
    resolve_target_alias_in_text,
    should_offer_relation_for_authoring,
)


def test_expands_broader_category_to_current_data_categories():
    assert expand_category_concept("three_dimensional_asset") == (
        "pointcloud",
        "3d_model",
        "3d_tiles",
    )
    assert expand_category_concept("pointcloud") == ("pointcloud",)
    assert expand_category_concept("not_a_concept") == ()


def test_resolves_bulguksa_site_aliases():
    assert resolve_site_alias("Bulguksa Temple").concept_id == "bulguksa"
    assert resolve_site_alias("경주불국사").concept_id == "bulguksa"


def test_resolves_real_data_site_aliases_without_over_merging_seongsu():
    assert resolve_site_alias("서강대교").concept_id == "sogang_bridge"
    assert resolve_site_alias("성수동").concept_id == "seongsu_dong"
    assert resolve_site_alias("본기숙사").concept_id == "kp_dormitory"
    assert resolve_site_alias("성수") is None


def test_resolves_bulguksa_target_aliases():
    assert (
        resolve_target_alias("Dabotap", site_concept="bulguksa").concept_id
        == "bulguksa_dabotap"
    )
    assert (
        resolve_target_alias("dabo_tap", site_concept="bulguksa").concept_id
        == "bulguksa_dabotap"
    )
    assert resolve_target_alias("불국사 다보탑").concept_id == "bulguksa_dabotap"


def test_resolves_real_data_target_with_site_context():
    assert (
        resolve_target_alias("이마트", site_concept="seongsu_dong").concept_id
        == "seongsu_emart"
    )


def test_resolves_aliases_inside_upload_filenames():
    assert resolve_site_alias_in_text("2024_경주불국사_측량").concept_id == "bulguksa"
    assert (
        resolve_target_alias_in_text("raw/dabotap_scan_001.laz", site_concept="bulguksa").concept_id
        == "bulguksa_dabotap"
    )


def test_has_derived_is_generated_reverse_not_primary_authoring():
    policy = get_relation_policy("has_derived")

    assert policy.generated_reverse_only is True
    assert policy.primary_authoring is False
    assert should_offer_relation_for_authoring("has_derived") is False
    assert inverse_relation("derived_from") == "has_derived"


def test_document_type_uses_stac_design_field():
    assert DOCUMENT_TYPE_FIELD == "properties.document:type"


def test_broader_category_concepts_for_upload_annotation():
    assert broader_category_concepts("pointcloud") == (
        "spatial_asset",
        "three_dimensional_asset",
    )


def test_builds_read_only_stac_search_expansion():
    expansion = build_search_expansion(
        category_concept="three_dimensional_asset",
        site_text="Bulguksa Temple",
        target_text="Dabotap",
        collection_id="bulguksa-2024",
        limit=500,
    )

    assert expansion.data_categories == ("pointcloud", "3d_model", "3d_tiles")
    assert expansion.site.concept_id == "bulguksa"
    assert expansion.target.concept_id == "bulguksa_dabotap"
    assert expansion.stac_search["limit"] == 200
    assert expansion.stac_search["collections"] == ["bulguksa-2024"]
    assert expansion.stac_search["filter-lang"] == "cql2-json"
    assert "limit capped to 200" in expansion.notes


def test_builds_existing_item_concept_write_dry_run_from_collection_context():
    item = {
        "id": "bg-dabotap-pc-20240312",
        "collection": "bulguksa-2024",
        "properties": {
            "data_category": "pointcloud",
            "target": "Dabotap",
        },
    }
    collection = {
        "id": "bulguksa-2024",
        "summaries": {"project:site": "경주 불국사"},
    }

    dry_run = build_item_concept_write_dry_run(item, collection=collection)

    assert dry_run.item_id == "bg-dabotap-pc-20240312"
    assert dry_run.site.status == "would_write"
    assert dry_run.site.source_field == "collection.summaries.project:site"
    assert dry_run.site.used_collection_context is True
    assert dry_run.site.proposed_concept == "bulguksa"
    assert dry_run.target.status == "would_write"
    assert dry_run.target.proposed_concept == "bulguksa_dabotap"
    assert dry_run.target.used_collection_context is True
    assert dry_run.would_write == {
        "sams:site_concept": "bulguksa",
        "sams:target_concept": "bulguksa_dabotap",
    }
    assert dry_run.safe_to_write is True


def test_builds_real_data_concept_write_dry_run_for_seongsu_emart():
    item = {
        "id": "upload-1778051566466-pointcloud-20260506071246-70dc69",
        "collection": "KP_dormitory",
        "properties": {
            "data_category": "pointcloud",
            "project:site": "성수동",
            "target": "이마트",
        },
    }
    collection = {
        "id": "KP_dormitory",
        "summaries": {"project:site": "본기숙사"},
    }

    dry_run = build_item_concept_write_dry_run(item, collection=collection)

    assert dry_run.site.status == "would_write"
    assert dry_run.site.proposed_concept == "seongsu_dong"
    assert dry_run.target.status == "would_write"
    assert dry_run.target.proposed_concept == "seongsu_emart"
    assert dry_run.would_write == {
        "sams:site_concept": "seongsu_dong",
        "sams:target_concept": "seongsu_emart",
    }
    assert dry_run.safe_to_write is True


def test_concept_write_dry_run_reports_conflict_without_overwriting():
    item = {
        "id": "bg-dabotap-model",
        "collection": "bulguksa-2024",
        "properties": {
            "project:site": "경주 불국사",
            "target": "다보탑",
            "sams:target_concept": "bulguksa_seokgatap",
        },
    }

    dry_run = build_item_concept_write_dry_run(item)

    assert dry_run.site.status == "would_write"
    assert dry_run.target.status == "conflict"
    assert dry_run.target.existing_concept == "bulguksa_seokgatap"
    assert dry_run.target.proposed_concept == "bulguksa_dabotap"
    assert dry_run.safe_to_write is False
    assert dry_run.would_write == {"sams:site_concept": "bulguksa"}
