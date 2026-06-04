import { getItemRelationSummary, RELATION_RELS } from '../features/items/getItemRelationSummary.js'

export default function PanelRelationSummarySection({ item, relationRecords = [] }) {
  const summary = getItemRelationSummary(item, relationRecords)
  const visibleMissingIds = summary.missingTargetIds.slice(0, 3)
  const hiddenMissingIds = summary.missingTargetIds.slice(3)

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
      <button
        disabled
        title="Phase 4에서 선택 Item 관계 overlay로 연결 예정"
        style={{
          width: '100%',
          padding: '7px 10px',
          borderRadius: 6,
          border: '1px solid var(--bd)',
          background: 'var(--s1)',
          color: 'var(--t3)',
          fontSize: 13,
          cursor: 'not-allowed',
        }}
      >
        지도에서 관계 보기 · Phase 4 예정
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
