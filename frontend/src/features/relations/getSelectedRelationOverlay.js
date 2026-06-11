import { getItemMapPosition } from '../explorer-map/getItemMapPosition.js'
import {
  getRelatedItemId,
  relationMatchesSelectedItem,
  resolveRelationTarget,
} from './resolveRelationTarget.js'
import { getRelationStyle, SUPPORTED_RELATIONS } from './relationStyles.js'

function relationKey(relation, selectedItemId) {
  const relatedItemId = getRelatedItemId(relation, selectedItemId)
  return [
    relation.rel,
    relation.sourceId,
    relation.targetId,
    relatedItemId,
  ].join('|')
}

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
    .filter(link => SUPPORTED_RELATIONS.includes(link.rel))
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

function getItemById(items, itemId) {
  return (items || []).find(item => item.id === itemId) || null
}

function emptyOverlay(selectedItemId) {
  return {
    selectedItemId: selectedItemId || null,
    relatedItemIds: [],
    visibleRelations: [],
    missingTargets: [],
  }
}

export function getSelectedRelationOverlay({
  fallbackCenters = null,
  selectedItem,
  visibleItems = [],
  relationRecords = [],
} = {}) {
  const selectedItemId = selectedItem?.id
  if (!selectedItemId) return emptyOverlay(null)

  const selectedVisibleItem = getItemById(visibleItems, selectedItemId) || selectedItem
  const selectedPosition = getItemMapPosition(selectedVisibleItem, fallbackCenters)
  const candidateRelations = relationRecords.length > 0
    ? relationRecords.filter(relation => relationMatchesSelectedItem(relation, selectedItemId))
    : relationsFromLinks(selectedItem)

  const seen = new Set()
  const relatedItemIds = new Set()
  const visibleRelations = []
  const missingTargets = []

  candidateRelations.forEach(relation => {
    const key = relationKey(relation, selectedItemId)
    if (seen.has(key)) return
    seen.add(key)

    const resolved = resolveRelationTarget(relation, selectedItemId, visibleItems)
    if (!resolved.direction || !resolved.relatedItemId) return

    const sourceItem = relation.sourceId === selectedItemId
      ? selectedVisibleItem
      : getItemById(visibleItems, relation.sourceId)
    const targetItem = relation.targetId === selectedItemId
      ? selectedVisibleItem
      : getItemById(visibleItems, relation.targetId)
    const sourceMap = getItemMapPosition(sourceItem, fallbackCenters)
    const targetMap = getItemMapPosition(targetItem, fallbackCenters)

    if (resolved.isVisible && sourceMap?.position && targetMap?.position && selectedPosition?.position) {
      relatedItemIds.add(resolved.relatedItemId)
      visibleRelations.push({
        id: key,
        rel: relation.rel,
        direction: resolved.direction,
        sourceItemId: relation.sourceId,
        targetItemId: relation.targetId,
        relatedItemId: resolved.relatedItemId,
        sourcePosition: sourceMap.position,
        targetPosition: targetMap.position,
        style: getRelationStyle(relation.rel),
        title: relation.title || null,
      })
      return
    }

    missingTargets.push({
      id: key,
      rel: relation.rel,
      direction: resolved.direction,
      sourceItemId: relation.sourceId,
      targetItemId: relation.targetId,
      relatedItemId: resolved.relatedItemId,
      title: relation.title || null,
      reason: resolved.isVisible ? 'no_map_position' : 'outside_visible_results',
    })
  })

  return {
    selectedItemId,
    relatedItemIds: [...relatedItemIds],
    visibleRelations,
    missingTargets,
  }
}
