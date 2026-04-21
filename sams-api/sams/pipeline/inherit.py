"""
3단계: Collection 기본값 상속

Collection을 선택하면 해당 Collection의 기본값이 Item에 자동 적용된다.
우선순위: 파일 추출값(구역 A) > Collection 기본값 > 빈 칸

참조: docs/autofill_pipeline_spec.md 섹션 5
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Collection 필드 → Item 필드 매핑
_INHERITANCE_MAP: dict[str, str] = {
    "title": "project:name",
    "project:site": "project:site",
    "project:default_epsg": "proj:epsg",
    "license": "license",
    "id": "collection",
}


def apply_collection_defaults(
    extracted_meta: dict[str, Any],
    collection_defaults: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """파일 추출 메타데이터에 Collection 기본값을 병합한다.

    Args:
        extracted_meta: extract.py에서 추출된 메타데이터 dict.
        collection_defaults: Collection의 필드 dict.
            예: {"id": "proj-001", "title": "다보탑 보수", "project:site": "경주",
                 "project:default_epsg": 5186, "license": "proprietary"}

    Returns:
        병합된 메타데이터 dict. 각 값에 source 태그가 붙은 _sources dict 포함.
        예: {"proj:epsg": 5186, ..., "_sources": {"proj:epsg": "collection_default", ...}}
    """
    if collection_defaults is None:
        collection_defaults = {}

    merged = dict(extracted_meta)
    sources: dict[str, str] = dict(merged.get("_sources", {}))

    # 기존 추출값의 source 표시 (아직 없으면 "file"로)
    for key, value in extracted_meta.items():
        if key.startswith("_"):
            continue
        if key not in sources and value is not None:
            sources[key] = "file"

    # Collection 기본값 상속
    for col_field, item_field in _INHERITANCE_MAP.items():
        col_value = collection_defaults.get(col_field)
        if col_value is None:
            continue

        existing = merged.get(item_field)
        if _is_empty(existing):
            merged[item_field] = col_value
            sources[item_field] = "collection_default"
            logger.debug(
                "Collection 기본값 상속: %s → %s = %s",
                col_field, item_field, col_value,
            )

    merged["_sources"] = sources
    return merged


def _is_empty(value: Any) -> bool:
    """값이 비어있는지 판단."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False
