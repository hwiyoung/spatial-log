export const ITEM_STATUSES = ['draft', 'published', 'archived', 'unknown']

export const STATUS_INFO = {
  draft: {
    label: 'Draft',
    color: 'var(--warn)',
    markerColor: '#FBBF24',
    background: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.35)',
  },
  published: {
    label: 'Published',
    color: 'var(--ok)',
    markerColor: '#34D399',
    background: 'rgba(52,211,153,0.10)',
    border: 'rgba(52,211,153,0.28)',
  },
  archived: {
    label: 'Archived',
    color: 'var(--t3)',
    markerColor: '#64748B',
    background: 'rgba(100,116,139,0.14)',
    border: 'rgba(100,116,139,0.30)',
  },
  unknown: {
    label: 'Unknown',
    color: '#6B7280',
    markerColor: '#6B7280',
    background: 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.26)',
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
