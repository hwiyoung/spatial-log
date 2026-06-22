/**
 * buildDetailMetadata — STAC Item → provenance 구분 메타데이터 그룹.
 *
 * `design-reference/project/detail/build.jsx` 의 buildMetadata 를 실제 STAC 속성과
 * getExplorerItemView 결과에 맞춰 환원한다. provenance 는 필드 성격으로 분류한다:
 *   auto   = 파이프라인 자동 추출 (파일명·크기·취득일·좌표·유형별 속성)
 *   manual = 사용자 입력 (표시 이름·제목·프로젝트·상태)
 *   needed = 필수인데 비어 있음 (missingRequiredFields)
 *
 * Spatial 그룹은 Spatial 섹션에서 미니맵과 함께 렌더하므로 메타데이터 그리드에서는 제외한다.
 */
import { getCategoryInfo, formatSize } from '../../constants'
import { SPATIAL_LABEL } from '../explorer/explorerMeta'

const EXTRA_LABEL = {
  'pc:count': '포인트 수',
  'proj:epsg': '좌표계 (EPSG)',
  'model:format': '모델 포맷',
  'raster:gsd': '해상도 (GSD)',
  gsd: '해상도 (GSD)',
  acq_height: '촬영 고도',
  'image:count': '이미지 수',
  camera: '카메라',
  'video:duration': '재생 시간',
}

// Identity/Project/Spatial/System 으로 이미 표시되는 키 — Type-specific 후보에서 제외
const SHOWN_KEYS = new Set([
  'title', 'description', 'display_name', 'datetime', 'data_category',
  'file:name', 'file:size', 'status', 'sams:status', 'created', 'updated',
  'proj:bbox', 'proj:geometry', 'proj:centroid', 'elevation',
])
const EXTRA_NONCOLON = ['gsd', 'camera', 'acq_height']

const fmtNum = (v) => (typeof v === 'number' ? v.toLocaleString() : v)

function isTypeSpecificKey(key) {
  if (SHOWN_KEYS.has(key)) return false
  if (key.startsWith('project:') || key.startsWith('sams:') || key.startsWith('mock:')) return false
  return key.includes(':') || EXTRA_NONCOLON.includes(key)
}

export function buildDetailMetadata(item, view) {
  const props = item?.properties || {}
  const rows = []
  const add = (group, k, label, value, prov, opt = {}) => rows.push({ group, k, label, value, prov, ...opt })
  const missing = view.miss || []
  const isMissing = (k) => missing.includes(k)

  // ── Identity ──
  add('Identity', 'display_name', '표시 이름', view.name, 'manual')
  add('Identity', 'title', '제목', props.title || '—', props.title ? 'manual' : 'needed')
  add('Identity', 'file:name', '원본 파일명', view.file, 'auto', { mono: true })
  add('Identity', 'id', 'Item ID', view.id, 'auto', { mono: true })
  add('Identity', 'file:size', '파일 크기', formatSize(view.size), 'auto')
  add('Identity', 'data_category', '데이터 유형', getCategoryInfo(view.cat).label, 'auto', { glyph: view.cat })
  if (view.dt) add('Identity', 'datetime', '취득 일시', view.dt, 'auto')

  // ── Project ──
  const projKnown = !view.isUnassigned && !isMissing('project:name')
  add('Project', 'project:name', '프로젝트', projKnown ? view.projectName : '미할당', projKnown ? 'manual' : 'needed')
  const siteKnown = view.projectSite && view.projectSite !== '미할당' && !isMissing('project:site')
  add('Project', 'project:site', '사이트', siteKnown ? view.projectSite : '—', siteKnown ? 'manual' : 'needed')
  // target(시계열 그룹핑 키)은 선택 필드 — 비어 있어도 백엔드가 필수로 표시한 경우에만 'needed'.
  const targetProv = props.target ? 'manual' : (isMissing('target') ? 'needed' : 'manual')
  add('Project', 'target', '대상(target)', props.target || '—', targetProv)
  add('Project', 'status', '상태', view.status, 'manual', { status: view.status })
  if (view.collection) add('Project', 'collection', 'Collection', view.collection, 'auto', { mono: true })

  // ── Spatial (Spatial 섹션에서 렌더) ──
  add('Spatial', 'spatial:source', '위치 근거', SPATIAL_LABEL[view.src] || SPATIAL_LABEL.none, view.src === 'none' ? 'needed' : 'auto')
  if (view.lon != null) add('Spatial', 'center', 'Center (lon,lat)', `${view.lon.toFixed(4)}, ${view.lat.toFixed(4)}`, 'auto', { mono: true })
  else add('Spatial', 'center', 'Center', '좌표 없음', 'needed', { mono: true })
  if (Array.isArray(item?.bbox) && item.bbox.length >= 4) {
    add('Spatial', 'bbox', 'BBox / footprint', item.bbox.map(n => Number(n).toFixed(4)).join(', '), 'auto', { mono: true })
  }
  if (view.elev != null) add('Spatial', 'elevation', '고도(Z)', `${view.elev} m`, 'auto')

  // ── Type-specific (네임스페이스 속성) ──
  Object.keys(props).filter(isTypeSpecificKey).forEach((k) => {
    const raw = props[k]
    if (raw == null || raw === '') return
    const val = k === 'proj:epsg' ? String(raw) : fmtNum(raw)
    add('Type-specific', k, EXTRA_LABEL[k] || k, val, 'auto', { mono: !EXTRA_LABEL[k] || k === 'proj:epsg' })
  })

  // ── 필요 · 미입력 (아직 표시되지 않은 누락 필드) ──
  missing.forEach((m) => {
    if (rows.some(r => r.k === m)) return
    add('필요 · 미입력', m, m, '—', 'needed', { mono: true })
  })

  const groups = {}
  rows.forEach(r => { (groups[r.group] = groups[r.group] || []).push(r) })
  const counts = {
    auto: rows.filter(r => r.prov === 'auto').length,
    manual: rows.filter(r => r.prov === 'manual').length,
    needed: rows.filter(r => r.prov === 'needed').length,
  }
  const order = ['Identity', 'Project', 'Spatial', 'Type-specific', '필요 · 미입력'].filter(g => groups[g])
  return { groups, order, counts }
}
