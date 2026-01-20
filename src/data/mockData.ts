export interface Asset {
  id: number
  name: string
  type: string
  size: string
  date: string
  status: string
  thumbnail: string
  folder: string
}

export interface Project {
  id: number
  name: string
  assets: number
  lastEdited: string
  tags: string[]
  status: string
  members: number
}

export interface Annotation {
  id: number
  title: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'Open' | 'In Progress' | 'Resolved'
  author: string
  date: string
  asset: string
  x: string
  y: string
}

export const MOCK_ASSETS: Asset[] = [
  {
    id: 1,
    name: '강남구_블록A_드론매핑.obj',
    type: 'Drone',
    size: '1.2 GB',
    date: '2024-01-15',
    status: 'ready',
    thumbnail: 'bg-blue-900',
    folder: '서울시',
  },
  {
    id: 2,
    name: '실내_스캔_B2층.las',
    type: 'LIDAR',
    size: '4.5 GB',
    date: '2024-01-14',
    status: 'processing',
    thumbnail: 'bg-gray-800',
    folder: '건물B',
  },
  {
    id: 3,
    name: '스마트폰_현장사진_모음.zip',
    type: 'Mobile',
    size: '250 MB',
    date: '2024-01-14',
    status: 'ready',
    thumbnail: 'bg-indigo-900',
    folder: '현장사진',
  },
  {
    id: 4,
    name: '시설물_모델링_v2.fbx',
    type: '3D Model',
    size: '85 MB',
    date: '2024-01-12',
    status: 'ready',
    thumbnail: 'bg-purple-900',
    folder: '라이브러리',
  },
  {
    id: 5,
    name: '지형_포인트클라우드.ply',
    type: 'Scan',
    size: '2.1 GB',
    date: '2024-01-10',
    status: 'ready',
    thumbnail: 'bg-green-900',
    folder: '서울시',
  },
]

export const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    name: '서울 스마트시티 실증',
    assets: 12,
    lastEdited: '2시간 전',
    tags: ['드론', '도시'],
    status: 'active',
    members: 4,
  },
  {
    id: 2,
    name: '부산 항만 시설 점검',
    assets: 5,
    lastEdited: '1일 전',
    tags: ['시설물', '안전'],
    status: 'review',
    members: 2,
  },
  {
    id: 3,
    name: '인천공항 제2터미널 스캔',
    assets: 24,
    lastEdited: '3일 전',
    tags: ['LIDAR', '대규모'],
    status: 'active',
    members: 8,
  },
  {
    id: 4,
    name: 'GTX-A 노선 지반 조사',
    assets: 8,
    lastEdited: '1주 전',
    tags: ['지하', '토목'],
    status: 'completed',
    members: 5,
  },
  {
    id: 5,
    name: '문화재 복원 3D 스캔',
    assets: 3,
    lastEdited: '2주 전',
    tags: ['문화재', '정밀'],
    status: 'active',
    members: 3,
  },
]

export const MOCK_ANNOTATIONS: Annotation[] = [
  {
    id: 1,
    title: '북측 외벽 균열 발생',
    priority: 'High',
    status: 'Open',
    author: '김지수',
    date: '2024-01-20',
    asset: '강남구_블록A_드론매핑.obj',
    x: '30%',
    y: '40%',
  },
  {
    id: 2,
    title: '배수관 연결부 부식 확인',
    priority: 'Medium',
    status: 'In Progress',
    author: '박서준',
    date: '2024-01-19',
    asset: '시설물_모델링_v2.fbx',
    x: '60%',
    y: '25%',
  },
  {
    id: 3,
    title: '포인트 클라우드 노이즈 제거 필요',
    priority: 'Low',
    status: 'Resolved',
    author: '이하은',
    date: '2024-01-18',
    asset: '실내_스캔_B2층.las',
    x: '45%',
    y: '70%',
  },
  {
    id: 4,
    title: '안전 펜스 위치 재조정 요망',
    priority: 'High',
    status: 'Open',
    author: '최민우',
    date: '2024-01-15',
    asset: '지형_포인트클라우드.ply',
    x: '75%',
    y: '55%',
  },
]
