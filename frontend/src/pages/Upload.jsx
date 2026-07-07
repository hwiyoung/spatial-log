/**
 * Upload — 데이터 등록 (route: /upload)
 *
 * "완성된 데이터만 받는 문이 아니다" — 불완전해도 Draft로 안전하게 수용하고,
 * 자동 분류(category 신뢰도·preview·spatial 예측)로 "왜 Draft인지"를 등록 전에 드러낸다.
 * 단건(정밀·카드) / 벌크(효율·테이블) 두 모드. 파일 선택 즉시 백그라운드 분석이 시작되고
 * 다른 페이지로 이동해도 작업은 계속된다 (UploadTasksContext + UploadStatusBar).
 *
 * 참조: design-reference/project/Upload.html (Claude Design 핸드오프)
 *      docs/system_structure_design.md 페이지 4, docs/autofill_pipeline_spec.md
 * 주의: 데모 전용(mock fixture palette)은 제외 — 실제 파일 입력 + analyze 파이프라인 결과 사용.
 */
import { useEffect, useState } from 'react'
import { collectionApi } from '../services/api'
import { DEFAULT_UPLOAD_POLICY, formatUploadBytes, useUploadTasks } from '../contexts/UploadTasksContext'
import TaskSection from '../components/upload/TaskSection'
import '../styles/upload.css'

export default function Upload() {
  const [mode, setMode] = useState('single')   // single(정밀·카드) | bulk(효율·테이블)
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [autoRegister, setAutoRegister] = useState(false)
  const [pendingLargeUpload, setPendingLargeUpload] = useState(null)
  const { tasks, startAnalysis, uploadPolicy } = useUploadTasks()

  useEffect(() => {
    collectionApi.list()
      .then(res => setCollections(res.data?.collections || []))
      .catch(() => {})
  }, [])

  const visibleTasks = tasks.slice().reverse()
  const policy = uploadPolicy || DEFAULT_UPLOAD_POLICY

  function queueFiles(files) {
    const selected = [...files]
    if (selected.length === 0) return
    const totalBytes = selected.reduce((sum, f) => sum + (f.size || 0), 0)
    const warnBytes = policy.warn_upload_bytes || DEFAULT_UPLOAD_POLICY.warn_upload_bytes
    const maxBytes = policy.max_upload_bytes || DEFAULT_UPLOAD_POLICY.max_upload_bytes
    if (totalBytes >= warnBytes && totalBytes <= maxBytes) {
      setPendingLargeUpload({
        files: selected,
        mode,
        collectionId: selectedCollection,
        autoRegister,
        totalBytes,
        fileCount: selected.length,
      })
      return
    }
    startAnalysis(selected, mode, selectedCollection, autoRegister)
  }

  function confirmLargeUpload() {
    if (!pendingLargeUpload) return
    startAnalysis(
      pendingLargeUpload.files,
      pendingLargeUpload.mode,
      pendingLargeUpload.collectionId,
      pendingLargeUpload.autoRegister,
    )
    setPendingLargeUpload(null)
  }

  return (
    <div className="up">
      <div className="inner">
        <div className="uphead">
          <div>
            <h1>데이터 등록</h1>
            <div className="sub">
              완성된 데이터만 받는 문이 아닙니다. 불완전해도 <b>Draft로 안전하게 수용</b>하고,
              자동 분류로 "왜 Draft인지"를 등록 전에 먼저 드러냅니다.
            </div>
          </div>
          <div className="modetoggle">
            <button type="button" className={mode === 'single' ? 'on' : ''} onClick={() => setMode('single')}>
              단건 등록<span className="mt-s">정밀 · 1–2건</span>
            </button>
            <button type="button" className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>
              벌크 등록<span className="mt-s">효율 · 폴더/다수</span>
            </button>
          </div>
        </div>

        <div className="policy">
          <span className="pi">●</span>
          <div>
            업로드된 데이터는 모두 <b>Draft</b>로 시작합니다. Published 전환·프로젝트 배정은
            등록 이후 별개 축으로 진행됩니다 — 등록 단계에서 완벽함을 강요하지 않습니다.
          </div>
        </div>

        <div className="optrow">
          <div className="of">
            <label>Collection (프로젝트) · 선택</label>
            <select value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)} style={{ width: 260 }}>
              <option value="">미지정 — 새 Collection 자동 생성</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
            </select>
          </div>
          <label className={'autoreg' + (autoRegister ? ' on' : '')}>
            <input type="checkbox" checked={autoRegister} onChange={e => setAutoRegister(e.target.checked)} />
            분석 완료 시 자동 등록 — 검토 없이 즉시 Draft 등록
          </label>
        </div>

        <Dropzone
          mode={mode}
          onFiles={queueFiles}
        />

        {pendingLargeUpload && (
          <div className="large-warn" role="alert">
            <div className="lw-main">
              <span className="lw-ico">!</span>
              <div>
                <b>{formatUploadBytes(pendingLargeUpload.totalBytes)}</b> 대용량 업로드입니다.
                <span>
                  {' '}파일 {pendingLargeUpload.fileCount}개 · 경고 기준 {formatUploadBytes(policy.warn_upload_bytes)} 이상.
                  업로드와 자동 분류가 오래 걸릴 수 있으니 네트워크와 저장 공간을 확인하세요.
                </span>
              </div>
            </div>
            <div className="lw-actions">
              <button type="button" className="btn ghost" onClick={() => setPendingLargeUpload(null)}>취소</button>
              <button type="button" className="btn primary" onClick={confirmLargeUpload}>업로드 시작</button>
            </div>
          </div>
        )}

        {visibleTasks.map(task => <TaskSection key={task.id} task={task} />)}
      </div>
    </div>
  )
}

