/**
 * DetailHero — Detail 상단 헤더 카드 + Assets 섹션.
 * `design-reference/project/Detail.html` 의 .dhead / .assets 포팅.
 * 색은 상태(STATUS_META) / 미리보기(PREVIEW_META) 토큰만 운반하고, 카테고리는 글리프(형태)로만 표시.
 */
import CategoryGlyph from '../viewer/CategoryGlyph'
import { getCategoryInfo, formatSize } from '../../constants'
import { STATUS_META, PREVIEW_META, SPATIAL_LABEL, tint } from '../../features/explorer/explorerMeta'

function Badge({ status }) {
  const v = STATUS_META[status] || STATUS_META.unknown
  return (
    <span
      className="badge"
      style={{ color: v.color, borderColor: tint(v.color, 40), background: tint(v.color, 8), borderStyle: v.dashed ? 'dashed' : 'solid' }}
    >
      {v.label}
    </span>
  )
}

export function DetailHeader({ view, isUnassigned, projectTitle, onOpenViewer, onDownload, canDownload, onEdit, editMode }) {
  const pv = PREVIEW_META[view.preview] || PREVIEW_META.missing
  const isDraft = view.status === 'draft'
  return (
    <div className="dhead">
      <div className="dhead-tile">
        {view.thumbnailHref
          ? <img key={view.thumbnailHref} src={view.thumbnailHref} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          : <CategoryGlyph cat={view.cat} s={40} />}
      </div>
      <div className="dhead-main">
        <div className="dhead-top">
          <h1>{view.name}</h1>
          <Badge status={view.status} />
          <span className={'proj-chip' + (isUnassigned ? ' un' : '')}>
            {isUnassigned ? '◇ Unassigned' : projectTitle}
          </span>
        </div>
        <div className="dhead-file">{view.file} · {view.id}</div>
        <div className="dhead-facts">
          <div className="fact"><span className="k">데이터 유형</span><span className="v">{getCategoryInfo(view.cat).label}</span></div>
          {view.dt && <div className="fact"><span className="k">취득일</span><span className="v mono">{view.dt}</span></div>}
          <div className="fact"><span className="k">크기</span><span className="v">{formatSize(view.size)}</span></div>
          <div className="fact"><span className="k">위치 근거</span><span className="v">{SPATIAL_LABEL[view.src] || SPATIAL_LABEL.none}</span></div>
          <div className="fact"><span className="k">preview</span><span className="v" style={{ color: pv.color }}>{view.preview}</span></div>
        </div>
      </div>
      <div className="dhead-act">
        <button type="button" className="act primary" onClick={onOpenViewer}>Viewer 열기</button>
        <button
          type="button" className="act" onClick={onDownload} disabled={!canDownload}
          title={canDownload ? '원본은 미리보기 상태와 무관하게 항상 다운로드 가능' : '데모 모드에서는 원본 다운로드가 비활성화됩니다'}
        >
          원본 다운로드
        </button>
        {!editMode && onEdit && (
          <button type="button" className={'act' + (isDraft ? ' warn' : '')} onClick={onEdit}>
            {isDraft ? '메타데이터 보완' : '편집'}
          </button>
        )}
      </div>
    </div>
  )
}

const PREVIEW_TYPE = {
  pointcloud: 'thumbnail → point cloud viewer',
  '3d_model': 'screenshot → model viewer',
  '3d_tiles': 'tileset placeholder → 3D Tiles',
  orthoimage: 'tiled image / GeoTIFF',
  image: 'image slideshow',
  panorama: 'panorama viewer',
  video: 'poster → video',
  document: 'PDF pages',
}

function buildAssets(view) {
  return [
    { key: 'original', label: '원본 (original)', name: view.file, size: formatSize(view.size), role: 'data', status: 'stored', note: null },
    { key: 'preview', label: 'Preview', name: PREVIEW_TYPE[view.cat] || 'asset preview', size: '—', role: 'preview', status: view.preview, note: view.previewFail },
    { key: 'download', label: 'Download / Export', name: '원본 다운로드 · 메타데이터(JSON)', size: formatSize(view.size), role: 'download', status: view.status === 'archived' ? 'restricted' : 'ready', note: view.status === 'archived' ? 'Archived — 복원 후 다운로드' : null },
  ]
}

export function AssetsSection({ view, onOpenViewer, onDownload, canDownload }) {
  const assets = buildAssets(view)
  return (
    <section className="dsec">
      <div className="dsec-h"><h2>Assets</h2><span className="dsec-sub">원본 · preview · download</span></div>
      <div className="assets">
        {assets.map(a => {
          const pv = PREVIEW_META[a.status] || null
          const isPreview = a.key === 'preview'
          const previewDisabled = isPreview && (a.status === 'missing' || a.status === 'failed')
          const downloadDisabled = a.key === 'download' && (!canDownload || a.status === 'restricted')
          return (
            <div className="asset" key={a.key}>
              <div className="asset-role">{a.label}</div>
              <div className={'asset-vis' + (isPreview ? ' pv-' + a.status : '')}>
                {isPreview && a.status === 'available' && view.thumbnailHref
                  ? <img key={view.thumbnailHref} src={view.thumbnailHref} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  : (
                    <span className="big">
                      {isPreview && a.status === 'failed' ? '⚠'
                        : isPreview && a.status === 'missing' ? '▢'
                          : <CategoryGlyph cat={view.cat} s={isPreview && a.status === 'available' ? 38 : 30} />}
                    </span>
                  )}
                {isPreview && a.status === 'available' && <span className="asset-thumbtag">대표 썸네일</span>}
                {isPreview && pv && (
                  <span className="asset-pvb" style={{ color: pv.color, border: '1px solid', borderColor: tint(pv.color, 33), background: tint(pv.color, 8) }}>
                    {a.status}
                  </span>
                )}
              </div>
              <div className="asset-nm">{a.name}</div>
              <div className="asset-meta"><span>{a.role}</span><span>{a.size}</span></div>
              {a.note && <div className="asset-note">⚠ {a.note}</div>}
              <button
                type="button" className="asset-btn"
                disabled={(isPreview && previewDisabled) || downloadDisabled}
                onClick={() => {
                  if (a.key === 'download') onDownload()
                  else onOpenViewer()
                }}
              >
                {a.key === 'original' ? '원본 보기'
                  : isPreview ? (a.status === 'available' ? 'Preview 열기' : a.status === 'pending' ? '변환 대기' : '미지원')
                    : '다운로드'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
