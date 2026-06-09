/**
 * CategoryGlyph — 카테고리를 "형태(shape)"로만 구분하는 단색 SVG 글리프.
 *
 * 디자인 원칙(핸드오프): 카테고리는 글리프/형태로만 구분하고 색은 절대 쓰지 않는다.
 * 색은 오직 상태(status)/미리보기 상태(preview)만 운반한다.
 */

const SHAPE_BY_CATEGORY = {
  pointcloud: 'pointcloud',
  '3d_model': 'model',
  '3d_tiles': 'tiles',
  orthoimage: 'ortho',
  image: 'image',
  panorama: 'pano',
  video: 'video',
  document: 'doc',
}

export default function CategoryGlyph({ cat, s = 16 }) {
  const sw = 1.6
  const c = 'currentColor'
  const common = {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c,
    strokeWidth: sw, strokeLinejoin: 'round', strokeLinecap: 'round',
  }
  switch (SHAPE_BY_CATEGORY[cat]) {
    case 'pointcloud':
      return (
        <svg {...common}>
          {[[7, 7], [12, 6], [17, 8], [6, 13], [12, 12], [18, 14], [9, 18], [15, 17]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.05" fill={c} stroke="none" />
          ))}
        </svg>
      )
    case 'model':
      return (<svg {...common}><path d="M12 4 L20 18 L4 18 Z" /><path d="M12 4 L12 18 M7 13 L17 13" /></svg>)
    case 'tiles':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      )
    case 'ortho':
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 14 L10 9 L14 13 L20 8" /><path d="M4 18 L9 15 L13 18" /></svg>)
    case 'image':
      return (<svg {...common}><rect x="4" y="6" width="16" height="12" rx="1.5" /><circle cx="9" cy="11" r="1.6" /><path d="M5 17 L11 12 L15 15 L19 11" /></svg>)
    case 'pano':
      return (<svg {...common}><ellipse cx="12" cy="12" rx="9" ry="6" /><path d="M12 6 C8 9 8 15 12 18 M12 6 C16 9 16 15 12 18 M3.4 12 H20.6" /></svg>)
    case 'video':
      return (<svg {...common}><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M10 9.5 L14.5 12 L10 14.5 Z" fill={c} stroke="none" /></svg>)
    case 'doc':
      return (<svg {...common}><path d="M7 3 H14 L18 7 V21 H7 Z" /><path d="M14 3 V7 H18 M9.5 12 H15.5 M9.5 15 H15.5 M9.5 18 H13" /></svg>)
    default:
      return (<svg {...common}><circle cx="12" cy="12" r="8" /></svg>)
  }
}
