/**
 * DeliverablesEditor — 예상 산출물(expected_deliverables) 표 편집기.
 * 생성 모달과 현황탭 편집에서 공용. 행 = {category, count, description}.
 * v4 설계서: Collection.expected_deliverables — 대시보드 "예상 대비 등록" KPI 의 기준값.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { CATEGORIES } from '../../constants'

const CAT_ORDER = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document']

export default function DeliverablesEditor({ value, onChange }) {
  const rows = value || []
  const update = (idx, patch) => onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const remove = (idx) => onChange(rows.filter((_, i) => i !== idx))
  const add = () => {
    // 아직 안 쓴 카테고리를 기본값으로 제안
    const used = new Set(rows.map(r => r.category))
    const next = CAT_ORDER.find(c => !used.has(c)) || CAT_ORDER[0]
    onChange([...rows, { category: next, count: 1, description: '' }])
  }

  return (
    <div className="deliv-edit">
      {rows.length === 0 && (
        <div className="de-empty">예상 산출물이 없으면 "등록 완성도" KPI 가 표시되지 않습니다 — 유형별 예상 수량을 추가하세요.</div>
      )}
      {rows.map((r, i) => (
        <div className="de-row" key={i}>
          <span className="de-glyph"><CategoryGlyph cat={r.category} s={15} /></span>
          <select value={r.category} onChange={e => update(i, { category: e.target.value })}>
            {CAT_ORDER.map(c => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
          </select>
          <input
            className="de-count" type="number" min="1" value={r.count}
            onChange={e => update(i, { count: Math.max(1, Number(e.target.value) || 1) })}
          />
          <input
            className="de-desc" value={r.description} placeholder="설명 (예: 다보탑·석가탑 스캔)"
            onChange={e => update(i, { description: e.target.value })}
          />
          <button type="button" className="de-rm" onClick={() => remove(i)} title="행 삭제">✕</button>
        </div>
      ))}
      <button type="button" className="de-add" onClick={add}>＋ 산출물 추가</button>
    </div>
  )
}
