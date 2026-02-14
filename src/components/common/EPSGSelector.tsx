import { useState } from 'react'
import { Globe, ChevronDown } from 'lucide-react'

// 자주 사용되는 EPSG 코드
const COMMON_EPSG_CODES = [
  { code: null, label: '자동 감지', description: '파일에서 좌표계를 자동으로 감지합니다' },
  { code: 4326, label: 'WGS 84 (EPSG:4326)', description: '전 세계 GPS 좌표계 (위경도)' },
  { code: 5186, label: 'Korea TM 중부 (EPSG:5186)', description: '한국 중부원점 (GRS80)' },
  { code: 5187, label: 'Korea TM 동부 (EPSG:5187)', description: '한국 동부원점 (GRS80)' },
  { code: 5185, label: 'Korea TM 서부 (EPSG:5185)', description: '한국 서부원점 (GRS80)' },
  { code: 5188, label: 'Korea TM 동해 (EPSG:5188)', description: '한국 동해원점 (GRS80)' },
  { code: 32652, label: 'UTM Zone 52N (EPSG:32652)', description: 'UTM 52N (한국 서부 포함)' },
  { code: 32651, label: 'UTM Zone 51N (EPSG:32651)', description: 'UTM 51N' },
] as const

interface EPSGSelectorProps {
  value: number | null
  onChange: (epsg: number | null) => void
  className?: string
}

export default function EPSGSelector({ value, onChange, className = '' }: EPSGSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selected = COMMON_EPSG_CODES.find(e => e.code === value) || COMMON_EPSG_CODES[0]

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:border-slate-500 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-cyan-400 flex-shrink-0" />
          <span className="truncate">{selected?.label || '자동 감지'}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {COMMON_EPSG_CODES.map((epsg) => (
              <button
                key={epsg.code ?? 'auto'}
                type="button"
                onClick={() => {
                  onChange(epsg.code)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors ${
                  value === epsg.code ? 'bg-blue-600/20 text-blue-400' : 'text-white'
                }`}
              >
                <div className="font-medium">{epsg.label}</div>
                <div className="text-xs text-slate-500">{epsg.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
