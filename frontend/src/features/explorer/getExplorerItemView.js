/**
 * STAC Item → Explorer 디자인 표시 필드 매핑.
 * 디자인 mock(it.cat/name/file/status/dt/size/preview/src/lon/lat/miss/gaps/draftReason…)을
 * 실제 STAC item 속성으로 환원한다. 실데이터·mock 모두 동일하게 동작.
 */
import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import { getDisplayLabel, getOriginalFilename } from '../items/getDisplayLabel.js'
import { getItemStatus } from '../items/getItemStatus.js'
import { getProjectContext } from '../items/getProjectContext.js'
import { normalizePreviewStatus } from '../items/getItemPreviewSummary.js'

export function getExplorerItemView(item, collections = []) {
  const props = item?.properties || {}
  const pos = getItemMapPosition(item)
  const project = getProjectContext(item, collections)
  return {
    id: item?.id || null,
    collection: item?.collection || null,
    cat: props.data_category || 'unknown',
    name: getDisplayLabel(item),
    file: getOriginalFilename(item) || item?.id || '',
    status: getItemStatus(item),
    dt: typeof props.datetime === 'string' ? props.datetime.slice(0, 10) : '',
    size: props['file:size'] ?? null,
    preview: normalizePreviewStatus(props.previewStatus),
    previewFail: props.previewFailureReason || null,
    src: pos ? pos.source : 'none',
    lon: pos ? pos.position[0] : null,
    lat: pos ? pos.position[1] : null,
    hasExtent: Boolean(item?.bbox) || Boolean(item?.geometry),
    elev: props.elevation ?? null,
    epsg: props['proj:epsg'] ? 'EPSG:' + props['proj:epsg'] : null,
    miss: props.missingRequiredFields || [],
    gaps: props.metadataGaps || [],
    draftReason: props.draftReason || null,
    projectName: project.projectName,
    projectSite: project.projectSite,
    isUnassigned: project.isUnassigned,
    thumbnailHref: item?.assets?.thumbnail?.href || null,
  }
}

const STATUS_RANK = { draft: 0, published: 1, archived: 2, unknown: 3 }

// 디자인 SORTS 와 동일: 최신순 / 이름순 / 상태순 / 용량순
export const EXPLORER_SORTS = {
  recent: (a, b) => String(b.dt).localeCompare(String(a.dt)),
  name: (a, b) => String(a.name).localeCompare(String(b.name), 'ko'),
  status: (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9),
  size: (a, b) => (b.size || 0) - (a.size || 0),
}
