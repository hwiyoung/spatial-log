import { SUPPORTED_RELATIONS } from './relationStyles.js'

export function getRelationDirection(relation, selectedItemId) {
  if (relation?.sourceId === selectedItemId) return 'outbound'
  if (relation?.targetId === selectedItemId) return 'inbound'
  return null
}

export function getRelatedItemId(relation, selectedItemId) {
  const direction = getRelationDirection(relation, selectedItemId)
  if (direction === 'outbound') return relation.targetId
  if (direction === 'inbound') return relation.sourceId
  return null
}

export function relationMatchesSelectedItem(relation, selectedItemId) {
  return Boolean(selectedItemId)
    && SUPPORTED_RELATIONS.includes(relation?.rel)
    && (relation?.sourceId === selectedItemId || relation?.targetId === selectedItemId)
}

export function resolveRelationTarget(relation, selectedItemId, visibleItems = []) {
  const direction = getRelationDirection(relation, selectedItemId)
  const relatedItemId = getRelatedItemId(relation, selectedItemId)
  const relatedItem = visibleItems.find(item => item.id === relatedItemId) || null

  return {
    direction,
    relatedItemId,
    relatedItem,
    isVisible: Boolean(relatedItem),
  }
}
