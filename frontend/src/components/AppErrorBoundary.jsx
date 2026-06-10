/**
 * AppErrorBoundary — 라우트 서브트리 에러 격리.
 *
 * 한 화면의 렌더/이펙트(클린업 포함) 에러가 React 루트 전체를 내리는 것을 막는다.
 * (실사례: Explorer 이탈 시 오버레이 cleanup throw → 앱 전체 빈 화면, 커밋 1310416 참조.)
 *
 * 배치: App 의 NavBar 바깥, <Routes> 만 감싼다 — 화면이 죽어도 내비게이션은 살아있다.
 * 복구: 네비게이션(location.key 변경) 시 자동 리셋 + 폴백 UI 의 "다시 시도"/"Explorer로".
 */
import { Component } from 'react'
import { useLocation } from 'react-router-dom'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('화면 에러 격리:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    // 사용자가 다른 곳으로 이동하면(NavBar 는 폴백 중에도 동작) 자동 복구
    if (this.state.error && prevProps.locationKey !== this.props.locationKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    const message = this.state.error?.message || String(this.state.error)
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
        background: 'var(--bg)', color: 'var(--t1)', textAlign: 'center',
      }}>
        <span style={{ fontSize: 34, color: 'var(--t3)', lineHeight: 1 }}>⚠</span>
        <div style={{ fontSize: 16, fontWeight: 600 }}>화면에 문제가 발생했습니다</div>
        <div style={{ fontSize: 12.5, color: 'var(--t2)', maxWidth: 480, lineHeight: 1.6 }}>
          이 화면에서 오류가 발생해 표시를 중단했습니다. 다른 화면은 정상 동작합니다.
        </div>
        <code style={{
          fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--fail)',
          background: 'color-mix(in srgb, var(--fail) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)',
          borderRadius: 8, padding: '8px 14px', maxWidth: 560,
          overflowWrap: 'anywhere',
        }}>
          {message}
        </code>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--blue)',
              border: 0, borderRadius: 8, padding: '9px 18px', cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          <a
            href="/"
            style={{
              fontSize: 12.5, fontWeight: 500, color: 'var(--t2)', background: 'var(--card)',
              border: '1px solid var(--line)', borderRadius: 8, padding: '9px 18px',
              textDecoration: 'none',
            }}
          >
            ← Explorer로 (새로고침)
          </a>
        </div>
      </div>
    )
  }
}

export default function AppErrorBoundary({ children }) {
  const location = useLocation()
  return <RouteErrorBoundary locationKey={location.key}>{children}</RouteErrorBoundary>
}
