import { useEffect } from 'react'
import ViewerShellBody from './ViewerShellBody'
import ViewerShellFooter from './ViewerShellFooter'
import ViewerShellHeader from './ViewerShellHeader'

export default function ViewerShell({ item, contract, mockMode = false, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!item || !contract) return null

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
      style={overlayStyle}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-shell-title"
        style={shellStyle}
      >
        <ViewerShellHeader contract={contract} onClose={onClose} />
        <ViewerShellBody item={item} contract={contract} />
        <ViewerShellFooter
          item={item}
          contract={contract}
          mockMode={mockMode}
          onClose={onClose}
        />
      </section>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(5,7,12,0.62)',
}

const shellStyle = {
  width: 'min(920px, calc(100vw - 48px))',
  maxHeight: 'calc(100vh - 48px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderRadius: 8,
  border: '1px solid var(--bd)',
  background: 'var(--s1)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
}
