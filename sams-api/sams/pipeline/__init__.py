"""
SAMS 메타데이터 자동 채움 파이프라인

이것이 SAMS의 핵심 차별점이다. 다른 모든 기능보다 이것이 먼저.
상세 명세: docs/autofill_pipeline_spec.md

모듈 구성:
- bundle.py   : 0단계 - 파일 그룹핑 (OBJ 참조 파싱, 이미지 세트, 3D Tiles)
- detect.py   : 1단계 - 파일 유형 자동 판별 (확장자 + 매직바이트)
- extract.py  : 2단계 - 유형별 메타데이터 추출 (laspy, rasterio, trimesh, ffprobe, Pillow, PyPDF)
- inherit.py  : 3단계 - Collection 기본값 상속 + 이전 입력값 자동완성
- suggest.py  : 4단계 - 관계(links) 자동 제안 (파일명 매칭, 유형 계보)
- thumbnail.py: 5단계 - 썸네일 자동 생성 (비동기, Worker에서 실행)

실행 흐름:
  analyze(files, collection_id) -> Manifest (자동 채움 완료 상태)

핵심 원칙:
  - 어떤 단계가 실패해도 등록은 진행 가능 (graceful degradation)
  - 0~4단계는 동기 (수 초 이내), 5단계만 비동기
"""

import logging
from collections import Counter
from typing import Any

from sams.models.manifest import (
    Manifest,
    ManifestItem,
    ManifestSummary,
    MetadataValue,
    SuggestedLinkItem,
)
from sams.pipeline.bundle import bundle_files
from sams.pipeline.detect import detect_category
from sams.pipeline.extract import extract_metadata
from sams.pipeline.inherit import apply_collection_defaults
from sams.pipeline.suggest import suggest_links, BatchItem
from sams.ontology.upload_annotations import annotate_manifest_ontology

logger = logging.getLogger(__name__)

# Item의 필수 필드 (STAC 표준 + SAMS 확장)
# 참조: docs/stac_metadata_design_v4.md
_COMMON_REQUIRED = frozenset([
    "datetime", "description", "data_category",
    "project:name", "project:site", "proj:epsg",
])

# category별 추가 필수 필드
_CATEGORY_REQUIRED: dict[str, frozenset[str]] = {
    "pointcloud": frozenset(["pc:count", "pc:type"]),
    "3d_model": frozenset(),
    "3d_tiles": frozenset(),
    "orthoimage": frozenset(["eo:bands"]),
    "image": frozenset(),
    "panorama": frozenset(),
    "video": frozenset(),
    "document": frozenset(),
}


def analyze(
    file_paths: list[str],
    collection_defaults: dict[str, Any] | None = None,
) -> Manifest:
    """파이프라인 전체를 실행하여 매니페스트를 생성한다.

    Args:
        file_paths: 업로드된 파일 경로 목록.
        collection_defaults: Collection의 필드 dict (inherit용).
            예: {"id": "proj-001", "title": "다보탑 보수", ...}

    Returns:
        Manifest — 파일별 분석 결과 + 요약.
    """
    # 0단계: 파일 그룹핑
    groups = bundle_files(file_paths)

    # 1~3단계: 각 그룹별 detect → extract → inherit
    items: list[ManifestItem] = []
    batch_items: list[BatchItem] = []  # suggest용

    for idx, group in enumerate(groups):
        item = _process_group(idx, group, collection_defaults)
        items.append(item)
        batch_items.append(BatchItem(
            index=idx,
            filepath=group.primary_file,
            data_category=item.detected_category,
        ))

    # 4단계: 관계 자동 제안
    suggestions = suggest_links(batch_items)
    for s in suggestions:
        if 0 <= s.source_idx < len(items):
            target_item = items[s.target_idx] if 0 <= s.target_idx < len(items) else None
            target_file = target_item.file_path if target_item else "unknown"
            items[s.source_idx].suggested_links.append(SuggestedLinkItem(
                rel=s.rel_type,
                target_file=target_file,
                target_idx=s.target_idx,
                confidence=s.confidence,
                reason=s.reason,
            ))

    # 요약 생성
    summary = _build_summary(items)

    manifest = Manifest(manifest=items, summary=summary)
    return annotate_manifest_ontology(manifest, collection_defaults)


def _process_group(
    idx: int,
    group,
    collection_defaults: dict[str, Any] | None,
) -> ManifestItem:
    """하나의 FileGroup을 파이프라인에 통과시킨다."""
    filepath = group.primary_file
    bundled = group.bundled_files or None
    warnings: list[str] = []

    # 1단계: detect
    detection = detect_category(filepath)
    category = detection.category
    confidence = detection.confidence
    if detection.warning:
        warnings.append(detection.warning)

    # 2단계: extract
    try:
        raw_meta = extract_metadata(
            filepath, category, bundled_files=group.bundled_files,
        )
    except Exception:
        logger.exception("extract 실패: %s", filepath)
        raw_meta = {"file:size": None}
        warnings.append(f"메타데이터 추출 실패: {filepath}")

    # detect 결과를 메타데이터에 포함
    raw_meta["data_category"] = category

    # 3단계: inherit
    merged = apply_collection_defaults(raw_meta, collection_defaults)

    # auto_extracted / inherited 분리
    sources = merged.pop("_sources", {})
    auto_extracted: dict[str, MetadataValue] = {}
    inherited: dict[str, MetadataValue] = {}

    for key, value in merged.items():
        if key.startswith("_"):
            continue
        source = sources.get(key, "unknown")
        mv = MetadataValue(value=value, source=source)

        # source에 따라 warning 필드에 경고 추가
        warning_for_key = _find_warning_for_key(key, source, warnings)
        if warning_for_key:
            mv.warning = warning_for_key

        if source == "collection_default":
            inherited[key] = mv
        else:
            auto_extracted[key] = mv

    # 필수 빈 필드 계산
    all_filled_keys = set(merged.keys())
    required_fields = _COMMON_REQUIRED | _CATEGORY_REQUIRED.get(category, frozenset())
    required_empty = sorted(f for f in required_fields if f not in all_filled_keys)

    return ManifestItem(
        file_path=filepath,
        bundled_files=bundled,
        detected_category=category,
        category_confidence=confidence,
        auto_extracted=auto_extracted,
        inherited=inherited,
        required_empty=required_empty,
        warnings=warnings,
    )


def _find_warning_for_key(key: str, source: str, warnings: list[str]) -> str | None:
    """특정 키에 대한 경고를 warnings에서 찾는다."""
    if source == "collection_default" and key == "proj:epsg":
        return "파일에서 좌표계를 확인할 수 없어 Collection 기본값을 적용했습니다."
    return None


def _build_summary(items: list[ManifestItem]) -> ManifestSummary:
    """매니페스트 요약 정보를 생성한다."""
    type_counts: Counter[str] = Counter()
    total_filled = 0
    total_possible = 0
    total_manual = 0

    for item in items:
        type_counts[item.detected_category] += 1
        filled = len(item.auto_extracted) + len(item.inherited)
        empty = len(item.required_empty)
        total_filled += filled
        total_possible += filled + empty
        total_manual += empty

    pct = (total_filled / total_possible * 100) if total_possible > 0 else 0.0

    return ManifestSummary(
        total_files=len(items),
        detected_types=dict(type_counts),
        auto_filled_percentage=round(pct, 1),
        manual_required_fields=total_manual,
    )
