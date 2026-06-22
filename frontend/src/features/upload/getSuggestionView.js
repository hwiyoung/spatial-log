/**
 * getSuggestionView — manifest 의 관계 자동 제안 → 검토 UI 모델 + 기본 수락 규칙.
 *
 * 기본값 규칙 (suggest 의 confidence 는 규칙별 상수 + target 근거 보정이므로,
 * 숫자 임계가 아니라 규칙·모호성 기준으로 정한다):
 * - related      : 기본 수락 — 같은 target 근거가 강하고 대칭 관계라 오류 비용이 낮다
 * - derived_from : 소스(파생본)의 후보 원본이 1개일 때만 기본 수락 — N:M 전조합은 모호
 * - describedby  : 기본 무시 — target 무관 전조합이라 노이즈가 크다
 */

export function getSuggestions(manifest) {
  const items = manifest?.manifest || []
  const out = []
  items.forEach((item, sourceIdx) => {
    ;(item.suggested_links || []).forEach(s => {
      if (s.target_idx == null || s.target_idx < 0) return   // 구버전 manifest — 해석 불가
      out.push({
        key: `${sourceIdx}-${s.target_idx}-${s.rel}`,
        sourceIdx,
        targetIdx: s.target_idx,
        rel: s.rel,
        confidence: s.confidence,
        reason: s.reason || '',
        targetFile: (s.target_file || '').split('/').pop(),
      })
    })
  })
  return out
}

export function getDefaultAcceptance(suggestions) {
  const derivedCountBySource = {}
  suggestions.forEach(s => {
    if (s.rel === 'derived_from') {
      derivedCountBySource[s.sourceIdx] = (derivedCountBySource[s.sourceIdx] || 0) + 1
    }
  })
  const acceptance = {}
  suggestions.forEach(s => {
    if (s.rel === 'related') acceptance[s.key] = true
    else if (s.rel === 'derived_from') acceptance[s.key] = derivedCountBySource[s.sourceIdx] === 1
    else acceptance[s.key] = false
  })
  return acceptance
}

// 최종 수락 상태 = 기본값 + 사용자 토글(overrides). 등록 payload 구성과 UI 가 같은 함수를 쓴다.
export function resolveAcceptance(suggestions, overrides = {}) {
  const defaults = getDefaultAcceptance(suggestions)
  const merged = {}
  suggestions.forEach(s => {
    merged[s.key] = overrides[s.key] !== undefined ? overrides[s.key] : defaults[s.key]
  })
  return merged
}
