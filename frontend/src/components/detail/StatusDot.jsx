/** StatusDot — 상태색 점. unknown 은 점선 테두리. (Relations · Timeline 공용) */
import { statusHex } from '../../features/detail/statusHex'

export default function StatusDot({ status, size = 9 }) {
  const color = statusHex(status)
  return (
    <i
      className="sdot"
      style={{ width: size, height: size, background: color, borderColor: color, borderStyle: status === 'unknown' ? 'dashed' : 'solid' }}
    />
  )
}
