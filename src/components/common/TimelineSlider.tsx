/**
 * TimelineSlider - 워크스페이스 하단 시각적 타임라인 슬라이더
 * 엔트리 밀도 히트맵 + 드래그 가능한 날짜 범위
 */
import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'

interface TimelineSliderProps {
  entries: Array<{ date: Date; id: string }>
  startDate: string | null
  endDate: string | null
  onDateRangeChange: (start: string | null, end: string | null) => void
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0] ?? ''
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

export default function TimelineSlider({
  entries,
  startDate,
  endDate,
  onDateRangeChange,
}: TimelineSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null)

  // 타임라인 범위 계산
  const { timelineStart, timelineEnd, totalDays, buckets } = useMemo(() => {
    if (entries.length === 0) {
      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return { timelineStart: thirtyDaysAgo, timelineEnd: now, totalDays: 30, buckets: [] as number[] }
    }

    const dates = entries.map((e) => e.date.getTime())
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    min.setHours(0, 0, 0, 0)
    max.setHours(23, 59, 59, 999)

    // 좌우 여유 2일
    const padStart = new Date(min)
    padStart.setDate(padStart.getDate() - 2)
    const padEnd = new Date(max)
    padEnd.setDate(padEnd.getDate() + 2)

    const totalDays = Math.max(daysBetween(padStart, padEnd), 1)
    const bucketCount = Math.min(totalDays, 60) // 최대 60 버킷
    const bucketSize = totalDays / bucketCount
    const buckets = new Array(bucketCount).fill(0) as number[]

    entries.forEach((e) => {
      const dayOffset = daysBetween(padStart, e.date)
      const bucketIdx = Math.min(Math.floor(dayOffset / bucketSize), bucketCount - 1)
      if (bucketIdx >= 0 && bucketIdx < bucketCount) {
          buckets[bucketIdx] = (buckets[bucketIdx] ?? 0) + 1
        }
    })

    return { timelineStart: padStart, timelineEnd: padEnd, totalDays, buckets }
  }, [entries])

  const maxBucketVal = Math.max(...buckets, 1)

  // 날짜 → 위치 비율 (0~1)
  const dateToRatio = useCallback((dateStr: string | null, defaultRatio: number): number => {
    if (!dateStr) return defaultRatio
    const d = new Date(dateStr)
    const offset = daysBetween(timelineStart, d)
    return Math.max(0, Math.min(1, offset / totalDays))
  }, [timelineStart, totalDays])

  // 위치 비율 → 날짜
  const ratioToDate = useCallback((ratio: number): string => {
    const d = new Date(timelineStart)
    d.setDate(d.getDate() + Math.round(ratio * totalDays))
    return toDateStr(d)
  }, [timelineStart, totalDays])

  const startRatio = dateToRatio(startDate, 0)
  const endRatio = dateToRatio(endDate, 1)

  // 드래그 핸들러
  const handleMouseDown = useCallback((handle: 'start' | 'end') => {
    setIsDragging(handle)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const newDate = ratioToDate(ratio)

      if (isDragging === 'start') {
        onDateRangeChange(newDate, endDate)
      } else {
        onDateRangeChange(startDate, newDate)
      }
    }

    const handleMouseUp = () => setIsDragging(null)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, startDate, endDate, onDateRangeChange, ratioToDate])

  // 트랙 클릭 → 가까운 핸들 이동
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const distToStart = Math.abs(ratio - startRatio)
    const distToEnd = Math.abs(ratio - endRatio)
    const newDate = ratioToDate(ratio)

    if (distToStart < distToEnd) {
      onDateRangeChange(newDate, endDate)
    } else {
      onDateRangeChange(startDate, newDate)
    }
  }, [startRatio, endRatio, startDate, endDate, onDateRangeChange, ratioToDate])

  const isFiltered = startDate !== null || endDate !== null

  return (
    <div className="h-14 bg-slate-900/80 border-t border-slate-700 px-4 flex items-center gap-3 flex-shrink-0">
      <Calendar size={14} className="text-slate-500 flex-shrink-0" />

      {/* 시작 날짜 */}
      <span className="text-[10px] text-slate-400 w-16 text-right flex-shrink-0">
        {startDate || toDateStr(timelineStart)}
      </span>

      {/* 슬라이더 트랙 */}
      <div
        ref={trackRef}
        className="flex-1 h-8 relative cursor-pointer select-none"
        onClick={handleTrackClick}
      >
        {/* 밀도 히트맵 */}
        <div className="absolute bottom-0 left-0 right-0 h-4 flex items-end gap-px">
          {buckets.map((count, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all"
              style={{
                height: `${Math.max(2, (count / maxBucketVal) * 100)}%`,
                backgroundColor: count > 0
                  ? `rgba(99, 102, 241, ${0.2 + (count / maxBucketVal) * 0.6})`
                  : 'rgba(51, 65, 85, 0.3)',
              }}
            />
          ))}
        </div>

        {/* 선택 범위 하이라이트 */}
        {isFiltered && (
          <div
            className="absolute top-0 bottom-0 bg-blue-500/10 border-t-2 border-blue-500/50"
            style={{
              left: `${startRatio * 100}%`,
              width: `${Math.max((endRatio - startRatio) * 100, 0.5)}%`,
            }}
          />
        )}

        {/* 시작 핸들 */}
        <div
          className={`absolute top-0 bottom-0 w-1 cursor-col-resize z-10 ${
            isDragging === 'start' ? 'bg-blue-400' : 'bg-blue-500/70 hover:bg-blue-400'
          }`}
          style={{ left: `${startRatio * 100}%` }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('start') }}
        >
          <div className="absolute -top-1 -left-1.5 w-4 h-3 bg-blue-500 rounded-sm" />
        </div>

        {/* 끝 핸들 */}
        <div
          className={`absolute top-0 bottom-0 w-1 cursor-col-resize z-10 ${
            isDragging === 'end' ? 'bg-blue-400' : 'bg-blue-500/70 hover:bg-blue-400'
          }`}
          style={{ left: `${endRatio * 100}%` }}
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown('end') }}
        >
          <div className="absolute -top-1 -left-1.5 w-4 h-3 bg-blue-500 rounded-sm" />
        </div>
      </div>

      {/* 끝 날짜 */}
      <span className="text-[10px] text-slate-400 w-16 flex-shrink-0">
        {endDate || toDateStr(timelineEnd)}
      </span>

      {/* 리셋 버튼 */}
      {isFiltered && (
        <button
          onClick={() => onDateRangeChange(null, null)}
          className="text-[10px] text-blue-400 hover:text-blue-300 flex-shrink-0"
        >
          초기화
        </button>
      )}
    </div>
  )
}
