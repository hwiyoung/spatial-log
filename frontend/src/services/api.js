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
  getPolicy: (config = {}) => samsApi.get('/upload/policy', config),
  analyze: (formData, config) => samsApi.post('/upload/analyze', formData, config),
  analyzeAsync: (formData, config) => samsApi.post('/upload/analyze-async', formData, config),
  validate: (manifest) => samsApi.post('/upload/validate', manifest),
  register: (manifest) => samsApi.post('/upload/register', manifest),
  getSession: (sessionId, config = {}) => samsApi.get(`/upload/sessions/${sessionId}`, config),
  retryAnalysis: (sessionId, config = {}) => samsApi.post(`/upload/sessions/${sessionId}/retry-analysis`, {}, config),
  cancelSession: (sessionId) => samsApi.delete(`/upload/sessions/${sessionId}`),
  getPresignedUrl: (params, config = {}) => samsApi.get('/upload/presigned-url', { params, ...config }),
  getManifestTemplate: (collectionId) => samsApi.get(`/upload/manifest-template/${collectionId}`, { responseType: 'blob' }),
  importManifest: (formData) => samsApi.post('/upload/manifest-import', formData),
  uploadComplete: (body, config) => samsApi.post('/upload/upload-complete', body, config),
  initiateMultipart: (body, config) => samsApi.post('/upload/multipart/initiate', body, config),
  getMultipartPartUrl: (body, config) => samsApi.post('/upload/multipart/part-url', body, config),
  completeMultipart: (body, config) => samsApi.post('/upload/multipart/complete', body, config),
  abortMultipart: (body, config) => samsApi.post('/upload/multipart/abort', body, config),
  // presigned PUT — MinIO 직행이므로 samsApi 인스턴스(baseURL/인터셉터) 를 쓰지 않는다
  putPresigned: (url, file, config = {}) => axios.put(url, file, {
    headers: { 'Content-Type': 'application/octet-stream' },
    ...config,
  }),
  putPresignedPart: (url, blob, config = {}) => axios.put(url, blob, {
    headers: { 'Content-Type': 'application/octet-stream' },
    ...config,
  }),
}

// ── Collections ──
export const collectionApi = {
  list: () => stacApi.get('/collections'),
  get: (id) => stacApi.get(`/collections/${id}`),
  items: (id, params = {}) => stacApi.get(`/collections/${id}/items`, { params: { limit: 200, ...params } }),
  create: (data) => samsApi.post('/collections', data),
  update: (id, data) => samsApi.put(`/collections/${id}`, data),
  dashboard: (id) => samsApi.get(`/collections/${id}/dashboard`),
  spatialSummary: (id) => samsApi.get(`/collections/${id}/spatial-summary`),
  delete: (id) => samsApi.delete(`/collections/${id}`),
}

// ── Search ──
export const searchApi = {
  search: (params) => stacApi.post('/search', params),
  autocomplete: (q) => samsApi.get('/search/autocomplete', { params: { q } }),
  facets: () => samsApi.get('/search/facets'),
  fieldValues: (fieldName, collectionId) => samsApi.get(`/field-values/${fieldName}`, { params: { collection: collectionId } }),
}

// ── Items ──
export const itemApi = {
  get: (collectionId, itemId) => stacApi.get(`/collections/${collectionId}/items/${itemId}`),
  updateStatus: (id, status) => samsApi.put(`/items/${id}/status`, { status }),
  getTimeline: (id) => samsApi.get(`/items/${id}/timeline`),
  getRelated: (id) => samsApi.get(`/items/${id}/related`),
  getHistory: (id) => samsApi.get(`/items/${id}/history`),
  addLink: (id, link) => samsApi.post(`/items/${id}/links`, link),
  removeLink: (id, linkIndex) => samsApi.delete(`/items/${id}/links/${linkIndex}`),
  update: (id, properties) => samsApi.put(`/items/${id}`, properties),
  updateProperties: (collectionId, itemId, properties) =>
    samsApi.put(`/items/${collectionId}/${itemId}/properties`, properties),
  delete: (id) => samsApi.delete(`/items/${id}`),
  move: (collectionId, itemId, targetCollectionId) =>
    samsApi.post(`/items/${collectionId}/${itemId}/move`, { target_collection_id: targetCollectionId }),
  updateLocation: (collectionId, itemId, longitude, latitude) =>
    samsApi.put(`/items/${collectionId}/${itemId}/location`, { longitude, latitude }),
}
