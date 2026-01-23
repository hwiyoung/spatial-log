// 렌더링 품질 옵션 시스템
// 사용자가 렌더링 품질을 선택할 수 있도록 프리셋을 제공합니다.

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra'

export interface RenderingQualityOptions {
  level: QualityLevel

  // Anti-aliasing
  antialias: boolean

  // Shadows
  shadowsEnabled: boolean
  shadowMapSize: number  // 512, 1024, 2048, 4096

  // Post-processing (high/ultra에서만 활성화)
  ssaoEnabled: boolean
  bloomEnabled: boolean

  // Performance
  pixelRatio: number
  maxLights: number

  // Lighting
  ambientIntensity: number
  directionalIntensity: number

  // Environment
  environmentPreset: 'none' | 'studio' | 'city' | 'warehouse' | 'outdoor'
}

// 품질 프리셋
export const QUALITY_PRESETS: Record<QualityLevel, RenderingQualityOptions> = {
  low: {
    level: 'low',
    antialias: false,
    shadowsEnabled: false,
    shadowMapSize: 512,
    ssaoEnabled: false,
    bloomEnabled: false,
    pixelRatio: 1,
    maxLights: 2,
    ambientIntensity: 0.5,
    directionalIntensity: 0.8,
    environmentPreset: 'none',
  },
  medium: {
    level: 'medium',
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    ssaoEnabled: false,
    bloomEnabled: false,
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    maxLights: 4,
    ambientIntensity: 0.4,
    directionalIntensity: 1.0,
    environmentPreset: 'studio',
  },
  high: {
    level: 'high',
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    ssaoEnabled: true,
    bloomEnabled: true,
    pixelRatio: window.devicePixelRatio,
    maxLights: 8,
    ambientIntensity: 0.35,
    directionalIntensity: 1.2,
    environmentPreset: 'city',
  },
  ultra: {
    level: 'ultra',
    antialias: true,
    shadowsEnabled: true,
    shadowMapSize: 4096,
    ssaoEnabled: true,
    bloomEnabled: true,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    maxLights: 16,
    ambientIntensity: 0.3,
    directionalIntensity: 1.5,
    environmentPreset: 'city',
  },
}

// 조명 프리셋
export interface LightingPreset {
  name: string
  ambient: number
  key: { position: [number, number, number]; intensity: number; color?: string }
  fill?: { position: [number, number, number]; intensity: number; color?: string }
  rim?: { position: [number, number, number]; intensity: number; color?: string }
}

export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  studio: {
    name: '스튜디오',
    ambient: 0.3,
    key: { position: [10, 10, 5], intensity: 1.2, color: '#ffffff' },
    fill: { position: [-5, 5, -5], intensity: 0.5, color: '#e0e8ff' },
    rim: { position: [0, -5, -10], intensity: 0.3, color: '#ffe0c0' },
  },
  outdoor: {
    name: '야외 (태양광)',
    ambient: 0.5,
    key: { position: [50, 50, 30], intensity: 1.5, color: '#fff8e0' },
    fill: { position: [-10, 20, -10], intensity: 0.2, color: '#a0c0ff' },
  },
  warehouse: {
    name: '창고/실내',
    ambient: 0.4,
    key: { position: [0, 20, 0], intensity: 1.0, color: '#ffffff' },
    fill: { position: [10, 5, 10], intensity: 0.3, color: '#ffffff' },
  },
  dramatic: {
    name: '드라마틱',
    ambient: 0.15,
    key: { position: [5, 10, 2], intensity: 2.0, color: '#ffcc80' },
    fill: { position: [-10, 5, -5], intensity: 0.1, color: '#4080ff' },
    rim: { position: [-5, 0, -10], intensity: 0.5, color: '#ff8040' },
  },
  neutral: {
    name: '중립',
    ambient: 0.4,
    key: { position: [10, 10, 10], intensity: 1.0, color: '#ffffff' },
    fill: { position: [-10, 10, -10], intensity: 0.3, color: '#ffffff' },
  },
}

// localStorage 키
const STORAGE_KEY = 'spatial-log-rendering-quality'

/**
 * 현재 품질 설정 로드
 */
export function loadQualitySettings(): QualityLevel {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (saved === 'low' || saved === 'medium' || saved === 'high' || saved === 'ultra')) {
      return saved
    }
  } catch {
    // localStorage 접근 실패
  }
  return 'medium' // 기본값
}

/**
 * 품질 설정 저장
 */
export function saveQualitySettings(level: QualityLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, level)
  } catch {
    // localStorage 접근 실패
  }
}

/**
 * 품질 레벨에 따른 옵션 반환
 */
export function getQualityOptions(level: QualityLevel): RenderingQualityOptions {
  return QUALITY_PRESETS[level]
}

/**
 * 품질 레벨 라벨
 */
export const QUALITY_LABELS: Record<QualityLevel, { label: string; description: string }> = {
  low: {
    label: '낮음',
    description: '저사양 기기에 적합. 그림자 없음.',
  },
  medium: {
    label: '보통',
    description: '기본 설정. 그림자 활성화.',
  },
  high: {
    label: '높음',
    description: '후처리 효과 활성화. SSAO, Bloom.',
  },
  ultra: {
    label: '최고',
    description: '최상의 품질. 고해상도 그림자.',
  },
}
