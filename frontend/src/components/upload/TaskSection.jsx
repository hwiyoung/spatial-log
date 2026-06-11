/**
 * TaskSection — 업로드 작업 하나의 상태별 UI.
 * analyzing(전송/분석 진행) → analyzed(검토: 단건 카드/벌크 테이블) → registering →
 * registered(완료 + CTA) / failed.
 * `design-reference/project/Upload.html` 의 analyzing/review/done/actbar 포팅 — 실 task 데이터.
 */
import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUploadTasks } from '../../contexts/UploadTasksContext'
import { getManifestRowView } from '../../features/upload/getManifestRowView'
import { getSuggestions, resolveAcceptance } from '../../features/upload/getSuggestionView'
import { PREVIEW_META, tint } from '../../features/explorer/explorerMeta'
import SingleCard from './SingleCard'
import BulkTable from './BulkTable'

const STATUS_PILL = {
  analyzing: { label: '분석 중', color: 'var(--orange)' },
  analyzed: { label: '검토 대기', color: 'var(--draft)' },
  registering: { label: '등록 중', color: 'var(--orange)' },
  registered: { label: '등록 완료', color: 'var(--pub)' },
  failed: { label: '실패', color: 'var(--fail)' },
}

function StatPill({ status }) {
  const v = STATUS_PILL[status] || STATUS_PILL.failed
  return (
    <span className="statpill" style={{ color: v.color, borderColor: tint(v.color, 40), background: tint(v.color, 8) }}>
      {v.label}
    </span>
  )
}

function DoneView({ task, onRemove }) {
  const navigate = useNavigate()
  const location = useLocation()
  const ids = task.registeredItemIds || []
  const col = task.registeredCollectionId
  const single = ids.length === 1 ? ids[0] : null
  const go = (pathname, state) => navigate({ pathname, search: location.search }, state ? { state } : undefined)

  return (
    <div className="done-wrap">
      <div className="done-ico">✓</div>
      <h2>{task.registeredCount}건이 Draft로 등록되었습니다</h2>
      <p className="ds">
        불완전한 데이터도 잃지 않고 <b>Draft로 안전하게 수용</b>되었습니다.
        보완·Published 전환은 등록과 별개 축으로 언제든 진행할 수 있습니다.
      </p>
      {ids.length > 0 && (
        <div className="done-list">
          {ids.map(id => (
            <div className="done-row" key={id}>
              <span className="dn">{id}</span>
              <span className="new">NEW</span>
              <span className="badge">Draft</span>
            </div>
          ))}
        </div>
      )}
      {task.partialErrors?.length > 0 && (
        <div className="partial">⚠ 일부 실패 {task.partialErrors.length}건: {task.partialErrors.join(' / ')}</div>
      )}
      <div className="done-cta">
        <button type="button" className="ctacard primary" onClick={() => go('/')}>
          <div className="ci">🧭</div>
          <div className="ct">Explorer에서 확인 →</div>
          <div className="cd">새 Item이 지도·목록에 Draft로 나타납니다.</div>
        </button>
        {single && (
          <button type="button" className="ctacard" onClick={() => go(`/complete/${col}/${single}`, { from: 'upload' })}>
            <div className="ci">◐</div>
            <div className="ct">보완하기 →</div>
            <div className="cd">누락 필드를 채워 Published 후보로. 라이브 품질 게이트로 진행.</div>
          </button>
        )}
        <button type="button" className="ctacard" onClick={() => go('/project')}>
          <div className="ci">▤</div>
          <div className="ct">Project 확인 →</div>
          <div className="cd">프로젝트별 현황·Draft 목록에서 후속 작업.</div>
        </button>
      </div>
      <div className="done-foot">
        <button type="button" className="btn ghost" onClick={onRemove}>닫기</button>
      </div>
    </div>
  )
}

