import { Folder, HardDrive } from 'lucide-react'
import { formatFileSize } from '@/utils/storage'
import type { FileMetadata, FolderData } from '@/services/api'

interface FolderSidebarProps {
  folders: FolderData[]
  files: FileMetadata[]
  selectedFolderId: string | null
  editingFolderId: string | null
  editingFolderName: string
  storageUsed: number
  selectFolder: (id: string | null) => void
  handleContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', id: string) => void
  startEditingFolder: (folder: FolderData) => void
  finishEditingFolder: () => void
  setEditingFolderName: (name: string) => void
}

export default function FolderSidebar({
  folders,
  files,
  selectedFolderId,
  editingFolderId,
  editingFolderName,
  storageUsed,
  selectFolder,
  handleContextMenu,
  finishEditingFolder,
  setEditingFolderName,
}: FolderSidebarProps) {
  return (
    <div className="w-60 bg-slate-900 border-r border-slate-700 p-4 flex-shrink-0">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">폴더</h3>
      <ul className="space-y-1">
        {/* 전체 파일 */}
        <li
          onClick={() => selectFolder(null)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            selectedFolderId === null
              ? 'bg-blue-600/10 text-blue-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Folder size={16} className={selectedFolderId === null ? 'fill-blue-400/20' : ''} />
          <span>전체 파일</span>
          <span className="ml-auto text-xs text-slate-500">{files.length}</span>
        </li>

        {/* 동적 폴더 목록 */}
        {folders.map((folder) => (
          <li
            key={folder.id}
            onClick={() => selectFolder(folder.id)}
            onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
              selectedFolderId === folder.id
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Folder size={16} className={selectedFolderId === folder.id ? 'fill-blue-400/20' : ''} />
            {editingFolderId === folder.id ? (
              <input
                type="text"
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onBlur={finishEditingFolder}
                onKeyDown={(e) => e.key === 'Enter' && finishEditingFolder()}
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-sm text-white"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-xs text-slate-500">
                  {files.filter(f => f.folderId === folder.id).length}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* 스토리지 정보 */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="flex items-center space-x-2 text-slate-500 mb-2">
          <HardDrive size={14} />
          <span className="text-xs">스토리지</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${Math.min((storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {formatFileSize(storageUsed)} / 5 GB
        </p>
      </div>
    </div>
  )
}
