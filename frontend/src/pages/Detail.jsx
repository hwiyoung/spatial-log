/**
 * Detail — Item 상세 조회 전체 페이지
 *
 * 히어로 헤더 + 4탭 (메타데이터, 파일, 연관관계, 시계열) + 편집 모드
 *
 * 참조: docs/system_structure_design.md 페이지 2-B
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { itemApi, searchApi } from '../services/api'
import { getCategoryInfo, formatSize } from '../constants'

export default function Detail() {
  const { collectionId, itemId } = useParams()
  const navigate = useNavigate()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('meta')
  const [related, setRelated] = useState([])
  const [timeline, setTimeline] = useState([])
  const [editMode, setEditMode] = useState(false)

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
          <div style={{
            width: 160, height: 120, borderRadius: 8, background: 'var(--s2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 48, color: cat.color, opacity: 0.3, flexShrink: 0,
          }}>
            {cat.icon}
          </div>
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
            <span style={{ fontSize: 13, color: 'var(--warn)' }}>📝 편집 모드</span>
            <div>
              <Btn label="취소" onClick={() => setEditMode(false)} />
              <Btn label="저장" primary onClick={() => setEditMode(false)} />
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
            <div
              onClick={() => setEditMode(true)}
              style={{
                padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                color: 'var(--t3)', marginLeft: 'auto',
              }}
            >
              ✏️ 편집
            </div>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'meta' && <MetaTab props={props} item={item} />}
        {tab === 'files' && <FilesTab assets={assets} />}
        {tab === 'relations' && <RelationsTab related={related} collectionId={collectionId} itemId={itemId} onRefresh={loadItem} />}
        {tab === 'timeline' && <TimelineTab timeline={timeline} currentId={itemId} collectionId={collectionId} />}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 탭 콘텐츠
// ─────────────────────────────────────────────────────────────────────────

function MetaTab({ props, item }) {
  // 메타데이터를 4개 그룹으로 분류
  const groups = [
    { title: '기본 정보', keys: ['project:name', 'project:site', 'target', 'description', 'datetime', 'data_category'] },
    { title: '공간 정보', keys: ['proj:epsg', 'bbox', 'gsd'] },
    { title: '유형별 속성', keys: Object.keys(props).filter(k => k.includes(':') && !k.startsWith('project:') && !k.startsWith('proj:') && !k.startsWith('sams:') && k !== 'datetime') },
    { title: '시스템', keys: ['sams:status', 'created', 'updated', 'file:size'] },
  ]

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
            if (val == null) return null
            if (typeof val === 'object') val = JSON.stringify(val)
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--t3)' }}>{key}</span>
                <span style={{ color: 'var(--t1)', fontFamily: 'monospace', fontSize: 12, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
                  {String(val)}
                </span>
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
                  <option value="related">related (관련)</option>
                  <option value="derived_from">derived_from (파생 원본)</option>
                  <option value="describedby">describedby (설명 문서)</option>
                  <option value="prev">prev (이전 시점)</option>
                  <option value="next">next (다음 시점)</option>
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
              }}>
                {r.rel}
              </span>
              <span
                onClick={() => navigate(`/detail/${collectionId}/${r.target_id}`)}
                style={{ fontSize: 14, color: 'var(--t1)', cursor: 'pointer', flex: 1 }}
              >
                {r.title || r.target_id}
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
  if (timeline.length === 0) return <Empty msg="시계열 데이터가 없습니다. (target 필드가 설정되지 않았을 수 있습니다)" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {timeline.map((t, i) => (
        <div
          key={i}
          onClick={() => !t.is_current && navigate(`/detail/${collectionId}/${t.item_id}`)}
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

function Empty({ msg }) {
  return <div style={{ padding: 30, textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>{msg}</div>
}
