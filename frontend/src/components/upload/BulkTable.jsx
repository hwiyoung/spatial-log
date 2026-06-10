/**
 * BulkTable — 벌크(효율) 등록 검토 테이블. 행당 category 교정·위치 지정·취득일·제외.
 * `design-reference/project/Upload.html` 의 .tbl-wrap 포팅 — 데이터는 실 analyze 결과.
 * (프로젝트는 작업(task) 단위 Collection 선택으로 일괄 지정 — register API 가 단일 collection 단위)
 */
import { useState } from 'react'
import CategoryGlyph from '../viewer/CategoryGlyph'
import SpatialGlyph from './SpatialGlyph'
import LocationPicker from '../LocationPicker'
import { CATEGORIES } from '../../constants'
import { formatSize } from '../../constants'
import { PvDot, SP_LABEL } from './uploadBits'

const CAT_ORDER = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document']

export default function BulkTable({ rows, onEdit, onExclude, onLocation }) {
  const [pickerIdx, setPickerIdx] = useState(null)
  const pickerRow = pickerIdx != null ? rows.find(r => r.idx === pickerIdx) : null

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>파일</th><th>예측 category</th><th>preview</th><th>위치</th><th>누락 · Draft 사유</th><th>취득일</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.idx} className={r.excluded ? 'excluded' : ''}>
              <td>
                <div className="td-file">
                  <span className="tg"><CategoryGlyph cat={r.cat} s={17} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="tn" title={r.filePath}>{r.filename}</div>
                    <div className="ts">{r.size != null ? formatSize(r.size) : '—'}{r.confPct != null ? ` · ${r.confPct}%` : ''}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className="td-cat">
                  <select className="tbl-sel" style={{ width: 130 }} value={r.cat} onChange={e => onEdit(r.idx, { data_category: e.target.value })}>
                    {r.cat === 'unknown' && <option value="unknown" disabled>알 수 없음 — 선택 필요</option>}
                    {CAT_ORDER.map(c => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
                  </select>
                  {r.conf === 'low' && <span style={{ color: 'var(--orange)', fontSize: 11 }} title="자동 판별 신뢰 낮음">⚠</span>}
                </div>
              </td>
              <td><div className="td-cat"><PvDot s={r.preview.s} />{r.preview.s}</div></td>
              <td>
                <div className="td-cat">
                  <span className="tcg"><SpatialGlyph kind={r.spatialKind} s={15} /></span>
                  {r.location
                    ? <span className="loc-ok" onClick={() => setPickerIdx(r.idx)} style={{ cursor: 'pointer' }}>지정됨 ✎</span>
                    : r.spatialKind === 'bbox'
                      ? SP_LABEL.bbox
                      : <span className="loc-link" onClick={() => setPickerIdx(r.idx)}>위치 지정</span>}
                </div>
              </td>
              <td>
                {r.missing.length > 0
                  ? <div className="miss-cell">{r.missing.join(', ')}</div>
                  : <span style={{ color: 'var(--t3)', fontSize: 11 }}>없음</span>}
              </td>
              <td>
                <input
                  className="tbl-in" type="date" value={r.date}
                  onChange={e => onEdit(r.idx, { datetime: e.target.value ? e.target.value + 'T00:00:00Z' : '' })}
                />
              </td>
              <td>
                <button type="button" className="tbl-rm" onClick={() => onExclude(r.idx)} title={r.excluded ? '복원' : '등록에서 제외'}>
                  {r.excluded ? '↺' : '✕'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pickerRow && (
        <LocationPicker
          initialLocation={pickerRow.location}
          onConfirm={(loc) => { onLocation(pickerRow.idx, loc); setPickerIdx(null) }}
          onCancel={() => setPickerIdx(null)}
        />
      )}
    </div>
  )
}
