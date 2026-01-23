import { useState, useCallback } from 'react'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Database,
  HardDrive,
  Clock,
  Loader2,
} from 'lucide-react'
import {
  runIntegrityCheck,
  repairOrphanedDbRecords,
  repairOrphanedStorageFiles,
  getIntegrityLogs,
  type IntegrityReport,
  type IntegrityLog,
} from '@/services/integrityService'
import { isBackendConnected } from '@/services/api'

export default function IntegrityChecker() {
  const [isChecking, setIsChecking] = useState(false)
  const [isRepairing, setIsRepairing] = useState(false)
  const [report, setReport] = useState<IntegrityReport | null>(null)
  const [logs, setLogs] = useState<IntegrityLog[]>([])
  const [error, setError] = useState<string | null>(null)

  // 무결성 검사 실행
  const handleCheck = useCallback(async () => {
    if (!isBackendConnected()) {
      setError('Supabase가 연결되지 않았습니다. 무결성 검사는 Supabase 환경에서만 사용 가능합니다.')
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      const result = await runIntegrityCheck({ includeValidFiles: false })
      setReport(result)

      // 로그 갱신
      const recentLogs = await getIntegrityLogs(5)
      setLogs(recentLogs)
    } catch (err) {
      setError(err instanceof Error ? err.message : '검사 중 오류가 발생했습니다.')
    } finally {
      setIsChecking(false)
    }
  }, [])

  // 고아 DB 레코드 복구
  const handleRepairDbRecords = useCallback(async () => {
    if (!report || report.orphanedDbRecords.length === 0) return

    setIsRepairing(true)
    try {
      const ids = report.orphanedDbRecords.map(r => r.id)
      const result = await repairOrphanedDbRecords(ids)

      if (result.failed.length > 0) {
        setError(`${result.failed.length}개 레코드 삭제 실패`)
      }

      // 재검사
      await handleCheck()
    } catch (err) {
      setError(err instanceof Error ? err.message : '복구 중 오류가 발생했습니다.')
    } finally {
      setIsRepairing(false)
    }
  }, [report, handleCheck])

  // 고아 Storage 파일 복구
  const handleRepairStorageFiles = useCallback(async () => {
    if (!report || report.orphanedStorageFiles.length === 0) return

    setIsRepairing(true)
    try {
      const result = await repairOrphanedStorageFiles(report.orphanedStorageFiles)

      if (result.failed.length > 0) {
        setError(`${result.failed.length}개 파일 삭제 실패`)
      }

      // 재검사
      await handleCheck()
    } catch (err) {
      setError(err instanceof Error ? err.message : '복구 중 오류가 발생했습니다.')
    } finally {
      setIsRepairing(false)
    }
  }, [report, handleCheck])

  // 상태 아이콘
  const StatusIcon = ({ status }: { status: 'success' | 'warning' | 'error' }) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-400" />
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-400" />
      case 'error':
        return <XCircle size={16} className="text-red-400" />
    }
  }

  // 날짜 포맷
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const hasIssues = report && (report.orphanedDbRecords.length > 0 || report.orphanedStorageFiles.length > 0)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">무결성 검사</h2>
            <p className="text-sm text-slate-400">Storage와 DB 간 동기화 상태를 확인합니다</p>
          </div>
        </div>
        <button
          onClick={handleCheck}
          disabled={isChecking}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
        >
          {isChecking ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <RefreshCw size={18} />
          )}
          <span>{isChecking ? '검사 중...' : '검사 실행'}</span>
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 검사 결과 */}
      {report && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Database size={16} />
                <span className="text-sm">DB 레코드</span>
              </div>
              <p className="text-2xl font-bold text-white">{report.dbRecordCount}</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <HardDrive size={16} />
                <span className="text-sm">Storage 파일</span>
              </div>
              <p className="text-2xl font-bold text-white">{report.storageFileCount}</p>
            </div>

            <div className={`rounded-lg p-4 border ${
              report.orphanedDbRecords.length > 0
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <AlertTriangle size={16} className={report.orphanedDbRecords.length > 0 ? 'text-yellow-400' : ''} />
                <span className="text-sm">고아 레코드</span>
              </div>
              <p className={`text-2xl font-bold ${report.orphanedDbRecords.length > 0 ? 'text-yellow-400' : 'text-white'}`}>
                {report.orphanedDbRecords.length}
              </p>
            </div>

            <div className={`rounded-lg p-4 border ${
              report.orphanedStorageFiles.length > 0
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <AlertTriangle size={16} className={report.orphanedStorageFiles.length > 0 ? 'text-yellow-400' : ''} />
                <span className="text-sm">고아 파일</span>
              </div>
              <p className={`text-2xl font-bold ${report.orphanedStorageFiles.length > 0 ? 'text-yellow-400' : 'text-white'}`}>
                {report.orphanedStorageFiles.length}
              </p>
            </div>
          </div>

          {/* 상태 메시지 */}
          <div className={`flex items-center gap-2 p-4 rounded-lg border ${
            hasIssues
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
          }`}>
            {hasIssues ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            <span>
              {hasIssues
                ? `${report.orphanedDbRecords.length + report.orphanedStorageFiles.length}개의 불일치 항목이 발견되었습니다.`
                : '모든 파일이 정상적으로 동기화되어 있습니다.'}
            </span>
            <span className="ml-auto text-sm opacity-70">
              검사 시간: {report.duration}ms
            </span>
          </div>

          {/* 고아 DB 레코드 목록 */}
          {report.orphanedDbRecords.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-yellow-400" />
                  <span className="font-medium text-white">고아 DB 레코드</span>
                  <span className="text-sm text-slate-400">(Storage에 파일 없음)</span>
                </div>
                <button
                  onClick={handleRepairDbRecords}
                  disabled={isRepairing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30"
                >
                  {isRepairing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>모두 삭제</span>
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {report.orphanedDbRecords.map((record) => (
                  <div key={record.id} className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 last:border-0">
                    <span className="text-sm text-white truncate flex-1">{record.name}</span>
                    <span className="text-xs text-slate-500 truncate max-w-xs">{record.storagePath}</span>
                    <span className="text-xs text-slate-500">{formatDate(record.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 고아 Storage 파일 목록 */}
          {report.orphanedStorageFiles.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-yellow-400" />
                  <span className="font-medium text-white">고아 Storage 파일</span>
                  <span className="text-sm text-slate-400">(DB에 레코드 없음)</span>
                </div>
                <button
                  onClick={handleRepairStorageFiles}
                  disabled={isRepairing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg border border-red-600/30"
                >
                  {isRepairing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>모두 삭제</span>
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {report.orphanedStorageFiles.map((path, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-4 py-3 border-b border-slate-700/50 last:border-0">
                    <span className="text-sm text-white truncate">{path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 검사 로그 */}
      {logs.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-700">
            <Clock size={16} className="text-slate-400" />
            <span className="font-medium text-white">검사 기록</span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-4 py-3">
                <StatusIcon status={log.status} />
                <span className="text-sm text-white">{formatDate(log.createdAt)}</span>
                <span className="text-sm text-slate-400">
                  정상: {log.validFiles} | 고아 레코드: {log.orphanedRecords} | 고아 파일: {log.orphanedFiles}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 초기 상태 */}
      {!report && !isChecking && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Shield size={48} strokeWidth={1} className="mb-4 opacity-50" />
          <p className="font-medium">검사를 실행하여 파일 무결성을 확인하세요</p>
          <p className="text-sm mt-1">Storage와 DB 간 동기화 상태를 검사합니다</p>
        </div>
      )}
    </div>
  )
}
