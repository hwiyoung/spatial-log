/**
 * SingleCard — 단건(정밀) 등록 검토 카드. 매니페스트 행 하나의 예측 3종 +
 * 자동 추출/누락(Draft 사유)/관계 제안 + 편집 필드(표시 이름·취득일·위치).
 * `design-reference/project/Upload.html` 의 .fcard 포팅 — 데이터는 실 analyze 결과.
 */
import { useState } from 'react'
import CategoryGlyph from '../viewer/CategoryGlyph'
import SpatialGlyph from './SpatialGlyph'
import LocationPicker from '../LocationPicker'
import { CATEGORIES, formatSize } from '../../constants'
import { PREVIEW_META } from '../../features/explorer/explorerMeta'
import { CONF_LABEL, SPATIAL_NOTE } from '../../features/upload/getManifestRowView'
import { Flag, PvDot, SP_LABEL } from './uploadBits'

const CAT_ORDER = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document']

export default function SingleCard({ row, onEdit, onExclude, onLocation }) {
  const [showPicker, setShowPicker] = useState(false)
  const pv = PREVIEW_META[row.preview.s] || PREVIEW_META.missing

  return (
    <div className={'fcard' + (row.excluded ? ' excluded' : '')}>
      <div className="fc-top">
        <div className="fc-glyph"><CategoryGlyph cat={row.cat} s={22} /></div>
        <div className="fc-id">
          <div className="fc-name" title={row.filePath}>{row.filename}</div>
          <div className="fc-meta">
            {row.size != null ? formatSize(row.size) + ' · ' : ''}업로드 원본
            {row.bundledFiles.length > 0 && ` · 번들 ${row.bundledFiles.length}개 파일`}
          </div>
        </div>
        <span className="draftpill">{row.excluded ? '등록 제외됨' : 'Draft로 등록 예정'}</span>
        <button type="button" className="fc-rm" onClick={() => onExclude(row.idx)} title={row.excluded ? '복원' : '등록에서 제외'}>
          {row.excluded ? '↺' : '✕'}
        </button>
      </div>

      <div className="pred">
        <div className="pred-c">
          <div className="pred-l">예측 category</div>
          <div className="pred-cat">
            <span className="pcg"><CategoryGlyph cat={row.cat} s={18} /></span>
            <select value={row.cat} onChange={e => onEdit(row.idx, { data_category: e.target.value })}>
              {row.cat === 'unknown' && <option value="unknown" disabled>알 수 없음 — 선택 필요</option>}
              {CAT_ORDER.map(c => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
            </select>
            <span className={'conf ' + row.conf}>
              {CONF_LABEL[row.conf]}{row.confPct != null ? ` ${row.confPct}%` : ''}
            </span>
          </div>
          {row.conf === 'low' && <div className="pred-note">자동 판별이 불확실합니다 — 직접 확인하세요.</div>}
        </div>
        <div className="pred-c">
          <div className="pred-l">예측 preview</div>
          <div className="pv-line"><PvDot s={row.preview.s} /><span style={{ color: pv.color }}>{row.preview.s}</span></div>
          <div className="pred-note">{row.preview.note}</div>
        </div>
        <div className="pred-c">
          <div className="pred-l">예측 spatial</div>
          <div className="sp-line">
            <span className="sp-glyph"><SpatialGlyph kind={row.spatialKind} s={17} /></span>
            {SP_LABEL[row.spatialKind]}
            <span className="sp-edit" onClick={() => setShowPicker(true)}>{row.location ? '수정' : '위치 지정'}</span>
          </div>
          <div className="pred-note">
            {row.location
              ? `${row.location[1].toFixed(5)}, ${row.location[0].toFixed(5)} (수동)`
              : SPATIAL_NOTE[row.spatialKind]}
          </div>
        </div>
      </div>

      <div className="fc-body">
        <div className="fc-half l">
          <div className="fc-sub">자동 추출됨</div>
          {row.autoRows.length === 0 && row.inheritedRows.length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>추출된 메타데이터 없음</div>
          )}
          {row.autoRows.map(r => (
            <div className="autorow" key={r.key}>
              <span className="ak">{r.key}</span>
              <span className="av">{typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value)}</span>
              <span className="ab">AUTO</span>
            </div>
          ))}
          {row.inheritedRows.map(r => (
            <div className="autorow" key={r.key}>
              <span className="ak">{r.key}</span>
              <span className="av">{String(r.value)}</span>
              <span className="ab inh">상속</span>
            </div>
          ))}
        </div>
        <div className="fc-half">
          <div className="fc-sub">등록 시 누락 <span style={{ color: 'var(--draft)', textTransform: 'none', letterSpacing: 0 }}>= Draft 사유</span></div>
          {row.missing.length > 0
            ? <div className="misschips">{row.missing.map(m => <span className="misschip" key={m}>{m}</span>)}</div>
            : <div className="misschips"><span style={{ fontSize: 11.5, color: 'var(--t3)' }}>품질 필드 누락 없음</span></div>}
          {row.missing.length > 0 && (
            <div className="reason">누락 필드는 등록을 막지 않습니다 — Draft로 수용 후 보완 화면에서 채울 수 있습니다.</div>
          )}
          {row.links.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="fc-sub">관계 자동 제안</div>
              {row.links.map((l, i) => (
                <div className="linkrow" key={i}>
                  <span className="lr">{l.rel}</span>
                  <span>→ {(l.target_file || '').split('/').pop()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fc-fields">
        <div className="ff">
          <label>Display name <span className="opt">· 사람이 읽는 이름 (비우면 파일명)</span></label>
          <input value={row.name} placeholder={row.filename} onChange={e => onEdit(row.idx, { description: e.target.value })} />
        </div>
        <div className="ff">
          <label>취득일 <span className="opt">· acquired</span></label>
          <input
            type="date" value={row.date}
            onChange={e => onEdit(row.idx, { datetime: e.target.value ? e.target.value + 'T00:00:00Z' : '' })}
          />
        </div>
        {row.flags.length > 0 && (
          <div className="ff" style={{ gridColumn: '1 / -1' }}>
            <label>분류 플래그</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{row.flags.map((fl, i) => <Flag key={i} f={fl} />)}</div>
          </div>
        )}
      </div>

      {showPicker && (
        <LocationPicker
          initialLocation={row.location}
          onConfirm={(loc) => { onLocation(row.idx, loc); setShowPicker(false) }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
