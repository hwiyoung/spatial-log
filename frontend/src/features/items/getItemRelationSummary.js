export const RELATION_RELS = ['derived_from', 'related', 'describedby', 'describes', 'prev', 'next']

function parseTarget(href) {
  const parts = String(href || '').split('/').filter(Boolean)
  const collectionsIndex = parts.indexOf('collections')
  const itemsIndex = parts.indexOf('items')
  if (collectionsIndex < 0 || itemsIndex < 0) return { collectionId: null, itemId: null }
  return {
    collectionId: parts[collectionsIndex + 1] || null,
    itemId: parts[itemsIndex + 1] || null,
  }
}

function relationsFromLinks(item) {
  return (item?.links || [])
    .filter(link => RELATION_RELS.includes(link.rel))
    .map(link => {
      const target = parseTarget(link.href)
      return {
        sourceId: item.id,
        sourceCollectionId: item.collection,
        rel: link.rel,
        targetId: target.itemId,
        targetCollectionId: target.collectionId,
        title: link.title || target.itemId || link.href,
        href: link.href,
        missingTarget: false,
      }
    })
}

function emptyCounts() {
  return RELATION_RELS.reduce((counts, rel) => {
    counts[rel] = 0
    return counts
  }, {})
}

export function getItemRelationSummary(item, relationRecords = []) {
  const itemId = item?.id
  const sourceRelations = relationRecords.length > 0
    ? relationRecords.filter(relation => relation.sourceId === itemId || relation.targetId === itemId)
    : relationsFromLinks(item)

  const counts = emptyCounts()
  const missingTargetIds = new Set(item?.properties?.['mock:missingRelationTargets'] || [])

  sourceRelations.forEach(relation => {
    if (RELATION_RELS.includes(relation.rel)) {
      counts[relation.rel] += 1
    }
    if (relation.missingTarget && relation.targetId) {
      missingTargetIds.add(relation.targetId)
    }
  })

  return {
    total: sourceRelations.length,
    counts,
    records: sourceRelations,
    missingTargetIds: [...missingTargetIds],
    missingTargetCount: missingTargetIds.size,
  }
}
