/**
 * ViewerShell — 단일 자산 전체 페이지 뷰어 셸 (route: /viewer/:collectionId/:itemId)
 *
 * 상단 chrome(카테고리·이름·상태·미리보기상태·자산 전환·원본 다운로드)은 카테고리/상태와
 * 무관하게 고정. 중앙 stage 만 카테고리(8종 표면) 또는 미리보기 상태(pending/missing/failed)에
 * 따라 적응한다. 하단 context strip 은 핵심 메타만 보여주고 전체는 Detail 로 연결한다.
 *
 * 참조: design-reference/project/ViewerShell.html (Claude Design 핸드오프)
 *      docs/system_use_scenarios.md (자산 열람 동선)
 * 주의: 데모 전용(좌측 rail · 상태 시뮬레이터)은 프로덕션에서 제외했다.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { itemApi } from '../services/api'
import { isMockExplorerMode, mockExplorerDataSource } from '../mocks/mockExplorerDataSource'
import { mockPreviewAssets } from '../mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from '../features/preview/getPreviewContract.js'
import { getDisplayLabel, getOriginalFilename } from '../features/items/getDisplayLabel.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getProjectContext } from '../features/items/getProjectContext.js'
import { getCategoryInfo } from '../constants'
import CategoryGlyph from '../components/viewer/CategoryGlyph'
import { getSurface } from '../components/viewer/ViewerSurfaces'
import { PendingPanel, MissingPanel, FailedPanel } from '../components/viewer/ViewerStatePanels'
import '../styles/viewer.css'

const PV = {
  available: { c: 'var(--av)', label: 'available' },
  pending: { c: 'var(--pend)', label: 'pending' },
  missing: { c: 'var(--miss)', label: 'missing' },
  failed: { c: 'var(--fail)', label: 'failed' },
}

const STATUS_BADGE = {
  draft: { label: 'Draft', color: 'var(--draft)', dashed: false },
  published: { label: 'Published', color: 'var(--pub)', dashed: false },
  archived: { label: 'Archived', color: 'var(--arch)', dashed: false },
  unknown: { label: 'Unknown', color: 'var(--unk)', dashed: true },
}

const VIEWER_LABEL = {
  pointcloud: '포인트클라우드 뷰어', '3d_model': '3D 모델 뷰어', '3d_tiles': '3D Tiles 뷰어',
  orthoimage: '2D 래스터 뷰어', image: '이미지 갤러리', panorama: '360° 파노라마 뷰어',
  video: '동영상 플레이어', document: '문서(PDF) 뷰어',
}
const ENGINE_HINT = {
  pointcloud: 'Potree-style', '3d_model': 'model-viewer', '3d_tiles': 'Cesium-style',
  orthoimage: 'tiled raster', image: 'slideshow', panorama: 'pannellum-style',
  video: 'HTML5 video', document: 'pdf.js',
}
const DERIVED_LABEL = {
  pointcloud: '파생 · Potree 타일셋', '3d_model': '파생 · 스트리밍 메시', '3d_tiles': '파생 · b3dm 타일',
  orthoimage: '파생 · COG 타일', image: '파생 · 썸네일 세트', panorama: '파생 · 멀티해상 타일',
  video: '파생 · poster + HLS', document: '파생 · 페이지 렌더',
}

function findDataAsset(assets) {
  const values = Object.values(assets || {})
  return values.find(a => (a?.roles || []).includes('data'))
    || values.find(a => !(a?.roles || []).includes('thumbnail'))
    || null
}

function buildAssetOptions(originalFilename, dataCategory, previewStatus) {
  const ext = (originalFilename || '').split('.').pop()
  const out = [{ key: 'original', label: '원본 · ' + (ext ? ext.toUpperCase() : 'FILE') }]
  const derived = DERIVED_LABEL[dataCategory]
  // 파생본은 뷰어용 변환이 실제로 준비된(available) 경우에만 노출 — 없는 파생을 암시하지 않는다.
  if (derived && previewStatus === 'available') out.push({ key: 'derived', label: derived })
  return out
}

export default function ViewerShell() {
  const { collectionId, itemId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const mockMode = useMemo(() => isMockExplorerMode(), [])

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assetKey, setAssetKey] = useState('original')

  // Detail 로 이동할 때 mock 데모 쿼리(?mock=1)를 보존한다. 보존하지 않으면 mock 자산이
  // 실 STAC 백엔드 조회로 빠져 404(막다른 길)가 된다. (Detail 도 mock 모드를 인지한다.)
  const goDetail = () => navigate({ pathname: `/detail/${collectionId}/${itemId}`, search: location.search })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setItem(null)
    setAssetKey('original')   // 새 자산으로 바뀌면 자산 선택을 원본으로 리셋 (stale 선택 방지)
    const request = mockMode
      ? mockExplorerDataSource.getItem(collectionId, itemId)
      : itemApi.get(collectionId, itemId)
    request
      .then(res => { if (!cancelled) setItem(res?.data || null) })
      .catch(() => { if (!cancelled) setItem(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [collectionId, itemId, mockMode])

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') goDetail() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [collectionId, itemId])

  if (loading) {
    return (
      <div className="vshell">
        <div className="vshell-fallback"><div className="vf-title">불러오는 중…</div></div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="vshell">
        <div className="vshell-fallback">
          <div className="vf-title">자산을 찾을 수 없습니다</div>
          <div style={{ fontSize: 12.5 }}>{collectionId} / {itemId}</div>
          <button type="button" className="sp-btn ghost" onClick={() => navigate('/')}>← Explorer로</button>
        </div>
      </div>
    )
  }

  const props = item.properties || {}
  const dataCategory = props.data_category || 'unknown'
  const cat = getCategoryInfo(dataCategory)
  const name = getDisplayLabel(item)
  const filename = getOriginalFilename(item) || item.id
  const itemStatus = getItemStatus(item)
  const statusBadge = STATUS_BADGE[itemStatus] || STATUS_BADGE.unknown

  const contract = getPreviewContract(item, mockMode ? mockPreviewAssets : null, { isMock: mockMode })
  const previewState = contract.status
  const pv = PV[previewState] || PV.missing

  const project = getProjectContext(item, [])
  const acquired = typeof props.datetime === 'string' ? props.datetime.slice(0, 10) : null
  const epsg = props['proj:epsg'] ? 'EPSG:' + props['proj:epsg'] : null

  const dataAsset = findDataAsset(item.assets)
  const downloadHref = dataAsset?.href || null
  const canDownload = Boolean(downloadHref) && !downloadHref.startsWith('mock://')
  const downloadTitle = canDownload
    ? '원본은 미리보기 상태와 무관하게 항상 다운로드 가능'
    : '데모 모드에서는 원본 다운로드가 비활성화됩니다'
  const handleDownload = () => { if (canDownload) window.open(downloadHref, '_blank', 'noopener') }

  const assetOptions = buildAssetOptions(filename, dataCategory, previewState)
  const Surface = getSurface(dataCategory)
  const missingKind = dataCategory === 'orthoimage' ? 'tiff' : null

  return (
    <div className="vshell">
      {/* ===== top chrome — 카테고리/상태와 무관하게 고정 ===== */}
      <div className="chrome">
        <button type="button" className="back" onClick={goDetail}>← Detail로</button>
        <div className="ch-id">
          <div className="ch-glyph"><CategoryGlyph cat={dataCategory} s={20} /></div>
          <div className="ch-txt">
            <div className="ch-name" title={name}>{name}</div>
            <div className="ch-sub">{dataCategory} · {filename}</div>
          </div>
          <span
            className="badge"
            style={{ color: statusBadge.color, borderColor: `color-mix(in srgb, ${statusBadge.color} 40%, transparent)`, background: `color-mix(in srgb, ${statusBadge.color} 8%, transparent)`, borderStyle: statusBadge.dashed ? 'dashed' : 'solid' }}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="ch-right">
          <span className="pv-badge" style={{ color: pv.c, borderColor: `color-mix(in srgb, ${pv.c} 40%, transparent)`, background: `color-mix(in srgb, ${pv.c} 8%, transparent)` }}>
            <i style={{ background: pv.c }} />{pv.label}
          </span>
          <div className="asset-sw">
            <span className="lbl">Asset</span>
            <select
              value={assetKey}
              onChange={e => setAssetKey(e.target.value)}
              disabled={assetOptions.length <= 1}
              title="원본/파생 자산 표시. 파생본 뷰어 연동은 Phase 2 — 현재 표면은 비작동 목업입니다."
            >
              {assetOptions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          {canDownload ? (
            <button type="button" className="dl" onClick={handleDownload} title={downloadTitle}>⤓ 원본 다운로드</button>
          ) : (
            <button type="button" className="dl disabled" disabled title={downloadTitle}>⤓ 원본 다운로드</button>
          )}
        </div>
      </div>

      <div className="body">
        <div className="vcol">
          <div className="vstage">
            <div className="vmock-tag">
              <CategoryGlyph cat={dataCategory} s={13} /> {VIEWER_LABEL[dataCategory] || '자산 뷰어'}
              <span className="mk">{ENGINE_HINT[dataCategory] || 'preview'} · 목업 (비작동)</span>
            </div>

            {previewState === 'available' && <Surface />}
            {previewState === 'pending' && <PendingPanel generating={null} onDownload={handleDownload} onOpenDetail={goDetail} />}
            {previewState === 'missing' && <MissingPanel kind={missingKind} onDownload={handleDownload} />}
            {previewState === 'failed' && <FailedPanel reason={contract.failureReason} onDownload={handleDownload} onOpenDetail={goDetail} />}
          </div>

          {/* context strip — 핵심 메타만, 전체는 Detail */}
          <div className="cstrip">
            <div className="cs-scroll">
              <div className="cs-item"><span className="cs-k">Category</span><span className="cs-v">{cat.label}</span></div>
              {acquired && <div className="cs-item"><span className="cs-k">취득일</span><span className="cs-v mono">{acquired}</span></div>}
              <div className="cs-item">
                <span className="cs-k">Project</span>
                {project.isUnassigned
                  ? <span className="cs-v unassigned">미배정</span>
                  : <span className="cs-v">{project.projectName}</span>}
              </div>
              {epsg && <div className="cs-item" style={{ borderRight: 0 }}><span className="cs-k">EPSG</span><span className="cs-v mono">{epsg}</span></div>}
            </div>
            <button type="button" className="cs-more" onClick={goDetail}>전체 정보 → Detail</button>
          </div>
        </div>
      </div>
    </div>
  )
}
