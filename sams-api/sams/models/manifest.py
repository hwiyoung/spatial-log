"""
매니페스트 모델 — /api/upload/analyze 응답 형식

파이프라인 분석 결과를 담는 구조체.
각 파일별로 자동 추출된 메타데이터, 상속된 기본값, 관계 제안, 필수 빈 필드를 포함.

참조: docs/system_architecture.md 섹션 3.2 (/api/upload/analyze 상세)
"""

from pydantic import BaseModel, Field
from typing import Any


class MetadataValue(BaseModel):
    """메타데이터 값 + 출처 정보."""
    value: Any
    source: str  # "file", "collection_default", "unknown"
    warning: str | None = None


class SuggestedLinkItem(BaseModel):
    """관계 제안 하나."""
    rel: str                # derived_from, related, describedby
    target_file: str        # 대상 파일 경로 (표시용)
    target_idx: int = -1    # 배치(manifest) 내 대상 인덱스 — register 의 _accepted_links 해석에 사용
    confidence: float       # 0.0 ~ 1.0
    reason: str             # 제안 이유


class OntologyAnnotation(BaseModel):
    """온톨로지 v0 dry-run 해석 결과. 등록 저장 대상이 아니다."""
    ontology_version: str
    category_concept: str | None = None
    broader_category_concepts: list[str] = Field(default_factory=list)
    site_concept: str | None = None
    site_label_ko: str | None = None
    target_concept: str | None = None
    target_label_ko: str | None = None
    target_match_source: str | None = None
    side_effects: str = "none"


class ManifestItem(BaseModel):
    """매니페스트 항목 — 파일 하나(또는 번들)의 분석 결과."""
    file_path: str
    bundled_files: list[str] | None = None
    detected_category: str
    category_confidence: float
    auto_extracted: dict[str, MetadataValue] = Field(default_factory=dict)
    inherited: dict[str, MetadataValue] = Field(default_factory=dict)
    suggested_links: list[SuggestedLinkItem] = Field(default_factory=list)
    required_empty: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    ontology: OntologyAnnotation | None = None


class ManifestSummary(BaseModel):
    """매니페스트 요약 정보."""
    total_files: int
    detected_types: dict[str, int] = Field(default_factory=dict)
    auto_filled_percentage: float = 0.0
    manual_required_fields: int = 0


class Manifest(BaseModel):
    """전체 매니페스트 — analyze() 반환값."""
    session_id: str = ""
    manifest: list[ManifestItem] = Field(default_factory=list)
    summary: ManifestSummary = Field(default_factory=ManifestSummary)
