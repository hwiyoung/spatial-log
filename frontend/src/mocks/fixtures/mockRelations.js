import { mockItems } from './mockItems.js'

export const relationRels = ['derived_from', 'related', 'describedby', 'describes', 'prev', 'next']

function parseTarget(href) {
  const parts = href.split('/').filter(Boolean)
  const collectionsIndex = parts.indexOf('collections')
  const itemsIndex = parts.indexOf('items')
  if (collectionsIndex < 0 || itemsIndex < 0) return { collectionId: null, itemId: null }
  return {
    collectionId: parts[collectionsIndex + 1] || null,
    itemId: parts[itemsIndex + 1] || null,
  }
}

export const mockRelations = mockItems.flatMap(item => (
  (item.links || [])
    .filter(link => relationRels.includes(link.rel))
    .map(link => {
      const target = parseTarget(link.href)
      const targetItem = mockItems.find(candidate => candidate.id === target.itemId)
      return {
        sourceId: item.id,
        sourceCollectionId: item.collection,
        rel: link.rel,
        targetId: target.itemId,
        targetCollectionId: target.collectionId,
        title: link.title || target.itemId,
        href: link.href,
        missingTarget: !targetItem,
      }
    })
))

export function getMockRelationsForItem(itemId) {
  return mockRelations.filter(relation => relation.sourceId === itemId || relation.targetId === itemId)
}
