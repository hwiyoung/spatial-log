/**
 * Upload — 벌크(3-step) + 단건(4-step) 업로드 페이지
 *
 * 벌크: Collection 선택 → 폴더 드래그앤드롭 → 매니페스트 편집 → 등록
 * 단건: Collection 선택 → 파일 드롭 → 메타데이터 입력 → 등록
 *
 * 참조: docs/system_structure_design.md 페이지 4
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadApi, collectionApi } from '../services/api'
import { getCategoryInfo, formatSize } from '../constants'

export default function Upload() {
  const [mode, setMode] = useState('bulk') // 'bulk' | 'single'

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>데이터 업로드</div>

        {/* 모드 탭 */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
          {[
            { id: 'bulk', label: '📦 벌크 업로드 (여러 파일)' },
            { id: 'single', label: '📄 단건 업로드 (파일 1개)' },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setMode(t.id)}
              style={{
                padding: '8px 20px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 12,
                background: mode === t.id ? 'var(--s1)' : 'transparent',
                color: mode === t.id ? 'var(--ac)' : 'var(--t3)',
                border: mode === t.id ? '1px solid var(--bd)' : '1px solid transparent',
                borderBottom: mode === t.id ? '1px solid var(--s1)' : '1px solid var(--bd)',
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {mode === 'bulk' ? <BulkUpload /> : <SingleUpload />}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 벌크 업로드 (3-step)
// ─────────────────────────────────────────────────────────────────────────

function BulkUpload() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [files, setFiles] = useState([])
  const [manifest, setManifest] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    collectionApi.list()
      .then(res => setCollections(res.data?.collections || []))
      .catch(() => {})
  }, [])

  // Step 1: 파일 선택 + analyze
  async function handleAnalyze() {
    if (!files.length) return
    setAnalyzing(true)
    try {
      const formData = new FormData()
      for (const f of files) formData.append('files', f)
      formData.append('collection_id', selectedCollection)

      const res = await uploadApi.analyze(formData)
      setManifest(res.data)
      setStep(2)
    } catch (err) {
      console.error('분석 실패:', err)
      alert('분석 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAnalyzing(false)
    }
  }

  // Step 3: 등록
  async function handleRegister() {
    if (!manifest) return
    setRegistering(true)
    try {
      const items = manifest.manifest.map(item => ({
        data_category: item.detected_category,
        ...flattenExtracted(item.auto_extracted),
        ...flattenExtracted(item.inherited),
        _filename: item.file_path,
      }))

      const res = await uploadApi.register({
        collection_id: selectedCollection,
        items,
        status: 'draft',
      })
      setStep(3)
    } catch (err) {
      console.error('등록 실패:', err)
      alert('등록 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div style={{ padding: 20, background: 'var(--s1)', borderRadius: 10, border: '1px solid var(--bd)' }}>
      {/* 스텝 인디케이터 */}
      <StepIndicator current={step} steps={['파일 선택 + 분석', '매니페스트 확인', '완료']} />

      {step === 1 && (
        <div>
          {/* Collection 선택 */}
          <div style={{ marginBottom: 16 }}>
            <Label>Collection 선택</Label>
            <select
              value={selectedCollection}
              onChange={e => setSelectedCollection(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)',
                background: 'var(--s2)', color: 'var(--t1)', fontSize: 12,
              }}
            >
              <option value="">Collection을 선택하세요 (선택사항)</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
            </select>
          </div>

          {/* 파일 드롭존 */}
          <Dropzone files={files} onFilesChange={setFiles} />

          {/* 분석 버튼 */}
          <button
            onClick={handleAnalyze}
            disabled={!files.length || analyzing}
            style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 6, border: 'none',
              background: files.length ? 'var(--ac)' : 'var(--bd)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: files.length ? 'pointer' : 'default',
              opacity: analyzing ? 0.5 : 1,
            }}
          >
            {analyzing ? '분석 중...' : `${files.length}개 파일 분석`}
          </button>
        </div>
      )}

      {step === 2 && manifest && (
        <div>
          {/* 요약 */}
          <div style={{
            padding: 12, background: 'var(--s2)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: 'var(--t2)',
          }}>
            전체 <b style={{ color: 'var(--t1)' }}>{manifest.summary.total_files}</b>개 Item
            {' · '}자동 채움: <b style={{ color: 'var(--ac)' }}>{manifest.summary.auto_filled_percentage}%</b>
            {' · '}수동 입력 필요: <b style={{ color: 'var(--err)' }}>{manifest.summary.manual_required_fields}</b>개 필드
          </div>

          {/* 매니페스트 테이블 */}
          <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: 14 }}>
            {manifest.manifest.map((item, idx) => (
              <ManifestRow key={idx} item={item} index={idx} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid var(--bd)',
              background: 'transparent', color: 'var(--t2)', fontSize: 12, cursor: 'pointer',
            }}>← 이전</button>
            <button onClick={handleRegister} disabled={registering} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: 'var(--ac)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: registering ? 0.5 : 1,
            }}>{registering ? '등록 중...' : 'Draft로 등록'}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 8 }}>등록 완료</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
            Draft 상태로 등록되었습니다. Project 페이지에서 확인하고 Published로 전환하세요.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => navigate('/project')} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: 'var(--ac)', color: '#fff', fontSize: 12, cursor: 'pointer',
            }}>Project로 이동</button>
            <button onClick={() => { setStep(1); setFiles([]); setManifest(null) }} style={{
              padding: '8px 20px', borderRadius: 6, border: '1px solid var(--bd)',
              background: 'transparent', color: 'var(--t2)', fontSize: 12, cursor: 'pointer',
            }}>추가 업로드</button>
          </div>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 단건 업로드 (4-step) — 간략 버전
