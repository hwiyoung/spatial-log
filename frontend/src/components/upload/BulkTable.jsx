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
import AcquiredDateTimeInput from './AcquiredDateTimeInput'

const CAT_ORDER = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document']

function StandardIdCell({ row, decision, onDecision, conceptWriteEnabled = false }) {
  const ontology = row.ontology
  const hasCandidate = row.ontologyState?.status === 'matched'

  if (!hasCandidate) {
    return <span className="std-empty">후보 없음</span>
  }

  return (
    <div className="std-cell">
      <div className="std-chips">
        {ontology?.site_concept && (
          <span className="std-chip"><b>Site</b>{ontology.site_label_ko || ontology.site_concept}<small>{ontology.site_concept}</small></span>
        )}
        {ontology?.target_concept && (
          <span className="std-chip"><b>Target</b>{ontology.target_label_ko || ontology.target_concept}<small>{ontology.target_concept}</small></span>
        )}
      </div>
      <div className="std-actions">
        <button
          type="button"
          className={decision === 'confirmed' ? 'on' : ''}
          onClick={() => onDecision(row.idx, decision === 'confirmed' ? '' : 'confirmed')}
        >
          확인
        </button>
        <button
          type="button"
          className={decision === 'deferred' ? 'on warn' : ''}
          onClick={() => onDecision(row.idx, decision === 'deferred' ? '' : 'deferred')}
        >
          보류
        </button>
      </div>
      <div className="std-save-note">
        {conceptWriteEnabled ? '확인 시 저장 예정' : '현재 저장 안 함'}
      </div>
    </div>
  )
}

export default function BulkTable({
  rows,
  onEdit,
  onExclude,
  onLocation,
  ontologyDecisions = {},
  onOntologyDecision = () => {},
  conceptWriteEnabled = false,
}) {
  const [pickerIdx, setPickerIdx] = useState(null)
  const pickerRow = pickerIdx != null ? rows.find(r => r.idx === pickerIdx) : null

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>파일</th><th>예측 category</th><th>표준 ID</th><th>preview</th><th>위치</th><th>누락 · Draft 사유</th><th>취득일시</th><th></th>
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
              <td>
                <StandardIdCell
                  row={r}
                  decision={ontologyDecisions[r.idx] || ''}
                  onDecision={onOntologyDecision}
                  conceptWriteEnabled={conceptWriteEnabled}
                />
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
                <AcquiredDateTimeInput
                  compact
                  value={r.datetime}
                  autoValue={r.autoDatetime}
                  onChange={datetime => onEdit(r.idx, { datetime })}
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
