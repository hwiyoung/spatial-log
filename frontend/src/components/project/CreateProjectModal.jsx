/**
 * CreateProjectModal — 새 프로젝트(Collection) 생성 모달.
 * 기간(project:period_start/end)과 예상 산출물(expected_deliverables)을 포함한 전체 필드 —
 * 예상 산출물은 현황탭 "예상 대비 등록" KPI 의 기준값이라 생성 시 입력을 유도한다.
 */
import { useState } from 'react'
import { collectionApi } from '../../services/api'
import DeliverablesEditor from './DeliverablesEditor'

const INITIAL = {
  id: '', title: '', description: '',
  'project:site': '', 'project:client': '', 'project:manager': '',
  'project:default_epsg': 5186,
  'project:period_start': '', 'project:period_end': '',
}

// Collection ID: URL/S3 경로에 쓰이므로 영문·숫자·점·하이픈·언더스코어만
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/i

export default function CreateProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL)
  const [deliverables, setDeliverables] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const idInvalid = form.id.trim() !== '' && !ID_RE.test(form.id.trim())
  const periodInvalid = Boolean(form['project:period_start'] && form['project:period_end']
    && form['project:period_start'] > form['project:period_end'])

  async function handleSubmit() {
    if (!form.id.trim() || !form.title.trim() || idInvalid || periodInvalid) return
    setSubmitting(true)
    try {
      await collectionApi.create({
        ...form,
        'project:period_start': form['project:period_start'] || null,
        'project:period_end': form['project:period_end'] || null,
        expected_deliverables: deliverables.filter(d => d.category && d.count > 0),
      })
      onCreated()
    } catch (err) {
      alert('생성 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" style={{ width: 560 }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-h"><b>새 프로젝트 생성</b><button type="button" className="modal-x" onClick={onClose}>×</button></div>
        <div className="modal-b" style={{ maxHeight: '64vh', overflowY: 'auto' }}>
          <div>
            <label>Collection ID *</label>
            <input value={form.id} onChange={e => update('id', e.target.value)} placeholder="bulguksa-2024-survey" />
            {idInvalid && <div style={{ fontSize: 10.5, color: 'var(--fail)', marginTop: 3 }}>영문/숫자로 시작, 영문·숫자·점·하이픈·언더스코어만 사용 가능</div>}
          </div>
          <div><label>프로젝트명 *</label><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="2024 경주 불국사 정밀실측" /></div>
          <div><label>사이트</label><input value={form['project:site']} onChange={e => update('project:site', e.target.value)} placeholder="경주 불국사" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label>발주처</label><input value={form['project:client']} onChange={e => update('project:client', e.target.value)} /></div>
            <div><label>PM</label><input value={form['project:manager']} onChange={e => update('project:manager', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label>기간 시작</label><input type="date" value={form['project:period_start']} onChange={e => update('project:period_start', e.target.value)} /></div>
            <div><label>기간 종료</label><input type="date" value={form['project:period_end']} onChange={e => update('project:period_end', e.target.value)} /></div>
            <div><label>기본 EPSG</label><input type="number" value={form['project:default_epsg'] ?? ''} onChange={e => update('project:default_epsg', e.target.value === '' ? null : Number(e.target.value))} /></div>
          </div>
          {periodInvalid && <div style={{ fontSize: 10.5, color: 'var(--fail)' }}>기간 종료가 시작보다 빠릅니다</div>}
          <div>
            <label>예상 산출물 <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· "예상 대비 등록" KPI 기준</span></label>
            <DeliverablesEditor value={deliverables} onChange={setDeliverables} />
          </div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn-primary" disabled={submitting || !form.id.trim() || !form.title.trim() || idInvalid || periodInvalid} onClick={handleSubmit}>
            {submitting ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
