/**
 * STATUS_HEX — 상태 색의 리터럴 hex (index.css 디자인 토큰과 동일).
 * SVG fill/stroke 처럼 CSS 변수 + 알파 합성이 까다로운 곳에서 쓴다(미니맵·관계 그래프).
 * 토큰: --draft #FBBF24 · --pub #34D399 · --arch #64748B · --unk #6B7280
 */
export const STATUS_HEX = {
  draft: '#FBBF24',
  published: '#34D399',
  archived: '#64748B',
  unknown: '#6B7280',
}

export function statusHex(status) {
  return STATUS_HEX[status] || STATUS_HEX.unknown
}
