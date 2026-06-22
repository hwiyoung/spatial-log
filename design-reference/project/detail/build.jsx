/* SAMS Detail — builders: metadata(provenance), assets, history, incoming relations */
(function () {
  const S = window.SAMS;

  const EXTRA_LABEL = {
    'pc:count': '포인트 수', 'proj:epsg': '좌표계 (EPSG)', 'model:format': '모델 포맷',
    'raster:gsd': '해상도 (GSD)', 'acq_height': '촬영 고도', 'image:count': '이미지 수',
    'camera': '카메라', 'video:duration': '재생 시간',
  };
  const fmtNum = (v) => typeof v === 'number' ? v.toLocaleString() : v;

  // ---- metadata with provenance: 'auto' | 'manual' | 'needed' ----
  function buildMetadata(item) {
    const col = S.collectionById(item.col);
    const rows = [];
    const add = (group, k, label, value, prov, opt = {}) => rows.push({ group, k, label, value, prov, ...opt });

    add('Identity', 'display_name', '표시 이름', item.name, 'manual');
    add('Identity', 'title', '제목', item.title || '—', item.title ? 'manual' : 'needed');
    add('Identity', 'file:name', '원본 파일명', item.file, 'auto', { mono: true });
    add('Identity', 'id', 'Item ID', item.id, 'auto', { mono: true });
    add('Identity', 'file:size', '파일 크기', S.formatSize(item.size), 'auto');
    add('Identity', 'data_category', '데이터 유형', S.CAT[item.cat].ko, 'auto', { glyph: item.cat });
    add('Identity', 'datetime', '취득 일시', item.dt, 'auto');

    const projKnown = item.col !== 'unassigned-inbox' && !(item.miss || []).includes('project:name');
    add('Project', 'project:name', '프로젝트', projKnown ? col.title : '미할당', projKnown ? 'manual' : 'needed');
    add('Project', 'project:site', '사이트', (item.miss || []).includes('project:site') ? '—' : col.site, (item.miss || []).includes('project:site') ? 'needed' : 'manual');
    add('Project', 'status', '상태', S.STATUS[item.status].label, 'manual', { status: item.status });
    add('Project', 'collection', 'Collection', item.col, 'auto', { mono: true });

    add('Spatial', 'spatial:source', '위치 근거', S.SPATIAL_LABEL[item.src], 'auto');
    if (item.lon != null) add('Spatial', 'center', 'Center (lon,lat)', item.lon.toFixed(4) + ', ' + item.lat.toFixed(4), 'auto', { mono: true });
    else add('Spatial', 'center', 'Center', '좌표 없음', 'needed', { mono: true });
    if (item.bbox) add('Spatial', 'bbox', 'BBox / footprint', item.bbox.map(n => n.toFixed(4)).join(', '), 'auto', { mono: true });
    if (item.elev != null) add('Spatial', 'elevation', '고도(Z)', item.elev + ' m', 'auto');

    const extra = item.extra || {};
    Object.keys(extra).forEach(k => {
      const val = k === 'proj:epsg' ? String(extra[k]) : fmtNum(extra[k]); // EPSG is an identifier — no thousands comma
      add('Type-specific', k, EXTRA_LABEL[k] || k, val, 'auto', { mono: !EXTRA_LABEL[k] || k === 'proj:epsg' });
    });

    (item.miss || []).forEach(m => {
      if (rows.some(r => r.k === m)) return;
      add('필요 · 미입력', m, m, '—', 'needed', { mono: true });
    });

    const groups = {};
    rows.forEach(r => { (groups[r.group] = groups[r.group] || []).push(r); });
    const counts = { auto: rows.filter(r => r.prov === 'auto').length, manual: rows.filter(r => r.prov === 'manual').length, needed: rows.filter(r => r.prov === 'needed').length };
    return { groups, order: ['Identity', 'Project', 'Spatial', 'Type-specific', '필요 · 미입력'].filter(g => groups[g]), counts };
  }

  // ---- assets ----
  const PREVIEW_TYPE = {
    pointcloud: 'thumbnail → point cloud viewer', '3d_model': 'screenshot → model viewer',
    '3d_tiles': 'tileset placeholder → 3D Tiles', orthoimage: 'tiled image / GeoTIFF',
    image: 'image slideshow', panorama: 'panorama viewer', video: 'poster → video', document: 'PDF pages',
  };
  function buildAssets(item) {
    return [
      { key: 'original', role: 'data', label: '원본 (original)', name: item.file, size: S.formatSize(item.size), status: 'stored', note: null },
      { key: 'preview', role: 'preview', label: 'Preview', name: PREVIEW_TYPE[item.cat], size: '—', status: item.preview, note: item.previewFail || null },
      { key: 'download', role: 'download', label: 'Download / Export', name: '원본 다운로드 · 메타데이터(JSON)', size: S.formatSize(item.size), status: item.status === 'archived' ? 'restricted' : 'ready', note: item.status === 'archived' ? 'Archived — 복원 후 다운로드' : null },
    ];
  }

  // ---- relations ----
  // describedby<->describes and prev<->next are inverse pairs; related is symmetric.
  // We store ONE direction (owner side) and DERIVE the reverse for display.
  const INV = { describedby: 'describes', describes: 'describedby', related: 'related' };
  const ROLE = { derived_from: '가공본 · 이 Item에서 파생', describes: '설명 대상', describedby: '설명 문서', related: '관련/동시취득' };

  // raw incoming: other items whose rel points AT this item (excl. prev/next)
  function incomingRelations(item) {
    const res = [];
    S.ITEMS.forEach(src => {
      (src.rel || []).forEach(r => {
        if (r.target === item.id && !['prev', 'next'].includes(r.rel)) res.push({ sourceId: src.id, sourceItem: src, rel: r.rel });
      });
    });
    return res;
  }

  // derived incoming for display: convert each incoming edge to THIS item's relationship
  // (inverse), and drop any that the owner side already stores as an outgoing relation.
  function deriveIncoming(item, outRels) {
    const outSet = new Set((outRels || []).map(r => r.rel + '|' + r.target));
    const seen = new Set();
    const res = [];
    incomingRelations(item).forEach(r => {
      const displayRel = INV[r.rel] || r.rel; // derived_from keeps its name (no inverse term)
      if ((displayRel in INV) && outSet.has(displayRel + '|' + r.sourceId)) return; // already owned outgoing
      const key = displayRel + '|' + r.sourceId;
      if (seen.has(key)) return; seen.add(key);
      res.push({ sourceId: r.sourceId, sourceItem: r.sourceItem, rel: displayRel, role: ROLE[displayRel] || displayRel });
    });
    return res;
  }

  // ---- history (synthesized, deterministic-ish) ----
  function addDays(dt, d) {
    const date = new Date(dt + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + d);
    return date.toISOString().slice(0, 10);
  }
  const ACTORS = ['현장 담당자 · 이수집', '후처리 · 정가공', 'PM · 김프로', '시스템'];
  function buildHistory(item) {
    const h = [];
    h.push({ date: item.dt, type: 'register', actor: ACTORS[0], text: 'Draft로 등록 · 자동 분류 → ' + S.CAT[item.cat].ko });
    if (item.col === 'unassigned-inbox')
      h.push({ date: addDays(item.dt, 0), type: 'assign', actor: ACTORS[3], text: 'Unassigned Inbox 수용 · 프로젝트 미할당', warn: true });
    else
      h.push({ date: addDays(item.dt, 1), type: 'assign', actor: ACTORS[2], text: S.collectionById(item.col).title + ' 프로젝트에 연결' });

    if (item.preview === 'failed') h.push({ date: addDays(item.dt, 2), type: 'preview', actor: ACTORS[3], text: 'preview 생성 실패 · ' + (item.previewFail || ''), warn: true });
    else if (item.preview === 'available') h.push({ date: addDays(item.dt, 1), type: 'preview', actor: ACTORS[3], text: 'preview 생성 완료' });
    else if (item.preview === 'pending') h.push({ date: addDays(item.dt, 1), type: 'preview', actor: ACTORS[3], text: 'preview 변환 대기열 등록' });

    if (/v\d+\./.test(item.file)) h.push({ date: addDays(item.dt, 4), type: 'file', actor: ACTORS[1], text: '원본 파일 교체 (이전 버전 → ' + item.file.match(/v\d+/)[0] + ')' });
    if ((item.miss || []).length) h.push({ date: addDays(item.dt, 5), type: 'meta', actor: ACTORS[1], text: '필수 필드 ' + item.miss.length + '건 누락 감지 — 보완 필요', warn: true });
    else h.push({ date: addDays(item.dt, 3), type: 'meta', actor: ACTORS[1], text: '메타데이터 검수 통과' });

    if (item.status === 'published') h.push({ date: addDays(item.dt, 6), type: 'status', actor: ACTORS[2], text: 'Published 전환 — 검색·재사용 가능' });
    if (item.status === 'archived') h.push({ date: addDays(item.dt, 30), type: 'status', actor: ACTORS[2], text: 'Archived 처리 — 보존 전환' });

    return h.sort((a, b) => b.date.localeCompare(a.date));
  }

  window.DETAIL = { buildMetadata, buildAssets, incomingRelations, deriveIncoming, buildHistory, PREVIEW_TYPE };
})();
