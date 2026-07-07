/**
 * buildCompletionSpec — Item → 보완(Completion) 화면 필드 스펙.
 *
 * Published 게이트 기준 (백엔드 _check_required_for_publish 와 정렬):
 * - 품질 필수(차단): 표시 이름(description) · 취득 일시(datetime) · 데이터 유형(읽기 전용)
 *   + 좌표계(proj:epsg) — v4 메타데이터 설계서 매트릭스상 epsg 필수 유형만
 * - Type-specific 필수(차단): 유형별 핵심 품질 필드 (디자인 핸드오프 기준)
 * - Project 연결(비차단): project:name / project:site — status 와 별개 축
 *
 * 참조: docs/stac_metadata_design_v4.md (필수/선택 매트릭스),
 *      design-reference/project/MetadataCompletion.html
 */

import { CATEGORIES } from '../../constants'

// v4 매트릭스: proj:epsg 필수(●)는 이 4개 유형 — image/panorama/video/document 는 선택(○)
export const EPSG_REQUIRED_CATS = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage']

// 유형별 필수 필드 — 키는 추출 파이프라인(extract.py)/v4 설계서의 정식 네임스페이스.
// 백엔드 게이트(items.py _TYPE_REQUIRED)와 반드시 동일해야 한다.
const TYPE_REQ = {
  pointcloud: [{ key: 'pc:count', label: '포인트 수', kind: 'number' }],
  '3d_model': [{ key: '3dmodel:format', label: '모델 포맷', kind: 'select', options: ['obj', 'ply', 'fbx', 'gltf', 'glb', 'stl', 'dae'] }],
  '3d_tiles': [{ key: '3dtiles:geometric_error', label: 'Geometric error', kind: 'number' }],
  orthoimage: [{ key: 'ortho:gsd', label: 'GSD (해상도)', kind: 'number', hint: '미터/픽셀' }],
  image: [{ key: 'image:camera_model', label: '카메라 모델', kind: 'text' }],
  panorama: [{ key: 'panorama:type', label: 'Projection', kind: 'select', options: ['equirectangular', 'cubemap', 'cylindrical'] }],
  video: [{ key: 'video:duration', label: '재생 시간', kind: 'text' }, { key: 'video:codec', label: '코덱', kind: 'text' }],
  document: [{ key: 'document:title', label: '문서 제목', kind: 'text' }, { key: 'document:authors', label: '작성자', kind: 'text' }],
}

export function buildCompletionSpec(item, view) {
  const props = item?.properties || {}
  const cat = view.cat

  const quality = [
    {
      key: 'description', label: '표시 이름', kind: 'text', block: true,
      hint: '검색자가 읽을 수 있는 이름', seed: props.description || '',
    },
    {
      key: 'datetime', label: '취득 일시', kind: 'datetime', block: true,
      hint: '날짜/시간 선택', seed: props.datetime || '',
    },
  ]
  if (EPSG_REQUIRED_CATS.includes(cat)) {
    quality.push({
      key: 'proj:epsg', label: '좌표계', kind: 'number', block: true,
      hint: 'EPSG 코드 (예: 5186)', seed: props['proj:epsg'] != null ? String(props['proj:epsg']) : '',
    })
  }
  // data_category 가 비어 있으면(자동 판별 실패) 직접 선택할 수 있게 — 백엔드 게이트도 이를 요구한다
  const hasCat = typeof props.data_category === 'string' && props.data_category.trim() !== ''
  if (hasCat) {
    quality.push({ key: 'data_category', label: '데이터 유형', kind: 'category', block: true, readonly: true, seed: cat })
  } else {
    quality.push({
      key: 'data_category', label: '데이터 유형', kind: 'select', block: true,
      options: Object.keys(CATEGORIES).filter(c => c !== 'unknown'),
      seed: '', hint: '자동 판별 실패 — 직접 선택',
    })
  }

  const type = (TYPE_REQ[cat] || []).map(f => ({
    ...f,
    block: true,
    seed: props[f.key] != null ? String(props[f.key]) : '',
  }))

  return { quality, type }
}
