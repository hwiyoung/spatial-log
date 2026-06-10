/**
 * SpatialGlyph — 공간 예측 종류를 형태로만 구분하는 단색 SVG 글리프 (Upload.html 포팅).
 * 카테고리 글리프와 동일 원칙: 색은 쓰지 않는다.
 */
export default function SpatialGlyph({ kind, s = 16 }) {
  const common = {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round',
  }
  switch (kind) {
    case 'geometry':
      return (<svg {...common}><path d="M12 21 C7 15 4 11 4 8 a8 8 0 0 1 16 0 c0 3 -3 7 -8 13 Z" /><circle cx="12" cy="8" r="2.2" /></svg>)
    case 'bbox':
      return (<svg {...common}><rect x="4.5" y="4.5" width="15" height="15" rx="1" strokeDasharray="3 2.4" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>)
    case 'manual':
      return (<svg {...common}><path d="M12 21 C7 15 4 11 4 8 a8 8 0 0 1 16 0 c0 3 -3 7 -8 13 Z" /><path d="M9.5 8 L12 10.5 L14.5 8" /></svg>)
    case 'coverage':
      return (<svg {...common}><path d="M6 5 L18 7 L20 16 L13 20 L4 15 Z" strokeDasharray="3 2.4" /></svg>)
    case 'fallback':
      return (<svg {...common}><circle cx="12" cy="12" r="8" strokeDasharray="3 2.6" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></svg>)
    default:
      return (<svg {...common}><circle cx="12" cy="12" r="8" strokeDasharray="2 3" opacity="0.6" /><path d="M8 8 L16 16 M16 8 L8 16" opacity="0.6" /></svg>)
  }
}
