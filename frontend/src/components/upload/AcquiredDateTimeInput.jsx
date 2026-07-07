function pad2(value) {
  return String(value).padStart(2, '0')
}

function toInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join('-') + 'T' + [
      pad2(date.getHours()),
      pad2(date.getMinutes()),
    ].join(':')
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/)
  return match ? `${match[1]}T${match[2] || '00:00'}` : ''
}

function fromInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) return date.toISOString()
  return `${value.length === 10 ? `${value}T00:00` : value}:00Z`
}

function nowInputValue() {
  const date = new Date()
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-') + 'T' + [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
  ].join(':')
}

function todayStartInputValue() {
  const date = new Date()
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-') + 'T00:00'
}

export default function AcquiredDateTimeInput({ value, autoValue, onChange, compact = false }) {
  const inputValue = toInputValue(value)
  const autoInputValue = toInputValue(autoValue)
  const applyInput = (next) => onChange(fromInputValue(next))

  return (
    <div className={'acq-input' + (compact ? ' compact' : '')}>
      <input
        className={compact ? 'tbl-in acq-dt' : 'acq-dt'}
        type="datetime-local"
        value={inputValue}
        onChange={e => applyInput(e.target.value)}
      />
      <div className="acq-actions">
        <button type="button" onClick={() => applyInput(nowInputValue())}>지금</button>
        <button type="button" onClick={() => applyInput(todayStartInputValue())}>오늘</button>
        {autoInputValue && <button type="button" onClick={() => applyInput(autoInputValue)}>자동값</button>}
        {inputValue && <button type="button" onClick={() => onChange('')}>비우기</button>}
      </div>
    </div>
  )
}
