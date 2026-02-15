type DateFormat = 'short' | 'datetime' | 'full' | 'mixed'

const FORMAT_OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: 'short', day: 'numeric' },
  datetime: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  full: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' },
  mixed: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
}

/** 날짜를 ko-KR 로케일로 포맷. format 미지정 시 'short' */
export function formatDate(date: Date | string, format: DateFormat = 'short'): string {
  try {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleString('ko-KR', FORMAT_OPTIONS[format])
  } catch {
    return String(date)
  }
}

/** 상대 시간 표시 (방금 전, N분 전, N시간 전, N일 전, 또는 날짜) */
export function getRelativeTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return d.toLocaleDateString('ko-KR')
}
