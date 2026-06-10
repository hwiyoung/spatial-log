/* SAMS Explorer — interactive Asset Map: CARTO dark raster basemap + pan/wheel-zoom, glyph markers, clustering, relation overlay */
(function () {
const { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } = React;

/* ---- category glyphs: SHAPE only (never status color) ---- */
function CategoryGlyph({ cat, s = 16 }) {
  const sw = 1.6, c = 'currentColor';
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round' };
  switch ((window.SAMS.CAT[cat] || {}).shape) {
    case 'pointcloud': return (<svg {...common}>{[[7,7],[12,6],[17,8],[6,13],[12,12],[18,14],[9,18],[15,17]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.05" fill={c} stroke="none"/>)}</svg>);
    case 'model': return (<svg {...common}><path d="M12 4 L20 18 L4 18 Z"/><path d="M12 4 L12 18 M7 13 L17 13"/></svg>);
    case 'tiles': return (<svg {...common}><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>);
    case 'ortho': return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 14 L10 9 L14 13 L20 8"/><path d="M4 18 L9 15 L13 18"/></svg>);
    case 'image': return (<svg {...common}><rect x="4" y="6" width="16" height="12" rx="1.5"/><circle cx="9" cy="11" r="1.6"/><path d="M5 17 L11 12 L15 15 L19 11"/></svg>);
    case 'pano': return (<svg {...common}><ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M12 6 C8 9 8 15 12 18 M12 6 C16 9 16 15 12 18 M3.4 12 H20.6"/></svg>);
    case 'video': return (<svg {...common}><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M10 9.5 L14.5 12 L10 14.5 Z" fill={c} stroke="none"/></svg>);
    case 'doc': return (<svg {...common}><path d="M7 3 H14 L18 7 V21 H7 Z"/><path d="M14 3 V7 H18 M9.5 12 H15.5 M9.5 15 H15.5 M9.5 18 H13"/></svg>);
    default: return (<svg {...common}><circle cx="12" cy="12" r="8"/></svg>);
  }
}

/* ---- web mercator ---- */
const TILE = 256;
const SUBS = ['a', 'b', 'c', 'd'];
const lon2tx = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
const lat2ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
const tx2lon = (tx, z) => tx / Math.pow(2, z) * 360 - 180;
const ty2lat = (ty, z) => { const n = Math.PI - 2 * Math.PI * ty / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
const clampZ = (z) => Math.max(2, Math.min(19, z));

function project2d(lon, lat, cam, W, H) {
  const cx = lon2tx(cam.lon, cam.zoom) * TILE, cy = lat2ty(cam.lat, cam.zoom) * TILE;
  return { x: W / 2 + (lon2tx(lon, cam.zoom) * TILE - cx), y: H / 2 + (lat2ty(lat, cam.zoom) * TILE - cy) };
}
function unproject2d(px, py, cam, W, H) {
  const cx = lon2tx(cam.lon, cam.zoom) * TILE, cy = lat2ty(cam.lat, cam.zoom) * TILE;
  return { lon: tx2lon((cx + px - W / 2) / TILE, cam.zoom), lat: ty2lat((cy + py - H / 2) / TILE, cam.zoom) };
}
function visibleBounds(cam, W, H) {
  const tl = unproject2d(0, 0, cam, W, H), br = unproject2d(W, H, cam, W, H);
  return { minLon: tl.lon, maxLon: br.lon, minLat: br.lat, maxLat: tl.lat };
}
function fitView(items, W, H) {
  const pts = items.filter(p => p.lon != null);
  if (!pts.length || !W || !H) return { lon: 127.7, lat: 36.3, zoom: 6 };
  let minLon = 1e9, minLat = 1e9, maxLon = -1e9, maxLat = -1e9;
  pts.forEach(p => { minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon); minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); });
  let spanX = Math.max(lon2tx(maxLon, 0) - lon2tx(minLon, 0), 6e-5);
  let spanY = Math.max(lat2ty(minLat, 0) - lat2ty(maxLat, 0), 6e-5);
  const zoom = clampZ(Math.min(Math.log2(W * 0.82 / (spanX * TILE)), Math.log2(H * 0.82 / (spanY * TILE))));
  return { lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2, zoom: Math.min(zoom, 17) };
}

/* pseudo-3D projection over current visible bounds (no basemap) */
function makeProject3d(bounds, W, H) {
  const pad = 30, cx = W / 2, topM = H * 0.13, groundH = H * 0.70, innerW = W - pad * 2;
  return (lon, lat, elev) => {
    const nx = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
    const ny = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    const gy = 1 - ny, scale = 0.42 + 0.58 * gy;
    const lift = elev != null ? Math.max(-26, Math.min(40, elev * 2.2)) : 0;
    return { x: cx + (nx - 0.5) * innerW * scale, y: topM + gy * groundH - lift, gy, scale, groundY: topM + gy * groundH };
  };
}

function niceStep(span) {
  const raw = span / 5; const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow; const n = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; return n * pow;
}

function AssetMap(props) {
  const { items, visibleIds, selectedId, onSelect, mode, showRelations, loading, emptyKind, fitKey, onBounds } = props;
  const S = window.SAMS;
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [cam, setCam] = useState({ lon: 127.7, lat: 36.3, zoom: 6 });
  const camRef = useRef(cam); camRef.current = cam;
  const sizeRef = useRef(size); sizeRef.current = size;

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const W = size.w, H = size.h;
  const positioned = useMemo(() => items.filter(it => it.lon != null), [items]);
  const posRef = useRef(positioned); posRef.current = positioned;

  // auto-fit on filter/size change
  useEffect(() => { const v = fitView(posRef.current, W, H); setCam(v); }, [fitKey, W, H]);

  // report visible bounds up (for spatial bbox filter)
  useEffect(() => { if (onBounds) onBounds(visibleBounds(cam, W, H)); }, [cam, W, H, onBounds]);

  const bounds = useMemo(() => visibleBounds(cam, W, H), [cam, W, H]);
  const project = useCallback((lon, lat, elev) => mode === '3d' ? makeProject3d(bounds, W, H)(lon, lat, elev) : project2d(lon, lat, cam, W, H), [mode, bounds, cam, W, H]);

  // ---- tiles (2D only) ----
  const tiles = useMemo(() => {
    if (mode !== '2d' || !W || !H) return [];
    const tz = clampZ(Math.round(cam.zoom)), scale = Math.pow(2, cam.zoom - tz), tpx = TILE * scale, n = Math.pow(2, tz);
    const cTx = lon2tx(cam.lon, tz), cTy = lat2ty(cam.lat, tz);
    const nx = Math.ceil(W / tpx / 2) + 1, ny = Math.ceil(H / tpx / 2) + 1;
    const out = [];
    for (let tx = Math.floor(cTx) - nx; tx <= Math.floor(cTx) + nx; tx++)
      for (let ty = Math.floor(cTy) - ny; ty <= Math.floor(cTy) + ny; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        out.push({ key: tz + '/' + wx + '/' + ty, left: W / 2 + (tx - cTx) * tpx, top: H / 2 + (ty - cTy) * tpx, size: tpx,
          url: 'https://' + SUBS[(wx + ty) % 4] + '.basemaps.cartocdn.com/dark_nolabels/' + tz + '/' + wx + '/' + ty + '.png' });
      }
    return out;
  }, [mode, cam, W, H]);

  // ---- clustering ----
  const { clusters, singles } = useMemo(() => {
    const R = 34;
    const pts = positioned.map(it => ({ it, p: project(it.lon, it.lat, it.elev) }))
      .filter(o => o.p.x > -40 && o.p.x < W + 40 && o.p.y > -40 && o.p.y < H + 40);
    const used = new Array(pts.length).fill(false), cl = [];
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue; used[i] = true; const g = [pts[i]];
      for (let j = i + 1; j < pts.length; j++) { if (used[j]) continue; const dx = pts[i].p.x - pts[j].p.x, dy = pts[i].p.y - pts[j].p.y; if (dx * dx + dy * dy < R * R) { used[j] = true; g.push(pts[j]); } }
      cl.push(g);
    }
    return { clusters: cl.filter(g => g.length > 1), singles: cl.filter(g => g.length === 1).map(g => g[0]) };
  }, [positioned, project, W, H]);

  const selected = selectedId ? S.BY_ID[selectedId] : null;
  const selPos = selected && selected.lon != null ? project(selected.lon, selected.lat, selected.elev) : null;
  const relLines = useMemo(() => {
    if (!selected || !showRelations || !selPos) return [];
    return (selected.rel || []).map(r => {
      const tgt = S.BY_ID[r.target], known = tgt && tgt.lon != null, inResult = tgt && visibleIds.has(tgt.id);
      return { r, tgt, p: known ? project(tgt.lon, tgt.lat, tgt.elev) : null, warn: r.missing || !tgt || !inResult, missingTarget: r.missing || !tgt, outOfResult: tgt && !inResult && !r.missing };
    });
  }, [selected, showRelations, selPos, project, visibleIds]);

  // graticule (only when no tiles / 3d)
  const grid = useMemo(() => {
    if (mode === '2d') return { xs: [], ys: [] };
    const sx = niceStep(bounds.maxLon - bounds.minLon), sy = niceStep(bounds.maxLat - bounds.minLat), xs = [], ys = [];
    for (let lon = Math.ceil(bounds.minLon / sx) * sx; lon < bounds.maxLon; lon += sx) xs.push(lon);
    for (let lat = Math.ceil(bounds.minLat / sy) * sy; lat < bounds.maxLat; lat += sy) ys.push(lat);
    return { xs, ys };
  }, [mode, bounds]);

  const regions = useMemo(() => {
    const g = {};
    positioned.forEach(it => { (g[it.col] = g[it.col] || []).push(it); });
    return Object.entries(g).filter(([k]) => k !== 'unassigned-inbox').map(([col, list]) => {
      const lon = list.reduce((a, b) => a + b.lon, 0) / list.length, lat = list.reduce((a, b) => a + b.lat, 0) / list.length;
      const p = project(lon, lat); return { col, name: S.COL_SHORT[col], x: p.x, y: p.y };
    });
  }, [positioned, project]);

  // ---- interactions ----
  const drag = useRef(null);
  function onDown(e) {
    if (e.target.closest('[data-ctl]') || e.target.closest('[data-marker]')) return;
    drag.current = { mx: e.clientX, my: e.clientY, cam: camRef.current, moved: false };
  }
  function onMove(e) {
    if (!drag.current) return;
    const b = drag.current.cam, dx = e.clientX - drag.current.mx, dy = e.clientY - drag.current.my;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    const cx = lon2tx(b.lon, b.zoom) * TILE - dx, cy = lat2ty(b.lat, b.zoom) * TILE - dy;
    setCam({ lon: tx2lon(cx / TILE, b.zoom), lat: ty2lat(cy / TILE, b.zoom), zoom: b.zoom });
  }
  function onUp() { drag.current = null; }

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top;
      setCam(prev => {
        const Wc = sizeRef.current.w, Hc = sizeRef.current.h;
        const before = unproject2d(px, py, prev, Wc, Hc);
        const zoom = clampZ(prev.zoom - e.deltaY * 0.0019);
        const ncx = lon2tx(before.lon, zoom) * TILE - (px - Wc / 2), ncy = lat2ty(before.lat, zoom) * TILE - (py - Hc / 2);
        return { lon: tx2lon(ncx / TILE, zoom), lat: ty2lat(ncy / TILE, zoom), zoom };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBtn = (d) => setCam(prev => ({ ...prev, zoom: clampZ(prev.zoom + d) }));
  const fit = () => setCam(fitView(posRef.current.length ? posRef.current : items, W, H));
  const statusColor = (it) => S.STATUS[it.status].color;
  const showEmpty = emptyKind === 'none';

  return (
    <div ref={wrapRef} className="map-root" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      style={{ cursor: drag.current ? 'grabbing' : 'grab' }}>

      {/* basemap tiles */}
      {mode === '2d' && <div className="map-tiles">
        {tiles.map(t => <img key={t.key} src={t.url} className="map-tile" alt="" draggable="false"
          style={{ left: t.left, top: t.top, width: t.size, height: t.size }} onError={(e) => { e.target.style.visibility = 'hidden'; }} />)}
      </div>}
      {mode === '2d' && <div className="map-tint" />}

      <div className={'map-plane ' + (mode === '3d' ? 'is3d' : '')}>
        <svg width={W} height={H} className="map-svg">
          {grid.xs.map((lon, i) => { const a = project(lon, bounds.minLat), b = project(lon, bounds.maxLat); return <line key={'x'+i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="grat" />; })}
          {grid.ys.map((lat, i) => { const a = project(bounds.minLon, lat), b = project(bounds.maxLon, lat); return <line key={'y'+i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="grat" />; })}
          {relLines.map((rl, i) => (rl.p && selPos) ? (
            <g key={i}>
              <line x1={selPos.x} y1={selPos.y} x2={rl.p.x} y2={rl.p.y} className={'rel-line ' + (rl.warn ? 'warn' : '')} />
              <text x={(selPos.x + rl.p.x) / 2} y={(selPos.y + rl.p.y) / 2 - 4} className="rel-tag">{rl.r.rel}</text>
            </g>) : null)}
        </svg>

        {regions.map((r, i) => <div key={i} className="region-label" style={{ left: r.x, top: r.y - 30 }}>◎ {r.name}</div>)}

        {clusters.map((g, i) => {
          const cx = g.reduce((a, o) => a + o.p.x, 0) / g.length, cy = g.reduce((a, o) => a + o.p.y, 0) / g.length;
          const hasDraft = g.some(o => o.it.status === 'draft'), hasFail = g.some(o => o.it.preview === 'failed');
          const sz = Math.min(54, 30 + Math.log2(g.length) * 6);
          return (
            <div key={'c'+i} data-marker data-ctl className="cluster" style={{ left: cx, top: cy, width: sz, height: sz }}
              onClick={() => setCam(fitView(g.map(o => o.it), W, H))}>
              <span className="cluster-n">{g.length > 999 ? (g.length/1000).toFixed(1)+'k' : g.length}</span>
              {(hasDraft || hasFail) && <span className="cluster-dot" style={{ background: hasFail ? '#F87171' : '#FBBF24' }} />}
            </div>
          );
        })}

        {singles.map((o) => {
          const it = o.it, sel = it.id === selectedId;
          const dimmed = selectedId && !sel && showRelations && !(selected && (selected.rel || []).some(r => r.target === it.id));
          return (
            <div key={it.id} data-marker className={'marker ' + (sel ? 'sel ' : '') + (it.src === 'fallback' ? 'fb ' : '') + (it.status === 'unknown' ? 'unk ' : '')}
              style={{ left: o.p.x, top: o.p.y, borderColor: statusColor(it), opacity: dimmed ? 0.35 : 1, zIndex: sel ? 30 : 12 }}
              title={it.name} onClick={(e) => { e.stopPropagation(); onSelect(it.id); }}>
              <span className="marker-glyph"><CategoryGlyph cat={it.cat} s={15} /></span>
              <span className="marker-dot" style={{ background: statusColor(it) }} />
              {mode === '3d' && it.elev != null && <span className="marker-stem" style={{ height: Math.max(4, Math.min(40, it.elev * 2.2)) }} />}
            </div>
          );
        })}
      </div>

      {selected && showRelations && relLines.some(rl => rl.outOfResult || rl.missingTarget) && (
        <div className="map-warnbar">⚠ 선택 Item의 관계 대상 {relLines.filter(rl => rl.outOfResult || rl.missingTarget).length}건이 현재 결과 밖이거나 존재하지 않습니다</div>
      )}

      <div className="map-modetag" data-ctl>{mode === '3d' ? '3D GIS · beta' : '2D map · CARTO dark'}</div>
      <div className="map-ctls" data-ctl>
        <button onClick={fit} title="결과에 맞춤">⤢</button>
        <button onClick={() => zoomBtn(0.8)} title="확대">＋</button>
        <button onClick={() => zoomBtn(-0.8)} title="축소">－</button>
      </div>

      <div className="map-legend" data-ctl>
        <div className="ml-row"><span className="ml-h">category · 형태</span>{S.CAT_ORDER.map(c => <span key={c} className="ml-cat" title={S.CAT[c].ko}><CategoryGlyph cat={c} s={13} /></span>)}</div>
        <div className="ml-row"><span className="ml-h">status · 색</span>{Object.entries(S.STATUS).map(([k, v]) => <span key={k} className="ml-st"><i style={{ background: v.color, borderStyle: v.dashed ? 'dashed' : 'solid' }} />{v.label}</span>)}</div>
      </div>

      {loading && <div className="map-overlay"><div className="spinner" /><span>지도 데이터 불러오는 중…</span></div>}
      {showEmpty && !loading && <div className="map-overlay soft"><span className="oc-glyph">⊘</span><span>표시할 공간 marker가 없습니다</span><small>좌표가 없는 Item은 목록·Context Panel에서 확인하세요</small></div>}
    </div>
  );
}

Object.assign(window, { AssetMap, CategoryGlyph });
})();
