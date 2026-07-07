/**
 * UploadTasksContext — 업로드 작업의 전역 상태 관리
 *
 * 페이지 이동/다른 작업과 무관하게 백그라운드에서 진행되는 업로드 작업을 관리한다.
 * 파일 선택 즉시 분석이 시작되고, 사용자는 다른 페이지로 이동해서 다른 작업을 할 수 있다.
 *
 * 작업 상태 흐름: analyzing → analyzed → registering → registered (또는 failed)
 *
 * 영속성:
 *  - session_id를 프론트에서 미리 생성하여 localStorage에 저장
 *  - 새로고침 시 백엔드에 세션 상태를 조회하여 분석 완료된 task를 복구
 *  - 분석 중이더라도 백엔드에서 완료되었으면 manifest를 가져와서 복구
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { uploadApi } from '../services/api'
import { getSuggestions, resolveAcceptance } from '../features/upload/getSuggestionView'

// 설계서 §4.2 — 이 크기 이상은 presigned URL 로 브라우저가 MinIO 에 직접 업로드
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024
const DIRECT_UPLOAD_BATCH_THRESHOLD = 500 * 1024 * 1024
const DIRECT_UPLOAD_FILE_COUNT_THRESHOLD = 200
const LARGE_UPLOAD_CONCURRENCY = 3
const PART_RETRY_LIMIT = 3

export const DEFAULT_UPLOAD_POLICY = {
  max_upload_bytes: 1024 * 1024 * 1024 * 1024,
  warn_upload_bytes: 500 * 1024 * 1024 * 1024,
  large_file_threshold_bytes: LARGE_FILE_THRESHOLD,
  multipart_part_size_bytes: 64 * 1024 * 1024,
  multipart_max_parts: 10000,
}

const UploadTasksContext = createContext(null)
const STORAGE_KEY = 'sams_upload_tasks'

function generateSessionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const saved = JSON.parse(raw)
    // 1시간 이상 지난 완료/실패 task 정리
    const cutoff = Date.now() - 60 * 60 * 1000
    return saved.filter(t => {
      if ((t.status === 'registered' || t.status === 'failed') && t.startedAt < cutoff) return false
      return true
    })
  } catch {
    return []
  }
}

function saveToStorage(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // localStorage 용량 초과 등 무시
  }
}

function isCanceled(err) {
  return err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatUploadError(err) {
  if (err?.response?.data?.detail) return err.response.data.detail
  if (err?.message) return err.message
  return '알 수 없는 네트워크 오류'
}

export function formatUploadBytes(bytes) {
  if (bytes == null) return '—'
  const tib = 1024 * 1024 * 1024 * 1024
  const gib = 1024 * 1024 * 1024
  const mib = 1024 * 1024
  if (bytes >= tib) return `${(bytes / tib).toFixed(2).replace(/\.00$/, '')} TiB`
  if (bytes >= gib) return `${(bytes / gib).toFixed(1).replace(/\.0$/, '')} GiB`
  if (bytes >= mib) return `${(bytes / mib).toFixed(1).replace(/\.0$/, '')} MiB`
  return `${bytes} B`
}

async function waitForSessionAnalysis(sessionId, signal, onStatus) {
  let retried = false
  while (true) {
    const { data } = await uploadApi.getSession(sessionId, { signal })
    if (data.status === 'analyzed' && data.manifest) return data.manifest
    if (data.status === 'failed') throw new Error(data.error || '분석 실패')
    if (data.status === 'stalled' && data.can_retry && !retried) {
      retried = true
      onStatus?.('retrying')
      await uploadApi.retryAnalysis(sessionId, { signal })
    } else {
      onStatus?.(data.status || 'analyzing')
    }
    await sleep(2500)
  }
}

export function useUploadTasks() {
  const ctx = useContext(UploadTasksContext)
  if (!ctx) throw new Error('useUploadTasks must be used within UploadTasksProvider')
  return ctx
}

export function UploadTasksProvider({ children }) {
  const [tasks, setTasks] = useState(() => loadFromStorage())
  const [uploadPolicy, setUploadPolicy] = useState(DEFAULT_UPLOAD_POLICY)
  const taskIdCounter = useRef(0)
  const recoveryDone = useRef(false)
  const abortControllers = useRef({})

  useEffect(() => {
    uploadApi.getPolicy()
      .then(res => {
        setUploadPolicy({
          ...DEFAULT_UPLOAD_POLICY,
          ...(res.data || {}),
        })
      })
      .catch(() => {})
  }, [])

  // 새로고침 후 analyzing/registering 상태인 task를 백엔드에서 복구 시도
  useEffect(() => {
    if (recoveryDone.current) return
    recoveryDone.current = true

    const recoverableTasks = tasks.filter(
      t => (t.status === 'analyzing' || t.status === 'registering') && t.sessionId
    )
    if (recoverableTasks.length === 0) return

    // 각 task에 대해 10초 간격으로 분석 완료까지 폴링
    recoverableTasks.forEach((task) => {
      const poll = async () => {
        try {
          const res = await uploadApi.getSession(task.sessionId)
          const data = res.data
          if (data.status === 'analyzed' && data.manifest) {
            setTasks(prev => prev.map(t =>
              t.id === task.id
                ? { ...t, status: 'analyzed', manifest: data.manifest }
                : t
            ))
            return
          }
          if (data.status === 'failed') {
            setTasks(prev => prev.map(t =>
              t.id === task.id
                ? { ...t, status: 'failed', uploadProgress: null, error: data.error || '분석 실패' }
                : t
            ))
            return
          }
          setTimeout(poll, 10000)
        } catch {
          // 404 등 — 세션 아직 생성 안 됨 (업로드 진행 중), 계속 대기
          setTimeout(poll, 10000)
        }
      }
      poll()
    })
  }, [])

  // tasks 변경 시 localStorage 동기화
  useEffect(() => {
    saveToStorage(tasks)
  }, [tasks])

  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
  }, [])

  const startAnalysis = useCallback((files, type, collectionId, autoRegister = false) => {
    taskIdCounter.current += 1
    const taskId = `task-${Date.now()}-${taskIdCounter.current}`
    const sessionId = generateSessionId()

    const newTask = {
      id: taskId,
      type,
      status: 'analyzing',
      fileCount: files.length,
      collectionId: collectionId || '',
      sessionId,
      manifest: null,
      locationOverrides: {},
      rowEdits: {},        // {idx: {data_category?, description?, datetime?}} — 검토 단계 사용자 수정
      excludedRows: [],    // 등록에서 제외한 manifest 인덱스
      linkOverrides: {},   // {suggestionKey: bool} — 관계 제안 기본값에 대한 사용자 토글
      stagingKeys: {},     // {파일명: staging_key} — presigned 대용량 (등록 시 서버측 복사)
      error: null,
      startedAt: Date.now(),
      uploadProgress: 0,
      uploadStage: '업로드 준비 중',
      autoRegister,
    }

    setTasks(prev => [...prev, newTask])

    const controller = new AbortController()
    abortControllers.current[taskId] = controller

    ;(async () => {
      try {
        // 대용량은 presigned 로 MinIO 직행 (API multipart 를 거치지 않음 — 설계서 §4.2),
        // 소용량은 기존 multipart. 같은 세션이라 서버에서 한 배치로 분석된다.
        const stagingKeys = {}
        // 진행률은 배치 전체 바이트 기준 누적 — 파일마다 0→100 반복으로 보이지 않게
        const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1
        const maxUploadBytes = uploadPolicy.max_upload_bytes || DEFAULT_UPLOAD_POLICY.max_upload_bytes
        if (totalBytes > maxUploadBytes) {
          throw new Error(`업로드 크기가 최대 허용량(${formatUploadBytes(maxUploadBytes)})을 초과합니다.`)
        }
        const directSmallBatch = totalBytes >= DIRECT_UPLOAD_BATCH_THRESHOLD || files.length >= DIRECT_UPLOAD_FILE_COUNT_THRESHOLD
        const largeFiles = files.filter(f => f.size >= LARGE_FILE_THRESHOLD)
        const smallFiles = files.filter(f => f.size < LARGE_FILE_THRESHOLD)
        const directSmallFiles = directSmallBatch ? smallFiles : []
        const apiSmallFiles = directSmallBatch ? [] : smallFiles
        let doneBytes = 0
        // 폴더 업로드의 서브디렉토리 경로 보존 — basename 충돌(같은 이름 다른 폴더) 방지.
        // manifest 의 file_path(세션 디렉토리 상대경로)와 같은 키가 되어 stagingKeys 매칭이 일치한다.
        const relName = (f) => f.webkitRelativePath || f._relPath || f.name

        const uploadLargeFile = async (file, name) => {
          updateTask(taskId, { uploadStage: `대용량 업로드 준비 — ${name}` })
          const { data: init } = await uploadApi.initiateMultipart({
            session_id: sessionId,
            filename: name,
            size: file.size,
            content_type: file.type || 'application/octet-stream',
          }, { signal: controller.signal })

          const partSize = init.part_size || (64 * 1024 * 1024)
          const partCount = Math.ceil(file.size / partSize)
          const partProgress = Array(partCount).fill(0)
          const completedParts = []
          let nextPartIdx = 0
          let completedCount = 0

          const publishProgress = () => {
            const inFlightBytes = partProgress.reduce((sum, v) => sum + v, 0)
            updateTask(taskId, {
              uploadProgress: Math.min(99, Math.round(((doneBytes + inFlightBytes) / totalBytes) * 100)),
              uploadStage: `대용량 업로드 중 — ${name} (${completedCount}/${partCount})`,
            })
          }

          const uploadPart = async (idx) => {
            const partNumber = idx + 1
            const start = idx * partSize
            const end = Math.min(file.size, start + partSize)
            const blob = file.slice(start, end)

            for (let attempt = 1; attempt <= PART_RETRY_LIMIT; attempt += 1) {
              try {
                const { data: part } = await uploadApi.getMultipartPartUrl({
                  session_id: sessionId,
                  staging_key: init.staging_key,
                  upload_id: init.upload_id,
                  part_number: partNumber,
                }, { signal: controller.signal })
                const res = await uploadApi.putPresignedPart(part.url, blob, {
                  signal: controller.signal,
                  onUploadProgress: (e) => {
                    partProgress[idx] = Math.min(blob.size, e.loaded || 0)
                    publishProgress()
                  },
                })
                const etag = res.headers?.etag || res.headers?.ETag
                if (!etag) {
                  throw new Error('multipart part ETag를 읽지 못했습니다. S3 응답 헤더 노출 설정을 확인하세요.')
                }
                partProgress[idx] = blob.size
                completedParts.push({ part_number: partNumber, etag })
                completedCount += 1
                publishProgress()
                return
              } catch (err) {
                partProgress[idx] = 0
                publishProgress()
                if (isCanceled(err) || attempt >= PART_RETRY_LIMIT) throw err
                await sleep(700 * attempt)
              }
            }
          }

          const worker = async () => {
            while (nextPartIdx < partCount) {
              const idx = nextPartIdx
              nextPartIdx += 1
              await uploadPart(idx)
            }
          }

          try {
            const workerCount = Math.min(LARGE_UPLOAD_CONCURRENCY, partCount)
            await Promise.all(Array.from({ length: workerCount }, worker))
            updateTask(taskId, { uploadStage: `업로드 확정 중 — ${name}` })
            await uploadApi.completeMultipart({
              session_id: sessionId,
              staging_key: init.staging_key,
              filename: name,
              upload_id: init.upload_id,
              parts: completedParts.sort((a, b) => a.part_number - b.part_number),
            }, { signal: controller.signal })
            return init.staging_key
          } catch (err) {
            uploadApi.abortMultipart({
              session_id: sessionId,
              staging_key: init.staging_key,
              upload_id: init.upload_id,
            }).catch(() => {})
            throw err
          }
        }

        const uploadDirectFile = async (file, name) => {
          let fileLoaded = 0
          const publishProgress = () => {
            updateTask(taskId, {
              uploadProgress: Math.min(99, Math.round(((doneBytes + fileLoaded) / totalBytes) * 100)),
              uploadStage: `staging 업로드 중 — ${name}`,
            })
          }

          for (let attempt = 1; attempt <= PART_RETRY_LIMIT; attempt += 1) {
            try {
              updateTask(taskId, { uploadStage: `staging URL 준비 — ${name}` })
              const { data: pres } = await uploadApi.getPresignedUrl(
                { filename: name, session_id: sessionId, size: file.size }, { signal: controller.signal })
              await uploadApi.putPresigned(pres.url, file, {
                signal: controller.signal,
                onUploadProgress: (e) => {
                  fileLoaded = Math.min(file.size, e.loaded || 0)
                  publishProgress()
                },
              })
              updateTask(taskId, { uploadStage: `staging 확정 중 — ${name}` })
              await uploadApi.uploadComplete(
                { session_id: sessionId, staging_key: pres.staging_key, filename: name, size: file.size },
                { signal: controller.signal })
              fileLoaded = file.size
              publishProgress()
              return pres.staging_key
            } catch (err) {
              fileLoaded = 0
              publishProgress()
              if (isCanceled(err) || attempt >= PART_RETRY_LIMIT) throw err
              await sleep(700 * attempt)
            }
          }
        }

        for (const f of largeFiles) {
          const name = relName(f)
          const stagingKey = await uploadLargeFile(f, name)
          doneBytes += f.size
          stagingKeys[name] = stagingKey
          // 새로고침 복구 시에도 register 가 staging 복사를 쓸 수 있게 즉시 영속
          updateTask(taskId, { stagingKeys: { ...stagingKeys } })
        }

        for (const f of directSmallFiles) {
          const name = relName(f)
          const stagingKey = await uploadDirectFile(f, name)
          doneBytes += f.size
          stagingKeys[name] = stagingKey
          updateTask(taskId, { stagingKeys: { ...stagingKeys } })
        }

        const formData = new FormData()
        for (const f of apiSmallFiles) formData.append('files', f, relName(f))
        formData.append('collection_id', collectionId || '')
        formData.append('session_id', sessionId)

        const hasStagedFiles = largeFiles.length > 0 || directSmallFiles.length > 0
        updateTask(taskId, {
          uploadStage: apiSmallFiles.length ? '소용량 파일 전송 중' : '자동 분류 준비 중',
        })
        let manifestData
        if (hasStagedFiles) {
          await uploadApi.analyzeAsync(formData, {
            signal: controller.signal,
            onUploadProgress: (e) => {
              if (e.total && apiSmallFiles.length) {
                updateTask(taskId, { uploadProgress: Math.min(100, Math.round(((doneBytes + e.loaded) / totalBytes) * 100)) })
              }
            },
          })
          updateTask(taskId, { uploadProgress: 100, uploadStage: '자동 분류 대기 중' })
          manifestData = await waitForSessionAnalysis(sessionId, controller.signal, (status) => {
            updateTask(taskId, {
              uploadProgress: 100,
              uploadStage:
                status === 'running' ? '자동 분류 중'
                  : status === 'retrying' ? '자동 분류 지연 — 재시도 중'
                    : status === 'stalled' ? '자동 분류 지연'
                      : '자동 분류 대기 중',
            })
          })
        } else {
          const res = await uploadApi.analyze(formData, {
            signal: controller.signal,
            onUploadProgress: (e) => {
              if (e.total && apiSmallFiles.length) {
                updateTask(taskId, { uploadProgress: Math.min(100, Math.round(((doneBytes + e.loaded) / totalBytes) * 100)) })
              }
            },
          })
          manifestData = res.data
        }
        delete abortControllers.current[taskId]

        const analyzedTask = {
          status: 'analyzed',
          manifest: manifestData,
          sessionId: manifestData?.session_id || sessionId,
          uploadProgress: null,
          uploadStage: null,
          stagingKeys,
        }
        updateTask(taskId, analyzedTask)

        // 자동 등록
        if (autoRegister && manifestData) {
          await _doRegister(taskId, {
            ...newTask,
            ...analyzedTask,
          })
        }
      } catch (err) {
        delete abortControllers.current[taskId]
        if (isCanceled(err)) return
        console.error('분석 실패:', err)
        updateTask(taskId, {
          status: 'failed',
          uploadProgress: null,
          error: formatUploadError(err),
        })
      }
    })()

    return taskId
  }, [updateTask, uploadPolicy])

  // 등록 로직 (registerTask, autoRegister 공용)
  const _doRegister = useCallback(async (taskId, task) => {
    updateTask(taskId, { status: 'registering' })
    try {
      const collectionId = task.collectionId || `upload-${Date.now()}`
      const excluded = new Set(task.excludedRows || [])

      // 수락된 관계 제안 — 양 끝이 모두 등록 대상일 때만 보낸다 (인덱스는 manifest 기준)
      const suggestions = getSuggestions(task.manifest)
      const acceptance = resolveAcceptance(suggestions, task.linkOverrides || {})
      const acceptedBySource = {}
      suggestions.forEach(s => {
        if (!acceptance[s.key] || excluded.has(s.sourceIdx) || excluded.has(s.targetIdx)) return
        ;(acceptedBySource[s.sourceIdx] = acceptedBySource[s.sourceIdx] || []).push({ target_idx: s.targetIdx, rel: s.rel })
      })

      const items = task.manifest.manifest.map((item, idx) => {
        if (excluded.has(idx)) return null
        const base = {
          data_category: item.detected_category,
          ...flattenExtracted(item.auto_extracted),
          ...flattenExtracted(item.inherited),
          _filename: item.file_path,
          _bundled_files: item.bundled_files || [],
          _manifest_idx: idx,
          ...(task.stagingKeys?.[item.file_path] ? { _staging_key: task.stagingKeys[item.file_path] } : {}),
          ...(acceptedBySource[idx] ? { _accepted_links: acceptedBySource[idx] } : {}),
        }
        // 검토 단계의 사용자 수정(카테고리 교정·표시 이름·취득일)이 자동 추출값을 덮어쓴다
        const edits = task.rowEdits?.[idx]
        if (edits) {
          for (const [k, v] of Object.entries(edits)) {
            if (v !== undefined && v !== '') base[k] = v
          }
        }
        if (!base.description) {
          base.description = item.file_path.split('/').pop()
        }
        const loc = task.locationOverrides?.[idx]
        if (loc) {
          base.bbox_4326 = [loc[0] - 0.0001, loc[1] - 0.0001, loc[0] + 0.0001, loc[1] + 0.0001]
        }
        return base
      }).filter(Boolean)

      if (items.length === 0) {
        updateTask(taskId, { status: 'analyzed' })
        alert('등록할 항목이 없습니다 — 모든 행이 제외되었습니다.')
        return
      }

      const res = await uploadApi.register({
        collection_id: collectionId,
        session_id: task.sessionId,
        items,
        status: 'draft',
      })
      const data = res.data || {}
      const registered = data.registered || 0
      const errors = data.errors || []

      if (registered === 0) {
        updateTask(taskId, {
          status: 'failed',
          error: errors.length > 0 ? `등록 실패: ${errors.join('; ')}` : '등록된 항목이 없습니다.',
        })
      } else {
        updateTask(taskId, {
          status: 'registered',
          registeredCount: registered,
          registeredItemIds: data.item_ids || [],
          registeredCollectionId: collectionId,
          partialErrors: errors,
        })
      }
    } catch (err) {
      console.error('등록 실패:', err)
      updateTask(taskId, { status: 'failed', error: err.response?.data?.detail || err.message })
    }
  }, [updateTask])

  const registerTask = useCallback(async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.manifest) return
    await _doRegister(taskId, task)
  }, [tasks, _doRegister])

  const cancelTask = useCallback((taskId) => {
    // HTTP 요청 중단
    const controller = abortControllers.current[taskId]
    if (controller) {
      controller.abort()
      delete abortControllers.current[taskId]
    }
    // 백엔드 임시 파일 정리
    const task = tasks.find(t => t.id === taskId)
    if (task?.sessionId) {
      uploadApi.cancelSession(task.sessionId).catch(() => {})
    }
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [tasks])

  const removeTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])

  const updateLocationOverride = useCallback((taskId, idx, location) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, locationOverrides: { ...t.locationOverrides, [idx]: location } }
    }))
  }, [])

  // 검토 단계의 행 단위 수정 (카테고리 교정·표시 이름·취득일) — 등록 payload 에 반영된다
  const updateRowEdit = useCallback((taskId, idx, patch) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const cur = t.rowEdits?.[idx] || {}
      return { ...t, rowEdits: { ...(t.rowEdits || {}), [idx]: { ...cur, ...patch } } }
    }))
  }, [])

  // 관계 제안 수락/무시 토글 (기본값은 규칙으로 계산 — override 만 저장)
  const toggleLinkAccept = useCallback((taskId, suggestionKey, nextValue) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, linkOverrides: { ...(t.linkOverrides || {}), [suggestionKey]: nextValue } }
    }))
  }, [])

  // 행 제외/복원 토글 — 제외된 행은 등록에서 빠진다
  const toggleRowExclude = useCallback((taskId, idx) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const cur = new Set(t.excludedRows || [])
      if (cur.has(idx)) cur.delete(idx)
      else cur.add(idx)
      return { ...t, excludedRows: [...cur] }
    }))
  }, [])

  const value = {
    tasks,
    uploadPolicy,
    startAnalysis,
    registerTask,
    cancelTask,
    removeTask,
    updateLocationOverride,
    updateRowEdit,
    toggleRowExclude,
    toggleLinkAccept,
  }

  return (
    <UploadTasksContext.Provider value={value}>
      {children}
    </UploadTasksContext.Provider>
  )
}

function flattenExtracted(obj) {
  const flat = {}
  for (const [key, val] of Object.entries(obj || {})) {
    flat[key] = val.value
  }
  return flat
}
