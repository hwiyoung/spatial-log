/**
 * CreateProjectModal — 새 프로젝트(Collection) 생성 모달. 기존 Project.jsx 에서 분리·디자인 토큰화.
 */
import { useState } from 'react'
import { collectionApi } from '../../services/api'

const INITIAL = {
  id: '', title: '', description: '',
  'project:site': '', 'project:client': '', 'project:manager': '',
  'project:default_epsg': 5186,
}

// Collection ID: URL/S3 경로에 쓰이므로 영문·숫자·점·하이픈·언더스코어만
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/i

export default function CreateProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const idInvalid = form.id.trim() !== '' && !ID_RE.test(form.id.trim())

  async function handleSubmit() {
    if (!form.id.trim() || !form.title.trim() || idInvalid) return
    setSubmitting(true)
    try {
      await collectionApi.create(form)
      onCreated()
    } catch (err) {
      alert('생성 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-h"><b>새 프로젝트 생성</b><button type="button" className="modal-x" onClick={onClose}>×</button></div>
        <div className="modal-b">
          <div>
            <label>Collection ID *</label>
            <input value={form.id} onChange={e => update('id', e.target.value)} placeholder="bulguksa-2024" />
            {idInvalid && <div style={{ fontSize: 10.5, color: 'var(--fail)', marginTop: 3 }}>영문/숫자로 시작, 영문·숫자·점·하이픈·언더스코어만 사용 가능</div>}
          </div>
          <div><label>프로젝트명 *</label><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="2024 경주 불국사 정밀실측" /></div>
          <div><label>사이트</label><input value={form['project:site']} onChange={e => update('project:site', e.target.value)} placeholder="경주 불국사" /></div>
          <div><label>발주처</label><input value={form['project:client']} onChange={e => update('project:client', e.target.value)} /></div>
          <div><label>PM</label><input value={form['project:manager']} onChange={e => update('project:manager', e.target.value)} /></div>
          <div><label>기본 EPSG</label><input type="number" value={form['project:default_epsg'] ?? ''} onChange={e => update('project:default_epsg', e.target.value === '' ? null : Number(e.target.value))} /></div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn-primary" disabled={submitting || !form.id.trim() || !form.title.trim() || idInvalid} onClick={handleSubmit}>
            {submitting ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
