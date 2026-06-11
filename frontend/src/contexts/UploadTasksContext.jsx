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

export function useUploadTasks() {
  const ctx = useContext(UploadTasksContext)
  if (!ctx) throw new Error('useUploadTasks must be used within UploadTasksProvider')
  return ctx
}

export function UploadTasksProvider({ children }) {
  const [tasks, setTasks] = useState(() => loadFromStorage())
  const taskIdCounter = useRef(0)
  const recoveryDone = useRef(false)
  const abortControllers = useRef({})

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
      error: null,
      startedAt: Date.now(),
      uploadProgress: 0,
      autoRegister,
    }

    setTasks(prev => [...prev, newTask])

    const controller = new AbortController()
    abortControllers.current[taskId] = controller

    ;(async () => {
      try {
        const formData = new FormData()
        for (const f of files) formData.append('files', f)
        formData.append('collection_id', collectionId || '')
        formData.append('session_id', sessionId)

        const res = await uploadApi.analyze(formData, {
          signal: controller.signal,
          onUploadProgress: (e) => {
            if (e.total) {
              const pct = Math.round((e.loaded / e.total) * 100)
              updateTask(taskId, { uploadProgress: pct })
            }
          },
        })
        delete abortControllers.current[taskId]

        const analyzedTask = {
          status: 'analyzed',
          manifest: res.data,
          sessionId: res.data?.session_id || sessionId,
          uploadProgress: null,
        }
        updateTask(taskId, analyzedTask)

        // 자동 등록
        if (autoRegister && res.data) {
          await _doRegister(taskId, {
            ...newTask,
            ...analyzedTask,
          })
        }
      } catch (err) {
        delete abortControllers.current[taskId]
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
        console.error('분석 실패:', err)
        updateTask(taskId, {
          status: 'failed',
          uploadProgress: null,
          error: err.response?.data?.detail || err.message,
        })
      }
    })()

    return taskId
  }, [updateTask])

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

      if (registered === 0 && errors.length > 0) {
        updateTask(taskId, { status: 'failed', error: `등록 실패: ${errors.join('; ')}` })
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
