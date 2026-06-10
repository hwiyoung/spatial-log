/**
 * Detail — Item 상세 전체 페이지 (route: /detail/:collectionId/:itemId)
 *
 * 단일 스크롤 섹션 레이아웃: Header · Assets · 전체 Metadata · Spatial · Relations · Timeline.
 * 자동추출↔수동입력 provenance, 상태색 미니맵, 관계 그래프 + authoring 을 한 화면에서 판단한다.
 * 편집(메타데이터)·위치 지정·프로젝트 이동·삭제·관계 추가/삭제 기능을 모두 유지한다.
 *
 * 참조: design-reference/project/Detail.html (+ detail/build·minimap·relations.jsx)
 *      docs/system_structure_design.md 페이지 2-B
 * 주의: 데모 전용(예시-상태 switcher · 중복 top nav · 합성 History)은 프로덕션에서 제외했다.
 *      mock 데모(?mock=1) 에서는 읽기 + 관계 로컬-authoring 데모만 지원한다(영속 편집/이동/삭제 비활성).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { itemApi, collectionApi, searchApi } from '../services/api'
import { isMockExplorerMode, mockExplorerDataSource } from '../mocks/mockExplorerDataSource'
import { mockItems } from '../mocks/fixtures/mockItems.js'
import { getMockRelationsForItem } from '../mocks/fixtures/mockRelations.js'
import { getDisplayLabel, getOriginalFilename } from '../features/items/getDisplayLabel.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getExplorerItemView } from '../features/explorer/getExplorerItemView.js'
import { buildDetailMetadata } from '../features/detail/buildDetailMetadata.js'
import { normalizeRelations } from '../features/detail/normalizeRelations.js'
import { buildMockTimeline } from '../features/detail/buildMockTimeline.js'
import { DetailHeader, AssetsSection } from '../components/detail/DetailHero'
import { MetadataSection, SpatialSection } from '../components/detail/MetadataSection'
import RelationsSection from '../components/detail/RelationsSection'
import TimelineSection from '../components/detail/TimelineSection'
import HistorySection from '../components/detail/HistorySection'
import MoveModal from '../components/detail/MoveModal'
import LocationPicker from '../components/LocationPicker'
import '../styles/detail.css'

// 다운로드 대상(data) 자산 찾기 — ViewerShell 과 동일 규칙
function findDataAsset(assets) {
  const values = Object.values(assets || {})
  return values.find(a => (a?.roles || []).includes('data'))
    || values.find(a => !(a?.roles || []).includes('thumbnail'))
    || null
}

// 백엔드 add_link 의 양방향 규칙과 동일한 역방향 rel 매핑
const REVERSE_REL = {
  derived_from: 'has_derived', has_derived: 'derived_from',
  related: 'related', describedby: 'describes', describes: 'describedby',
  prev: 'next', next: 'prev',
}

// mock 관계를 related(API) 형태로 환원 — 실 백엔드처럼 양방향(소유 forward + 자동 reverse) 모두 포함.
// fixtures 는 한 방향만 저장할 수 있으므로, 이 Item 이 대상인 관계는 역방향 rel 로 합성해 incoming 으로 노출한다.
function mockRelatedFor(itemId) {
  const byId = new Map(mockItems.map(i => [i.id, i]))
  const rels = getMockRelationsForItem(itemId)
  const owned = new Set(rels.filter(r => r.sourceId === itemId).map(r => `${r.rel}|${r.targetId}`))
  const out = []

  for (const r of rels) {
    let rel, targetId, targetCol, title, missing
    if (r.sourceId === itemId) {                  // 이 Item 이 소유한 forward 링크
      rel = r.rel; targetId = r.targetId; targetCol = r.targetCollectionId
      title = r.title; missing = !!r.missingTarget
    } else if (r.targetId === itemId) {           // 이 Item 이 대상 — 역방향(자동 reverse) 링크 합성
      rel = REVERSE_REL[r.rel] || r.rel; targetId = r.sourceId; targetCol = r.sourceCollectionId
      const src = byId.get(r.sourceId)
      title = src ? getDisplayLabel(src) : r.sourceId; missing = !src
      if (owned.has(`${rel}|${targetId}`)) continue  // fixtures 가 이미 양방향 보유 → 중복 제거
    } else {
      continue
    }
    const t = byId.get(targetId)
    out.push({
      rel, target_id: targetId, target_collection_id: targetCol, title,
      description: t ? getDisplayLabel(t) : title,
      data_category: t ? (t.properties?.data_category || 'unknown') : 'unknown',
      status: t ? getItemStatus(t) : 'unknown',
      missing,
    })
  }
  return out
}

function toCandidate(feature) {
  return {
    id: feature.id,
    collection: feature.collection,
    name: getDisplayLabel(feature),
    cat: feature.properties?.data_category || 'unknown',
    status: getItemStatus(feature),
    file: getOriginalFilename(feature) || feature.id,
  }
}

export default function Detail() {
  const { collectionId, itemId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isMock = useMemo(() => isMockExplorerMode(), [])

  const [item, setItem] = useState(null)
  const [collections, setCollections] = useState([])
  const [relatedRaw, setRelatedRaw] = useState([])
  const [timeline, setTimeline] = useState([])
  const [historyEvents, setHistoryEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [relBusy, setRelBusy] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  const loadItem = useCallback(async () => {
    setLoading(true)
    try {
      const [itemRes, colRes] = await Promise.all([
        isMock ? mockExplorerDataSource.getItem(collectionId, itemId) : itemApi.get(collectionId, itemId),
        (isMock ? mockExplorerDataSource.listCollections() : collectionApi.list()).catch(() => ({ data: { collections: [] } })),
      ])
      setItem(itemRes.data)
      setCollections(colRes.data?.collections || [])

      if (!itemRes.data) return

      if (isMock) {
        setRelatedRaw(mockRelatedFor(itemId))
        setTimeline(buildMockTimeline(itemRes.data, mockItems))
        setHistoryEvents([])   // mock 은 영속 이력이 없다 — 데모 세션 중의 행위만 로컬로 쌓인다
      } else {
        const [relRes, tlRes, histRes] = await Promise.allSettled([
          itemApi.getRelated(`${collectionId}/${itemId}`),
          itemApi.getTimeline(`${collectionId}/${itemId}`),
          itemApi.getHistory(`${collectionId}/${itemId}`),
        ])
        setRelatedRaw(relRes.status === 'fulfilled' ? (relRes.value.data?.related || []) : [])
        setTimeline(tlRes.status === 'fulfilled' ? (tlRes.value.data?.timeline || []) : [])
        setHistoryEvents(histRes.status === 'fulfilled' ? (histRes.value.data?.history || []) : [])
      }
    } catch (err) {
      console.error('Item 로드 실패:', err)
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [collectionId, itemId, isMock])

  useEffect(() => {
    setEditMode(false)
    setEditDraft({})
    loadItem()
  }, [loadItem])

  const view = useMemo(() => (item ? getExplorerItemView(item, collections) : null), [item, collections])
  const meta = useMemo(() => (item && view ? buildDetailMetadata(item, view) : null), [item, view])
  const relations = useMemo(() => normalizeRelations(relatedRaw), [relatedRaw])

  // ── navigation ──
  const goExplorer = () => navigate({ pathname: '/', search: location.search })
  const goViewer = () => navigate({ pathname: `/viewer/${collectionId}/${itemId}`, search: location.search })
  const goFocus = (targetCol, targetId) => {
    if (!targetId) return
    navigate({ pathname: `/detail/${targetCol || collectionId}/${targetId}`, search: location.search })
  }

  // ── download ──
  const dataAsset = item ? findDataAsset(item.assets) : null
  const downloadHref = dataAsset?.href || null
  const canDownload = Boolean(downloadHref) && !downloadHref.startsWith('mock://')
  const handleDownload = () => { if (canDownload) window.open(downloadHref, '_blank', 'noopener') }

  // ── relation authoring (real API or mock local state) ──
  const searchTargets = useCallback(async (query) => {
    try {
      if (isMock) {
        const q = query.toLowerCase()
        return mockItems
          .filter(f => f.id !== itemId)
          .filter(f => !q || `${getDisplayLabel(f)} ${getOriginalFilename(f) || ''} ${f.collection}`.toLowerCase().includes(q))
          .map(toCandidate)
      }
      const res = await searchApi.search({ collections: [collectionId], limit: 100 })
      const q = query.toLowerCase()
      return (res.data?.features || [])
        .filter(f => f.id !== itemId)
        .filter(f => !q || `${getDisplayLabel(f)} ${getOriginalFilename(f) || ''} ${f.properties?.data_category || ''}`.toLowerCase().includes(q))
        .map(toCandidate)
    } catch (err) {
      console.error('대상 Item 검색 실패:', err)
      return []
    }
  }, [isMock, collectionId, itemId])

  // mock 데모 세션에서 실제로 일어난 행위만 로컬 이력으로 기록한다 (허구 이력 합성 금지)
  const pushMockEvent = useCallback((summary) => {
    setHistoryEvents(prev => [
      { event_type: 'relation', summary, actor: null, created_at: new Date().toISOString() },
      ...prev,
    ])
  }, [])

  const handleAddRelation = useCallback(async ({ targetId, targetCol, rel, title }) => {
    if (isMock) {
      const t = mockItems.find(i => i.id === targetId)
      setRelatedRaw(prev => [...prev, {
        rel, target_id: targetId, target_collection_id: targetCol, title,
        description: t ? getDisplayLabel(t) : title,
        data_category: t ? (t.properties?.data_category || 'unknown') : 'unknown',
        status: t ? getItemStatus(t) : 'unknown', missing: !t,
      }])
      pushMockEvent(`관계 추가: ${rel} → ${targetId} (데모 세션)`)
      return
    }
    setRelBusy(true)
    try {
      await itemApi.addLink(`${collectionId}/${itemId}`, { rel, target_collection_id: targetCol, target_item_id: targetId })
      await loadItem()
    } catch (err) {
      alert('관계 추가 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setRelBusy(false)
    }
  }, [isMock, collectionId, itemId, loadItem, pushMockEvent])

  const handleDeleteRelation = useCallback(async (relation) => {
    if (!confirm('이 관계를 삭제하시겠습니까? (양방향 자동 삭제)')) return
    if (isMock) {
      setRelatedRaw(prev => prev.filter((_, i) => i !== relation.linkIndex))
      pushMockEvent(`관계 삭제: ${relation.rel} → ${relation.targetId} (데모 세션)`)
      return
    }
    setRelBusy(true)
    try {
      await itemApi.removeLink(`${collectionId}/${itemId}`, relation.linkIndex)
      await loadItem()
    } catch (err) {
      alert('관계 삭제 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setRelBusy(false)
    }
  }, [isMock, collectionId, itemId, loadItem, pushMockEvent])

  // ── metadata edit ──
  const onEditChange = useCallback((key, value) => setEditDraft(prev => ({ ...prev, [key]: value })), [])
  const handleSave = async () => {
    if (Object.keys(editDraft).length === 0) { setEditMode(false); return }
    setSaving(true)
    try {
      await itemApi.updateProperties(collectionId, itemId, editDraft)
      setEditMode(false)
      setEditDraft({})
      await loadItem()
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`"${view?.name || itemId}" 아이템을 삭제하시겠습니까?\nS3 파일도 함께 삭제됩니다.`)) return
    try {
      await itemApi.delete(`${collectionId}/${itemId}`)
      alert('삭제 완료')
      goExplorer()
    } catch (err) {
      alert('삭제 실패: ' + (err.response?.data?.detail || err.message))
    }
  }

  if (loading) {
    return <div className="detail"><div className="dfallback"><div className="df-title">불러오는 중…</div></div></div>
  }
  if (!item || !view) {
    return (
      <div className="detail">
        <div className="dfallback">
          <div className="df-title">Item을 찾을 수 없습니다</div>
          <div style={{ fontSize: 12.5 }}>{collectionId} / {itemId}</div>
          <button type="button" className="back" onClick={goExplorer}>← Explorer로</button>
        </div>
      </div>
    )
  }

  const excludeIds = [itemId, ...relations.outgoing.map(r => r.targetId), ...relations.incoming.map(r => r.targetId)].filter(Boolean)

  return (
    <div className="detail">
      <div className="page">
        <div className="dcrumb">
          <button type="button" className="back" onClick={goExplorer}>← Explorer로</button>
          <span className="crumb"><b>Explorer</b> › Detail{isMock && ' · Mock Demo'}</span>
        </div>

        {editMode && (
          <div className="editbar">
            <span className="editbar-msg">✎ 편집 모드 — 변경 후 저장을 눌러주세요</span>
            <div className="editbar-acts">
              <button type="button" className="ebtn" onClick={() => setShowLocationPicker(true)}>📍 위치</button>
              <button type="button" className="ebtn" onClick={() => setShowMoveModal(true)}>📦 이동</button>
              <button type="button" className="ebtn danger" onClick={handleDelete}>🗑 삭제</button>
              <button type="button" className="ebtn" onClick={() => { setEditMode(false); setEditDraft({}) }}>취소</button>
              <button type="button" className="ebtn primary" onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        )}

        <DetailHeader
          view={view}
          isUnassigned={view.isUnassigned}
          projectTitle={view.projectName}
          onOpenViewer={goViewer}
          onDownload={handleDownload}
          canDownload={canDownload}
          onEdit={isMock ? undefined : () => { setEditMode(true); setEditDraft({}) }}
          editMode={editMode}
        />

        <AssetsSection view={view} onOpenViewer={goViewer} onDownload={handleDownload} canDownload={canDownload} />

        <MetadataSection meta={meta} item={item} editMode={editMode} editDraft={editDraft} onEditChange={onEditChange} />

        <SpatialSection
          meta={meta} item={item} view={view}
          onEditLocation={isMock ? undefined : () => setShowLocationPicker(true)}
        />

        <RelationsSection
          view={view}
          relations={relations}
          excludeIds={excludeIds}
          searchTargets={searchTargets}
          onAdd={handleAddRelation}
          onDelete={handleDeleteRelation}
          onFocus={goFocus}
          busy={relBusy}
        />

        <TimelineSection timeline={timeline} currentId={itemId} currentView={view} onFocus={goFocus} />

        <HistorySection events={historyEvents} item={item} />
      </div>

      {showMoveModal && (
        <MoveModal
          currentCollectionId={collectionId}
          itemId={itemId}
          itemDescription={view.name}
          onClose={() => setShowMoveModal(false)}
          onMoved={(targetId) => navigate({ pathname: `/detail/${targetId}/${itemId}`, search: location.search })}
        />
      )}

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
              await loadItem()
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
