/**
 * 미리보기 패널 — Explorer 오른쪽 슬라이드
 * Item 클릭 시 나타나며, "상세 보기" → /detail/:id 로 이동
 */
import { useNavigate } from 'react-router-dom'
import {
  getCategoryInfo,
  formatSize,
  getPreviewStatusInfo,
} from '../constants'
import DraftBadge from './DraftBadge'
import ProjectBadge from './ProjectBadge'
import StatusBadge from './StatusBadge'
import { getDisplayLabel, getOriginalFilename } from '../features/items/getDisplayLabel.js'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getProjectContext } from '../features/items/getProjectContext.js'
import { getItemVisibilityFlags } from '../features/items/getItemVisibilityFlags.js'

export default function PreviewPanel({ item, collections = [], onClose, width = 540, mockMode = false }) {
  const navigate = useNavigate()
  if (!item) return null

  const props = item.properties || {}
  const cat = getCategoryInfo(props.data_category)
  const status = getItemStatus(item)
  const previewInfo = getPreviewStatusInfo(props.previewStatus)
  const label = getDisplayLabel(item)
  const originalFilename = getOriginalFilename(item)
  const project = getProjectContext(item, collections)
  const flags = getItemVisibilityFlags(item, collections)
  const collection = item.collection
  const metadataGaps = props.metadataGaps || props.missingRequiredFields || []
  const missingRelationTargets = props['mock:missingRelationTargets'] || []
  const relationCount = props['mock:relation_count'] || 0

  return (
    <div style={{
      width, minWidth: 320, background: 'var(--s1)',
      borderLeft: '1px solid var(--bd)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          background: cat.color + '12', color: cat.color,
        }}>
          {cat.icon} {cat.label}
        </span>
        <span
          onClick={onClose}
          style={{ fontSize: 16, color: 'var(--t3)', cursor: 'pointer' }}
        >
          ✕
        </span>
      </div>

      {/* 내용 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
        {/* 썸네일 영역 */}
        {item.assets?.thumbnail?.href ? (
          <img
            src={item.assets.thumbnail.href}
            alt={label}
            style={{
              width: '100%', height: 360, objectFit: 'contain',
              borderRadius: 8, marginBottom: 14,
              border: '1px solid var(--bd)', background: 'var(--s2)',
            }}
          />
        ) : (
          <div style={{
            height: 300, background: 'var(--s2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, border: '1px solid var(--bd)',
            fontSize: 40, color: cat.color, opacity: 0.3,
          }}>
            {cat.icon}
          </div>
        )}

        {/* 제목 */}
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>
          {label}
        </div>

        {/* 태그 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          <ProjectBadge projectName={project.projectName} isUnassigned={project.isUnassigned} />
          {flags.isDraft ? <DraftBadge /> : <StatusBadge status={status} />}
          {project.projectSite && <Tag label={`Site: ${project.projectSite}`} />}
          {props.target && <Tag label={`🎯 ${props.target}`} />}
          {props.datetime && <Tag label={`📅 ${props.datetime.slice(0, 10)}`} />}
          {props['proj:epsg'] && <Tag label={`📐 EPSG:${props['proj:epsg']}`} />}
          <Tag label={previewInfo.label} color={previewInfo.color} />
        </div>

        {/* 메타데이터 요약 */}
        <div style={{
          padding: '10px 12px', background: 'var(--s2)',
          borderRadius: 6, border: '1px solid var(--bd)', marginBottom: 12,
        }}>
          <MetaRow label="Collection" value={collection} />
          <MetaRow label="Project" value={project.projectName} />
          <MetaRow label="Site" value={project.projectSite} />
          <MetaRow label="Item ID" value={item.id} />
          <MetaRow label="Original filename" value={originalFilename} />
          <MetaRow label="Status" value={status} />
          <MetaRow label="Preview" value={props.previewStatus} />
          <MetaRow label="Relations" value={relationCount ? `${relationCount} linked` : '0 linked'} />
          <MetaRow label="파일 크기" value={formatSize(props['file:size'])} />
          {props['pc:count'] && <MetaRow label="포인트 수" value={Number(props['pc:count']).toLocaleString()} />}
          {props['image:image_count'] && <MetaRow label="이미지 수" value={`${props['image:image_count']}장`} />}
          {props['image:camera_model'] && <MetaRow label="카메라" value={props['image:camera_model']} />}
          {props['proj:epsg'] && <MetaRow label="좌표계" value={`EPSG:${props['proj:epsg']}`} />}
        </div>

        {/* 바운딩 박스 */}
        {item.bbox && item.bbox.length >= 4 && (
          <div style={{
            padding: '8px 12px', background: 'var(--s2)',
            borderRadius: 6, border: '1px solid var(--bd)', marginBottom: 12,
            fontSize: 13, fontFamily: 'monospace',
          }}>
            <div style={{ color: 'var(--t3)', marginBottom: 4, fontSize: 12 }}>Bounding Box (EPSG:4326)</div>
            <div style={{ color: 'var(--t2)' }}>
              W {Number(item.bbox[0]).toFixed(6)}° / S {Number(item.bbox[1]).toFixed(6)}°
            </div>
            <div style={{ color: 'var(--t2)' }}>
              E {Number(item.bbox[2]).toFixed(6)}° / N {Number(item.bbox[3]).toFixed(6)}°
            </div>
          </div>
        )}

        {(props.draftReason || metadataGaps.length > 0 || props.previewFailureReason) && (
          <div style={{
            padding: '10px 12px', background: 'var(--s2)',
            borderRadius: 6, border: '1px solid var(--bd)', marginBottom: 12,
          }}>
            <div style={{ color: 'var(--t3)', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
              Draft / Preview / Metadata
            </div>
            {props.draftReason && <NoticeRow label="Draft reason" value={props.draftReason} />}
            {props.previewFailureReason && <NoticeRow label="Preview failure" value={props.previewFailureReason} />}
            {metadataGaps.length > 0 && <NoticeRow label="Gaps" value={metadataGaps.join(', ')} />}
          </div>
        )}

        {missingRelationTargets.length > 0 && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(215,184,74,0.08)',
            borderRadius: 6,
            border: '1px solid rgba(215,184,74,0.28)',
            marginBottom: 12,
          }}>
            <div style={{ color: 'var(--warn)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Relation target outside current results
            </div>
            <div style={{ color: 'var(--t2)', fontSize: 13 }}>
              {missingRelationTargets.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--bd)',
        display: 'flex', gap: 8,
      }}>
        <button
          onClick={() => navigate(`/detail/${collection}/${item.id}`)}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
            background: 'var(--ac)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          상세 보기 →
        </button>
        {!mockMode && (
          <button
            onClick={async () => {
              if (!confirm(`"${label}" 아이템을 삭제하시겠습니까?`)) return
              try {
                const { itemApi } = await import('../services/api')
                await itemApi.delete(`${collection}/${item.id}`)
                onClose()
                window.location.reload()
              } catch (err) {
                alert('삭제 실패: ' + (err.response?.data?.detail || err.message))
              }
            }}
            style={{
              padding: '8px 12px', borderRadius: 6,
              border: '1px solid var(--err, #e55)', background: 'transparent',
              color: 'var(--err, #e55)', fontSize: 13, cursor: 'pointer',
            }}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

function Tag({ label, color }) {
  const background = color?.startsWith('var(') ? 'var(--s2)' : `${color || ''}10`
  const borderColor = color?.startsWith('var(') ? 'var(--bd)' : `${color || ''}30`
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 12,
      background: color ? background : 'var(--s2)',
      color: color || 'var(--t2)',
      border: `1px solid ${color ? borderColor : 'var(--bd)'}`,
    }}>
      {label}
    </span>
  )
}

function NoticeRow({ label, value }) {
  return (
    <div style={{ padding: '2px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--t3)', marginRight: 8 }}>{label}</span>
      <span style={{ color: 'var(--t2)' }}>{value}</span>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 14 }}>
      <span style={{ color: 'var(--t3)' }}>{label}</span>
      <span style={{ color: 'var(--t1)', fontFamily: 'monospace', fontSize: 13 }}>{value || '—'}</span>
    </div>
  )
}
