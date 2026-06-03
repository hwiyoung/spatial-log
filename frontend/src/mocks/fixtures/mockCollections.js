export const mockCollections = [
  {
    type: 'Collection',
    stac_version: '1.0.0',
    id: 'seongsu-office-renovation',
    title: '성수동 오피스 리노베이션',
    description: '성수동 업무시설 리노베이션 산출물 mock collection',
    extent: {
      spatial: { bbox: [[[127.0508, 37.5414, 127.0588, 37.5484]]] },
      temporal: { interval: [['2024-02-01T00:00:00Z', '2024-05-31T23:59:59Z']] },
    },
    license: 'proprietary',
    properties: {
      'project:name': '성수동 오피스 리노베이션',
      'project:site': '서울 성동구 성수동',
      'project:campaign': '2024 리노베이션 실측',
      status: 'active',
      pm: '김PM',
      default_crs: 'EPSG:5186',
    },
    links: [{ rel: 'self', href: '/stac/collections/seongsu-office-renovation' }],
  },
  {
    type: 'Collection',
    stac_version: '1.0.0',
    id: 'gyeongju-bulguksa-2024',
    title: '2024 경주 불국사 정밀실측',
    description: '불국사 문화유산 정밀실측 산출물 mock collection',
    extent: {
      spatial: { bbox: [[[129.329, 35.787, 129.337, 35.793]]] },
      temporal: { interval: [['2024-03-01T00:00:00Z', '2024-06-30T23:59:59Z']] },
    },
    license: 'proprietary',
    properties: {
      'project:name': '2024 경주 불국사 정밀실측',
      'project:site': '경주 불국사',
      'project:campaign': '2024 문화재 정밀실측',
      status: 'active',
      pm: '박PM',
      default_crs: 'EPSG:5186',
    },
    links: [{ rel: 'self', href: '/stac/collections/gyeongju-bulguksa-2024' }],
  },
  {
    type: 'Collection',
    stac_version: '1.0.0',
    id: 'unassigned-inbox',
    title: 'Unassigned Inbox',
    description: '프로젝트 미할당 산출물을 모아두는 시스템 예약 mock collection',
    extent: {
      spatial: { bbox: [[[126.9, 35.7, 129.4, 37.7]]] },
      temporal: { interval: [[null, null]] },
    },
    license: 'proprietary',
    properties: {
      'project:name': 'Unassigned Inbox',
      'project:site': '미할당',
      'project:campaign': '분류 대기',
      status: 'system',
      pm: null,
      default_crs: null,
    },
    links: [{ rel: 'self', href: '/stac/collections/unassigned-inbox' }],
  },
]

export function getMockCollection(collectionId) {
  return mockCollections.find(collection => collection.id === collectionId) || null
}