export default function TaskSection({ task }) {
  const { registerTask, cancelTask, removeTask, updateLocationOverride, updateRowEdit, toggleRowExclude, toggleLinkAccept } = useUploadTasks()

  const rows = useMemo(() => {
    const manifest = task.manifest?.manifest || []
    const excluded = new Set(task.excludedRows || [])
    return manifest.map((item, idx) => getManifestRowView(item, idx, {
      edits: task.rowEdits?.[idx] || {},
      location: task.locationOverrides?.[idx] || null,
      excluded: excluded.has(idx),
    }))
  }, [task.manifest, task.rowEdits, task.locationOverrides, task.excludedRows])

  // 관계 자동 제안 + 수락 상태 (기본값 규칙 ⊕ 사용자 토글) — 등록 payload 와 같은 함수 사용
  const suggestions = useMemo(() => getSuggestions(task.manifest), [task.manifest])
  const acceptance = useMemo(() => resolveAcceptance(suggestions, task.linkOverrides || {}), [suggestions, task.linkOverrides])
  const excludedSet = useMemo(() => new Set(task.excludedRows || []), [task.excludedRows])
  const acceptedCount = useMemo(
    () => suggestions.filter(s => acceptance[s.key] && !excludedSet.has(s.sourceIdx) && !excludedSet.has(s.targetIdx)).length,
    [suggestions, acceptance, excludedSet],
  )

  const includedCount = rows.filter(r => !r.excluded).length
  const inReview = task.status === 'analyzed' || task.status === 'registering'
  const onEdit = (idx, patch) => updateRowEdit(task.id, idx, patch)
  const onExclude = (idx) => toggleRowExclude(task.id, idx)
  const onLocation = (idx, loc) => updateLocationOverride(task.id, idx, loc)

  return (
    <div className="task">
      <div className="task-h">
        <h2>{task.type === 'bulk' ? '벌크 등록' : '단건 등록'}</h2>
        <span className="cnt">
          파일 {task.fileCount}개{task.collectionId ? ` · ${task.collectionId}` : ' · 새 Collection 자동 생성'}
        </span>
        <StatPill status={task.status} />
        <div className="right">
          {inReview && (
            <div className="leg">
              {['available', 'pending', 'missing', 'failed'].map(s => (
                <span key={s}><i style={{ background: PREVIEW_META[s].color }} />{s}</span>
              ))}
            </div>
          )}
          {(task.status === 'analyzing' || task.status === 'registering') && (
            <button type="button" className="btn danger" onClick={() => cancelTask(task.id)}>취소</button>
          )}
          {(task.status === 'failed' || task.status === 'analyzed') && (
            <button type="button" className="btn ghost" onClick={() => (task.status === 'analyzed' ? cancelTask(task.id) : removeTask(task.id))}>
              {task.status === 'analyzed' ? '작업 취소' : '닫기'}
            </button>
          )}
        </div>
      </div>

      {task.status === 'analyzing' && (
        <div className="analyzing">
          <div className="at">{task.uploadProgress != null && task.uploadProgress < 100 ? `서버로 전송 중 — ${task.uploadProgress}%` : '자동 분류 중…'}</div>
          <div className="scanbar">
            {task.uploadProgress != null && task.uploadProgress < 100
              ? <i className="det" style={{ width: task.uploadProgress + '%' }} />
              : <i />}
          </div>
          <div className="as">category · 메타데이터 추출 · 번들 그룹핑 · 관계 제안 — 다른 페이지로 이동해도 계속됩니다</div>
        </div>
      )}

      {task.status === 'failed' && <div className="failbox">{task.error || '알 수 없는 오류가 발생했습니다.'}</div>}

      {inReview && task.manifest && (
        <>
          {task.manifest.summary && (
            <div style={{ fontSize: 12, color: 'var(--t3)', margin: '4px 0 2px' }}>
              자동 채움 <b style={{ color: 'var(--auto, #7FB1E8)' }}>{task.manifest.summary.auto_filled_percentage}%</b>
              {' · '}수동 입력 필요 필드 <b style={{ color: 'var(--draft)' }}>{task.manifest.summary.manual_required_fields}</b>개
            </div>
          )}
          {/* 등록 요청 중에는 검토 영역을 비활성 — 클릭 후 수정이 조용히 유실되는 것 방지 */}
          <div
            style={task.status === 'registering' ? { pointerEvents: 'none', opacity: 0.65 } : undefined}
            aria-disabled={task.status === 'registering'}
          >
            {task.type === 'bulk'
              ? <BulkTable rows={rows} onEdit={onEdit} onExclude={onExclude} onLocation={onLocation} />
              : rows.map(row => (
                <SingleCard
                  key={row.idx} row={row} onEdit={onEdit} onExclude={onExclude} onLocation={onLocation}
                  suggestions={suggestions.filter(s => s.sourceIdx === row.idx)}
                  acceptance={acceptance}
                  excludedSet={excludedSet}
                  onToggleLink={(key, val) => toggleLinkAccept(task.id, key, val)}
                />
              ))}
          </div>

          <div className="actbar">
            <div className="summary">
              <b>{includedCount}건</b>이 <b style={{ color: 'var(--draft)' }}>Draft</b>로 등록됩니다
              {rows.length !== includedCount && ` · ${rows.length - includedCount}건 제외`}
              {acceptedCount > 0 && <> · 관계 <b style={{ color: 'var(--blue)' }}>{acceptedCount}건</b> 함께 연결</>}
            </div>
            <div className="right">
              <button
                type="button" className="btn primary"
                disabled={task.status === 'registering' || includedCount === 0}
                onClick={() => registerTask(task.id)}
              >
                {task.status === 'registering' ? '등록 중…' : `${includedCount}건 Draft로 등록 →`}
              </button>
            </div>
          </div>
        </>
      )}

      {task.status === 'registered' && <DoneView task={task} onRemove={() => removeTask(task.id)} />}
    </div>
  )
}
