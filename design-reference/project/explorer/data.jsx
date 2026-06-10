/* SAMS Explorer — mock data + domain helpers (faithful to frontend fixtures) */
(function () {
  // ---- collections (3 projects) ----
  const COLLECTIONS = [
    { id: 'seongsu-office-renovation', title: '성수동 오피스 리노베이션', site: '서울 성동구 성수동', client: '대성디벨롭먼트', pm: '김PM', period: '2024.02 – 2024.05', epsg: 'EPSG:5186', status: 'active' },
    { id: 'gyeongju-bulguksa-2024', title: '2024 경주 불국사 정밀실측', site: '경주 불국사', client: '국가유산청', pm: '박PM', period: '2024.03 – 2024.06', epsg: 'EPSG:5186', status: 'active' },
    { id: 'unassigned-inbox', title: 'Unassigned Inbox', site: '미할당', client: '—', pm: '—', period: '—', epsg: '—', status: 'system' },
  ];
  const COL_SHORT = {
    'seongsu-office-renovation': '성수 리노베이션',
    'gyeongju-bulguksa-2024': '불국사 실측',
    'unassigned-inbox': 'Unassigned',
  };

  // ---- categories: distinguished by GLYPH/SHAPE only (never color) ----
  const CAT = {
    pointcloud: { ko: '포인트클라우드', short: 'pointcloud', shape: 'pointcloud' },
    '3d_model': { ko: '3D 모델', short: '3d_model', shape: 'model' },
    '3d_tiles': { ko: '3D Tiles', short: '3d_tiles', shape: 'tiles' },
    orthoimage: { ko: '정사영상', short: 'orthoimage', shape: 'ortho' },
    image: { ko: '원본 이미지', short: 'image', shape: 'image' },
    panorama: { ko: '파노라마', short: 'panorama', shape: 'pano' },
    video: { ko: '동영상', short: 'video', shape: 'video' },
    document: { ko: '문헌정보', short: 'document', shape: 'doc' },
  };
  const CAT_ORDER = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document'];

  // ---- status: the ONLY color carrier ----
  const STATUS = {
    draft: { label: 'Draft', color: '#FBBF24' },
    published: { label: 'Published', color: '#34D399' },
    archived: { label: 'Archived', color: '#64748B' },
    unknown: { label: 'Unknown', color: '#6B7280', dashed: true },
  };

  const PREVIEW = {
    available: { label: 'available', color: '#34D399' },
    pending: { label: 'pending', color: '#FBBF24' },
    missing: { label: 'missing', color: '#5B6573' },
    failed: { label: 'failed', color: '#F87171' },
  };

  const REL_LABEL = {
    derived_from: 'derived_from', related: 'related', describedby: 'describedby',
    describes: 'describes', prev: 'prev', next: 'next',
  };

  // ---- 24 items ----
  // center = display location; src = geometry|bbox|fallback|none
  const I = (o) => o;
  const ITEMS = [
    I({ id:'seongsu-pc-basement-draft', col:'seongsu-office-renovation', name:'지하 기계실 LiDAR 스캔', title:'성수동 지하층 LiDAR 초안', file:'scan_20240218_areaB.laz', cat:'pointcloud', status:'draft', dt:'2024-02-18', size:2748779069, lon:127.05415, lat:37.54425, src:'geometry', bbox:[127.0536,37.5438,127.0547,37.5447], elev:-4.2, preview:'available', miss:['proj:epsg','pc:density'], gaps:['좌표계 확인 필요','스캔 장비명 미입력'], draftReason:'좌표계와 밀도 메타데이터가 누락됨', extra:{'pc:count':15230482}, rel:[] }),
    I({ id:'seongsu-model-lobby-bim', col:'seongsu-office-renovation', name:'1층 로비 리노베이션 BIM', title:'성수동 로비 BIM 모델', file:'lobby_model_final_v3.glb', cat:'3d_model', status:'published', dt:'2024-03-05', size:224395264, lon:127.05455, lat:37.5445, src:'bbox', bbox:[127.0542,37.5441,127.0549,37.5449], elev:5.8, preview:'pending', miss:[], gaps:[], extra:{'proj:epsg':5186,'model:format':'glb'}, rel:[{rel:'derived_from',target:'seongsu-pc-basement-draft',title:'지하 기계실 LiDAR 스캔'},{rel:'describedby',target:'seongsu-document-permit-draft',title:'리노베이션 인허가 메모'}] }),
    I({ id:'seongsu-tiles-shell-beta', col:'seongsu-office-renovation', name:'건물 외피 3D Tiles 변환본', title:'성수동 외피 3D Tiles Beta', file:'seongsu_shell_tileset.json', cat:'3d_tiles', status:'draft', dt:'2024-03-12', size:644245094, lon:127.05425, lat:37.54475, src:'geometry', bbox:[127.0528,37.5434,127.0557,37.5461], preview:'missing', miss:['tileset:root_geometric_error'], gaps:['3D Tiles 품질 검수 미완료'], draftReason:'tileset 메타데이터 검수 대기', rel:[{rel:'derived_from',target:'seongsu-model-lobby-bim',title:'1층 로비 리노베이션 BIM'}] }),
    I({ id:'seongsu-ortho-rooftop', col:'seongsu-office-renovation', name:'옥상 설비 배치 정사영상', title:'성수동 옥상 정사영상', file:'DJI_ortho_rooftop_20240402.tif', cat:'orthoimage', status:'published', dt:'2024-04-02', size:1369020825, lon:127.05415, lat:37.54485, src:'geometry', bbox:[127.0521,37.5432,127.0562,37.5465], preview:'available', miss:[], gaps:[], extra:{'proj:epsg':5186,'raster:gsd':'0.04m','acq_height':'82m'}, rel:[] }),
    I({ id:'seongsu-image-facade-set', col:'seongsu-office-renovation', name:'북측 파사드 보수 전 사진 42장', title:'성수동 외관 사진 세트', file:'IMG_renovation_facade_bundle.zip', cat:'image', status:'published', dt:'2024-04-05', size:734003200, lon:127.0543, lat:37.5451, src:'geometry', bbox:[127.0531,37.5447,127.0552,37.5456], preview:'available', miss:[], gaps:[], extra:{'image:count':42,'camera':'Sony A7R IV'}, rel:[{rel:'related',target:'seongsu-panorama-lobby',title:'로비 360 파노라마'}] }),
    I({ id:'seongsu-panorama-lobby', col:'seongsu-office-renovation', name:'로비 중앙 360도 파노라마', title:'성수동 로비 360 파노라마', file:'R0010142_er_missing_xmp.jpg', cat:'panorama', status:'draft', dt:'2024-04-05', size:50331648, lon:127.05415, lat:37.54424, src:'geometry', preview:'failed', previewFail:'Equirectangular metadata is missing.', miss:['panorama:projection'], gaps:['360도 projection 정보 누락'], draftReason:'파노라마 projection 메타데이터 확인 필요', rel:[] }),
    I({ id:'seongsu-video-safety', col:'seongsu-office-renovation', name:'철거 전 안전 동선 점검 영상', title:'성수동 안전 점검 영상', file:'safety_walkthrough_20240322.mp4', cat:'video', status:'archived', dt:'2024-03-22', size:4294967296, lon:127.05435, lat:37.54485, src:'bbox', bbox:[127.0529,37.5437,127.0558,37.5460], preview:'available', miss:[], gaps:[], extra:{'video:duration':'12:22'}, rel:[{rel:'prev',target:'seongsu-video-safety-2023',title:'2023 안전 점검 영상',missing:true}] }),
    I({ id:'seongsu-document-permit-draft', col:'seongsu-office-renovation', name:'구조 변경 인허가 검토 메모', title:'성수동 리노베이션 인허가 메모', file:'permit_notes_temp_name.pdf', cat:'document', status:'draft', dt:'2024-03-28', size:12582912, lon:127.0543, lat:37.5448, src:'fallback', preview:'missing', miss:['document:author','document:date'], gaps:['작성자 누락','문서 날짜 불명확'], draftReason:'필수 문서 메타데이터 누락', rel:[] }),

    I({ id:'bulguksa-pointcloud-dabotap', col:'gyeongju-bulguksa-2024', name:'다보탑 2024 LiDAR 스캔', title:'다보탑 LiDAR 정밀 스캔', file:'20240312_DBT_RTC360.las', cat:'pointcloud', status:'published', dt:'2024-03-12', size:5905580032, lon:129.3322, lat:35.7906, src:'geometry', bbox:[129.3318,35.7902,129.3326,35.7910], elev:11.5, preview:'available', miss:[], gaps:[], extra:{'pc:count':78451220,'proj:epsg':5186}, rel:[{rel:'prev',target:'bulguksa-pointcloud-dabotap-2022',title:'2022 다보탑 LiDAR 스캔',missing:true},{rel:'next',target:'bulguksa-pointcloud-dabotap-2026-plan',title:'2026 다보탑 후속 실측 예정',missing:true},{rel:'describedby',target:'bulguksa-document-precision-report',title:'불국사 정밀실측 보고서'}] }),
    I({ id:'bulguksa-model-dabotap-photogrammetry', col:'gyeongju-bulguksa-2024', name:'다보탑 고해상도 메시 초안', title:'다보탑 포토그래메트리 모델', file:'dabotap_mesh_textures_missing.obj', cat:'3d_model', status:'draft', dt:'2024-03-18', size:1503238553, lon:129.3322, lat:35.7906, src:'bbox', bbox:[129.3317,35.7901,129.3327,35.7911], preview:'failed', previewFail:'Texture atlas was not generated.', miss:['model:vertex_count','model:texture_status'], gaps:['텍스처 atlas 생성 실패'], draftReason:'모델 텍스처 실패로 preview failed 검수 필요', rel:[{rel:'derived_from',target:'bulguksa-pointcloud-dabotap',title:'다보탑 2024 LiDAR 스캔'}] }),
    I({ id:'bulguksa-tiles-site-context', col:'gyeongju-bulguksa-2024', name:'경내 주변 지형 3D Tiles', title:'불국사 경내 3D Tiles 문맥', file:'bulguksa_site_tileset.json', cat:'3d_tiles', status:'published', dt:'2024-04-01', size:2147483648, lon:129.33265, lat:35.7905, src:'geometry', bbox:[129.3296,35.7882,129.3357,35.7928], preview:'pending', miss:[], gaps:[], rel:[] }),
    I({ id:'bulguksa-ortho-main-zone', col:'gyeongju-bulguksa-2024', name:'불국사 경내 드론 정사영상', title:'불국사 주요 구역 정사영상', file:'bulguksa_ortho_main_4cm.tif', cat:'orthoimage', status:'published', dt:'2024-04-03', size:3221225472, lon:129.3326, lat:35.79045, src:'geometry', bbox:[129.3299,35.7885,129.3353,35.7924], preview:'available', miss:[], gaps:['미지원 TIFF preview (mock)'], extra:{'proj:epsg':5186,'raster:gsd':'0.04m'}, rel:[{rel:'related',target:'bulguksa-tiles-site-context',title:'경내 주변 지형 3D Tiles'}] }),
    I({ id:'bulguksa-image-drone-set', col:'gyeongju-bulguksa-2024', name:'경내 상공 촬영 원본 이미지 126장', title:'불국사 드론 원본 이미지', file:'bulguksa_drone_raw_126.zip', cat:'image', status:'draft', dt:'2024-04-03', size:9663676416, lon:129.3328, lat:35.7907, src:'geometry', bbox:[129.3301,35.7884,129.3352,35.7923], preview:'missing', miss:['image:gsd','image:camera_model'], gaps:['카메라 모델 자동 추출 실패'], draftReason:'촬영 장비/해상도 확인 필요', extra:{'image:count':126}, rel:[] }),
    I({ id:'bulguksa-panorama-main-hall', col:'gyeongju-bulguksa-2024', name:'대웅전 전면 360 파노라마', title:'대웅전 전면 파노라마', file:'main_hall_front_360.jpg', cat:'panorama', status:'published', dt:'2024-04-04', size:81788928, lon:129.33295, lat:35.79094, src:'geometry', preview:'available', miss:[], gaps:[], rel:[] }),
    I({ id:'bulguksa-video-survey-walkthrough', col:'gyeongju-bulguksa-2024', name:'석가탑-다보탑 동선 점검 영상', title:'불국사 현장 점검 영상', file:'walkthrough_codec_probe_fail.mov', cat:'video', status:'unknown', dt:'2024-04-06', size:2576980377, lon:129.33225, lat:35.7906, src:'bbox', bbox:[129.3310,35.7898,129.3335,35.7914], preview:'failed', previewFail:'Codec probe timed out.', miss:['video:duration','video:codec'], gaps:['코덱 분석 실패'], rel:[] }),
    I({ id:'bulguksa-document-precision-report', col:'gyeongju-bulguksa-2024', name:'2024 불국사 정밀실측 중간보고서', title:'불국사 정밀실측 보고서', file:'BGS_2024_interim_report.pdf', cat:'document', status:'published', dt:'2024-04-15', size:69206016, lon:129.3324, lat:35.7908, src:'fallback', preview:'available', miss:[], gaps:[], rel:[] }),

    I({ id:'inbox-pointcloud-unknown-scan', col:'unassigned-inbox', name:'프로젝트 미확인 포인트클라우드', title:'미분류 포인트클라우드', file:'scan_no_project_001.e57', cat:'pointcloud', status:'unknown', dt:'2024-05-02', size:1181116006, lon:127.0, lat:37.55, src:'fallback', preview:'pending', miss:['project:name','project:site','geometry','bbox'], gaps:['프로젝트 미할당','위치 추출 실패'], rel:[] }),
    I({ id:'inbox-model-damaged-obj', col:'unassigned-inbox', name:'변환 실패 OBJ 모델', title:'손상된 OBJ 모델', file:'broken_mesh_upload.obj', cat:'3d_model', status:'archived', dt:'2024-05-05', size:94371840, lon:126.9815, lat:37.5655, src:'bbox', bbox:[126.981,37.565,126.982,37.566], preview:'failed', previewFail:'Mesh file is incomplete.', miss:[], gaps:['파일 무결성 실패'], rel:[] }),
    I({ id:'inbox-tiles-test-area', col:'unassigned-inbox', name:'소속 미정 3D Tiles 샘플', title:'테스트 영역 3D Tiles', file:'test_area_tileset.json', cat:'3d_tiles', status:'unknown', dt:'2024-05-06', size:503316480, lon:127.0145, lat:37.504, src:'geometry', bbox:[127.011,37.501,127.018,37.507], preview:'available', miss:[], gaps:[], rel:[] }),
    I({ id:'inbox-ortho-no-site', col:'unassigned-inbox', name:'사이트명 없는 정사영상', title:'위치 미확인 정사영상', file:'ortho_without_site.tif', cat:'orthoimage', status:'draft', dt:'2024-05-07', size:1879048192, lon:127.12, lat:37.38, src:'fallback', preview:'missing', miss:['project:name','project:site','geometry'], gaps:['사이트명 없음','좌표계 검증 필요'], draftReason:'프로젝트/위치 필수값 누락', rel:[] }),
    I({ id:'inbox-image-field-photo', col:'unassigned-inbox', name:'업로드자 지정 이름 없는 현장 사진', title:'현장 사진 원본', file:'DSC00042.JPG', cat:'image', status:'draft', dt:'2024-05-07', size:13631488, lon:129.0001, lat:35.9001, src:'geometry', preview:'available', miss:['project:name'], gaps:['사람이 읽는 display name 필요'], draftReason:'프로젝트 배정 대기', rel:[{rel:'describedby',target:'inbox-document-contract-draft',title:'계약서 초안'}] }),
    I({ id:'inbox-panorama-room-raw', col:'unassigned-inbox', name:'실내 360도 원본', title:'미분류 실내 파노라마', file:'room_raw_360_pending.jpg', cat:'panorama', status:'published', dt:'2024-05-08', size:65011712, lon:127.21105, lat:37.30205, src:'geometry', preview:'pending', miss:[], gaps:['프로젝트 배정 필요'], rel:[] }),
    I({ id:'inbox-video-raw-mp4', col:'unassigned-inbox', name:'현장 기록 MP4', title:'미분류 동영상', file:'VID_20240509_134500.mp4', cat:'video', status:'unknown', dt:'2024-05-09', size:838860800, lon:128.8, lat:36.1, src:'fallback', preview:'missing', miss:['project:name','video:duration'], gaps:['프로젝트 미할당','영상 duration 추출 전'], rel:[] }),
    I({ id:'inbox-document-contract-draft', col:'unassigned-inbox', name:'프로젝트 미확인 계약서 초안', title:'계약서 초안', file:'contract_draft_text_extract_failed.pdf', cat:'document', status:'draft', dt:'2024-05-10', size:6291456, lon:127.0003, lat:37.5503, src:'fallback', preview:'failed', previewFail:'PDF text extraction failed.', miss:['project:name','document:date','document:author'], gaps:['텍스트 추출 실패','프로젝트 배정 필요'], draftReason:'문서 필수값과 프로젝트 배정 누락', rel:[{rel:'related',target:'inbox-document-outside-search',title:'검색 결과 밖 문서',missing:true}] }),
  ];

  const BY_ID = {}; ITEMS.forEach(it => { BY_ID[it.id] = it; });

  // ---- formatters ----
  function formatSize(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }
  function formatDate(s) { return s; }
  const SPATIAL_LABEL = {
    geometry: 'Geometry center', bbox: 'BBox center', fallback: 'Project fallback', none: 'No spatial marker',
  };

  // ---- relation summary (1-depth) ----
  function relationSummary(item) {
    const rels = item.rel || [];
    const counts = {};
    rels.forEach(r => { counts[r.rel] = (counts[r.rel] || 0) + 1; });
    const missing = rels.filter(r => r.missing);
    return { total: rels.length, counts, records: rels, missingCount: missing.length, missing };
  }

  // ---- geometry helpers ----
  function fitBounds(items) {
    const pts = items.filter(it => it.lon != null && it.lat != null);
    if (!pts.length) return { minLon: 126.7, minLat: 35.5, maxLon: 129.6, maxLat: 37.8 };
    let minLon = 1e9, minLat = 1e9, maxLon = -1e9, maxLat = -1e9;
    pts.forEach(p => {
      minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    });
    let dx = maxLon - minLon, dy = maxLat - minLat;
    if (dx < 0.004) { const c = (minLon + maxLon) / 2; minLon = c - 0.004; maxLon = c + 0.004; dx = 0.008; }
    if (dy < 0.004) { const c = (minLat + maxLat) / 2; minLat = c - 0.004; maxLat = c + 0.004; dy = 0.008; }
    const px = dx * 0.16, py = dy * 0.16;
    return { minLon: minLon - px, minLat: minLat - py, maxLon: maxLon + px, maxLat: maxLat + py };
  }

  window.SAMS = {
    COLLECTIONS, COL_SHORT, CAT, CAT_ORDER, STATUS, PREVIEW, REL_LABEL,
    ITEMS, BY_ID, formatSize, formatDate, SPATIAL_LABEL, relationSummary, fitBounds,
    collectionById: (id) => COLLECTIONS.find(c => c.id === id),
  };
})();
