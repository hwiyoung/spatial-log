/**
 * ViewerStatePanels — 미리보기 상태별 안내 패널.
 *
 * preview 상태가 available 이 아닐 때 vstage 중앙에 표시된다.
 *  - pending : 변환 진행 중 (에러 아님). 원본은 항상 다운로드 가능.
 *  - missing : 미리보기 없음. orthoimage(GeoTIFF)는 "브라우저 비표시"라는 알려진 한계로 구분.
 *  - failed  : 변환 시도했으나 실패 — 사유 표기 + 재시도.
 *
 * 핸드오프 `ViewerShell.html` 의 PendingPanel/MissingPanel/FailedPanel 을 옮긴 것.
 */

export function PendingPanel({ generating, onDownload, onOpenDetail }) {
  return (
    <div className="state-panel">
      <div className="sp-ico" style={{ color: 'var(--pend)', borderColor: 'rgba(251,191,36,.4)', background: 'rgba(251,191,36,.08)' }}>◔</div>
      <span className="sp-state" style={{ color: 'var(--pend)', borderColor: 'rgba(251,191,36,.4)', background: 'rgba(251,191,36,.08)' }}>
        <i style={{ background: 'var(--pend)' }} />PENDING · 준비 중
      </span>
      <div className="sp-title">미리보기 생성 중</div>
      <div className="sp-desc">
        <b style={{ color: 'var(--t1)' }}>{generating || '뷰어용 변환'}</b> 작업이 진행 중입니다.
        완료되면 이 자리에 뷰어가 표시됩니다. 에러가 아닙니다.
      </div>
      <div className="sp-progress"><i /></div>
      <div className="sp-meta">원본은 지금도 손실 없이 받을 수 있습니다 · 무손실 원칙</div>
      <div className="sp-actions">
        <button type="button" className="sp-btn primary" onClick={onDownload}>⤓ 원본 먼저 다운로드</button>
        {onOpenDetail && (
          <button type="button" className="sp-btn ghost" onClick={onOpenDetail}>변환 진행 상황</button>
        )}
      </div>
    </div>
  )
}

export function MissingPanel({ kind, onDownload }) {
  const tiff = kind === 'tiff'
  return (
    <div className="state-panel">
      <div className="sp-ico" style={{ color: 'var(--miss)', borderColor: '#3a4452', background: 'rgba(91,101,115,.1)' }}>⊘</div>
      <span className="sp-state" style={{ color: 'var(--t2)', borderColor: '#3a4452', background: 'rgba(91,101,115,.1)' }}>
        <i style={{ background: 'var(--miss)' }} />MISSING · 미리보기 없음
      </span>
      <div className="sp-title">{tiff ? '브라우저에서 표시할 수 없는 형식' : '미리보기를 사용할 수 없음'}</div>
      <div className="sp-desc">
        {tiff
          ? (
            <>
              원본 <span className="mono" style={{ color: 'var(--t1)' }}>GeoTIFF</span> 는 브라우저에서 직접 렌더링되지 않습니다.
              이는 <b style={{ color: 'var(--t1)' }}>알려진 한계</b>이지 오류가 아닙니다 — 원본을 받아 GIS 도구에서 열거나,
              타일 변환본이 준비되면 표시됩니다.
            </>
          )
          : <>이 자산에는 표시 가능한 미리보기가 없습니다. 원본을 다운로드해 외부 도구에서 확인하세요.</>}
      </div>
      <div className="sp-meta">권장 도구 · QGIS · ArcGIS · GDAL</div>
      <div className="sp-actions">
        <button type="button" className="sp-btn primary" onClick={onDownload}>⤓ 원본 다운로드 (무손실)</button>
        <button type="button" className="sp-btn ghost" disabled title="외부 도구 연동은 추후 연결" style={{ cursor: 'not-allowed', opacity: 0.6 }}>외부 도구로 열기</button>
      </div>
    </div>
  )
}

export function FailedPanel({ reason, onDownload, onOpenDetail }) {
  return (
    <div className="state-panel">
      <div className="sp-ico" style={{ color: 'var(--fail)', borderColor: 'rgba(248,113,113,.45)', background: 'rgba(248,113,113,.1)' }}>⚠</div>
      <span className="sp-state" style={{ color: 'var(--fail)', borderColor: 'rgba(248,113,113,.45)', background: 'rgba(248,113,113,.1)' }}>
        <i style={{ background: 'var(--fail)' }} />FAILED · 생성 실패
      </span>
      <div className="sp-title">미리보기 생성에 실패했습니다</div>
      <div className="sp-desc">
        뷰어용 변환을 <b style={{ color: 'var(--t1)' }}>시도했으나 오류로 중단</b>되었습니다.
        (미리보기가 애초에 없는 <span className="mono">missing</span> 과 다릅니다.) 사유는 아래에 기록됩니다.
      </div>
      <div className="sp-reason">⚠ {reason || 'Preview generation failed.'}</div>
      <div className="sp-actions">
        <button type="button" className="sp-btn retry" disabled title="변환 재시도는 추후 연결" style={{ cursor: 'not-allowed', opacity: 0.6 }}>↻ 변환 재시도</button>
        <button type="button" className="sp-btn primary" onClick={onDownload}>⤓ 원본 다운로드</button>
        {onOpenDetail && (
          <button type="button" className="sp-btn ghost" onClick={onOpenDetail}>전체 기록 → Detail</button>
        )}
      </div>
    </div>
  )
}