// 폴더 드래그 시 재귀적으로 하위 파일을 읽는 헬퍼 (webkitGetAsEntry).
// 에러 콜백 누락 시 promise 가 영원히 pending 으로 남아 드롭존이 조용히 멈춘다 — 실패는 빈 결과로 정착.
function readEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(f => {
        // 서브디렉토리 경로 보존 — 같은 이름의 파일이 다른 폴더에 있을 때 충돌 방지
        // (File.webkitRelativePath 는 디렉토리 input 전용이라 드롭에서는 비어 있다)
        try { f._relPath = (entry.fullPath || '').replace(/^\//, '') || f.name } catch { /* read-only 면 무시 */ }
        resolve([f])
      }, () => resolve([]))
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const allFiles = []
      function readBatch() {
        reader.readEntries(entries => {
          if (entries.length === 0) {
            resolve(allFiles)
          } else {
            Promise.all(entries.map(readEntry)).then(results => {
              allFiles.push(...results.flat())
              readBatch()
            })
          }
        }, () => resolve(allFiles))
      }
      readBatch()
    } else {
      resolve([])
    }
  })
}

function Dropzone({ mode, onFiles }) {
  const [hot, setHot] = useState(false)
  const inputId = mode === 'bulk' ? 'up-folder-input' : 'up-files-input'

  function handleDrop(e) {
    e.preventDefault()
    setHot(false)
    const items = e.dataTransfer.items
    if (mode === 'bulk' && items) {
      // 폴더 드롭 — 하위 파일 재귀 수집. entry 미지원/없음이면 평면 파일 목록으로 폴백.
      const flat = [...e.dataTransfer.files]
      const promises = []
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.()
        if (entry) promises.push(readEntry(entry))
      }
      Promise.all(promises).then(results => {
        const all = results.flat()
        if (all.length > 0) onFiles(all)
        else if (flat.length > 0) onFiles(flat)
      })
      return
    }
    const dropped = [...e.dataTransfer.files]
    if (dropped.length > 0) onFiles(dropped)
  }

  function handleSelect(e) {
    const selected = [...e.target.files]
    if (selected.length > 0) onFiles(selected)
    e.target.value = ''  // 동일 파일 재선택 가능하게
  }

  return (
    <div
      className={'drop' + (hot ? ' hot' : '')}
      onDragOver={e => { e.preventDefault(); setHot(true) }}
      onDragLeave={() => setHot(false)}
      onDrop={handleDrop}
    >
      <div className="di">⤓</div>
      <h3>{mode === 'single' ? '파일을 끌어다 놓거나 선택' : '폴더(또는 여러 파일)를 한 번에 끌어다 놓기'}</h3>
      <p>
        {mode === 'single'
          ? '정밀 등록 — 1~2개 파일의 분류·메타데이터를 카드에서 직접 확인'
          : '효율 등록 — 테이블에서 일괄 검토 + 행별 교정'}
      </p>
      <span className="pick" onClick={() => document.getElementById(inputId).click()}>
        {mode === 'bulk' ? '폴더 선택' : '파일 선택'}
      </span>
      {mode === 'bulk'
        ? <input id={inputId} type="file" webkitdirectory="" multiple onChange={handleSelect} style={{ display: 'none' }} />
        : <input id={inputId} type="file" multiple onChange={handleSelect} style={{ display: 'none' }} />}
    </div>
  )
}
