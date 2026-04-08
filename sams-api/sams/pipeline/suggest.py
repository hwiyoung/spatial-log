"""
4단계: 관계 자동 제안

같은 배치 내 파일들 간의 관계를 파일명, 폴더, 유형 계보로 추론하여 제안한다.
제안은 "확인 필요"로 표시되며, 사용자가 수락/거절한다.

참조: docs/autofill_pipeline_spec.md 섹션 6
"""

import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# 유형 계보: source → target 으로 derived_from 관계
_DERIVATION_CHAINS: list[tuple[str, str]] = [
    ("pointcloud", "3d_model"),
    ("image", "3d_model"),
    ("3d_model", "3d_tiles"),
]


@dataclass
class SuggestedLink:
    """관계 제안 하나."""
    source_idx: int        # 배치 내 소스 아이템 인덱스
    target_idx: int        # 배치 내 타겟 아이템 인덱스
    rel_type: str          # derived_from, related, describedby
    confidence: float      # 0.0 ~ 1.0
    reason: str            # 제안 이유 설명


@dataclass
class BatchItem:
    """배치 내 아이템 정보 (suggest에 필요한 최소 정보)."""
    index: int
    filepath: str
    data_category: str
    target: str | None = None  # 사용자가 이미 입력한 target


def suggest_links(items: list[BatchItem]) -> list[SuggestedLink]:
    """배치 내 아이템들 간의 관계를 추론하여 제안한다.

    Args:
        items: 배치 내 아이템 목록 (index, filepath, data_category, target).

    Returns:
        SuggestedLink 목록. 중복 제거 및 confidence 내림차순 정렬.
    """
    if len(items) < 2:
        return []

    suggestions: list[SuggestedLink] = []

    # target 그룹 구성: 같은 target끼리 묶기
    target_groups = _build_target_groups(items)

    for _target_key, group in target_groups.items():
        if len(group) < 2:
            continue

        # 같은 target 내 유형 계보 (derived_from)
        suggestions.extend(_suggest_derivations(group))

        # 같은 target 내 다른 유형 (related)
        suggestions.extend(_suggest_related(group))

    # document → 나머지 (describedby)
    suggestions.extend(_suggest_describedby(items))

    # 중복 제거 및 정렬
    suggestions = _deduplicate(suggestions)
    suggestions.sort(key=lambda s: s.confidence, reverse=True)

    return suggestions


def _build_target_groups(items: list[BatchItem]) -> dict[str, list[BatchItem]]:
    """아이템들을 target 기준으로 그룹핑한다.

    target 결정 우선순위:
    1. 사용자가 이미 입력한 target 필드
    2. 파일명에서 추출한 공통 키워드
    3. 같은 하위 폴더
    """
    groups: dict[str, list[BatchItem]] = {}

    for item in items:
        key = _resolve_target_key(item)
        if key:
            groups.setdefault(key, []).append(item)

    return groups


def _resolve_target_key(item: BatchItem) -> str | None:
    """아이템의 target 키를 결정한다."""
    # 1) 사용자가 입력한 target
    if item.target:
        return item.target.lower().strip()

    path = Path(item.filepath)
    stem = path.stem.lower()

    # 2) 파일명에서 키워드 추출 (tileset.json 등 특수 파일은 건너뜀)
    keyword = _extract_keyword(stem)
    if keyword:
        return keyword

    # 3) 상위 폴더명 (유형 폴더가 아닌 경우)
    parent = path.parent.name.lower()
    category_folders = {
        "pointcloud", "3dmodel", "3d_model", "ortho", "image",
        "video", "panorama", "document", "3dtiles", "data",
    }
    if parent and parent not in category_folders:
        return parent

    return None


