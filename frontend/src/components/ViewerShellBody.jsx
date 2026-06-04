import ViewerDocumentPlaceholder from './ViewerDocumentPlaceholder'
import ViewerImage from './ViewerImage'
import ViewerModelPlaceholder from './ViewerModelPlaceholder'
import ViewerPanoramaPlaceholder from './ViewerPanoramaPlaceholder'
import ViewerPointCloudPlaceholder from './ViewerPointCloudPlaceholder'
import ViewerTilesetPlaceholder from './ViewerTilesetPlaceholder'
import ViewerVideo from './ViewerVideo'

export default function ViewerShellBody({ item, contract }) {
  return (
    <div style={bodyStyle}>
      <StatusCallout contract={contract} />
      {renderCategoryShell(item, contract)}
    </div>
  )
}

function renderCategoryShell(item, contract) {
  switch (contract.dataCategory) {
    case 'orthoimage':
      return <ViewerImage contract={contract} label="Orthoimage shell" />
    case 'image':
      return <ViewerImage contract={contract} label="Image shell" />
    case 'video':
      return <ViewerVideo contract={contract} />
    case 'document':
      return <ViewerDocumentPlaceholder contract={contract} />
    case 'panorama':
      return <ViewerPanoramaPlaceholder contract={contract} />
    case '3d_model':
      return <ViewerModelPlaceholder contract={contract} />
    case 'pointcloud':
      return <ViewerPointCloudPlaceholder contract={contract} />
    case '3d_tiles':
      return <ViewerTilesetPlaceholder contract={contract} />
    default:
      return <ViewerImage contract={contract} label="Unsupported asset shell" />
  }
}

function StatusCallout({ contract }) {
  const tone = getStatusTone(contract.status)
  const message = getStatusMessage(contract)

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 6,
      border: `1px solid ${tone.border}`,
      background: tone.background,
      color: tone.color,
      display: 'grid',
      gap: 5,
    }}>
      <div style={{ fontSize: 13, fontWeight: 900 }}>
        {message.title}
      </div>
      <div style={{ color: 'var(--t2)', fontSize: 12, lineHeight: 1.45 }}>
        {message.body}
      </div>
      {contract.status === 'failed' && contract.failureReason && (
        <div style={{
          marginTop: 3,
          color: 'var(--err, #e55)',
          fontSize: 12,
          fontWeight: 800,
        }}>
          {contract.failureReason}
        </div>
      )}
    </div>
  )
}

function getStatusMessage(contract) {
  if (contract.status === 'available') {
    return {
      title: 'Lightweight viewer shell',
      body: 'This opens a Phase 6B shell only. Production heavy viewer integration is deferred.',
    }
  }
  if (contract.status === 'pending') {
    return {
      title: 'Viewer preparation pending',
      body: 'Preview generation or conversion is still pending. The shell verifies the action state without opening a production viewer.',
    }
  }
  if (contract.status === 'failed') {
    return {
      title: 'Preview failed',
      body: 'The shell shows the failure reason and keeps production viewer launch disabled for this asset.',
    }
  }
  return {
    title: 'Conversion needed',
    body: 'No preview asset is ready yet. The shell marks this as a conversion or preview-generation handoff.',
  }
}

function getStatusTone(status) {
  if (status === 'available') {
    return { color: 'var(--ok)', border: 'rgba(61,214,140,0.30)', background: 'rgba(61,214,140,0.07)' }
  }
  if (status === 'pending') {
    return { color: 'var(--warn)', border: 'rgba(240,180,42,0.32)', background: 'rgba(240,180,42,0.08)' }
  }
  if (status === 'failed') {
    return { color: 'var(--err, #e55)', border: 'rgba(229,85,85,0.34)', background: 'rgba(229,85,85,0.08)' }
  }
  return { color: 'var(--t2)', border: 'var(--bd)', background: 'var(--s2)' }
}

const bodyStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 16,
  display: 'grid',
  gap: 12,
}
