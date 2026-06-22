/**
 * SpatialMiniMap — 위치/범위 미니맵.
 * CARTO dark 래스터 베이스맵 + 상태색 bbox/point 오버레이. graticule 폴백(타일 로드 실패 대비).
 *
 * `design-reference/project/detail/minimap.jsx` 포팅. 데이터는 실 STAC item.bbox +
 * getExplorerItemView(view) 의 lon/lat/src/status/cat 으로 환원한다.
 */
import { statusHex } from '../../features/detail/statusHex'
import { getBboxBounds } from '../../features/explorer-map/getItemMapPosition'

const W = 420, H = 182, TS = 256
const SUBS = ['a', 'b', 'c', 'd']

const sc = (z) => TS * Math.pow(2, z)
const lon2px = (lon, z) => ((lon + 180) / 360) * sc(z)
const lat2px = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * sc(z)
}

function dims(b) {
  const latM = (b[3] - b[1]) * 111320
  const lonM = (b[2] - b[0]) * 111320 * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180)
  const f = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m')
  return f(Math.abs(lonM)) + ' × ' + f(Math.abs(latM))
}

export default function SpatialMiniMap({ item, view }) {
  // getBboxBounds: 좌표 유효성 검증 + [minLng,minLat,maxLng,maxLat] 정규화(역전 bbox 보정), 무효 시 null
  const bbox = getBboxBounds(item?.bbox)
  if (view.lon == null && !bbox) {
    return (
      <div className="mini empty">
        <span className="oc-glyph">⊘</span>
        <span>위치 정보 없음 (no spatial marker)</span>
      </div>
    )
  }

  const color = statusHex(view.status)
  const isBbox = !!bbox
  const isFallback = view.src === 'fallback'
  const b = bbox
  const clon = isBbox ? (b[0] + b[2]) / 2 : view.lon
  const clat = isBbox ? (b[1] + b[3]) / 2 : view.lat

  // zoom: bbox + 주변(블록/건물 레벨)
  let z
  if (isBbox) {
    z = 18
    for (; z > 11; z--) {
      const bw = Math.abs(lon2px(b[2], z) - lon2px(b[0], z))
      const bh = Math.abs(lat2px(b[3], z) - lat2px(b[1], z))
      if (bw <= W * 0.58 && bh <= H * 0.58) break
    }
  } else if (isFallback) {
    z = 15
  } else {
    z = 18
  }

  const cpx = lon2px(clon, z), cpy = lat2px(clat, z)
  const project = (lon, lat) => ({ x: W / 2 + lon2px(lon, z) - cpx, y: H / 2 + lat2px(lat, z) - cpy })
  const n = Math.pow(2, z)

  // 뷰포트를 덮는 타일
  const tiles = []
  const txMin = Math.floor((cpx - W / 2) / TS), txMax = Math.floor((cpx + W / 2) / TS)
  const tyMin = Math.floor((cpy - H / 2) / TS), tyMax = Math.floor((cpy + H / 2) / TS)
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      if (ty < 0 || ty >= n) continue
      const wx = ((tx % n) + n) % n
      tiles.push({
        key: tx + '_' + ty,
        left: W / 2 + (tx * TS - cpx),
        top: H / 2 + (ty * TS - cpy),
        url: 'https://' + SUBS[(wx + ty) % 4] + '.basemaps.cartocdn.com/dark_nolabels/' + z + '/' + wx + '/' + ty + '.png',
      })
    }
  }

  const c = project(clon, clat)
  const grat = [0.25, 0.5, 0.75]
  const shapeLabel = isFallback
    ? 'project fallback'
    : isBbox
      ? (['orthoimage', '3d_model'].includes(view.cat) ? 'footprint' : 'bbox')
      : 'point'

  return (
    <div className="mini">
      <div className="mini-canvas" style={{ width: W, height: H }}>
        {/* graticule 폴백(타일 로드 실패 시 표시) */}
        <svg width={W} height={H} className="mini-grat-layer">
          {grat.map((g, i) => <line key={'v' + i} x1={g * W} y1={0} x2={g * W} y2={H} className="mini-grat" />)}
          {grat.map((g, i) => <line key={'h' + i} x1={0} y1={g * H} x2={W} y2={g * H} className="mini-grat" />)}
        </svg>
        {/* 래스터 베이스맵 */}
        <div className="mini-tiles">
          {tiles.map(t => (
            <img
              key={t.key} src={t.url} className="mini-tile" loading="lazy" alt=""
              style={{ left: t.left, top: t.top }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ))}
        </div>
        <div className="mini-tint" />
        {/* 오버레이: 상태색 shape */}
        <svg width={W} height={H} className="mini-overlay">
          {isBbox && (() => {
            const p0 = project(b[0], b[1]), p1 = project(b[2], b[3])
            return (
              <rect
                x={Math.min(p0.x, p1.x)} y={Math.min(p0.y, p1.y)}
                width={Math.abs(p1.x - p0.x)} height={Math.abs(p1.y - p0.y)}
                rx="2" className="mini-shape"
                style={{ stroke: color, fill: color + '24', strokeDasharray: shapeLabel === 'footprint' ? '5 3' : 'none' }}
              />
            )
          })()}
          {isFallback && <circle cx={c.x} cy={c.y} r="14" className="mini-fbring" />}
          <circle cx={c.x} cy={c.y} r="9" style={{ fill: 'none', stroke: color, strokeOpacity: 0.5, strokeWidth: 2 }} />
          <circle cx={c.x} cy={c.y} r="4.5" style={{ fill: color, stroke: '#0b0f14', strokeWidth: 1.5 }} />
        </svg>
        <span className="mini-attr">© OSM · CARTO</span>
      </div>
      <div className="mini-cap">
        <span className="mini-type" style={{ color }}>{shapeLabel}</span>
        {isBbox && <span className="mini-dim">범위 ≈ {dims(b)}</span>}
        {!isBbox && !isFallback && <span className="mini-dim">{view.lon.toFixed(4)}, {view.lat.toFixed(4)}</span>}
        {isFallback && <span className="mini-fb">⚑ 직접 좌표 없음 — 프로젝트 위치 기반 표시</span>}
      </div>
    </div>
  )
}
