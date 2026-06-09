/**
 * MapLibre 2D 지도 — Item 을 글리프 마커로 표시하고 겹치면 클러스터링.
 *
 * 디자인(Explorer.html / map.jsx): CARTO dark 베이스맵 + 둥근 사각 글리프 마커(상태색 테두리 +
 * 미리보기 점) + 클러스터 버블 + 카테고리·상태 범례.
 *
 * 구현: GeoJSON cluster source(MapLibre 네이티브 클러스터링) + 'render' 시 HTML 마커 동기화.
 *  - 마커는 source 좌표로 배치되므로 지도 이동/줌에 항상 정확히 따라간다(지오 앵커 유지).
 *  - 마커 루트 element 는 MapLibre 가 transform 으로 위치시키고, 시각/선택 스케일은 inner element 에 둔다
 *    (MapLibre 의 위치 transform 과 충돌하지 않게 분리 — 마커 중심이 곧 지오 좌표 = 관계선 끝점과 정확히 일치).
 */
import { useRef, useEffect, useMemo, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { getItemsBounds } from '../features/explorer-map/getItemsBounds.js'
import { getItemMapPosition } from '../features/explorer-map/getItemMapPosition.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { normalizePreviewStatus } from '../features/items/getItemPreviewSummary.js'
import { categoryGlyphSvg, STATUS_VAR, PREVIEW_VAR } from '../features/explorer-map/categoryGlyphSvg.js'
import { CAT_ORDER, STATUS_META, STATUS_ORDER } from '../features/explorer/explorerMeta.js'
import { getCategoryInfo } from '../constants'
import CategoryGlyph from './viewer/CategoryGlyph'
import RelationOverlayLayer from './RelationOverlayLayer'

const SRC = 'assets'
const CARTO_DARK = [
  'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  'https://d.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
]

function stylePointEl(inner, dot, props, state) {
  const statusColor = STATUS_VAR[props.status] || STATUS_VAR.unknown
  const dashed = props.fallback || props.status === 'unknown'
  const shadow = state.selected
    ? '0 0 0 3px rgba(59,130,246,.9), 0 4px 14px -2px rgba(0,0,0,.6)'
    : state.hovered
      ? '0 0 0 2px rgba(59,130,246,.55), 0 3px 10px -2px rgba(0,0,0,.55)'
      : '0 2px 8px -2px rgba(0,0,0,.5)'
  const scale = state.selected ? 1.16 : state.hovered ? 1.2 : state.related ? 1.08 : 1
  inner.style.cssText = `
    position: relative; width: 30px; height: 30px; border-radius: 8px; background: var(--card);
    border: 1.6px ${dashed ? 'dashed' : 'solid'} ${statusColor};
    display: flex; align-items: center; justify-content: center; color: #C7D0DC;
    box-shadow: ${shadow}; transform: scale(${scale}); transition: transform .1s;
    opacity: ${state.dimmed ? 0.4 : 1};
  `
  dot.style.cssText = `position: absolute; top: -3px; right: -3px; width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--bg); background: ${PREVIEW_VAR[props.preview] || PREVIEW_VAR.missing};`
}

export default function MapView({
  items,
  selectedId,
  hoveredId,
  onSelectItem,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  onBoundsChange,
  fitToItems = true,
  loading = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const htmlMarkersRef = useRef({})        // key -> maplibregl.Marker (cached)
  const onScreenRef = useRef({})           // key -> marker currently added
  const updateMarkersRef = useRef(null)
  const hasFitRef = useRef(false)

  // 항상 최신 값을 읽도록 ref 로 보관 (render 핸들러가 클로저로 잡는 값들)
  const boundsCbRef = useRef(onBoundsChange); boundsCbRef.current = onBoundsChange
  const onSelectRef = useRef(onSelectItem); onSelectRef.current = onSelectItem
  const selectedIdRef = useRef(selectedId); selectedIdRef.current = selectedId
  const hoveredIdRef = useRef(hoveredId); hoveredIdRef.current = hoveredId
  const relEnabledRef = useRef(relationOverlayEnabled); relEnabledRef.current = relationOverlayEnabled
  const relatedIds = useMemo(() => new Set(relationOverlayModel?.relatedItemIds || []), [relationOverlayModel])
  const relatedIdsRef = useRef(relatedIds); relatedIdsRef.current = relatedIds

  // 선택 + (관계 on 시) 관련 item 은 클러스터링에서 제외 → 항상 개별 마커로 떠서 관계선이 보이는 마커끼리 연결된다.
  const focusIds = useMemo(() => {
    const s = new Set()
    if (selectedId) s.add(selectedId)
    if (relationOverlayEnabled) relatedIds.forEach(id => s.add(id))
    return s
  }, [selectedId, relatedIds, relationOverlayEnabled])

  const itemsById = useMemo(() => {
    const m = new Map(); (items || []).forEach(i => m.set(i.id, i)); return m
  }, [items])
  const itemsByIdRef = useRef(itemsById); itemsByIdRef.current = itemsById

  const featureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: (items || []).filter(it => !focusIds.has(it.id)).map(it => {
      const pos = getItemMapPosition(it)
      if (!pos) return null
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pos.position },
        properties: {
          id: it.id,
          cat: it.properties?.data_category || 'unknown',
          status: getItemStatus(it),
          preview: normalizePreviewStatus(it.properties?.previewStatus),
          fallback: pos.source === 'fallback' ? 1 : 0,
        },
      }
    }).filter(Boolean),
  }), [items, focusIds])

  // ── 지도 초기화 + 클러스터 source + 마커 동기화 ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { carto: { type: 'raster', tiles: CARTO_DARK, tileSize: 256, attribution: '© OpenStreetMap © CARTO' } },
        layers: [{ id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 }],
      },
      center: [128.6, 35.9],
      zoom: 7,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const emitBounds = () => {
      const b = map.getBounds()
      boundsCbRef.current?.({ minLon: b.getWest(), maxLon: b.getEast(), minLat: b.getSouth(), maxLat: b.getNorth() })
    }

    // 클러스터 버블 내용 갱신 (dirty 체크). cluster_id 는 줌마다 다른 클러스터를 가리킬 수 있으므로
    // 재사용 시에도 매번 카운트/뱃지를 갱신한다.
    const styleCluster = (el, p) => {
      const count = p.point_count
      const sig = count + '|' + (p.drafts || 0) + '|' + (p.fails || 0)
      if (el.__sig === sig) return
      el.__sig = sig
      const sz = Math.min(50, 30 + Math.log2(count) * 6)
      el.style.cssText = `width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(30,38,48,.92);border:1.5px solid #3a4452;color:var(--t1);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 12px -2px rgba(0,0,0,.55);font-family:var(--font-mono);font-weight:600;font-size:13px;position:relative;`
      el.textContent = count > 999 ? (count / 1000).toFixed(1) + 'k' : String(count)
      if ((p.fails || 0) > 0 || (p.drafts || 0) > 0) {
        const d = document.createElement('span')
        d.style.cssText = `position:absolute;top:0;right:2px;width:9px;height:9px;border-radius:50%;border:1.5px solid var(--card);background:${(p.fails || 0) > 0 ? 'var(--fail)' : 'var(--draft)'};`
        el.appendChild(d)
      }
    }

    const makePoint = (id) => {
      const root = document.createElement('div')   // MapLibre 가 transform 으로 위치시키는 컨테이너
      const inner = document.createElement('div')  // 시각/스케일 — MapLibre 위치 transform 과 분리
      const dot = document.createElement('span')
      root.appendChild(inner)
      root.style.cursor = 'pointer'
      root.__inner = inner; root.__dot = dot
      root.addEventListener('click', (e) => {
        e.stopPropagation()
        const it = itemsByIdRef.current.get(id)
        if (it) onSelectRef.current?.(it)
      })
      return root
    }

    // 개별 점 마커 생성/갱신 (source 의 unclustered point + focus 마커 공용)
    const upsertPoint = (key, props, coords, next) => {
      let m = htmlMarkersRef.current[key]
      if (!m) {
        const el = makePoint(props.id)
        m = htmlMarkersRef.current[key] = new maplibregl.Marker({ element: el })
        m.__el = el; m.__cat = null; m.__stateKey = null
      }
      m.setLngLat(coords)   // 매 패스 재앵커 (geometry 변동 + 관계선 정합성)
      const el = m.__el
      if (m.__cat !== props.cat) {  // 글리프는 카테고리가 바뀔 때만 다시 그림
        m.__cat = props.cat
        el.__inner.innerHTML = categoryGlyphSvg(props.cat, 15)
        el.__inner.appendChild(el.__dot)
      }
      const sel = selectedIdRef.current === props.id
      const hov = hoveredIdRef.current === props.id && !sel
      const rel = relEnabledRef.current && relatedIdsRef.current.has(props.id) && !sel
      const dimmed = Boolean(selectedIdRef.current) && relEnabledRef.current && relatedIdsRef.current.size > 0 && !sel && !rel && !hov
      const stateKey = (sel ? 's' : hov ? 'h' : rel ? 'r' : 'n') + (dimmed ? 'd' : '') + props.status + props.preview + (props.fallback ? 'f' : '')
      if (m.__stateKey !== stateKey) {  // 상태 변화가 있을 때만 재스타일 (프레임마다 cssText 재작성 방지)
        m.__stateKey = stateKey
        stylePointEl(el.__inner, el.__dot, props, { selected: sel, hovered: hov, related: rel, dimmed })
        el.style.zIndex = sel ? 40 : hov ? 35 : rel ? 30 : 12
      }
      next[key] = m
      if (!onScreenRef.current[key]) m.addTo(map)
    }

    const updateMarkers = () => {
      // 소스가 (재)로딩 중이면 querySourceFeatures 가 비거나 부분 결과 → 마커가 깜빡임. 로드 완료 전엔 건너뛴다.
      if (!map.getSource(SRC) || !map.isSourceLoaded(SRC)) return
      const next = {}
      const feats = map.querySourceFeatures(SRC)
      for (const f of feats) {
        const p = f.properties
        const coords = f.geometry.coordinates
        if (p.cluster) {
          const key = 'c' + p.cluster_id
          let m = htmlMarkersRef.current[key]
          if (!m) {
            const el = document.createElement('div')
            m = htmlMarkersRef.current[key] = new maplibregl.Marker({ element: el })
            m.__el = el
            el.addEventListener('click', () => {
              const src = map.getSource(SRC); if (!src) return
              src.getClusterExpansionZoom(m.__clusterId).then(z => map.easeTo({ center: m.__coords, zoom: z })).catch(() => {})
            })
          }
          // cluster_id 는 줌별로 재사용되므로 매 패스마다 위치/내용/클릭 타깃을 현재 값으로 갱신
          m.__clusterId = p.cluster_id
          m.__coords = coords
          m.setLngLat(coords)
          styleCluster(m.__el, p)
          next[key] = m
          if (!onScreenRef.current[key]) m.addTo(map)
        } else {
          upsertPoint('p' + p.id, p, coords, next)
        }
      }
      // focus(선택 + 관련) item 은 source 에서 제외돼 있으므로 itemsById 로 직접 개별 마커 렌더
      const focus = new Set()
      if (selectedIdRef.current) focus.add(selectedIdRef.current)
      if (relEnabledRef.current) relatedIdsRef.current.forEach(id => focus.add(id))
      focus.forEach(id => {
        const it = itemsByIdRef.current.get(id); if (!it) return
        const pos = getItemMapPosition(it); if (!pos) return
        upsertPoint('f' + id, {
          id,
          cat: it.properties?.data_category || 'unknown',
          status: getItemStatus(it),
          preview: normalizePreviewStatus(it.properties?.previewStatus),
          fallback: pos.source === 'fallback',
        }, pos.position, next)
      })
      // 화면에서 사라진 마커는 제거 + 캐시에서도 제거 (무한 증가 방지)
      for (const key in onScreenRef.current) {
        if (!next[key]) { onScreenRef.current[key].remove(); delete htmlMarkersRef.current[key] }
      }
      onScreenRef.current = next
    }
    updateMarkersRef.current = updateMarkers

    map.on('load', () => {
      map.addSource(SRC, {
        type: 'geojson',
        data: featureCollection,
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 16,
        clusterProperties: {
          drafts: ['+', ['case', ['==', ['get', 'status'], 'draft'], 1, 0]],
          fails: ['+', ['case', ['==', ['get', 'preview'], 'failed'], 1, 0]],
        },
      })
      // querySourceFeatures 가 동작하려면 source 를 참조하는 레이어가 필요 (보이지 않게)
      map.addLayer({ id: SRC + '-pts', type: 'circle', source: SRC, paint: { 'circle-radius': 0, 'circle-opacity': 0 } })
      setMapLoaded(true)
      emitBounds()
      updateMarkers()
    })
    map.on('render', updateMarkers)
    map.on('sourcedata', (e) => { if (e.sourceId === SRC && map.isSourceLoaded(SRC)) updateMarkers() })
    map.on('moveend', emitBounds)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; setMapLoaded(false); htmlMarkersRef.current = {}; onScreenRef.current = {} }
  }, [])

  // source 데이터 갱신
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !map.getSource(SRC)) return
    map.getSource(SRC).setData(featureCollection)
    // 'sourcedata'/'render' 가 클러스터 재계산 완료 후 마커를 동기화 (여기서 즉시 호출하면 stale tiles 조회).
  }, [featureCollection, mapLoaded])

  // 선택/관계/hover 상태 변하면 마커 재스타일
  useEffect(() => {
    if (mapLoaded) updateMarkersRef.current?.()
  }, [selectedId, hoveredId, relatedIds, relationOverlayEnabled, mapLoaded])

  // 결과 전체 범위로 맞춤 (단, bbox 필터로 사용자가 뷰를 조종 중이면 맞추지 않음)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !fitToItems) return
    const bounds = getItemsBounds(items)
    if (!bounds) { hasFitRef.current = false; return }
    const [w, s, e, n] = bounds
    if (w === e && s === n) {
      map.flyTo({ center: [w, s], zoom: 14, duration: hasFitRef.current ? 350 : 0 })
    } else {
      map.fitBounds([[w, s], [e, n]], { padding: 80, duration: hasFitRef.current ? 350 : 0, maxZoom: 15 })
    }
    hasFitRef.current = true
  }, [items, mapLoaded, fitToItems])

  // 선택 시 줌은 바꾸지 않는다(기획). 단, 선택 item 이 현재 화면 밖이면 줌 유지한 채 중심만 이동해 보이게 한다.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !selectedId) return
    const item = itemsByIdRef.current.get(selectedId)
    const pos = item && getItemMapPosition(item)
    if (!pos) return
    if (!map.getBounds().contains(pos.position)) {
      map.easeTo({ center: pos.position, zoom: map.getZoom(), duration: 500 })
    }
  }, [selectedId, mapLoaded])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      <RelationOverlayLayer
        map={mapRef.current}
        mapLoaded={mapLoaded}
        enabled={relationOverlayEnabled}
        overlayModel={relationOverlayModel}
      />

      <div className="map-modetag">2D map · CARTO dark</div>

      <div className="map-legend">
        <div className="ml-row">
          <span className="ml-h">category · 형태</span>
          {CAT_ORDER.map(c => <span key={c} className="ml-cat" title={getCategoryInfo(c).label}><CategoryGlyph cat={c} s={13} /></span>)}
        </div>
        <div className="ml-row">
          <span className="ml-h">status · 색</span>
          {STATUS_ORDER.map(k => {
            const v = STATUS_META[k]
            return <span key={k} className="ml-st"><i style={{ background: v.color, borderColor: v.color, borderStyle: v.dashed ? 'dashed' : 'solid' }} />{v.label}</span>
          })}
        </div>
      </div>

      {loading && <div className="map-overlay"><div className="spinner" /><span>지도 데이터 불러오는 중…</span></div>}
    </div>
  )
}
