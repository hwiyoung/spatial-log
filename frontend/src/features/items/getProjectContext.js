const UNASSIGNED_COLLECTION_IDS = new Set(['unassigned-inbox', 'inbox', 'unassigned'])
const UNASSIGNED_LABELS = new Set(['unassigned', 'unassigned inbox', '미할당'])

function firstNonEmpty(values) {
  return values.find(value => String(value || '').trim()) || null
}

function findCollection(collectionId, collections) {
  if (!collectionId || !Array.isArray(collections)) return null
  return collections.find(collection => collection?.id === collectionId) || null
}

function collectionName(collection) {
  return firstNonEmpty([
    collection?.title,
    collection?.name,
    collection?.properties?.['project:name'],
    collection?.properties?.project_name,
    collection?.id,
  ])
}

export function getProjectContext(item, collections = []) {
  const props = item?.properties || {}
  const collectionId = item?.collection || item?.collection_id || null
  const collection = findCollection(collectionId, collections)

  const projectName = firstNonEmpty([
    props['project:name'],
    props.project_name,
    collectionName(collection),
    collectionId,
    'Unassigned',
  ])

  const projectSite = firstNonEmpty([
    props['project:site'],
    props.project_site,
    collection?.properties?.['project:site'],
    collection?.properties?.project_site,
    'unknown',
  ])

  const normalizedName = String(projectName || '').trim().toLowerCase()
  const isUnassigned = UNASSIGNED_COLLECTION_IDS.has(String(collectionId || '').toLowerCase())
    || UNASSIGNED_LABELS.has(normalizedName)
    || !firstNonEmpty([props['project:name'], props.project_name, collectionName(collection), collectionId])

  return {
    projectName: isUnassigned ? 'Unassigned Inbox' : projectName,
    projectSite: isUnassigned && projectSite === 'unknown' ? '미할당' : projectSite,
    collectionId,
    isUnassigned,
  }
}
