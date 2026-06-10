/**
 * UploadStatusBar — 네비게이션 바 우측에 표시되는 업로드 알림
 *
 * 활성 업로드 task가 있을 때 표시되며, 클릭하면 task 목록 드롭다운을 보여준다.
 * 항목 클릭 시 Upload 페이지로 이동.
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUploadTasks } from '../contexts/UploadTasksContext'

const STATUS_INFO = {
  analyzing: { icon: '⏳', label: '분석 중', color: 'var(--ac)' },
  analyzed: { icon: '📋', label: '등록 대기', color: 'var(--warn)' },
  registering: { icon: '⬆', label: '등록 중', color: 'var(--ac)' },
  registered: { icon: '✅', label: '완료', color: 'var(--ok)' },
  failed: { icon: '⚠', label: '실패', color: 'var(--err)' },
}

export default function UploadStatusBar() {
  const { tasks, removeTask } = useUploadTasks()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (tasks.length === 0) return null

  const counts = {
    analyzing: tasks.filter(t => t.status === 'analyzing').length,
    analyzed: tasks.filter(t => t.status === 'analyzed').length,
    registering: tasks.filter(t => t.status === 'registering').length,
    registered: tasks.filter(t => t.status === 'registered').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }

  // 우선순위 높은 상태만 뱃지로 표시
  const activeBadges = []
  if (counts.analyzing) activeBadges.push({ ...STATUS_INFO.analyzing, count: counts.analyzing })
  if (counts.analyzed) activeBadges.push({ ...STATUS_INFO.analyzed, count: counts.analyzed })
  if (counts.registering) activeBadges.push({ ...STATUS_INFO.registering, count: counts.registering })
  if (counts.failed) activeBadges.push({ ...STATUS_INFO.failed, count: counts.failed })
  if (activeBadges.length === 0 && counts.registered) {
    activeBadges.push({ ...STATUS_INFO.registered, count: counts.registered })
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 6,
          background: open ? 'var(--s2)' : 'rgba(59,130,246,0.08)',
          border: '1px solid var(--bd)',
          cursor: 'pointer', fontSize: 13,
        }}
        title="업로드 작업 보기"
      >
        <span style={{ fontSize: 14 }}>📤</span>
        {activeBadges.map((b, i) => (
          <span key={i} style={{ color: b.color, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span>{b.icon}</span>
            <span>{b.count}</span>
          </span>
        ))}
      </div>

      {/* 드롭다운 */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9000,
          width: 360, maxHeight: 480, overflow: 'auto',
          background: 'var(--s1)', border: '1px solid var(--bd)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--bd)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
              업로드 작업 ({tasks.length})
            </span>
            <span
              onClick={() => { setOpen(false); navigate('/upload') }}
              style={{ fontSize: 12, color: 'var(--ac)', cursor: 'pointer' }}
            >
              전체 보기 →
            </span>
          </div>
          <div>
            {tasks.slice().reverse().map(task => {
              const info = STATUS_INFO[task.status]
              return (
                <div
                  key={task.id}
                  onClick={() => { setOpen(false); navigate('/upload') }}
                  style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--bd)',
                    cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{info.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: info.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {info.label}
                      {task.status === 'analyzing' && task.uploadProgress != null && task.uploadProgress < 100 && (
                        <span style={{ color: 'var(--ac)', fontWeight: 400 }}>{task.uploadProgress}%</span>
                      )}
                      {task.autoRegister && task.status !== 'registered' && (
                        <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 2, background: 'rgba(59,130,246,0.12)', color: 'var(--ac)' }}>자동</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      파일 {task.fileCount}개 · {task.collectionId || '(미지정)'}
                    </div>
                    {task.error && (
                      <div style={{ color: 'var(--err)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.error}
                      </div>
                    )}
                  </div>
                  {(task.status === 'registered' || task.status === 'failed') && (
                    <span
                      onClick={(e) => { e.stopPropagation(); removeTask(task.id) }}
                      style={{ color: 'var(--t3)', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
                      title="알림 닫기"
                    >
                      ✕
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
