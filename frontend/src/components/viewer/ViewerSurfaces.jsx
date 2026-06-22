/**
 * ViewerSurfaces — 카테고리별 뷰어 표면(목업).
 *
 * 핸드오프 `ViewerShell.html` 의 surface 함수들을 그대로 옮긴 비작동 크롬 목업이다.
 * 실제 헤비 뷰어(Potree/Cesium/pdf.js 등) 연동은 Phase 2 로 유보 — 여기서는 "available"
 * 상태일 때 카테고리에 맞는 뷰어가 어떤 모습인지 보여주는 셸 역할만 한다.
 */
import { useMemo } from 'react'
import CategoryGlyph from './CategoryGlyph'

function PointcloudSurface() {
  const dots = useMemo(() => {
    const a = []
    for (let i = 0; i < 420; i++) {
      const cx = 50 + (Math.random() - 0.5) * 46
      const cy = 52 + (Math.random() - 0.5) * 50
      const d = Math.hypot(cx - 50, (cy - 52) * 0.8)
      const lum = Math.max(0.18, 1 - d / 42)
      a.push({ x: cx, y: cy, s: 1.3 + Math.random() * 1.8, o: lum, hue: 196 + lum * 40 })
    }
    return a
  }, [])
  return (
    <div className="surf">
      <div className="pc-stage">
        {dots.map((d, i) => (
          <span
            key={i}
            className="pc-dot"
            style={{ left: d.x + '%', top: d.y + '%', width: d.s, height: d.s, background: `hsl(${d.hue} 55% ${45 + d.o * 30}%)`, opacity: d.o }}
          />
        ))}
      </div>
      <div className="surf-ctls ctl-col">
        <div className="cbtn" title="회전">⟲</div><div className="cbtn" title="이동">✛</div>
        <div className="cbtn" title="측정">⊿</div><div className="cbtn" title="단면/클리핑">▤</div>
      </div>
      <div className="surf-ctls ctl-bottom">
        <div className="cpill">점 크기 <span className="cslider"><i style={{ left: '42%' }} /></span></div>
        <div className="cpill">EDL 음영 <span style={{ color: 'var(--av)' }}>ON</span></div>
        <div className="cpill">분류 색상</div>
      </div>
      <div className="navcube"><div /></div>
    </div>
  )
}

function TilesSurface() {
  return (
    <div className="surf">
      <div className="tiles-stage">
        <div className="tiles-grid">
          {Array.from({ length: 64 }).map((_, i) => <span key={i} style={{ opacity: 0.4 + ((i * 7) % 9) / 14 }} />)}
        </div>
      </div>
      <div className="surf-ctls ctl-tr">
        <div className="cbtn lg"><span className="ci">▦</span>tile 경계</div>
        <div className="cbtn lg"><span className="ci">◳</span>LOD</div>
        <div className="cbtn lg"><span className="ci">☀</span>지형 음영</div>
      </div>
      <div className="surf-ctls ctl-bottom">
        <div className="cpill">geometric error <span className="mono" style={{ color: 'var(--t1)' }}>16 → 2</span></div>
        <div className="cpill">tiles 로드됨 <span className="mono" style={{ color: 'var(--t1)' }}>3,412</span></div>
      </div>
    </div>
  )
}

function ModelSurface() {
  return (
    <div className="surf">
      <div className="model-stage"><div className="model-shape" /></div>
      <div className="surf-ctls ctl-col">
        <div className="cbtn" title="궤도">⟲</div><div className="cbtn" title="이동">✛</div><div className="cbtn" title="줌">⊕</div>
      </div>
      <div className="surf-ctls ctl-bottom">
        <div className="cpill">와이어프레임</div><div className="cpill">재질 <span style={{ color: 'var(--t1)' }}>PBR</span></div>
        <div className="cpill">조명</div><div className="cpill">bbox</div>
      </div>
      <div className="navcube"><div /></div>
    </div>
  )
}

