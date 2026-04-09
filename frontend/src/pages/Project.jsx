/**
 * Project — Collection(프로젝트) 관리 페이지
 *
 * 왼쪽: Collection 목록 + 새 프로젝트 버튼
 * 오른쪽: 프로젝트 헤더 + 4탭 (현황, 공간, Draft, 전체)
 *
 * 참조: docs/system_structure_design.md 페이지 3
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collectionApi } from '../services/api'
import { getCategoryInfo, formatSize } from '../constants'

export default function Project() {
  const navigate = useNavigate()
  const [collections, setCollections] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [tab, setTab] = useState('status')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadCollections() }, [])

  useEffect(() => {
    if (selectedId) loadDashboard(selectedId)
  }, [selectedId])

  async function loadCollections() {
    setLoading(true)
    try {
      const res = await collectionApi.list()
      const cols = res.data?.collections || []
      setCollections(cols)
      if (cols.length > 0 && !selectedId) setSelectedId(cols[0].id)
    } catch (err) {
      console.error('Collection 목록 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadDashboard(id) {
    try {
      const res = await collectionApi.dashboard(id)
      setDashboard(res.data)
    } catch (err) {
      console.error('Dashboard 로드 실패:', err)
      setDashboard(null)
    }
  }

  const selectedCol = collections.find(c => c.id === selectedId)
  const summaries = selectedCol?.summaries || {}

  const tabs = [
    { id: 'status', label: '📊 현황' },
    { id: 'spatial', label: '🗺 공간' },
    { id: 'draft', label: `⚠ Draft (${dashboard?.draft_count || 0})` },
    { id: 'all', label: `📋 전체 (${dashboard?.total_items || 0})` },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 왼쪽: Collection 목록 */}
      <div style={{
        width: 220, minWidth: 220, background: 'var(--s1)',
        borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)', fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>
          프로젝트 목록
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {collections.map(col => {
            const s = col.summaries || {}
            const isActive = col.id === selectedId
            return (
              <div
                key={col.id}
                onClick={() => setSelectedId(col.id)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  background: isActive ? 'rgba(74,114,255,0.06)' : 'transparent',
                  borderBottom: '1px solid var(--bd)',
                  borderLeft: isActive ? '3px solid var(--ac)' : '3px solid transparent',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--ac)' : 'var(--t1)' }}>
                  {col.title || col.id}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                  {s['project:site'] || ''} · {s['sams:status'] || 'active'}
                </div>
              </div>
            )
          })}
          {collections.length === 0 && !loading && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
              프로젝트가 없습니다.
            </div>
          )}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--bd)' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 6, border: '1px dashed var(--bd)',
              background: 'transparent', color: 'var(--t2)', fontSize: 11, cursor: 'pointer',
            }}
          >
            + 새 프로젝트
          </button>
        </div>
      </div>

      {/* 오른쪽: 상세 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {!selectedCol ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t3)', fontSize: 12 }}>
            왼쪽에서 프로젝트를 선택하세요.
          </div>
        ) : (
          <>
            {/* 프로젝트 헤더 */}
            <div style={{
              padding: 16, background: 'var(--s1)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: 16,
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>
                {selectedCol.title || selectedCol.id}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {summaries['project:client'] && <span>🏢 {summaries['project:client']}</span>}
                {summaries['project:site'] && <span>📍 {summaries['project:site']}</span>}
                {summaries['project:manager'] && <span>👤 {summaries['project:manager']}</span>}
                {summaries['project:default_epsg'] && <span>📐 EPSG:{summaries['project:default_epsg']}</span>}
                <span style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                  background: summaries['sams:status'] === 'active' ? 'rgba(61,214,140,0.1)' : 'rgba(92,100,120,0.1)',
                  color: summaries['sams:status'] === 'active' ? 'var(--ok)' : 'var(--t3)',
                }}>
                  {summaries['sams:status'] || 'active'}
                </span>
              </div>
              {/* 진행률 */}
              {dashboard && (
                <div style={{ marginTop: 10 }}>
                  <ProgressBar total={dashboard.total_items} label={`등록: ${dashboard.total_items}건`} />
                </div>
              )}
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--bd)', marginBottom: 16 }}>
              {tabs.map(t => (
                <div
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '8px 16px', fontSize: 12, cursor: 'pointer',
                    color: tab === t.id ? 'var(--ac)' : 'var(--t3)',
                    borderBottom: tab === t.id ? '2px solid var(--ac)' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            {tab === 'status' && <StatusTab dashboard={dashboard} />}
            {tab === 'spatial' && <SpatialTab collectionId={selectedId} />}
            {tab === 'draft' && <DraftTab dashboard={dashboard} collectionId={selectedId} />}
            {tab === 'all' && <AllItemsTab dashboard={dashboard} collectionId={selectedId} />}
          </>
        )}
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadCollections() }}
        />
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 탭: 현황
// ─────────────────────────────────────────────────────────────────────────

