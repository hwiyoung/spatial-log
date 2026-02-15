/**
 * EntryForm - Entry 생성 폼 (4종 타입 버튼 + 인라인 폼)
 */
import { useState } from 'react'
import { MapPin, MapPinOff, Search } from 'lucide-react'
import type { SceneEntryType } from '@/types/story'
import type { FileMetadata } from '@/services/api'
import { detectEntryTypeFromFormat } from '@/services/api'
import { ENTRY_TYPES, FILE_FORMAT_FILTERS } from '@/constants/entries'

interface EntryFormProps {
  files: FileMetadata[]
  onAddEntry: (data: {
    entryType: SceneEntryType
    fileId: string | null
    title: string | null
    body: string | null
    url: string | null
    gps: { latitude: number; longitude: number } | null
  }) => Promise<void>
}

export default function EntryForm({ files, onAddEntry }: EntryFormProps) {
  const [showAddForm, setShowAddForm] = useState<SceneEntryType | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [fileSearch, setFileSearch] = useState('')

  const resetForm = () => {
    setShowAddForm(null)
    setFormTitle('')
    setFormBody('')
    setFormUrl('')
    setSelectedFileId(null)
    setFileSearch('')
  }

  const filteredFiles = files.filter(f => {
    if (fileSearch && !f.name.toLowerCase().includes(fileSearch.toLowerCase())) return false
    if (showAddForm && FILE_FORMAT_FILTERS[showAddForm]) {
      return FILE_FORMAT_FILTERS[showAddForm]!(f.format)
    }
    return true
  })

  const getEntryConfig = (type: SceneEntryType) => {
    return ENTRY_TYPES.find(t => t.type === type) ?? ENTRY_TYPES[3]!
  }

  const handleAddEntry = async () => {
    if (!showAddForm) return

    const isFileType = showAddForm !== 'note'
    const selectedFile = isFileType && selectedFileId ? files.find(f => f.id === selectedFileId) : null

    // GPS 추출
    let gps: { latitude: number; longitude: number } | null = null
    if (selectedFile?.gps) {
      gps = { latitude: selectedFile.gps.latitude, longitude: selectedFile.gps.longitude }
    } else if (selectedFile?.spatialInfo?.center?.latitude != null && selectedFile?.spatialInfo?.center?.longitude != null) {
      gps = { latitude: selectedFile.spatialInfo!.center!.latitude!, longitude: selectedFile.spatialInfo!.center!.longitude! }
    }

    const title = formTitle.trim() || (isFileType ? selectedFile?.name ?? null : null)

    await onAddEntry({
      entryType: showAddForm,
      fileId: isFileType ? selectedFileId : null,
      title,
      body: showAddForm === 'note' ? formBody || null : null,
      url: showAddForm === 'note' ? formUrl || null : null,
      gps,
    })

    resetForm()
  }

  return (
    <>
      {/* 4종 Entry 추가 버튼 (2x2 그리드) */}
      <div className="grid grid-cols-2 gap-1.5 p-3 border-b border-slate-700">
        {ENTRY_TYPES.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => setShowAddForm(showAddForm === type ? null : type)}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              showAddForm === type
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Icon size={12} className={showAddForm === type ? 'text-white' : color} />
            {label}
          </button>
        ))}
      </div>

      {/* 인라인 추가 폼 */}
      {showAddForm && (
        <div className="p-3 border-b border-slate-700 bg-slate-800/50">
          {/* 파일 기반 타입: 파일 선택 */}
          {showAddForm !== 'note' && (
            <div className="mb-2">
              <div className="relative mb-1">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="파일 검색..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="max-h-32 overflow-auto bg-slate-800 border border-slate-600 rounded-lg">
                {filteredFiles.slice(0, 30).map(file => {
                  const fileEntryType = detectEntryTypeFromFormat(file.format)
                  const cfg = getEntryConfig(fileEntryType)
                  const FileIcon = cfg.icon
                  const hasGps = !!(file.gps || (file.spatialInfo?.center?.latitude != null))
                  return (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFileId(file.id)
                        if (!formTitle.trim()) setFormTitle(file.name)
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${
                        selectedFileId === file.id
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <FileIcon size={12} className={cfg.color + ' flex-shrink-0'} />
                      <span className="truncate flex-1">{file.name}</span>
                      {hasGps ? (
                        <MapPin size={12} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <MapPinOff size={12} className="text-orange-400/50 flex-shrink-0" />
                      )}
                    </button>
                  )
                })}
                {filteredFiles.length === 0 && (
                  <div className="text-center text-xs text-slate-500 py-3">해당 타입 파일 없음</div>
                )}
              </div>
              {/* GPS 상태 표시 */}
              {selectedFileId && (() => {
                const sf = files.find(f => f.id === selectedFileId)
                if (!sf) return null
                const hasGps = !!(sf.gps || (sf.spatialInfo?.center?.latitude != null))
                return hasGps ? (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-green-400">
                    <MapPin size={12} />
                    GPS 자동 추출됨
                    {sf.gps
                      ? ` (${sf.gps.latitude.toFixed(4)}, ${sf.gps.longitude.toFixed(4)})`
                      : ` (${sf.spatialInfo?.center?.latitude?.toFixed(4) ?? '?'}, ${sf.spatialInfo?.center?.longitude?.toFixed(4) ?? '?'})`
                    }
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-orange-400">
                    <MapPinOff size={12} />
                    GPS 정보 없음 (저장 후 위치 지정 가능)
                  </div>
                )
              })()}
            </div>
          )}

          {/* 제목 */}
          <input
            type="text"
            placeholder={showAddForm === 'note' ? '메모 제목' : '제목 (선택)'}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            autoFocus={showAddForm === 'note'}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-2"
          />

          {/* Note: 본문 + URL */}
          {showAddForm === 'note' && (
            <>
              <textarea
                placeholder="메모 내용..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-2 resize-none"
              />
              <input
                type="text"
                placeholder="URL 링크 (선택)"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 mb-2"
              />
            </>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              취소
            </button>
            <button
              onClick={handleAddEntry}
              disabled={showAddForm !== 'note' && !selectedFileId}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </>
  )
}
