import { mockCollections } from './fixtures/mockCollections.js'
import { mockItems } from './fixtures/mockItems.js'
import { getMockRelationsForItem } from './fixtures/mockRelations.js'
import { getDisplayLabel, getOriginalFilename } from '../features/items/getDisplayLabel.js'
import { getItemMapPosition } from '../features/explorer-map/getItemMapPosition.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getProjectContext } from '../features/items/getProjectContext.js'

const MOCK_SEARCH_DELAY_MS = 120

export function isMockExplorerMode() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') return true
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('mock') === '1' || params.get('mock') === 'true'
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function decorateItem(item) {
  const relations = getMockRelationsForItem(item.id)
  const missingRelationTargets = relations
    .filter(relation => relation.sourceId === item.id && relation.missingTarget)
    .map(relation => relation.targetId)

  return {
    ...clone(item),
    properties: {
      ...clone(item.properties || {}),
      'mock:relation_count': relations.length,
      'mock:missingRelationTargets': [
        ...new Set([
          ...((item.properties || {})['mock:missingRelationTargets'] || []),
          ...missingRelationTargets,
        ]),
      ],
    },
  }
}

function matchesKeyword(item, keyword) {
  if (!keyword) return true
  const q = keyword.toLowerCase()
  const props = item.properties || {}
  const project = getProjectContext(item, mockCollections)
  const values = [
    item.id,
    item.collection,
    getDisplayLabel(item),
    getOriginalFilename(item),
    project.projectName,
    project.projectSite,
    props.title,
    props.display_name,
    props['document:title'],
    props.description,
    props.originalFilename,
    props['file:name'],
    props['project:name'],
    props['project:site'],
    props.data_category,
    props.status,
    ...(props.metadataGaps || []),
    ...(props.missingRequiredFields || []),
  ]
  return values.some(value => String(value || '').toLowerCase().includes(q))
}

export const mockExplorerDataSource = {
  async listCollections() {
    await sleep(MOCK_SEARCH_DELAY_MS)
    return { data: { collections: clone(mockCollections) } }
  },

  async search({ keyword = '', categories = [], collectionId = null, status = 'all', datetimeRange = null, bbox = null } = {}) {
    await sleep(MOCK_SEARCH_DELAY_MS)
    // 실서버 /search 의 datetime·bbox 파라미터와 같은 의미의 mock 필터
    const inTime = (item) => {
      if (!datetimeRange) return true
      const dt = item.properties?.datetime || item.properties?.start_datetime
      if (!dt) return false
      const [from, to] = datetimeRange
      return (!from || dt >= from) && (!to || dt <= to)
    }
    const inBbox = (item) => {
      if (!bbox) return true
      const pos = getItemMapPosition(item)
      if (!pos || pos.source === 'fallback') return false   // pgSTAC bbox 는 geometry 만 매칭 — fallback 위치 제외
      const [lon, lat] = pos.position
      return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
    }
    const filtered = mockItems
      .filter(item => !collectionId || item.collection === collectionId)
      .filter(item => categories.length === 0 || categories.includes(item.properties?.data_category))
      .filter(item => status === 'all' || getItemStatus(item) === status)
      .filter(item => matchesKeyword(item, keyword))
      .filter(inTime)
      .filter(inBbox)
      .map(decorateItem)

    return {
      data: {
        type: 'FeatureCollection',
        features: filtered,
        numberMatched: filtered.length,
        numberReturned: filtered.length,
      },
    }
  },

  async getItem(collectionId, itemId) {
    await sleep(MOCK_SEARCH_DELAY_MS)
    const item = mockItems.find(candidate => candidate.collection === collectionId && candidate.id === itemId)
    return { data: item ? decorateItem(item) : null }
  },

  async getRelations(itemId) {
    await sleep(MOCK_SEARCH_DELAY_MS)
    return { data: { itemId, relations: clone(getMockRelationsForItem(itemId)) } }
  },
}
