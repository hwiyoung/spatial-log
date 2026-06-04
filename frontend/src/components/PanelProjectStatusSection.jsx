import { getPreviewStatusInfo } from '../constants'
import { getItemStatus } from '../features/items/getItemStatus.js'
import { getItemPreviewSummary } from '../features/items/getItemPreviewSummary.js'
import { getItemVisibilityFlags } from '../features/items/getItemVisibilityFlags.js'
import { getProjectContext } from '../features/items/getProjectContext.js'
import DraftBadge from './DraftBadge'
import ProjectBadge from './ProjectBadge'
import StatusBadge from './StatusBadge'

export default function PanelProjectStatusSection({ item, collections = [] }) {
  const props = item?.properties || {}
  const status = getItemStatus(item)
  const flags = getItemVisibilityFlags(item, collections)
  const project = getProjectContext(item, collections)
  const previewSummary = getItemPreviewSummary(item)
  const previewInfo = getPreviewStatusInfo(previewSummary.status)

  return (
    <section style={sectionStyle}>
      <div style={{ color: 'var(--t3)', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
        Project / Status
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        <ProjectBadge projectName={project.projectName} isUnassigned={project.isUnassigned} />
        {flags.isDraft ? <DraftBadge /> : <StatusBadge status={status} />}
        <Tag label={previewSummary.statusLabel} color={previewInfo.color} />
      </div>
      <MetaRow label="Project" value={project.projectName} />
      <MetaRow label="Site" value={project.projectSite} />
      <MetaRow label="Collection" value={project.collectionId || item?.collection} mono />
      <MetaRow label="Status" value={status} />
      <MetaRow label="Preview" value={previewSummary.status} />
      {props['project:campaign'] && <MetaRow label="Campaign" value={props['project:campaign']} />}
      {props.target && <MetaRow label="Target" value={props.target} />}
    </section>
  )
}

function Tag({ label, color }) {
  const usesCssVar = String(color || '').startsWith('var(')
  const borderColor = color ? (usesCssVar ? 'var(--bd)' : `${color}35`) : 'var(--bd)'
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 700,
      color: color || 'var(--t2)',
      background: color ? (usesCssVar ? 'var(--s1)' : `${color}12`) : 'var(--s1)',
      border: `1px solid ${borderColor}`,
    }}>
      {label}
    </span>
  )
}

function MetaRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--t3)', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: 'var(--t1)',
        textAlign: 'right',
        fontFamily: mono ? 'monospace' : 'inherit',
        overflowWrap: 'anywhere',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

const sectionStyle = {
  padding: '10px 12px',
  background: 'var(--s2)',
  borderRadius: 6,
  border: '1px solid var(--bd)',
  marginBottom: 12,
}