// ─────────────────────────────────────────────────────────────────────────

function SingleUpload() {
  const navigate = useNavigate()
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    collectionApi.list()
      .then(res => setCollections(res.data?.collections || []))
      .catch(() => {})
  }, [])

  async function handleAnalyze() {
    if (!file) return
    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('collection_id', selectedCollection)
      const res = await uploadApi.analyze(formData)
      setResult(res.data)
    } catch (err) {
      alert('분석 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div style={{ padding: 20, background: 'var(--s1)', borderRadius: 10, border: '1px solid var(--bd)' }}>
      {/* Collection 선택 */}
      <div style={{ marginBottom: 16 }}>
        <Label>Collection 선택</Label>
        <select
          value={selectedCollection}
          onChange={e => setSelectedCollection(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bd)',
            background: 'var(--s2)', color: 'var(--t1)', fontSize: 12,
          }}
        >
          <option value="">Collection을 선택하세요 (선택사항)</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
        </select>
      </div>

      {/* 파일 선택 */}
      <Dropzone files={file ? [file] : []} onFilesChange={f => setFile(f[0] || null)} single />

      {file && !result && (
        <button onClick={handleAnalyze} disabled={analyzing} style={{
          marginTop: 16, padding: '10px 24px', borderRadius: 6, border: 'none',
          background: 'var(--ac)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          opacity: analyzing ? 0.5 : 1,
        }}>{analyzing ? '분석 중...' : '분석'}</button>
      )}

      {/* 분석 결과 */}
      {result && result.manifest?.[0] && (
        <div style={{ marginTop: 16 }}>
          <ManifestRow item={result.manifest[0]} index={0} expanded />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 12 }}>
            매니페스트를 확인한 후 벌크 업로드에서 등록하거나, 직접 API를 호출하여 등록할 수 있습니다.
          </div>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────
// 공통 컴포넌트
// ─────────────────────────────────────────────────────────────────────────

function Dropzone({ files, onFilesChange, single }) {
  const [over, setOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setOver(false)
    const dropped = [...e.dataTransfer.files]
    onFilesChange(single ? [dropped[0]] : dropped)
  }

  function handleSelect(e) {
    const selected = [...e.target.files]
    onFilesChange(single ? [selected[0]] : selected)
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById(single ? 'single-file' : 'bulk-files').click()}
        style={{
          padding: '36px 20px', textAlign: 'center', cursor: 'pointer',
          border: `2px dashed ${over ? 'var(--ac)' : 'var(--bd)'}`,
          borderRadius: 10, transition: '0.2s',
          background: over ? 'rgba(74,114,255,0.03)' : 'transparent',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>
          파일을 여기에 드래그하세요
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
          또는 클릭하여 선택 {single ? '(파일 1개)' : '(여러 파일 가능)'}
        </div>
      </div>
      <input
        id={single ? 'single-file' : 'bulk-files'}
        type="file"
        multiple={!single}
        onChange={handleSelect}
        style={{ display: 'none' }}
      />

      {/* 선택된 파일 목록 */}
      {files.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
              fontSize: 11, color: 'var(--t2)',
            }}>
              <span>📄</span>
              <span style={{ flex: 1 }}>{f.name}</span>
              <span style={{ color: 'var(--t3)' }}>{formatSize(f.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ManifestRow({ item, index, expanded: defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded || false)
  const cat = getCategoryInfo(item.detected_category)

  return (
    <div style={{
      padding: '10px 14px', background: 'var(--s2)', borderRadius: 8,
      border: '1px solid var(--bd)', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, color: cat.color }}>{cat.icon}</span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--t1)' }}>{item.file_path}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
          background: cat.color + '12', color: cat.color,
        }}>{cat.label} ({(item.category_confidence * 100).toFixed(0)}%)</span>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 10, color: 'var(--ac)', cursor: 'pointer' }}
        >{expanded ? '▼ 접기' : '▶ 상세'}</span>
      </div>

      {/* 필수 빈 필드 */}
      {item.required_empty?.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--err)', marginTop: 4 }}>
          ⚠ 수동 입력 필요: {item.required_empty.join(', ')}
        </div>
      )}

      {/* 관계 제안 */}
      {item.suggested_links?.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 4 }}>
          🔗 관계 제안: {item.suggested_links.map(l => `${l.rel} → ${l.target_file.split('/').pop()}`).join(', ')}
        </div>
      )}

      {/* 확장: 추출 메타데이터 */}
      {expanded && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--s1)', borderRadius: 6, fontSize: 10 }}>
          {Object.entries(item.auto_extracted || {}).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ color: 'var(--ac)' }}>{key}</span>
              <span style={{ color: 'var(--t1)' }}>
                {typeof val.value === 'object' ? JSON.stringify(val.value) : String(val.value)}
                <span style={{ color: 'var(--t3)', marginLeft: 4 }}>[{val.source}]</span>
              </span>
            </div>
          ))}
          {Object.entries(item.inherited || {}).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ color: 'var(--ok)' }}>{key}</span>
              <span style={{ color: 'var(--t1)' }}>
                {String(val.value)} <span style={{ color: 'var(--t3)', marginLeft: 4 }}>[Collection]</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepIndicator({ current, steps }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {steps.map((label, i) => {
        const num = i + 1
        const isActive = num === current
        const isDone = num < current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600,
              background: isDone ? 'var(--ok)' : isActive ? 'var(--ac)' : 'var(--s2)',
              color: isDone || isActive ? '#fff' : 'var(--t3)',
            }}>
              {isDone ? '✓' : num}
            </div>
            <span style={{ fontSize: 11, color: isActive ? 'var(--ac)' : 'var(--t3)' }}>{label}</span>
            {i < steps.length - 1 && <div style={{ width: 30, height: 1, background: 'var(--bd)' }} />}
          </div>
        )
      })}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{children}</div>
}

function flattenExtracted(obj) {
  const flat = {}
  for (const [key, val] of Object.entries(obj || {})) {
    flat[key] = val.value
  }
  return flat
}
