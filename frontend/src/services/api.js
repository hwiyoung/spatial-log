/**
 * SAMS API 클라이언트
 * 
 * /api/* → SAMS 커스텀 API (업로드, 자동 채움, Collection 관리)
 * /stac/* → STAC 표준 API (검색, Item/Collection CRUD)
 */

import axios from 'axios'

export const samsApi = axios.create({ baseURL: '/api' })
export const stacApi = axios.create({ baseURL: '/stac' })

// ── Upload (자동 채움 파이프라인) ──
export const uploadApi = {
  analyze: (formData) => samsApi.post('/upload/analyze', formData),
  validate: (manifest) => samsApi.post('/upload/validate', manifest),
  register: (manifest) => samsApi.post('/upload/register', manifest),
  getPresignedUrl: (params) => samsApi.get('/upload/presigned-url', { params }),
}

// ── Collections ──
export const collectionApi = {
  list: () => stacApi.get('/collections'),
  get: (id) => stacApi.get(`/collections/${id}`),
  create: (data) => samsApi.post('/collections', data),
  update: (id, data) => samsApi.put(`/collections/${id}`, data),
  dashboard: (id) => samsApi.get(`/collections/${id}/dashboard`),
  spatialSummary: (id) => samsApi.get(`/collections/${id}/spatial-summary`),
}

// ── Search ──
export const searchApi = {
  search: (params) => stacApi.post('/search', params),
  autocomplete: (q) => samsApi.get('/search/autocomplete', { params: { q } }),
  facets: () => samsApi.get('/search/facets'),
}

// ── Items ──
export const itemApi = {
  get: (collectionId, itemId) => stacApi.get(`/collections/${collectionId}/items/${itemId}`),
  updateStatus: (id, status) => samsApi.put(`/items/${id}/status`, { status }),
  getTimeline: (id) => samsApi.get(`/items/${id}/timeline`),
  getRelated: (id) => samsApi.get(`/items/${id}/related`),
  addLink: (id, link) => samsApi.post(`/items/${id}/links`, link),
}
