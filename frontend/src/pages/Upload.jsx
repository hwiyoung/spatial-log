/**
 * Upload — 폴더 업로드 + 개별 업로드 페이지
 *
 * 파일 선택 즉시 분석이 시작되며(자동), 사용자는 다른 페이지로 이동해서 다른 작업을
 * 할 수 있다. 분석 진행 중인 task는 우하단 floating UploadStatusBar에 표시된다.
 *
 * 폴더: 폴더를 선택/드래그하면 즉시 분석 시작 → 매니페스트 확인 → 등록
 * 개별: 1개~다수 파일을 선택/드래그하면 즉시 분석 시작 → 매니페스트 확인 → 등록
 *
 * 참조: docs/system_structure_design.md 페이지 4
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collectionApi } from '../services/api'
import { getCategoryInfo, formatSize } from '../constants'
import { useUploadTasks } from '../contexts/UploadTasksContext'
import LocationPicker from '../components/LocationPicker'

export default function Upload() {
  const [mode, setMode] = useState('bulk') // 'bulk' | 'single'
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [autoRegister, setAutoRegister] = useState(false)
  const { tasks, startAnalysis } = useUploadTasks()

  useEffect(() => {
    collectionApi.list()
      .then(res => setCollections(res.data?.collections || []))
      .catch(() => {})
  }, [])

  // 현재 mode와 일치하는 task 목록
  const visibleTasks = tasks.filter(t => t.type === mode)

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>데이터 업로드</div>

        {/* 모드 탭 */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
          {[
            { id: 'bulk', label: '📁 폴더 업로드' },
            { id: 'single', label: '📄 개별 업로드' },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setMode(t.id)}
              style={{
                padding: '8px 20px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 14,
                background: mode === t.id ? 'var(--s1)' : 'transparent',
                color: mode === t.id ? 'var(--ac)' : 'var(--t3)',
                border: mode === t.id ? '1px solid var(--bd)' : '1px solid transparent',
                borderBottom: mode === t.id ? '1px solid var(--s1)' : '1px solid var(--bd)',
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* 컨테이너 */}
        <div style={{ padding: 20, background: 'var(--s1)', borderRadius: 10, border: '1px solid var(--bd)' }}>
          {/* Collection 선택 */}
          <div style={{ marginBottom: 16 }}>
            <Label>Collection 선택</Label>
            <select
              value={selectedCollection}
              onChange={e => setSelectedCollection(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)',
                background: 'var(--s2)', color: 'var(--t1)', fontSize: 14,
              }}
            >
              <option value="">Collection을 선택하세요 (선택사항)</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
            </select>
          </div>

          {/* 드롭존 — 파일 선택 즉시 분석 시작 */}
          {mode === 'bulk' ? (
            <FolderDropzone
              onFiles={(files) => startAnalysis(files, 'bulk', selectedCollection, autoRegister)}
            />
          ) : (
            <IndividualDropzone
              onFiles={(files) => startAnalysis(files, 'single', selectedCollection, autoRegister)}
            />
          )}

          {/* 자동 등록 옵션 + 안내 */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: autoRegister ? 'rgba(74,114,255,0.06)' : 'var(--s2)',
              borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${autoRegister ? 'rgba(74,114,255,0.3)' : 'var(--bd)'}`,
            }}>
              <input
                type="checkbox"
                checked={autoRegister}
                onChange={e => setAutoRegister(e.target.checked)}
                style={{ accentColor: 'var(--ac)', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontSize: 13, color: autoRegister ? 'var(--ac)' : 'var(--t1)', fontWeight: 500 }}>
                  분석 완료 후 자동 등록
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  체크하면 분석이 끝나는 즉시 Draft로 자동 등록됩니다. 대용량 업로드 시 자리를 비울 수 있습니다.
                </div>
              </div>
            </label>
            <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--t3)' }}>
              💡 파일을 선택하면 자동으로 분석이 시작됩니다. 분석 중에도 다른 페이지로 이동하거나 새 작업을 시작할 수 있습니다.
            </div>
          </div>
        </div>

        {/* Task 목록 */}
        {visibleTasks.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 10 }}>
              업로드 작업 ({visibleTasks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visibleTasks.slice().reverse().map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// TaskCard — 개별 업로드 작업 카드
// ─────────────────────────────────────────────────────────────────────────

function TaskCard({ task }) {
  const navigate = useNavigate()
  const { registerTask, cancelTask, removeTask, updateLocationOverride } = useUploadTasks()

  const statusInfo = {
    analyzing: { icon: '⏳', label: '분석 중...', color: 'var(--ac)' },
    analyzed: { icon: '📋', label: '등록 대기', color: 'var(--warn)' },
    registering: { icon: '⬆', label: '등록 중...', color: 'var(--ac)' },
    registered: { icon: '✅', label: '등록 완료', color: 'var(--ok)' },
    failed: { icon: '⚠', label: '실패', color: 'var(--err)' },
  }[task.status]

  const elapsed = Math.floor((Date.now() - task.startedAt) / 1000)

  return (
    <div style={{
      padding: 16, background: 'var(--s1)', borderRadius: 10, border: '1px solid var(--bd)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{statusInfo.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: statusInfo.color, display: 'flex', alignItems: 'center', gap: 6 }}>
            {statusInfo.label}
            {task.autoRegister && task.status !== 'registered' && (
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(74,114,255,0.12)', color: 'var(--ac)' }}>자동 등록</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            파일 {task.fileCount}개 · {task.collectionId || '(Collection 미지정)'}
            {task.status === 'analyzing' && ` · ${elapsed}초 경과`}
          </div>
        </div>
        {(task.status === 'analyzing' || task.status === 'registering') && (
          <button onClick={() => cancelTask(task.id)} style={{ ...btnGhostStyle, color: 'var(--err)', borderColor: 'var(--err)' }}>취소</button>
        )}
        {(task.status === 'registered' || task.status === 'failed') && (
          <button onClick={() => removeTask(task.id)} style={btnGhostStyle}>닫기</button>
        )}
      </div>

      {/* 분석 중 — 진행률 표시 */}
      {task.status === 'analyzing' && (
        <div style={{ padding: '12px 14px', background: 'var(--s2)', borderRadius: 6 }}>
          {task.uploadProgress != null && task.uploadProgress < 100 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--t2)', marginBottom: 6 }}>
                <span>서버로 전송 중...</span>
                <span style={{ color: 'var(--ac)', fontWeight: 600 }}>{task.uploadProgress}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--s1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${task.uploadProgress}%`,
                  background: 'var(--ac)', borderRadius: 3, transition: 'width 0.3s',
                }} />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--t2)' }}>
              백엔드에서 파일을 분석 중입니다. 다른 페이지로 이동하거나 새로고침해도 작업은 계속됩니다.
            </div>
          )}
        </div>
      )}

      {/* 실패 */}
      {task.status === 'failed' && (
        <div style={{ padding: '12px 14px', background: 'rgba(240,96,96,0.06)', borderRadius: 6, fontSize: 13, color: 'var(--err)' }}>
          {task.error || '알 수 없는 오류가 발생했습니다.'}
        </div>
      )}

      {/* 등록 완료 */}
      {task.status === 'registered' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8 }}>
            {task.registeredCount || 0}개 Item이 Draft 상태로 등록되었습니다.
          </div>
          {task.partialErrors && task.partialErrors.length > 0 && (
            <div style={{ padding: '10px 12px', background: 'rgba(240,180,42,0.06)', border: '1px solid rgba(240,180,42,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--warn)', marginBottom: 8 }}>
              ⚠ 일부 실패: {task.partialErrors.length}건
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {task.partialErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/')} style={btnPrimaryStyle}>Explorer로 이동</button>
            <button onClick={() => navigate('/project')} style={btnGhostStyle}>Project로 이동</button>
          </div>
        </div>
      )}

      {/* 분석 완료 — 매니페스트 표시 + 등록 버튼 */}
      {(task.status === 'analyzed' || task.status === 'registering') && task.manifest && (
        <div>
          <div style={{
            padding: 10, background: 'var(--s2)', borderRadius: 6, marginBottom: 10,
            fontSize: 12, color: 'var(--t2)',
          }}>
            전체 <b style={{ color: 'var(--t1)' }}>{task.manifest.summary?.total_files || task.manifest.manifest.length}</b>개 Item
            {task.manifest.summary && (
              <>
                {' · '}자동 채움: <b style={{ color: 'var(--ac)' }}>{task.manifest.summary.auto_filled_percentage}%</b>
                {' · '}수동 입력: <b style={{ color: 'var(--err)' }}>{task.manifest.summary.manual_required_fields}</b>개
              </>
            )}
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto', marginBottom: 12 }}>
            {task.manifest.manifest.map((item, idx) => (
              <ManifestRow
                key={idx} item={item} index={idx}
                expanded={task.manifest.manifest.length === 1}
                location={task.locationOverrides[idx]}
                onLocationChange={(loc) => updateLocationOverride(task.id, idx, loc)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => registerTask(task.id)}
              disabled={task.status === 'registering'}
              style={{ ...btnPrimaryStyle, opacity: task.status === 'registering' ? 0.5 : 1 }}
            >
              {task.status === 'registering' ? '등록 중...' : `${task.manifest.manifest.length}개 Item Draft로 등록`}
            </button>
            {task.status === 'analyzed' && (
              <button onClick={() => removeTask(task.id)} style={btnGhostStyle}>취소</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 드롭존
// ─────────────────────────────────────────────────────────────────────────

function FolderDropzone({ onFiles }) {
  const [over, setOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setOver(false)
    const items = e.dataTransfer.items
    if (items) {
      const promises = []
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.()
        if (entry) promises.push(readEntry(entry))
      }
      Promise.all(promises).then(results => {
        const all = results.flat()
        if (all.length > 0) onFiles(all)
      })
    } else {
      const dropped = [...e.dataTransfer.files]
      if (dropped.length > 0) onFiles(dropped)
    }
  }

  function handleSelect(e) {
    const selected = [...e.target.files]
    if (selected.length > 0) onFiles(selected)
    e.target.value = ''  // 동일 파일 재선택 가능하게
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        style={{
          padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
          border: `2px dashed ${over ? 'var(--ac)' : 'var(--bd)'}`,
          borderRadius: 10, transition: '0.2s',
          background: over ? 'rgba(74,114,255,0.03)' : 'transparent',
        }}
      >
        <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 4 }}>
          폴더를 여기에 드래그하세요
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <span
            onClick={(e) => { e.stopPropagation(); document.getElementById('bulk-folder').click() }}
            style={{ fontSize: 13, color: 'var(--ac)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            폴더 선택
          </span>
        </div>
      </div>
      <input
        id="bulk-folder"
        type="file"
        webkitdirectory=""
        onChange={handleSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

function IndividualDropzone({ onFiles }) {
  const [over, setOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setOver(false)
    const dropped = [...e.dataTransfer.files]
    if (dropped.length > 0) onFiles(dropped)
  }

  function handleSelect(e) {
    const selected = [...e.target.files]
    if (selected.length > 0) onFiles(selected)
    e.target.value = ''
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        style={{
          padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
          border: `2px dashed ${over ? 'var(--ac)' : 'var(--bd)'}`,
          borderRadius: 10, transition: '0.2s',
          background: over ? 'rgba(74,114,255,0.03)' : 'transparent',
        }}
      >
        <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 4 }}>
          파일을 여기에 드래그하세요 (1개 또는 여러 개)
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <span
            onClick={(e) => { e.stopPropagation(); document.getElementById('individual-files').click() }}
            style={{ fontSize: 13, color: 'var(--ac)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            파일 선택
          </span>
        </div>
      </div>
      <input
        id="individual-files"
        type="file"
        multiple
        onChange={handleSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// ManifestRow — 매니페스트 항목 한 줄 (위치 지정 포함)
// ─────────────────────────────────────────────────────────────────────────

function ManifestRow({ item, index, expanded: defaultExpanded, location, onLocationChange }) {
  const [expanded, setExpanded] = useState(defaultExpanded || false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const cat = getCategoryInfo(item.detected_category)
  const hasAutoLocation = !!item.auto_extracted?.bbox_4326

  return (
    <div style={{
      padding: '10px 14px', background: 'var(--s2)', borderRadius: 8,
      border: '1px solid var(--bd)', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, color: cat.color }}>{cat.icon}</span>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--t1)', wordBreak: 'break-all' }}>{item.file_path}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: cat.color + '12', color: cat.color, flexShrink: 0,
        }}>{cat.label} ({(item.category_confidence * 100).toFixed(0)}%)</span>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 12, color: 'var(--ac)', cursor: 'pointer', flexShrink: 0 }}
        >{expanded ? '▼ 접기' : '▶ 상세'}</span>
      </div>

      {/* 위치 정보 */}
      {!hasAutoLocation && !location && (
        <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 4 }}>
          ⚠ 위치 정보 없음 —{' '}
          <span
            onClick={() => setShowLocationPicker(true)}
            style={{ color: 'var(--ac)', cursor: 'pointer', textDecoration: 'underline' }}
          >지도에서 위치 지정</span>
        </div>
      )}
      {location && (
        <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 4 }}>
          📍 위도 {location[1].toFixed(6)}°, 경도 {location[0].toFixed(6)}°{' '}
          <span
            onClick={() => setShowLocationPicker(true)}
            style={{ color: 'var(--ac)', cursor: 'pointer', marginLeft: 4 }}
          >수정</span>
        </div>
      )}
      {hasAutoLocation && !location && (
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
          📍 자동 추출 좌표 사용{' '}
          <span
            onClick={() => setShowLocationPicker(true)}
            style={{ color: 'var(--ac)', cursor: 'pointer' }}
          >직접 지정</span>
        </div>
      )}

      {/* 필수 빈 필드 */}
      {item.required_empty?.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 4 }}>
          ⚠ 수동 입력 필요: {item.required_empty.join(', ')}
        </div>
      )}

      {/* 관계 제안 */}
      {item.suggested_links?.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>
          🔗 관계 제안: {item.suggested_links.map(l => `${l.rel} → ${l.target_file.split('/').pop()}`).join(', ')}
        </div>
      )}

      {/* 확장: 추출 메타데이터 */}
      {expanded && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--s1)', borderRadius: 6, fontSize: 12 }}>
          {Object.entries(item.auto_extracted || {}).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ color: 'var(--ac)' }}>{key}</span>
              <span style={{ color: 'var(--t1)' }}>
                {typeof val.value === 'object' ? JSON.stringify(val.value) : String(val.value)}
                <span style={{ color: 'var(--t3)', marginLeft: 4 }}>[{val.source}]</span>
              </span>
            </div>
          ))}
          {Object.entries(item.inherited || {}).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ color: 'var(--ok)' }}>{key}</span>
              <span style={{ color: 'var(--t1)' }}>
                {String(val.value)} <span style={{ color: 'var(--t3)', marginLeft: 4 }}>[Collection]</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 위치 지정 모달 */}
      {showLocationPicker && (
        <LocationPicker
          initialLocation={location}
          onConfirm={(loc) => { onLocationChange(loc); setShowLocationPicker(false) }}
          onCancel={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────────────────────────

function Label({ children }) {
  return <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>{children}</div>
}

const btnPrimaryStyle = {
  padding: '8px 18px', borderRadius: 6, border: 'none',
  background: 'var(--ac)', color: '#fff',
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
}

const btnGhostStyle = {
  padding: '8px 16px', borderRadius: 6, border: '1px solid var(--bd)',
  background: 'transparent', color: 'var(--t2)',
  fontSize: 13, cursor: 'pointer',
}

// 폴더 드래그 시 재귀적으로 하위 파일을 읽는 헬퍼
function readEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(f => resolve([f]))
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
        })
      }
      readBatch()
    } else {
      resolve([])
    }
  })
}
