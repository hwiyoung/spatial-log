/**
 * UnassignedView — Unassigned Inbox 전용 뷰: 상태 혼재 안내 + 프로젝트 연결(실제 이동).
 * `design-reference/project/Project.html` 의 UnassignedView 포팅.
 * 실데이터에서 "프로젝트 연결" = Collection 이동(itemApi.move). mock 은 로컬 데모만.
 */
import { useState } from 'react'
import CategoryGlyph from '../viewer/CategoryGlyph'
import { Badge, StatusMix } from './StatusBadge'

export default function UnassignedView({ views, projects, statusCounts, onAssign, onOpen, busyId }) {
  const [targets, setTargets] = useState({})   // {itemId: collectionId}

  return (
    <div>
      <div className="un-note">
        <span>◇</span>
        <div>
          <b>Unassigned Inbox는 "고장난 것들"이 아니라 "아직 프로젝트에 안 붙은 것들"입니다.</b>{' '}
          Draft와 Published가 섞여 있으며, 상태로 거르지 않습니다. 아래에서 프로젝트를 골라 연결(이동)하세요.
        </div>
      </div>

      <StatusMix statusCounts={statusCounts} style={{ marginBottom: 14 }} />

      {views.length === 0 && <div className="panel proj-empty">미배정 Item 없음 — 모두 프로젝트에 연결되었습니다</div>}
      {views.map(v => (
        <div className="irow" key={v.id}>
          <span className="ig"><CategoryGlyph cat={v.cat} s={16} /></span>
          <div className="im" onClick={() => onOpen(v)} style={{ cursor: 'pointer' }}>
            <div className="inm">
              {v.name}
              {v.status === 'published' && <span className="pub-unassigned">● Published인데 미배정</span>}
            </div>
            <div className="isub">{v.file}</div>
          </div>
          <div className="irow-r">
            <Badge status={v.status} />
            <div className="assign-row">
              <select
                value={targets[v.id] || ''}
                onChange={e => setTargets(t => ({ ...t, [v.id]: e.target.value }))}
                disabled={busyId === v.id}
              >
                <option value="">프로젝트 선택…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title || p.id}</option>)}
              </select>
              <button
                type="button" className="ghost-btn"
                disabled={!targets[v.id] || busyId === v.id}
                onClick={() => onAssign(v, targets[v.id])}
              >
                {busyId === v.id ? '이동 중…' : '연결(이동)'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
