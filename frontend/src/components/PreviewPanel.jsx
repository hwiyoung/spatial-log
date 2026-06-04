/**
 * Explorer Context Panel.
 * Opens from the shared selectedItem state used by map markers and list rows.
 */
import { getCategoryInfo } from '../constants'
import PanelActionFooter from './PanelActionFooter'
import PanelIdentitySection from './PanelIdentitySection'
import PanelMetadataGapSection from './PanelMetadataGapSection'
import PanelPreviewHero from './PanelPreviewHero'
import PanelProjectStatusSection from './PanelProjectStatusSection'
import PanelRelationSummarySection from './PanelRelationSummarySection'
import PanelSpatialSummarySection from './PanelSpatialSummarySection'

export default function PreviewPanel({
  item,
  collections = [],
  relationRecords = [],
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  onToggleRelationOverlay,
  onClose,
  width = 540,
  mockMode = false,
}) {
  if (!item) return null

  const props = item.properties || {}
  const cat = getCategoryInfo(props.data_category)

  return (
    <aside style={{
      width,
      minWidth: 320,
      background: 'var(--s1)',
      borderLeft: '1px solid var(--bd)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--bd)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          padding: '2px 10px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          background: `${cat.color}12`,
          color: cat.color,
          border: `1px solid ${cat.color}35`,
        }}>
          {cat.icon} Context Panel
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close context panel"
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            border: '1px solid var(--bd)',
            background: 'var(--s2)',
            color: 'var(--t3)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: '24px',
          }}
        >
          x
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
        <PanelPreviewHero item={item} mockMode={mockMode} />
        <PanelIdentitySection item={item} />
        <PanelProjectStatusSection item={item} collections={collections} />
        <PanelMetadataGapSection item={item} />
        <PanelSpatialSummarySection item={item} />
        <PanelRelationSummarySection
          item={item}
          relationRecords={relationRecords}
          relationOverlayEnabled={relationOverlayEnabled}
          relationOverlayModel={relationOverlayModel}
          onToggleRelationOverlay={onToggleRelationOverlay}
        />
      </div>

      <PanelActionFooter
        item={item}
        collections={collections}
        mockMode={mockMode}
        onClose={onClose}
      />
    </aside>
  )
}