def _extract_keyword(stem: str) -> str | None:
    """파일명 stem에서 의미있는 키워드를 추출한다.

    예: "dabotap_scan_01" → "dabotap"
        "building_a_pc" → "building_a"
        "scan001" → None (너무 일반적)
    """
    # 숫자 접미사 먼저 제거 (반복 적용: _scan_01 → _scan → 제거)
    cleaned = re.sub(r"[_-]?\d+$", "", stem)

    # 알려진 유형/역할 접미사 제거 (반복 적용)
    _suffix_pattern = (
        r"[_-]?(scan|pc|model|ortho|mesh|photo|img|vid|doc|dwg|flight|"
        r"pointcloud|3dmodel|image|video|document|tileset|thumb|preview)$"
    )
    for _ in range(3):
        prev = cleaned
        cleaned = re.sub(r"[_-]?\d+$", "", cleaned)
        cleaned = re.sub(_suffix_pattern, "", cleaned, flags=re.IGNORECASE)
        if cleaned == prev:
            break

    cleaned = cleaned.strip("_- ")

    if len(cleaned) < 2:
        return None
    return cleaned


def _suggest_derivations(group: list[BatchItem]) -> list[SuggestedLink]:
    """같은 target 내 유형 계보를 기반으로 derived_from 관계를 제안한다."""
    suggestions = []
    by_category: dict[str, list[BatchItem]] = {}
    for item in group:
        by_category.setdefault(item.data_category, []).append(item)

    for source_cat, target_cat in _DERIVATION_CHAINS:
        sources = by_category.get(source_cat, [])
        targets = by_category.get(target_cat, [])

        for src in sources:
            for tgt in targets:
                suggestions.append(SuggestedLink(
                    source_idx=tgt.index,
                    target_idx=src.index,
                    rel_type="derived_from",
                    confidence=0.7,
                    reason=f"{target_cat}이(가) {source_cat}에서 파생된 것으로 추정 "
                           f"(같은 target, 유형 계보)",
                ))

    return suggestions


def _suggest_related(group: list[BatchItem]) -> list[SuggestedLink]:
    """같은 target 내 다른 유형 아이템 간 related 관계를 제안한다.

    derived_from으로 이미 연결된 쌍은 제외.
    """
    derivation_pairs = set()
    for src_cat, tgt_cat in _DERIVATION_CHAINS:
        derivation_pairs.add((src_cat, tgt_cat))
        derivation_pairs.add((tgt_cat, src_cat))

    suggestions = []
    for i, a in enumerate(group):
        for b in group[i + 1:]:
            if a.data_category == b.data_category:
                continue
            pair = (a.data_category, b.data_category)
            if pair in derivation_pairs:
                continue
            suggestions.append(SuggestedLink(
                source_idx=a.index,
                target_idx=b.index,
                rel_type="related",
                confidence=0.8,
                reason=f"같은 target의 다른 유형 ({a.data_category}, {b.data_category})",
            ))

    return suggestions


def _suggest_describedby(items: list[BatchItem]) -> list[SuggestedLink]:
    """document 유형 아이템을 나머지와 describedby로 연결 제안."""
    docs = [item for item in items if item.data_category == "document"]
    non_docs = [item for item in items if item.data_category != "document"]

    if not docs or not non_docs:
        return []

    suggestions = []
    for doc in docs:
        for other in non_docs:
            suggestions.append(SuggestedLink(
                source_idx=other.index,
                target_idx=doc.index,
                rel_type="describedby",
                confidence=0.5,
                reason="문서가 다른 데이터를 설명하는 것으로 추정",
            ))

    return suggestions


def _deduplicate(suggestions: list[SuggestedLink]) -> list[SuggestedLink]:
    """같은 (source, target) 쌍의 중복 제안 중 confidence가 높은 것만 유지."""
    best: dict[tuple[int, int], SuggestedLink] = {}
    for s in suggestions:
        key = (s.source_idx, s.target_idx)
        existing = best.get(key)
        if existing is None or s.confidence > existing.confidence:
            best[key] = s
    return list(best.values())
