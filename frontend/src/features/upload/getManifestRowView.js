/**
 * getManifestRowView — analyze 매니페스트 행(+사용자 수정) → Upload 검토 화면 표시 모델.
 *
 * 디자인의 예측 3종(category 신뢰도 · preview · spatial)을 실데이터에서 유도한다:
 * - category: detected_category + category_confidence (≥0.8 high / ≥0.5 medium / 그 외 low)
 * - preview: 카테고리별 썸네일 파이프라인 지원 여부 → 등록 시 생성 예측 (정직한 예측만)
 * - spatial: 추출 bbox_4326 → bbox / 사용자 지정 → manual / 없으면 none(지정 가능)
 */

export const PREVIEW_PREDICT = {
  pointcloud: { s: 'pending', note: '등록 시 썸네일 자동 생성' },
  '3d_model': { s: 'pending', note: '등록 시 썸네일 자동 생성' },
  '3d_tiles': { s: 'missing', note: '타일셋 placeholder — 전용 뷰어는 Phase 2' },
  orthoimage: { s: 'pending', note: '등록 시 썸네일 자동 생성' },
  image: { s: 'pending', note: '등록 시 썸네일 자동 생성' },
  panorama: { s: 'pending', note: '등록 시 썸네일 자동 생성' },
  video: { s: 'pending', note: '대표 프레임(poster) 자동 생성' },
  document: { s: 'pending', note: 'PDF 첫 페이지 렌더 자동 생성' },
}

export const SPATIAL_NOTE = {
  bbox: '파일에서 위치/범위 추출됨',
  manual: '지도에서 직접 지정됨',
  none: '좌표 없음 — 지정하거나 등록 후 보완',
}

export function confidenceLevel(conf) {
  if (conf == null) return 'low'
  if (conf >= 0.8) return 'high'
  if (conf >= 0.5) return 'medium'
  return 'low'
}

export const CONF_LABEL = { high: '신뢰 높음', medium: '신뢰 보통', low: '신뢰 낮음', manual: '직접 지정' }

function extractedValue(item, key) {
  const entry = item?.auto_extracted?.[key]
  return entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry
}

export function getManifestRowView(item, idx, { edits = {}, location = null, excluded = false } = {}) {
  const cat = edits.data_category || item.detected_category || 'unknown'
  const filename = (item.file_path || '').split('/').pop() || item.file_path
  const size = extractedValue(item, 'file:size')
  const autoDatetime = extractedValue(item, 'datetime')
  const hasAutoLocation = Boolean(extractedValue(item, 'bbox_4326') || item.auto_extracted?.bbox_4326)

  const spatialKind = location ? 'manual' : hasAutoLocation ? 'bbox' : 'none'
  const preview = PREVIEW_PREDICT[cat] || { s: 'missing', note: '미리보기 미지원 유형' }

  // 자동 추출/상속 행 (key, value, source) — 내부 키(_*) 와 위치 원시값은 표시에서 제외
  const HIDDEN = new Set(['bbox_4326', 'geometry'])
  const autoRows = Object.entries(item.auto_extracted || {})
    .filter(([k]) => !k.startsWith('_') && !HIDDEN.has(k))
    .map(([k, v]) => ({ key: k, value: v && typeof v === 'object' && 'value' in v ? v.value : v, source: 'auto' }))
  const inheritedRows = Object.entries(item.inherited || {})
    .map(([k, v]) => ({ key: k, value: v && typeof v === 'object' && 'value' in v ? v.value : v, source: 'collection' }))

  // 사용자가 검토 단계에서 채운 필드(표시 이름·취득일 등)는 누락 목록에서 제외
  const missing = (item.required_empty || []).filter(k => !edits[k])
  const links = item.suggested_links || []

  // 카테고리를 직접 교정했으면 자동 판별 신뢰도 경고는 무의미 — '직접 지정'으로 표시
  const manualCat = Boolean(edits.data_category)
  const conf = manualCat ? 'manual' : confidenceLevel(item.category_confidence)

  const flags = []
  if (conf === 'low') flags.push({ k: 'category', t: 'category 확인 필요' })
  if (missing.length > 0) flags.push({ k: 'metadata', t: `필수 ${missing.length}개 누락` })
  if (spatialKind === 'none') flags.push({ k: 'spatial', t: '위치 없음' })
  if (links.length > 0) flags.push({ k: 'link', t: `관계 제안 ${links.length}` })

  return {
    idx,
    cat,
    filename,
    filePath: item.file_path,
    size,
    conf,
    confPct: manualCat ? null : (item.category_confidence != null ? Math.round(item.category_confidence * 100) : null),
    preview,
    spatialKind,
    hasAutoLocation,
    location,
    autoRows,
    inheritedRows,
    missing,
    links,
    flags,
    excluded,
    name: edits.description ?? '',
    date: edits.datetime ? edits.datetime.slice(0, 10) : (typeof autoDatetime === 'string' ? autoDatetime.slice(0, 10) : ''),
    bundledFiles: item.bundled_files || [],
  }
}
