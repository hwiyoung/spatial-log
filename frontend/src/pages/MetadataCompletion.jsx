/**
 * MetadataCompletion — 메타데이터 보완 (route: /complete/:collectionId/:itemId)
 *
 * Draft → Published 전환의 라이브 품질 게이트. 좌측에서 필수(차단) 필드를 채우면
 * 우측 게이트 패널이 실시간으로 진행률·차단 항목을 보여주고, 충족 시 Published 전환.
 * Project 연결은 비차단(별개 축) — "Published ≠ 완벽" 원칙 (preview 실패·미배정은 막지 않음).
 *
 * 저장 = updateProperties, 전환 = updateStatus(백엔드 게이트 재검증).
 * mock 모드(?mock=1)는 로컬 상태 데모만 (영속 저장/전환 없음).
 *
 * 참조: design-reference/project/MetadataCompletion.html (Claude Design 핸드오프)
 *      docs/stac_metadata_design_v4.md (필수/선택 매트릭스)
 * 주의: 데모 전용(예시 Draft switcher · 예시값 채우기)은 제외.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { itemApi, collectionApi } from '../services/api'
import { isMockExplorerMode, mockExplorerDataSource } from '../mocks/mockExplorerDataSource'
import { getExplorerItemView } from '../features/explorer/getExplorerItemView.js'
import { buildCompletionSpec } from '../features/completion/buildCompletionSpec.js'
import { STATUS_META, PREVIEW_META, SPATIAL_LABEL, tint } from '../features/explorer/explorerMeta'
import { getCategoryInfo } from '../constants'
import CategoryGlyph from '../components/viewer/CategoryGlyph'
import AcquiredDateTimeInput from '../components/upload/AcquiredDateTimeInput'
import '../styles/completion.css'

function Badge({ status }) {
  const v = STATUS_META[status] || STATUS_META.unknown
  return (
    <span className="badge" style={{ color: v.color, borderColor: tint(v.color, 40), background: tint(v.color, 8), borderStyle: v.dashed ? 'dashed' : 'solid' }}>
      {v.label}
    </span>
  )
}

function Field({ f, value, prov, onChange }) {
  const miss = !value && f.block && !f.readonly
  return (
    <div className={'field' + (miss ? ' miss' : '')} id={'mcf-' + f.key}>
      <div className="f-label">
        <span className="f-name">{f.kind === 'category' && value && <CategoryGlyph cat={value} s={15} />}{f.label}</span>
        <span className="f-key">{f.key}</span>
        {f.hint && <span className="f-hint">{f.hint}</span>}
      </div>
      <div className="f-input">
        {f.readonly ? (
          <span className="f-readonly">{f.kind === 'category' ? getCategoryInfo(value).label : value}</span>
        ) : f.kind === 'datetime' ? (
          <AcquiredDateTimeInput value={value} autoValue={f.seed} onChange={onChange} />
        ) : f.kind === 'select' ? (
          <select value={value} onChange={e => onChange(e.target.value)}>
            <option value="">— 선택 —</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input value={value} placeholder={miss ? '미입력 — 보완 필요' : ''} onChange={e => onChange(e.target.value)} />
        )}
        <span className={'prov ' + prov}>{prov === 'auto' ? 'AUTO' : prov === 'manual' ? '수동' : '미입력'}</span>
      </div>
    </div>
  )
}

function collectionTitle(col) {
  return col?.title || col?.id || ''
}

function collectionSite(col) {
  return col?.summaries?.['project:site'] || col?.properties?.['project:site'] || ''
}

function collectionOptionLabel(col) {
  const title = collectionTitle(col)
  return title && title !== col.id ? `${title} (${col.id})` : title
}

function projectMetadataForCollection(col) {
  if (!col || col.id === 'unassigned-inbox') return { name: '', site: '' }
  return {
    name: collectionTitle(col),
    site: collectionSite(col),
  }
}

export default function MetadataCompletion() {
  const { collectionId, itemId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isMock = useMemo(() => isMockExplorerMode(), [])

  const [item, setItem] = useState(null)
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [vals, setVals] = useState({})
  const [seeds, setSeeds] = useState({})
  const [touched, setTouched] = useState({})   // 사용자가 직접 수정한 키 — 저장 후에도 '수동' 유지
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      try {
        const [itemRes, colRes] = await Promise.all([
          isMock ? mockExplorerDataSource.getItem(collectionId, itemId) : itemApi.get(collectionId, itemId),
          (isMock ? mockExplorerDataSource.listCollections() : collectionApi.list()).catch(() => ({ data: { collections: [] } })),
        ])
        if (cancelled) return
        const loaded = itemRes.data
        setItem(loaded)
        setCollections(colRes.data?.collections || [])
        if (loaded) {
          const v = getExplorerItemView(loaded, colRes.data?.collections || [])
          const spec = buildCompletionSpec(loaded, v)
          const seed = {}
          ;[...spec.quality, ...spec.type].forEach(f => { seed[f.key] = f.seed })
          setSeeds(seed)
          setVals(seed)
          setTouched({})
          setSelectedProjectId(loaded.collection || collectionId)
          setPublished(v.status === 'published')
        }
      } catch (err) {
        console.error('Item 로드 실패:', err)
        if (!cancelled) setItem(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [collectionId, itemId, isMock])

  const view = useMemo(() => (item ? getExplorerItemView(item, collections) : null), [item, collections])
  const spec = useMemo(() => (item && view ? buildCompletionSpec(item, view) : null), [item, view])
  const selectedProject = useMemo(
    () => collections.find(c => c.id === selectedProjectId) || null,
    [collections, selectedProjectId],
  )
  const selectedProjectMeta = useMemo(() => projectMetadataForCollection(selectedProject), [selectedProject])
  const projectWillMove = Boolean(selectedProjectId && selectedProjectId !== collectionId)
  const projectAssigned = Boolean(selectedProjectId && selectedProjectId !== 'unassigned-inbox')

  // 진입 출처(Detail/Explorer/Upload)에 따라 돌아갈 곳을 맞춘다 — navigate state 의 from 힌트
  const origin = location.state?.from || 'detail'
  const BACK = {
    detail: { label: 'Detail', pathname: `/detail/${collectionId}/${itemId}` },
    explorer: { label: 'Explorer', pathname: '/' },
    upload: { label: 'Upload', pathname: '/upload' },
    project: { label: 'Project', pathname: '/project' },
  }[origin] || { label: 'Detail', pathname: `/detail/${collectionId}/${itemId}` }
  const goBack = () => {
    const search = new URLSearchParams(location.search)
    if (origin === 'project') search.set('col', collectionId)   // Project 복귀 시 원래 프로젝트 복원
    navigate({ pathname: BACK.pathname, search: search.toString() })
  }

  if (loading) return <div className="mc"><div className="mc-fallback"><div className="t">불러오는 중…</div></div></div>
  if (!item || !view || !spec) {
    return (
      <div className="mc">
        <div className="mc-fallback">
          <div className="t">Item을 찾을 수 없습니다</div>
          <div style={{ fontSize: 12.5 }}>{collectionId} / {itemId}</div>
          <button type="button" className="back" onClick={() => navigate('/')}>← Explorer로</button>
        </div>
      </div>
    )
  }

  const allFields = [...spec.quality, ...spec.type]
  // 시드에 있던 값=AUTO(기존/자동 추출), 사용자가 만진 키=수동(저장 후에도 유지), 빈 값=미입력
  const provOf = (f) => (f.readonly ? 'auto' : !(vals[f.key] || '').trim() ? 'needed' : touched[f.key] ? 'manual' : 'auto')
  const blockers = allFields.filter(f => f.block && !f.readonly && !(vals[f.key] || '').trim())
  const totalReq = allFields.filter(f => f.block).length
  const filledReq = totalReq - blockers.length
  const gateMet = blockers.length === 0
  const sectionOf = (f) => (spec.type.includes(f) ? 'Type-specific' : '품질')
  const pv = PREVIEW_META[view.preview] || PREVIEW_META.missing

  const focusField = (key) => {
    const el = document.getElementById('mcf-' + key)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const inp = el.querySelector('input,select')
      if (inp) inp.focus()
    }
  }

  // datetime 은 pgSTAC 필수 — 비우거나 ISO8601 이 아니면 저장/전환 전에 막는다
  const validateDatetime = () => {
    const f = allFields.find(x => x.key === 'datetime')
    if (!f) return true
    const raw = (vals.datetime || '').trim()
    if (!raw) {
      alert('취득 일시(datetime)는 비울 수 없습니다 — ISO8601 형식으로 입력하세요.')
      focusField('datetime')
      return false
    }
    if (Number.isNaN(new Date(raw).getTime())) {
      alert(`취득 일시 형식이 올바르지 않습니다: "${raw}"\nISO8601 예: 2024-03-12T09:30:00Z`)
      focusField('datetime')
      return false
    }
    return true
  }

  // 변경분만 추출 — trim 비교, 숫자 필드는 숫자로 강제, 빈 값은 null(삭제)
  const changedPayload = () => {
    const payload = {}
    allFields.forEach(f => {
      if (f.readonly) return
      const next = (vals[f.key] || '').trim()
      if (next === (seeds[f.key] || '').trim()) return
      if (!next) { payload[f.key] = null; return }
      if (f.kind === 'number') {
        const num = Number(next)
        payload[f.key] = Number.isFinite(num) ? num : next   // 비수치는 그대로 — 백엔드/사용자 검증에 노출
      } else {
        payload[f.key] = next
      }
    })
    if (projectWillMove) {
      payload['project:name'] = selectedProjectMeta.name || null
      payload['project:site'] = selectedProjectMeta.site || null
    }
    return payload
  }

  const handleSave = async () => {
    if (!validateDatetime()) return
    const payload = changedPayload()
    if (Object.keys(payload).length === 0 && !projectWillMove) { showToast('변경된 내용이 없습니다'); return }
    if (isMock) { showToast('저장됨 (데모 세션 — 영속되지 않음)'); return }
    setSaving(true)
    try {
      if (Object.keys(payload).length > 0) {
        await itemApi.updateProperties(collectionId, itemId, payload)
        setSeeds(s => ({ ...s, ...Object.fromEntries(Object.entries(payload).filter(([k]) => k in s).map(([k, v]) => [k, v == null ? '' : String(v)])) }))
      }
      if (projectWillMove) {
        await itemApi.move(collectionId, itemId, selectedProjectId)
        showToast('프로젝트가 변경되었습니다')
        navigate(
          { pathname: `/complete/${selectedProjectId}/${itemId}`, search: location.search },
          { replace: true, state: location.state },
        )
      } else {
        showToast('Draft가 저장되었습니다')
      }
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!gateMet || published) return
    if (!validateDatetime()) return
    if (isMock) { setPublished(true); showToast('Published로 전환 (데모 세션)'); return }
    setPublishing(true)
    try {
      // 미저장 변경분 먼저 저장 후 전환 — 백엔드 게이트가 최종 검증한다
      const payload = changedPayload()
      if (Object.keys(payload).length > 0) await itemApi.updateProperties(collectionId, itemId, payload)
      const statusCollectionId = projectWillMove ? selectedProjectId : collectionId
      if (projectWillMove) await itemApi.move(collectionId, itemId, selectedProjectId)
      await itemApi.updateStatus(`${statusCollectionId}/${itemId}`, 'published')
      setPublished(true)
      showToast('Published로 전환되었습니다')
      if (projectWillMove) {
        navigate(
          { pathname: `/complete/${selectedProjectId}/${itemId}`, search: location.search },
          { replace: true, state: location.state },
        )
      }
    } catch (err) {
      alert('전환 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setPublishing(false)
    }
  }

  const gateClass = published ? 'gate-done' : gateMet ? 'gate-ready' : 'gate-blocked'

  return (
    <div className="mc">
      <div className="page">
        <div className="dcrumb">
          <button type="button" className="back" onClick={goBack}>← {BACK.label}로</button>
          <span className="crumb"><b>{BACK.label}</b> › 메타데이터 보완{isMock && ' · Mock Demo'}</span>
        </div>

        <div className="ptitle">메타데이터 보완 <span className="tag">Draft → Published 후보</span></div>

        <div className="layout">
          {/* ---- main ---- */}
          <div>
            <div className="summary">
              <div className="sum-tile">
                {view.thumbnailHref
                  ? <img key={view.thumbnailHref} src={view.thumbnailHref} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                  : <CategoryGlyph cat={view.cat} s={30} />}
              </div>
              <div className="sum-main">
                <div className="sum-top">
                  <span className="sum-name">{vals.description || view.name}</span>
                  <Badge status={published ? 'published' : view.status} />
                  <span className="flag">유형 · {getCategoryInfo(view.cat).label}</span>
                </div>
                <div className="sum-file">{view.file} · {view.id}</div>
                <div className="sum-flags">
                  <span className="flag"><i style={{ background: pv.color }} />preview {view.preview}</span>
                  <span className="flag">위치 · {SPATIAL_LABEL[view.src] || SPATIAL_LABEL.none}</span>
                  <span className="flag">{view.isUnassigned ? '◇ 프로젝트 미배정' : `프로젝트 · ${view.projectName}`}</span>
                </div>
                {view.draftReason && !published && (
                  <div className="draftreason"><span className="dr-b">Draft</span> {view.draftReason}</div>
                )}
              </div>
            </div>

            <div className="sec">
              <div className="sec-h">
                <h2>Required Fields · 품질</h2>
                <span className="sec-sub">검색·재사용 최소 품질</span>
                <span className="sec-pill block">Published 차단</span>
              </div>
              {spec.quality.map(f => (
                <Field key={f.key} f={f} value={vals[f.key] || ''} prov={provOf(f)} onChange={val => { setTouched(t => ({ ...t, [f.key]: true })); setVals(v => ({ ...v, [f.key]: val })) }} />
              ))}
            </div>

            {spec.type.length > 0 && (
              <div className="sec">
                <div className="sec-h">
                  <h2>Type-specific · {getCategoryInfo(view.cat).label}</h2>
                  <span className="sec-sub">{view.cat} 필수값</span>
                  <span className="sec-pill block">Published 차단</span>
                </div>
                {spec.type.map(f => (
                  <Field key={f.key} f={f} value={vals[f.key] || ''} prov={provOf(f)} onChange={val => { setTouched(t => ({ ...t, [f.key]: true })); setVals(v => ({ ...v, [f.key]: val })) }} />
                ))}
              </div>
            )}

            <div className="sec aux">
              <div className="sec-h">
                <h2>Project 연결</h2>
                <span className="sec-sub">status와 별개 축</span>
                <span className="sec-pill free">Published 비차단</span>
              </div>
              <div className="field" id="mcf-project">
                <div className="f-label"><span className="f-name">프로젝트</span><span className="f-key">project:name</span></div>
                <div className="f-input">
                  <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{collectionOptionLabel(c)}</option>
                    ))}
                  </select>
                  <span className={'prov ' + (projectWillMove ? 'manual' : 'auto')}>{projectWillMove ? '이동' : '현재'}</span>
                </div>
              </div>
              <div className="field">
                <div className="f-label"><span className="f-name">사이트</span><span className="f-key">project:site</span></div>
                <div className="f-input">
                  <span className="f-readonly">{selectedProjectMeta.site || '—'}</span>
                  <span className={'prov ' + (selectedProjectMeta.site ? 'auto' : 'needed')}>{selectedProjectMeta.site ? 'AUTO' : '미입력'}</span>
                </div>
              </div>
              <div className="proj-note">
                <span>i</span>
                <div><b>{projectWillMove ? '저장하면 실제 프로젝트 소속이 변경됩니다.' : '현재 실제 프로젝트 소속입니다.'}</b> 프로젝트를 바꾸면 선택한 Collection 값으로 project:name/site가 기록됩니다.</div>
              </div>
            </div>
          </div>

          {/* ---- gate aside ---- */}
          <div className="aside">
            <div className={'gate ' + gateClass}>
              <div className="gate-hd">
                <div className="gate-state">
                  <span className="gate-ico">{published || gateMet ? '✓' : '!'}</span>
                  <div>
                    <div className="gate-lbl">{published ? 'Published 전환됨' : gateMet ? 'Published 가능' : '보완 필요'}</div>
                    <div className="gate-sub">
                      {published ? '검색·재사용 가능 상태' : gateMet ? '품질 기준 충족 — 전환할 수 있습니다' : `${blockers.length}개 품질 항목이 막고 있습니다`}
                    </div>
                  </div>
                </div>
                <div className="gate-prog">
                  <div className="gate-bar"><div className="gate-fill" style={{ width: Math.round((filledReq / totalReq) * 100) + '%' }} /></div>
                  <div className="gate-progl"><span>품질 필드 {filledReq}/{totalReq}</span><span>{Math.round((filledReq / totalReq) * 100)}%</span></div>
                </div>
              </div>

              <div className="gate-body">
                {!gateMet ? (
                  <>
                    <div className="gate-blk-h">막고 있는 항목</div>
                    {blockers.map(f => (
                      <div className="blk-row" key={f.key} onClick={() => focusField(f.key)}>
                        <span className="blk-dot" /><span>{f.label}</span><span className="blk-sec">{sectionOf(f)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="gate-allok">✓ 모든 품질 필드가 충족되었습니다</div>
                )}

                {view.preview === 'failed' && (
                  <div className="note-card warn">
                    <span className="ni">⚠</span>
                    <div><b>preview 실패는 Published를 막지 않습니다.</b>{view.previewFail && <> 사유: <span className="mono">{view.previewFail}</span></>}</div>
                  </div>
                )}
                {!projectAssigned && (
                  <div className="note-card info"><span className="ni">◇</span><div><b>프로젝트 미배정</b> — Published 비차단. 나중에 배정 가능.</div></div>
                )}
                {gateMet && !published && (
                  <div className="note-card"><span className="ni">✎</span><div>Published ≠ 완벽. 일부 optional 필드나 preview 실패는 남을 수 있으며 그 사유는 기록됩니다.</div></div>
                )}
              </div>

              <div className="gate-acts">
                <button type="button" className="gact pub" disabled={!gateMet || published || publishing} onClick={handlePublish}>
                  {published ? '✓ Published' : publishing ? '전환 중…' : 'Published로 전환'}
                </button>
                <div className="gact-row">
                  <button type="button" className="gact" onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
                  <button type="button" className="gact" onClick={() => focusField('project')}>Project 연결</button>
                </div>
                <button type="button" className="gact ghost" onClick={goBack}>← {BACK.label}로 돌아가기</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
