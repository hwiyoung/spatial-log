/**
 * MoveModal — Item 을 다른 Collection(프로젝트)으로 이동.
 * 기존 Detail.jsx 에서 분리. 색은 디자인 토큰 별칭(var) 을 읽으므로 팔레트는 자동 적용된다.
 */
import { useEffect, useState } from 'react'
import { collectionApi, itemApi } from '../../services/api'

export default function MoveModal({ currentCollectionId, itemId, itemDescription, onClose, onMoved }) {
  const [collections, setCollections] = useState([])
  const [targetId, setTargetId] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    collectionApi.list()
      .then(res => setCollections((res.data?.collections || []).filter(c => c.id !== currentCollectionId)))
      .catch(() => {})
  }, [currentCollectionId])

  async function handleMove() {
    if (!targetId) return
    setMoving(true)
    try {
      await itemApi.move(currentCollectionId, itemId, targetId)
      onClose()
      onMoved(targetId)
    } catch (err) {
      alert('이동 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setMoving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(7,9,12,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div style={{ width: 440, background: 'var(--panel)', borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>프로젝트 이동</span>
          <span onClick={onClose} style={{ fontSize: 18, color: 'var(--t3)', cursor: 'pointer' }}>×</span>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
            "<b style={{ color: 'var(--t1)' }}>{itemDescription}</b>"을(를) 다른 프로젝트로 이동합니다.
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 4 }}>대상 프로젝트</div>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--t1)', fontSize: 14 }}
          >
            <option value="">프로젝트를 선택하세요</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
          </select>
          {collections.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>이동 가능한 다른 프로젝트가 없습니다.</div>
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>취소</button>
          <button onClick={handleMove} disabled={!targetId || moving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: targetId ? 'var(--blue)' : 'var(--line)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: targetId ? 'pointer' : 'default', opacity: moving ? 0.5 : 1 }}>
            {moving ? '이동 중...' : '이동'}
          </button>
        </div>
      </div>
    </div>
  )
}
