export const ITEM_STATUSES = ['draft', 'published', 'archived', 'unknown']

export const STATUS_INFO = {
  draft: {
    label: 'Draft',
    color: 'var(--warn)',
    markerColor: '#F0B42A',
    background: 'rgba(240,180,42,0.12)',
    border: 'rgba(240,180,42,0.35)',
  },
  published: {
    label: 'Published',
    color: 'var(--ok)',
    markerColor: '#3DD68C',
    background: 'rgba(61,214,140,0.10)',
    border: 'rgba(61,214,140,0.28)',
  },
  archived: {
    label: 'Archived',
    color: 'var(--t3)',
    markerColor: '#5C6478',
    background: 'rgba(92,100,120,0.14)',
    border: 'rgba(92,100,120,0.30)',
  },
  unknown: {
    label: 'Unknown',
    color: '#C8CEDA',
    markerColor: '#C8CEDA',
    background: 'rgba(200,206,218,0.10)',
    border: 'rgba(200,206,218,0.26)',
  },
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ITEM_STATUSES.includes(normalized) ? normalized : null
}

export function getItemStatus(item) {
  const props = item?.properties || {}
  return normalizeStatus(props.status)
    || normalizeStatus(props['sams:status'])
    || normalizeStatus(item?.status)
    || 'unknown'
}

export function getStatusInfo(status) {
  return STATUS_INFO[getItemStatus({ properties: { status } })] || STATUS_INFO.unknown
}