function OrthoSurface() {
  return (
    <div className="surf">
      <div className="ortho-stage" />
      <div className="surf-ctls ctl-tr">
        <div className="cbtn" title="줌 +">＋</div><div className="cbtn" title="줌 −">－</div><div className="cbtn" title="전체">⤢</div>
      </div>
      <div className="surf-ctls ctl-bottom">
        <div className="cpill">불투명도 <span className="cslider"><i style={{ left: '80%' }} /></span></div>
        <div className="cpill mono" style={{ color: 'var(--t2)' }}>129.3326, 35.7905</div>
      </div>
      <div className="ortho-scale"><span>0 ─ 20m</span><div className="bar"><span /><span /><span /><span /></div></div>
    </div>
  )
}

function GallerySurface() {
  return (
    <div className="surf">
      <div className="gal-stage">
        <div className="gal-main">
          <div className="ph"><CategoryGlyph cat="image" s={40} /><span style={{ fontSize: 12 }}>대표 이미지 (목업)</span></div>
          <div className="gal-nav" style={{ left: 14 }}>‹</div><div className="gal-nav" style={{ right: 14 }}>›</div>
          <div className="gal-counter">07 / 42</div>
          <div className="gal-exif"><span>ƒ/8.0</span><span>1/250s</span><span>ISO 100</span><span>Sony A7R IV</span></div>
        </div>
        <div className="gal-strip">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className={'gal-thumb' + (i === 6 ? ' on' : '')} />)}
        </div>
      </div>
    </div>
  )
}

function PanoramaSurface() {
  return (
    <div className="surf">
      <div className="pano-stage">
        <div className="pano-strip" /><div className="pano-vignette" /><div className="pano-cross" />
        <div className="pano-hint">드래그하여 시점 회전 · 스크롤로 확대</div>
      </div>
      <div className="surf-ctls ctl-tr">
        <div className="cbtn lg"><span className="ci">↻</span>자동회전</div>
        <div className="cbtn lg"><span className="ci">⊕</span>FOV</div>
        <div className="cbtn lg"><span className="ci">⌖</span>핫스팟</div>
      </div>
    </div>
  )
}

function VideoSurface() {
  return (
    <div className="surf">
      <div className="vid-stage"><div className="vid-play" /></div>
      <div className="vid-bar">
        <span>03:11</span><span className="vid-track"><i /></span><span>12:22</span>
        <span style={{ marginLeft: 4 }}>🔊</span><span>⛶</span>
      </div>
    </div>
  )
}

function DocumentSurface() {
  return (
    <div className="surf">
      <div className="doc-stage">
        <div className="doc-thumbs">{[1, 2, 3].map(n => <div key={n} className={'doc-thumb' + (n === 1 ? ' on' : '')}><span>{n}</span></div>)}</div>
        <div className="doc-page-wrap">
          <div className="doc-page">
            <div className="doc-line title" /><div className="doc-line" /><div className="doc-line" /><div className="doc-line short" />
            <div className="doc-line" style={{ marginTop: 22 }} /><div className="doc-line" /><div className="doc-line short" />
          </div>
        </div>
      </div>
      <div className="doc-toolbar">
        <span>◀</span><span className="pg">1 / 3</span><span>▶</span><span style={{ color: 'var(--line)' }}>|</span>
        <span>－</span><span className="pg">120%</span><span>＋</span>
      </div>
    </div>
  )
}

function UnknownSurface() {
  return (
    <div className="surf">
      <div className="surf-watermark"><CategoryGlyph cat="unknown" s={120} /></div>
    </div>
  )
}

export const SURFACES = {
  pointcloud: PointcloudSurface,
  '3d_model': ModelSurface,
  '3d_tiles': TilesSurface,
  orthoimage: OrthoSurface,
  image: GallerySurface,
  panorama: PanoramaSurface,
  video: VideoSurface,
  document: DocumentSurface,
}

export function getSurface(dataCategory) {
  return SURFACES[dataCategory] || UnknownSurface
}