function StatusTab({ dashboard }) {
  if (!dashboard) return <Empty msg="로딩 중..." />

  const { expected_vs_actual = [], type_counts = {} } = dashboard

  return (
    <div>
      {/* 예상 vs 실제 테이블 */}
      {expected_vs_actual.length > 0 && (
        <div style={{
          padding: 16, background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: 'var(--ac)', fontWeight: 600, marginBottom: 10 }}>예상 vs 실제</div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--t3)', borderBottom: '1px solid var(--bd)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>유형</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}>예상</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}>등록</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}>상태</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>설명</th>
              </tr>
            </thead>
            <tbody>
              {expected_vs_actual.map((row, i) => {
                const cat = getCategoryInfo(row.category)
                const ok = row.actual >= row.expected
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bd)' }}>
                    <td style={{ padding: '6px 8px', color: cat.color }}>{cat.icon} {cat.label}</td>
                    <td style={{ textAlign: 'center', color: 'var(--t2)' }}>{row.expected}</td>
                    <td style={{ textAlign: 'center', color: 'var(--t1)', fontWeight: 600 }}>{row.actual}</td>
                    <td style={{ textAlign: 'center' }}>{ok ? '✅' : '⚠'}</td>
                    <td style={{ color: 'var(--t3)' }}>{row.description}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 유형별 등록 현황 */}
      <div style={{
        padding: 16, background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--bd)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--ac)', fontWeight: 600, marginBottom: 10 }}>유형별 등록 현황</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(type_counts).map(([cat, count]) => {
            const info = getCategoryInfo(cat)
            return (
              <div key={cat} style={{
                padding: '8px 14px', borderRadius: 6, background: info.color + '08',
                border: `1px solid ${info.color}20`, minWidth: 100,
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: info.color }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{info.icon} {info.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 탭: 공간
// ─────────────────────────────────────────────────────────────────────────

function SpatialTab({ collectionId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    collectionApi.spatialSummary(collectionId)
      .then(res => setData(res.data))
      .catch(() => setData(null))
  }, [collectionId])

  if (!data) return <Empty msg="로딩 중..." />

  const categories = data.categories || {}
  if (Object.keys(categories).length === 0) return <Empty msg="공간 정보가 있는 Item이 없습니다." />

  return (
    <div>
      {Object.entries(categories).map(([cat, items]) => {
        const info = getCategoryInfo(cat)
        return (
          <div key={cat} style={{
            padding: 14, background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, color: info.color, fontWeight: 600, marginBottom: 8 }}>{info.icon} {info.label} ({items.length})</div>
            {items.map((item, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--t2)', padding: '2px 0', fontFamily: 'monospace' }}>
                {item.item_id} — bbox: [{item.bbox.map(v => v.toFixed(3)).join(', ')}]
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 탭: Draft
// ─────────────────────────────────────────────────────────────────────────

function DraftTab({ dashboard, collectionId }) {
  const navigate = useNavigate()
  if (!dashboard) return <Empty msg="로딩 중..." />

  const drafts = dashboard.draft_items || []
  if (drafts.length === 0) return <Empty msg="Draft 상태인 Item이 없습니다." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {drafts.map(item => {
        const cat = getCategoryInfo(item.data_category)
        return (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--bd)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, background: cat.color + '12', color: cat.color,
            }}>
              {cat.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--t1)' }}>{item.description || item.id}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>{cat.label}</div>
            </div>
            <button
              onClick={() => navigate(`/detail/${collectionId}/${item.id}`)}
              style={{
                padding: '4px 10px', borderRadius: 4, border: '1px solid var(--warn)',
                background: 'transparent', color: 'var(--warn)', fontSize: 10, cursor: 'pointer',
              }}
            >
              편집하여 완성 →
            </button>
          </div>
        )
      })}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 탭: 전체
// ─────────────────────────────────────────────────────────────────────────

function AllItemsTab({ dashboard, collectionId }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])

  useEffect(() => {
    import('../services/api').then(({ searchApi }) => {
      searchApi.search({ collections: [collectionId], limit: 200 })
        .then(res => setItems(res.data?.features || []))
        .catch(() => setItems([]))
    })
  }, [collectionId])

  if (items.length === 0) return <Empty msg="등록된 Item이 없습니다." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(item => {
        const props = item.properties || {}
        const cat = getCategoryInfo(props.data_category)
        return (
          <div
            key={item.id}
            onClick={() => navigate(`/detail/${collectionId}/${item.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
              background: 'var(--s1)', borderRadius: 6, border: '1px solid var(--bd)', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 12, color: cat.color }}>{cat.icon}</span>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--t1)' }}>{props.description || item.id}</span>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{props.datetime?.slice(0, 10)}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 3, fontSize: 9,
              background: props['sams:status'] === 'published' ? 'rgba(61,214,140,0.08)' : 'rgba(240,180,42,0.08)',
              color: props['sams:status'] === 'published' ? 'var(--ok)' : 'var(--warn)',
            }}>
              {props['sams:status'] || 'draft'}
            </span>
            <span style={{
              padding: '1px 6px', borderRadius: 3, fontSize: 9,
              background: cat.color + '12', color: cat.color,
            }}>
              {cat.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 생성 모달
// ─────────────────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    id: '', title: '', description: '',
    'project:site': '', 'project:client': '', 'project:manager': '',
    'project:default_epsg': 5186,
  })
  const [submitting, setSubmitting] = useState(false)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  async function handleSubmit() {
    if (!form.id || !form.title) return
    setSubmitting(true)
    try {
      await collectionApi.create(form)
      onCreated()
    } catch (err) {
      console.error('Collection 생성 실패:', err)
      alert('생성 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, padding: 24, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--bd)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 16 }}>새 프로젝트 생성</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input label="Collection ID *" value={form.id} onChange={v => update('id', v)} placeholder="bulguksa-2024" />
          <Input label="프로젝트명 *" value={form.title} onChange={v => update('title', v)} placeholder="2024 경주 불국사 정밀실측" />
          <Input label="사이트" value={form['project:site']} onChange={v => update('project:site', v)} placeholder="경주 불국사" />
          <Input label="발주처" value={form['project:client']} onChange={v => update('project:client', v)} />
          <Input label="PM" value={form['project:manager']} onChange={v => update('project:manager', v)} />
          <Input label="기본 EPSG" value={form['project:default_epsg']} onChange={v => update('project:default_epsg', Number(v))} type="number" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid var(--bd)',
            background: 'transparent', color: 'var(--t2)', fontSize: 12, cursor: 'pointer',
          }}>취소</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: 'var(--ac)', color: '#fff', fontSize: 12, cursor: 'pointer',
            opacity: submitting ? 0.5 : 1,
          }}>{submitting ? '생성 중...' : '생성'}</button>
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────────────────────────

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--bd)',
          background: 'var(--s2)', color: 'var(--t1)', fontSize: 12, outline: 'none',
        }}
      />
    </div>
  )
}

function ProgressBar({ total, label }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--t2)', marginBottom: 4 }}>{label}</div>
      <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, total * 10)}%`, background: 'var(--ac)', borderRadius: 3 }} />
      </div>
    </div>
  )
}

function Empty({ msg }) {
  return <div style={{ padding: 30, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>{msg}</div>
}
