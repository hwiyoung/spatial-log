/**
 * 미리보기 패널 — Explorer 오른쪽 슬라이드
 * Item 클릭 시 나타나며, "상세 보기" → /detail/:id 로 이동
 */
import { useNavigate } from 'react-router-dom'
import { getCategoryInfo, formatSize } from '../constants'

export default function PreviewPanel({ item, onClose, width = 540 }) {
  const navigate = useNavigate()
  if (!item) return null

  const props = item.properties || {}
  const cat = getCategoryInfo(props.data_category)
  const collection = item.collection

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
            alt={props.description || item.id}
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
          {props.description || item.id}
        </div>

        {/* 태그 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {props['project:site'] && <Tag label={`📍 ${props['project:site']}`} />}
          {props.target && <Tag label={`🎯 ${props.target}`} />}
          {props.datetime && <Tag label={`📅 ${props.datetime.slice(0, 10)}`} />}
          {props['proj:epsg'] && <Tag label={`📐 EPSG:${props['proj:epsg']}`} />}
          <Tag
            label={props['sams:status'] === 'published' ? '✅ Published' : '⚠ Draft'}
            color={props['sams:status'] === 'published' ? 'var(--ok)' : 'var(--warn)'}
          />
        </div>

        {/* 메타데이터 요약 */}
        <div style={{
          padding: '10px 12px', background: 'var(--s2)',
          borderRadius: 6, border: '1px solid var(--bd)', marginBottom: 12,
        }}>
          <MetaRow label="Collection" value={collection} />
          <MetaRow label="Item ID" value={item.id} />
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
        <button
          onClick={async () => {
            if (!confirm(`"${props.description || item.id}" 아이템을 삭제하시겠습니까?`)) return
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
      </div>
    </div>
  )
}

function Tag({ label, color }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 12,
      background: color ? color + '10' : 'var(--s2)',
      color: color || 'var(--t2)',
      border: `1px solid ${color ? color + '30' : 'var(--bd)'}`,
    }}>
      {label}
    </span>
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
