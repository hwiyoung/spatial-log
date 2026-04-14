/**
 * Detail — Item 상세 조회 전체 페이지
 *
 * 히어로 헤더 + 4탭 (메타데이터, 파일, 연관관계, 시계열) + 편집 모드
 *
 * 참조: docs/system_structure_design.md 페이지 2-B
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { itemApi, collectionApi, searchApi } from '../services/api'
import { getCategoryInfo, formatSize } from '../constants'
import LocationPicker from '../components/LocationPicker'

export default function Detail() {
  const { collectionId, itemId } = useParams()
  const navigate = useNavigate()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('meta')
  const [related, setRelated] = useState([])
  const [timeline, setTimeline] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  useEffect(() => {
    loadItem()
  }, [collectionId, itemId])

  async function loadItem() {
    setLoading(true)
    try {
      const res = await itemApi.get(collectionId, itemId)
      setItem(res.data)

      // 관련 데이터 + 타임라인 병렬 로드
      const [relRes, tlRes] = await Promise.allSettled([
        itemApi.getRelated(`${collectionId}/${itemId}`),
        itemApi.getTimeline(`${collectionId}/${itemId}`),
      ])
      if (relRes.status === 'fulfilled') setRelated(relRes.value.data?.related || [])
      if (tlRes.status === 'fulfilled') setTimeline(tlRes.value.data?.timeline || [])
    } catch (err) {
      console.error('Item 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />
  if (!item) return <NotFound onBack={() => navigate('/')} />

  const props = item.properties || {}
  const cat = getCategoryInfo(props.data_category)
  const assets = item.assets || {}

  const tabs = [
    { id: 'meta', label: '📋 메타데이터' },
    { id: 'files', label: `📁 파일 (${Object.keys(assets).length})` },
    { id: 'relations', label: `🔗 연관관계 (${related.length})` },
    { id: 'timeline', label: '⏱ 시계열' },
  ]

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px' }}>
        {/* 뒤로가기 */}
        <div
          onClick={() => navigate('/')}
          style={{ fontSize: 14, color: 'var(--ac)', cursor: 'pointer', marginBottom: 16 }}
        >
          ← Explorer로 돌아가기
        </div>

        {/* 히어로 헤더 */}
        <div style={{
          display: 'flex', gap: 20, marginBottom: 20,
          padding: 20, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--bd)',
        }}>
          {/* 썸네일 */}
          {assets.thumbnail?.href ? (
            <img
              src={assets.thumbnail.href}
              alt={props.description || itemId}
              style={{
                width: 160, height: 120, borderRadius: 8, objectFit: 'cover',
                flexShrink: 0, background: 'var(--s2)', border: '1px solid var(--bd)',
              }}
            />
          ) : (
            <div style={{
              width: 160, height: 120, borderRadius: 8, background: 'var(--s2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48, color: cat.color, opacity: 0.3, flexShrink: 0,
            }}>
              {cat.icon}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span style={{
              padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
              background: cat.color + '12', color: cat.color, marginBottom: 8, display: 'inline-block',
            }}>
              {cat.icon} {cat.label}
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>
              {props.description || itemId}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {props['project:site'] && <Tag label={`📍 ${props['project:site']}${props.target ? ' · ' + props.target : ''}`} />}
              {props.datetime && <Tag label={`📅 ${props.datetime.slice(0, 10)}`} />}
              {props['proj:epsg'] && <Tag label={`📐 EPSG:${props['proj:epsg']}`} />}
              <Tag
                label={props['sams:status'] === 'published' ? '✅ Published' : '⚠ Draft'}
                color={props['sams:status'] === 'published' ? 'var(--ok)' : 'var(--warn)'}
              />
            </div>
          </div>
        </div>

        {/* 편집 모드 배너 */}
        {editMode && (
          <div style={{
            padding: '10px 16px', background: 'rgba(240,180,42,0.06)', border: '1px solid rgba(240,180,42,0.15)',
            borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--warn)' }}>📝 편집 모드 — 변경 후 저장을 눌러주세요</span>
            <div>
              <Btn label="취소" onClick={() => { setEditMode(false); setEditDraft({}) }} />
              <Btn label={saving ? '저장 중...' : '저장'} primary onClick={async () => {
                if (Object.keys(editDraft).length === 0) { setEditMode(false); return }
                setSaving(true)
                try {
                  await itemApi.updateProperties(collectionId, itemId, editDraft)
                  setEditMode(false)
                  setEditDraft({})
                  loadItem()
                } catch (err) {
                  alert('저장 실패: ' + (err.response?.data?.detail || err.message))
                } finally {
                  setSaving(false)
                }
              }} />
            </div>
          </div>
        )}

        {/* 탭 */}
        <div style={{
          display: 'flex', gap: 2, borderBottom: '1px solid var(--bd)', marginBottom: 16,
        }}>
          {tabs.map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                color: tab === t.id ? 'var(--ac)' : 'var(--t3)',
                borderBottom: tab === t.id ? '2px solid var(--ac)' : '2px solid transparent',
              }}
            >
              {t.label}
            </div>
          ))}
          {!editMode && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <div
                onClick={() => { setEditMode(true); setEditDraft({}) }}
                style={{
                  padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  color: 'var(--t3)',
                }}
              >
                ✏️ 편집
              </div>
              <div
                onClick={() => setShowLocationPicker(true)}
                style={{
                  padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  color: 'var(--t3)',
                }}
              >
                📍 위치
              </div>
              <div
                onClick={() => setShowMoveModal(true)}
                style={{
                  padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  color: 'var(--t3)',
                }}
              >
                📦 이동
              </div>
              <div
                onClick={async () => {
                  if (!confirm(`"${props.description || itemId}" 아이템을 삭제하시겠습니까?\nS3 파일도 함께 삭제됩니다.`)) return
                  try {
                    await itemApi.delete(`${collectionId}/${itemId}`)
                    alert('삭제 완료')
                    navigate('/')
                  } catch (err) {
                    alert('삭제 실패: ' + (err.response?.data?.detail || err.message))
                  }
                }}
                style={{
                  padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  color: 'var(--err, #e55)',
                }}
              >
                🗑 삭제
              </div>
            </div>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'meta' && <MetaTab props={props} item={item} editMode={editMode} editDraft={editDraft} onEditChange={setEditDraft} />}
        {tab === 'files' && <FilesTab assets={assets} />}
        {tab === 'relations' && <RelationsTab related={related} collectionId={collectionId} itemId={itemId} onRefresh={loadItem} />}
        {tab === 'timeline' && <TimelineTab timeline={timeline} currentId={itemId} collectionId={collectionId} />}
      </div>

      {/* 프로젝트 이동 모달 */}
      {showMoveModal && (
        <MoveModal
          currentCollectionId={collectionId}
          itemId={itemId}
          itemDescription={props.description || itemId}
          onClose={() => setShowMoveModal(false)}
          onMoved={(targetId) => navigate(`/detail/${targetId}/${itemId}`)}
        />
      )}

      {/* 위치 지정 모달 */}
      {showLocationPicker && (
        <LocationPicker
          initialLocation={
            item.bbox && item.bbox.length >= 4
              ? [(item.bbox[0] + item.bbox[2]) / 2, (item.bbox[1] + item.bbox[3]) / 2]
              : null
          }
          onConfirm={async (loc) => {
            try {
              await itemApi.updateLocation(collectionId, itemId, loc[0], loc[1])
              setShowLocationPicker(false)
              loadItem()
            } catch (err) {
              alert('위치 갱신 실패: ' + (err.response?.data?.detail || err.message))
            }
          }}
          onCancel={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 탭 콘텐츠
// ─────────────────────────────────────────────────────────────────────────

// 편집 가능한 필드 (나머지는 읽기 전용)
const EDITABLE_FIELDS = new Set([
  'description', 'project:name', 'project:site', 'target',
  'datetime', 'data_category', 'proj:epsg', 'gsd',
  'sams:status',
])
// 읽기 전용 필드 (시스템 자동 생성)
const READONLY_FIELDS = new Set(['created', 'updated', 'file:size', 'bbox'])

function MetaTab({ props, item, editMode, editDraft, onEditChange }) {
  const groups = [
    { title: '기본 정보', keys: ['project:name', 'project:site', 'target', 'description', 'datetime', 'data_category'] },
    { title: '공간 정보', keys: ['proj:epsg', 'bbox', 'gsd'] },
    { title: '유형별 속성', keys: Object.keys(props).filter(k => k.includes(':') && !k.startsWith('project:') && !k.startsWith('proj:') && !k.startsWith('sams:') && k !== 'datetime') },
    { title: '시스템', keys: ['sams:status', 'created', 'updated', 'file:size'] },
  ]

  const handleFieldChange = (key, value) => {
    onEditChange({ ...editDraft, [key]: value })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {groups.map(group => (
        <div key={group.title} style={{
          padding: 16, background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--bd)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--ac)', fontWeight: 600, marginBottom: 10 }}>
            {group.title}
          </div>
          {group.keys.map(key => {
            let val = key === 'bbox' ? JSON.stringify(item.bbox) : props[key]
            if (key === 'file:size') val = formatSize(val)
            const displayVal = val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val))
            const isEditable = editMode && EDITABLE_FIELDS.has(key) && !READONLY_FIELDS.has(key)
            const draftVal = editDraft[key]

            // 편집 모드에서 빈 필드도 표시 (입력할 수 있게)
            if (!editMode && val == null) return null

            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, gap: 8 }}>
                <span style={{ color: 'var(--t3)', flexShrink: 0 }}>{key}</span>
                {isEditable ? (
                  <input
                    value={draftVal !== undefined ? draftVal : displayVal}
                    onChange={e => handleFieldChange(key, e.target.value)}
                    placeholder={displayVal || '입력하세요'}
                    style={{
                      flex: 1, maxWidth: '60%', textAlign: 'right',
                      padding: '2px 6px', borderRadius: 4,
                      border: '1px solid var(--ac)', background: 'var(--s2)',
                      color: 'var(--t1)', fontSize: 12, fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <span style={{ color: val == null ? 'var(--t3)' : 'var(--t1)', fontFamily: 'monospace', fontSize: 12, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
                    {displayVal || '—'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function FilesTab({ assets }) {
  const entries = Object.entries(assets)
  if (entries.length === 0) return <Empty msg="등록된 파일이 없습니다." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, asset]) => (
        <div key={key} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--bd)',
        }}>
          <div style={{ fontSize: 20 }}>📄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{asset.title || key}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              {asset.type || 'unknown'} · {(asset.roles || []).join(', ')}
            </div>
          </div>
          <a href={asset.href} style={{
            padding: '4px 12px', borderRadius: 4, fontSize: 12,
            background: 'var(--ac)', color: '#fff', textDecoration: 'none',
          }}>
            다운로드
          </a>
        </div>
      ))}
    </div>
  )
}

function RelationsTab({ related, collectionId, itemId, onRefresh }) {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [rel, setRel] = useState('related')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [adding, setAdding] = useState(false)

  const relColors = {
    derived_from: '#E87830', has_derived: '#E87830',
    related: '#35A5E0', describedby: '#8899AA', describes: '#8899AA',
    prev: '#9055C8', next: '#9055C8',
  }
  const relLabels = {
    derived_from: '원본 데이터',
    has_derived: '파생 데이터',
    related: '관련 데이터',
    describedby: '설명 문서',
    describes: '설명 대상',
    prev: '이전 시점 데이터',
    next: '이후 시점 데이터',
  }

  // 검색 (같은 Collection 내 Item, 자기 자신 제외)
  useEffect(() => {
    if (!showAdd) return
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.search({ collections: [collectionId], limit: 100 })
        let items = (res.data?.features || []).filter(f => f.id !== itemId)
        // 클라이언트 사이드 필터링 (STAC q 파라미터가 미지원일 수 있음)
        const q = searchQuery.trim().toLowerCase()
        if (q) {
          items = items.filter(f => {
            const p = f.properties || {}
            return (p.description || '').toLowerCase().includes(q)
              || (p.target || '').toLowerCase().includes(q)
              || (p['project:site'] || '').toLowerCase().includes(q)
              || (p.data_category || '').toLowerCase().includes(q)
              || f.id.toLowerCase().includes(q)
          })
        }
        setSearchResults(items)
      } catch (err) {
        console.error('Item 검색 실패:', err)
        setSearchResults([])
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, showAdd, collectionId, itemId])

  async function handleAddLink() {
    if (!selectedTarget) return
    setAdding(true)
    try {
      await itemApi.addLink(`${collectionId}/${itemId}`, {
        rel,
        target_collection_id: collectionId,
        target_item_id: selectedTarget.id,
      })
      setShowAdd(false)
      setSelectedTarget(null)
      setSearchQuery('')
      if (onRefresh) onRefresh()
    } catch (err) {
      alert('관계 추가 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteLink(index) {
    if (!confirm('이 관계를 삭제하시겠습니까? (양방향 자동 삭제)')) return
    try {
      await itemApi.removeLink(`${collectionId}/${itemId}`, index)
      if (onRefresh) onRefresh()
    } catch (err) {
      alert('관계 삭제 실패: ' + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div>
      {/* 관계 추가 */}
      <div style={{ marginBottom: 12 }}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--bd)',
            background: 'transparent', color: 'var(--ac)', fontSize: 13, cursor: 'pointer',
          }}>
            + 관계 추가
          </button>
        ) : (
          <div style={{
            padding: 14, background: 'var(--s1)', borderRadius: 8, border: '1px solid var(--ac)',
          }}>
            {/* 관계 유형 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 3 }}>관계 유형</div>
                <select
                  value={rel}
                  onChange={e => setRel(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 4, border: '1px solid var(--bd)',
                    background: 'var(--s2)', color: 'var(--t1)', fontSize: 13,
                  }}
                >
                  <option value="related">관련 데이터</option>
                  <option value="derived_from">선택 항목은 현재 아이템의 원본</option>
                  <option value="describedby">선택 항목은 현재 아이템의 설명 문서</option>
                  <option value="prev">선택 항목은 현재보다 이전 시점</option>
                  <option value="next">선택 항목은 현재보다 이후 시점</option>
                </select>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <button onClick={handleAddLink} disabled={adding || !selectedTarget} style={{
                  padding: '6px 14px', borderRadius: 4, border: 'none',
                  background: selectedTarget ? 'var(--ac)' : 'var(--bd)',
                  color: '#fff', fontSize: 13, cursor: selectedTarget ? 'pointer' : 'default',
                }}>{adding ? '추가 중...' : '추가'}</button>
                <button onClick={() => { setShowAdd(false); setSelectedTarget(null); setSearchQuery('') }} style={{
                  padding: '6px 14px', borderRadius: 4, border: '1px solid var(--bd)',
                  background: 'transparent', color: 'var(--t3)', fontSize: 13, cursor: 'pointer',
                }}>취소</button>
              </div>
            </div>

            {/* 선택된 대상 표시 */}
            {selectedTarget && (
              <div style={{
                padding: '8px 12px', background: 'rgba(74,114,255,0.06)', border: '1px solid var(--ac)',
                borderRadius: 6, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 13, color: 'var(--ac)' }}>
                  {getCategoryInfo(selectedTarget.properties?.data_category).icon}
                </span>
                <span style={{ fontSize: 13, color: 'var(--t1)', flex: 1 }}>
                  {selectedTarget.properties?.description || selectedTarget.id}
                </span>
                <span onClick={() => setSelectedTarget(null)} style={{ color: 'var(--t3)', cursor: 'pointer', fontSize: 12 }}>✕</span>
              </div>
            )}

            {/* Item 검색 */}
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 3 }}>대상 Item 검색</div>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="키워드로 검색... (비워두면 전체 표시)"
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--bd)',
                background: 'var(--s2)', color: 'var(--t1)', fontSize: 13, outline: 'none',
                marginBottom: 6,
              }}
            />
            <div style={{
              maxHeight: 200, overflow: 'auto', borderRadius: 6,
              border: '1px solid var(--bd)', background: 'var(--s2)',
            }}>
              {searchResults.map(item => {
                const p = item.properties || {}
                const cat = getCategoryInfo(p.data_category)
                const isSelected = selectedTarget?.id === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedTarget(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', cursor: 'pointer',
                      background: isSelected ? 'rgba(74,114,255,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--bd)',
                    }}
                  >
                    <span style={{ fontSize: 13, color: cat.color }}>{cat.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--t1)', flex: 1 }}>{p.description || item.id}</span>
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>{cat.label}</span>
                  </div>
                )
              })}
              {searchResults.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  검색 결과 없음
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 관계 목록 */}
      {related.length === 0 ? (
        <Empty msg="연관 데이터가 없습니다. 위에서 관계를 추가할 수 있습니다." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {related.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: 'var(--s1)', borderRadius: 8,
                border: '1px solid var(--bd)',
              }}
            >
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                background: (relColors[r.rel] || 'var(--t3)') + '18',
                color: relColors[r.rel] || 'var(--t3)',
                whiteSpace: 'nowrap',
              }}>
                {relLabels[r.rel] || r.rel}
              </span>
              {r.data_category && (
                <span style={{ fontSize: 13, color: getCategoryInfo(r.data_category).color }}>
                  {getCategoryInfo(r.data_category).icon}
                </span>
              )}
              <span
                onClick={() => navigate(`/detail/${r.target_collection_id || collectionId}/${r.target_id}`)}
                style={{ fontSize: 14, color: 'var(--ac)', cursor: 'pointer', flex: 1, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
              >
                {r.description || r.title || r.target_id}
              </span>
              <span
                onClick={() => handleDeleteLink(i)}
                style={{ fontSize: 12, color: 'var(--err)', cursor: 'pointer' }}
                title="관계 삭제"
              >
                ✕
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineTab({ timeline, currentId, collectionId }) {
  const navigate = useNavigate()
  if (timeline.length === 0) return <Empty msg="시계열 데이터가 없습니다. 연관관계에서 prev/next를 추가하거나, target 필드를 설정하세요." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {timeline.map((t, i) => (
        <div
          key={i}
          onClick={() => !t.is_current && navigate(`/detail/${t.collection_id || collectionId}/${t.item_id}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', background: t.is_current ? 'rgba(74,114,255,0.06)' : 'var(--s1)',
            borderRadius: 8, border: `1px solid ${t.is_current ? 'var(--ac)' : 'var(--bd)'}`,
            cursor: t.is_current ? 'default' : 'pointer',
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: t.is_current ? 'var(--ac)' : 'var(--bd)',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--t1)', fontWeight: t.is_current ? 600 : 400 }}>
              {t.description || t.item_id}
              {t.is_current && <span style={{ fontSize: 12, color: 'var(--ac)', marginLeft: 6 }}>← 현재</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              {t.datetime?.slice(0, 10) || '날짜 없음'} · {t.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 공통 컴포넌트
// ─────────────────────────────────────────────────────────────────────────

function Tag({ label, color }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 12,
      background: color ? color + '10' : 'var(--s2)',
      color: color || 'var(--t2)',
      border: `1px solid ${color ? color + '30' : 'var(--bd)'}`,
    }}>
      {label}
    </span>
  )
}

function Btn({ label, primary, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 12,
      cursor: 'pointer', marginLeft: 4,
      background: primary ? 'var(--ac)' : 'var(--s2)',
      color: primary ? '#fff' : 'var(--t2)',
    }}>
      {label}
    </button>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t3)', fontSize: 14 }}>
      불러오는 중...
    </div>
  )
}

function NotFound({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
      <div style={{ fontSize: 16, color: 'var(--t3)' }}>Item을 찾을 수 없습니다.</div>
      <div onClick={onBack} style={{ fontSize: 14, color: 'var(--ac)', cursor: 'pointer' }}>← Explorer로 돌아가기</div>
    </div>
  )
}

function _extractCollectionFromHref(href, fallbackCollection) {
  // "../../{collection}/items/{item_id}" → collection
  // "./{item_id}" → fallbackCollection (같은 Collection)
  if (href.startsWith('./')) return fallbackCollection
  const parts = href.split('/')
  const itemsIdx = parts.indexOf('items')
  if (itemsIdx > 0) return parts[itemsIdx - 1]
  return fallbackCollection
}

function Empty({ msg }) {
  return <div style={{ padding: 30, textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>{msg}</div>
}

function MoveModal({ currentCollectionId, itemId, itemDescription, onClose, onMoved }) {
  const [collections, setCollections] = useState([])
  const [targetId, setTargetId] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    collectionApi.list()
      .then(res => {
        const cols = (res.data?.collections || []).filter(c => c.id !== currentCollectionId)
        setCollections(cols)
      })
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 440, background: 'var(--s1)', borderRadius: 12,
        border: '1px solid var(--bd)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>프로젝트 이동</span>
          <span onClick={onClose} style={{ fontSize: 16, color: 'var(--t3)', cursor: 'pointer' }}>✕</span>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
            "<b style={{ color: 'var(--t1)' }}>{itemDescription}</b>"을(를) 다른 프로젝트로 이동합니다.
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 4 }}>대상 프로젝트</div>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid var(--bd)', background: 'var(--s2)',
              color: 'var(--t1)', fontSize: 14,
            }}
          >
            <option value="">프로젝트를 선택하세요</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.title || c.id}</option>
            ))}
          </select>
          {collections.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
              이동 가능한 다른 프로젝트가 없습니다.
            </div>
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '7px 16px', borderRadius: 6, border: '1px solid var(--bd)',
            background: 'transparent', color: 'var(--t2)', fontSize: 13, cursor: 'pointer',
          }}>취소</button>
          <button onClick={handleMove} disabled={!targetId || moving} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none',
            background: targetId ? 'var(--ac)' : 'var(--bd)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: targetId ? 'pointer' : 'default',
            opacity: moving ? 0.5 : 1,
          }}>{moving ? '이동 중...' : '이동'}</button>
        </div>
      </div>
    </div>
  )
}
