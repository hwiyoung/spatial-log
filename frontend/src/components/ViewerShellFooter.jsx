import { useNavigate } from 'react-router-dom'

export default function ViewerShellFooter({ item, contract, mockMode = false, onClose }) {
  const navigate = useNavigate()
  const canOpenDetail = Boolean(item?.collection && item?.id)

  return (
    <footer style={footerStyle}>
      <div style={noticeStyle}>
        {mockMode || contract.isMock
          ? 'Mock/future shell only. Heavy viewer dependency is not loaded.'
          : 'Lightweight shell only. Production viewer integration is deferred.'}
      </div>
      <div style={buttonRowStyle}>
        <button type="button" onClick={onClose} style={secondaryButtonStyle}>
          닫기
        </button>
        <button
          type="button"
          disabled={!canOpenDetail}
          onClick={() => {
            if (!canOpenDetail) return
            onClose?.()
            navigate(`/detail/${item.collection}/${item.id}`)
          }}
          style={canOpenDetail ? primaryButtonStyle : disabledButtonStyle}
        >
          상세 보기 →
        </button>
      </div>
    </footer>
  )
}

const footerStyle = {
  padding: '12px 16px',
  borderTop: '1px solid var(--bd)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const noticeStyle = {
  color: 'var(--t3)',
  fontSize: 12,
  lineHeight: 1.4,
}

const buttonRowStyle = {
  display: 'flex',
  gap: 8,
  flexShrink: 0,
}

const secondaryButtonStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
  color: 'var(--t2)',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const primaryButtonStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--ac)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const disabledButtonStyle = {
  ...primaryButtonStyle,
  border: '1px solid var(--bd)',
  background: 'var(--s2)',
  color: 'var(--t3)',
  cursor: 'not-allowed',
}
