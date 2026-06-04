import { useNavigate } from 'react-router-dom'
import { getDisplayLabel } from '../features/items/getDisplayLabel.js'
import { getItemVisibilityFlags } from '../features/items/getItemVisibilityFlags.js'
import { getProjectContext } from '../features/items/getProjectContext.js'

export default function PanelActionFooter({ item, collections = [], mockMode = false, onClose }) {
  const navigate = useNavigate()
  const collection = item?.collection
  const label = getDisplayLabel(item)
  const flags = getItemVisibilityFlags(item, collections)
  const project = getProjectContext(item, collections)

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--bd)',
      display: 'grid',
      gridTemplateColumns: flags.isDraft ? '1fr 1fr' : '1fr',
      gap: 8,
    }}>
      <button
        onClick={() => navigate(`/detail/${collection}/${item.id}`)}
        style={primaryButtonStyle}
      >
        상세 보기 →
      </button>
      {flags.isDraft && (
        <button
          disabled
          title="실제 edit form은 later phase에서 연결"
          style={disabledButtonStyle}
        >
          메타데이터 보완
        </button>
      )}
      {!project.isUnassigned && (
        <button
          disabled
          title="Project route 연결 전"
          style={{ ...disabledButtonStyle, gridColumn: '1 / -1' }}
        >
          프로젝트 보기
        </button>
      )}
      {!mockMode && (
        <button
          onClick={async () => {
            if (!confirm(`"${label}" 아이템을 삭제하시겠습니까?`)) return
            try {
              const { itemApi } = await import('../services/api')
              await itemApi.delete(`${collection}/${item.id}`)
              onClose?.()
              window.location.reload()
            } catch (err) {
              alert('삭제 실패: ' + (err.response?.data?.detail || err.message))
            }
          }}
          style={{ ...dangerButtonStyle, gridColumn: '1 / -1' }}
        >
          삭제
        </button>
      )}
    </div>
  )
}

const primaryButtonStyle = {
  padding: '8px 0',
  borderRadius: 6,
  border: 'none',
  background: 'var(--ac)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const disabledButtonStyle = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
  color: 'var(--t3)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'not-allowed',
}

const dangerButtonStyle = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--err, #e55)',
  background: 'transparent',
  color: 'var(--err, #e55)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
