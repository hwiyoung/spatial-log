import { CATEGORIES } from '../constants.js'
import { STATUS_INFO } from '../features/items/getItemStatus.js'
import { getRelationStyle, SUPPORTED_RELATIONS } from '../features/relations/relationStyles.js'

const CATEGORY_KEYS = ['pointcloud', '3d_model', '3d_tiles', 'orthoimage', 'image', 'panorama', 'video', 'document']

export default function Explorer3dLegend({
  activeRels = new Set(),
  relationOverlayEnabled = false,
  missingTargets = [],
}) {
  const rels = SUPPORTED_RELATIONS.filter(rel => activeRels.has(rel))

  return (
    <div style={rootStyle}>
      <Section title="Asset categories">
        <div style={categoryGridStyle}>
          {CATEGORY_KEYS.map(key => {
            const category = CATEGORIES[key]
            return (
              <div key={key} style={categoryItemStyle}>
                <span style={{ color: category.color, fontWeight: 900 }}>{category.icon}</span>
                <span>{category.label}</span>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Status">
        <div style={rowWrapStyle}>
          <StatusSwatch status="draft" label="Draft" />
          <StatusSwatch status="published" label="Published" />
          <StatusSwatch status="archived" label="Archived" />
          <StatusSwatch status="unknown" label="Unknown" />
        </div>
      </Section>

      <Section title="Z / elevation">
        <div style={zLegendStyle}>
          <span><b>Actual elevation</b>: bbox z or elevation property</span>
          <span><b>Visual layer</b>: category-based pseudo height</span>
        </div>
      </Section>

      {relationOverlayEnabled && (
        <Section title="선택 관계 보기">
          {rels.length > 0 ? (
            <div style={relationGridStyle}>
              {rels.map(rel => <RelationRow key={rel} rel={rel} />)}
            </div>
          ) : (
            <div style={emptyTextStyle}>No visible selected-item relations</div>
          )}
          {missingTargets.length > 0 && (
            <div style={warningStyle}>
              Missing targets: {missingTargets.length}. These links are outside the current result set or have no usable position.
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </div>
  )
}

function StatusSwatch({ status, label }) {
  const info = STATUS_INFO[status]
  return (
    <span style={statusStyle}>
      <span style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: info.markerColor,
        boxShadow: status === 'draft' ? '0 0 0 3px rgba(251,191,36,0.18)' : 'none',
      }} />
      {label}
    </span>
  )
}

function RelationRow({ rel }) {
  const style = getRelationStyle(rel)
  return (
    <div style={relationRowStyle}>
      <span style={{
        width: 28,
        height: 0,
        borderTop: `${Math.max(2, style.lineWidth)}px ${style.dashArray ? 'dashed' : 'solid'} ${style.color}`,
      }} />
      <span>{style.label}</span>
    </div>
  )
}

const rootStyle = {
  position: 'absolute',
  left: 12,
  bottom: 12,
  zIndex: 720,
  width: 330,
  display: 'grid',
  gap: 8,
  padding: '10px 11px',
  borderRadius: 7,
  border: '1px solid rgba(228,231,240,0.16)',
  background: 'rgba(12,14,20,0.88)',
  boxShadow: '0 14px 30px rgba(0,0,0,0.34)',
  color: 'var(--t2)',
  fontSize: 11,
}

const sectionStyle = {
  display: 'grid',
  gap: 6,
}

const sectionTitleStyle = {
  color: 'var(--t1)',
  fontSize: 11,
  fontWeight: 900,
}

const categoryGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
}

const categoryItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  minWidth: 0,
}

const rowWrapStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const statusStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontWeight: 800,
}

const zLegendStyle = {
  display: 'grid',
  gap: 3,
  color: 'var(--t3)',
  lineHeight: 1.35,
}

const relationGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 5,
}

const relationRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
}

const warningStyle = {
  marginTop: 3,
  padding: '7px 8px',
  borderRadius: 5,
  border: '1px solid rgba(251,191,36,0.28)',
  color: 'var(--warn)',
  background: 'rgba(251,191,36,0.09)',
  lineHeight: 1.35,
}

const emptyTextStyle = {
  color: 'var(--t3)',
}
