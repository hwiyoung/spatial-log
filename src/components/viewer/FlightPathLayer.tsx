/**
 * 드론 비행경로 시각화 레이어
 * GPS + 촬영시각이 있는 이미지를 시간순으로 연결하여 Polyline으로 표시
 * 촬영 날짜에 따른 색상 그라데이션 지원
 */

import { useMemo } from 'react'
import { Polyline, CircleMarker, Popup } from 'react-leaflet'
import type { FlightPathPoint } from '@/services/api'

interface FlightPathLayerProps {
  points: FlightPathPoint[]
}

// 날짜 포맷
function formatDateTime(datetime: string): string {
  try {
    const d = new Date(datetime)
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return datetime
  }
}

// 날짜만 추출 (YYYY-MM-DD)
function getDateKey(datetime: string): string {
  try {
    return new Date(datetime).toISOString().slice(0, 10)
  } catch {
    return datetime
  }
}

// 시간 진행률(0~1)에 따른 색상 보간 (초록 → 노랑 → 주황 → 빨강)
function getTimeGradientColor(ratio: number): string {
  // HSL 색상: 120(초록) → 60(노랑) → 30(주황) → 0(빨강)
  const hue = Math.round(120 * (1 - ratio))
  return `hsl(${hue}, 85%, 55%)`
}

export default function FlightPathLayer({ points }: FlightPathLayerProps) {
  // 날짜별 그룹 및 색상 계산
  const { dateGroups, dateColors } = useMemo(() => {
    if (points.length === 0) return { dateGroups: new Map<string, FlightPathPoint[]>(), dateColors: new Map<string, string>() }

    const groups = new Map<string, FlightPathPoint[]>()
    for (const point of points) {
      const key = getDateKey(point.datetime)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(point)
    }

    const colors = new Map<string, string>()
    const dates = Array.from(groups.keys()).sort()
    dates.forEach((date, idx) => {
      const ratio = dates.length > 1 ? idx / (dates.length - 1) : 0
      colors.set(date, getTimeGradientColor(ratio))
    })

    return { dateGroups: groups, dateColors: colors }
  }, [points])

  if (points.length === 0) return null

  // 전체 경로 polyline
  const positions = points.map(p => [p.latitude, p.longitude] as [number, number])

  // 날짜별 세그먼트 polylines
  const dateSegments = Array.from(dateGroups.entries()).map(([date, pts]) => ({
    date,
    positions: pts.map(p => [p.latitude, p.longitude] as [number, number]),
    color: dateColors.get(date) || '#f59e0b',
  }))

  return (
    <>
      {/* 전체 경로 (배경선) */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#64748b',
          weight: 1,
          opacity: 0.3,
        }}
      />

      {/* 날짜별 세그먼트 */}
      {dateSegments.map(seg => (
        <Polyline
          key={seg.date}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: 3,
            opacity: 0.8,
          }}
        />
      ))}

      {/* 포인트별 마커 */}
      {points.map((point, idx) => {
        const dateColor = dateColors.get(getDateKey(point.datetime)) || '#f59e0b'
        const isFirst = idx === 0
        const isLast = idx === points.length - 1

        return (
          <CircleMarker
            key={point.fileId}
            center={[point.latitude, point.longitude]}
            radius={isFirst || isLast ? 6 : 3}
            pathOptions={{
              color: isFirst ? '#22c55e' : isLast ? '#ef4444' : dateColor,
              fillColor: isFirst ? '#22c55e' : isLast ? '#ef4444' : dateColor,
              fillOpacity: 0.8,
              weight: isFirst || isLast ? 2 : 1,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1" style={{ minWidth: '160px' }}>
                <p className="font-medium text-slate-900">{point.fileName}</p>
                <p className="text-slate-600">{formatDateTime(point.datetime)}</p>
                <p className="text-slate-500 font-mono text-[10px]">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  {point.altitude !== undefined && ` (${point.altitude.toFixed(1)}m)`}
                </p>
                {isFirst && <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">시작</span>}
                {isLast && <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">종료</span>}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* 날짜 범위 레전드 (포인트가 2일 이상일 때) */}
      {dateGroups.size > 1 && (
        <div className="leaflet-bottom leaflet-left">
          <div className="leaflet-control" style={{
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(4px)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            fontSize: '11px',
            color: '#e2e8f0',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>비행경로 ({dateGroups.size}일)</div>
            {Array.from(dateColors.entries()).map(([date, color]) => (
              <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                <span>{date} ({dateGroups.get(date)?.length || 0}장)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
