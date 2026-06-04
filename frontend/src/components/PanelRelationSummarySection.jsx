import { getItemRelationSummary, RELATION_RELS } from '../features/items/getItemRelationSummary.js'

export default function PanelRelationSummarySection({
  item,
  relationRecords = [],
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  onToggleRelationOverlay,
}) {
  const summary = getItemRelationSummary(item, relationRecords)
  const hasRelations = summary.total > 0
  const visibleMissingIds = summary.missingTargetIds.slice(0, 3)
  const hiddenMissingIds = summary.missingTargetIds.slice(3)
  const visibleLineCount = relationOverlayModel?.visibleRelations?.length || 0
  const overlayMissingCount = relationOverlayModel?.missingTargets?.length || 0

  return (
    <section style={sectionStyle}>
      <div style={{ color: 'var(--t3)', marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
        Relation Summary
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
        <span style={{ color: 'var(--t2)', fontSize: 13 }}>Total relations</span>
        <strong style={{ color: 'var(--t1)', fontSize: 14 }}>{summary.total}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
        {RELATION_RELS.map(rel => (
          <RelCount key={rel} rel={rel} count={summary.counts[rel] || 0} />
        ))}
      </div>
      {summary.missingTargetCount > 0 && (
        <div style={{
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid rgba(240,180,42,0.28)',
          background: 'rgba(240,180,42,0.08)',
          marginBottom: 10,
        }}>
          <div style={{ color: 'var(--warn)', fontSize: 12, fontWeight: 800, marginBottom: 5 }}>
            Missing relation targets: {summary.missingTargetCount}
          </div>
          <div style={{ color: 'var(--t2)', fontSize: 12, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
            {visibleMissingIds.join(', ')}
          </div>
          {hiddenMissingIds.length > 0 && (
            <details style={{ color: 'var(--t2)', fontSize: 12, marginTop: 5 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--t3)' }}>
                Show {hiddenMissingIds.length} more
              </summary>
              <div style={{ marginTop: 4, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                {hiddenMissingIds.join(', ')}
              </div>
            </details>
          )}
        </div>
      )}
      {hasRelations && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          color: 'var(--t3)',
          fontSize: 12,
          marginBottom: 8,
        }}>
          <span>Visible map lines: {visibleLineCount}</span>
          <span>Warnings: {overlayMissingCount}</span>
        </div>
      )}
      <button
        type="button"
        disabled={!hasRelations || !onToggleRelationOverlay}
        onClick={onToggleRelationOverlay}
        title={hasRelations ? '선택 Item의 1-depth 관계만 지도 위에 표시합니다.' : '이 Item에는 표시할 관계가 없습니다.'}
        style={{
          width: '100%',
          padding: '7px 10px',
          borderRadius: 6,
          border: `1px solid ${relationOverlayEnabled ? 'rgba(74,114,255,0.35)' : 'var(--bd)'}`,
          background: relationOverlayEnabled ? 'rgba(74,114,255,0.10)' : 'var(--s1)',
          color: hasRelations ? (relationOverlayEnabled ? 'var(--ac)' : 'var(--t2)') : 'var(--t3)',
          fontSize: 13,
          fontWeight: 700,
          cursor: hasRelations ? 'pointer' : 'not-allowed',
        }}
      >
        {hasRelations
          ? (relationOverlayEnabled ? '지도 관계 숨기기' : '지도에서 관계 보기')
          : '관계 없음'}
      </button>
    </section>
  )
}

function RelCount({ rel, count }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      padding: '4px 7px',
      borderRadius: 4,
      background: count > 0 ? 'rgba(74,114,255,0.07)' : 'var(--s1)',
      border: `1px solid ${count > 0 ? 'rgba(74,114,255,0.20)' : 'var(--bd)'}`,
      fontSize: 12,
    }}>
      <span style={{ color: count > 0 ? 'var(--t1)' : 'var(--t3)' }}>{rel}</span>
      <b style={{ color: count > 0 ? 'var(--ac)' : 'var(--t3)' }}>{count}</b>
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
