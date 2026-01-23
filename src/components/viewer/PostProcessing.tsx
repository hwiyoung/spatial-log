// 후처리 효과 컴포넌트
// SSAO, Bloom 등의 효과를 제공합니다.
// high/ultra 품질에서만 활성화됩니다.

import { useMemo } from 'react'
import { EffectComposer, SSAO, Bloom, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import type { RenderingQualityOptions } from '@/utils/renderingOptions'

interface PostProcessingProps {
  quality: RenderingQualityOptions
  enabled?: boolean
}

export default function PostProcessing({ quality, enabled = true }: PostProcessingProps) {
  // low/medium에서는 후처리 없음
  if (!enabled || (quality.level !== 'high' && quality.level !== 'ultra')) {
    return null
  }

  // SSAO 설정
  const ssaoConfig = useMemo(() => ({
    samples: quality.level === 'ultra' ? 32 : 16,
    radius: 0.5,
    intensity: 15,
    luminanceInfluence: 0.5,
    color: undefined,
    bias: 0.025,
  }), [quality.level])

  // Bloom 설정
  const bloomConfig = useMemo(() => ({
    intensity: quality.level === 'ultra' ? 0.6 : 0.4,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025,
    mipmapBlur: true,
  }), [quality.level])

  return (
    <EffectComposer multisampling={quality.level === 'ultra' ? 8 : 4}>
      {/* SSAO (Ambient Occlusion) */}
      {quality.ssaoEnabled && (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={ssaoConfig.samples}
          radius={ssaoConfig.radius}
          intensity={ssaoConfig.intensity}
          luminanceInfluence={ssaoConfig.luminanceInfluence}
          bias={ssaoConfig.bias}
        />
      )}

      {/* Bloom */}
      {quality.bloomEnabled && (
        <Bloom
          intensity={bloomConfig.intensity}
          luminanceThreshold={bloomConfig.luminanceThreshold}
          luminanceSmoothing={bloomConfig.luminanceSmoothing}
          mipmapBlur={bloomConfig.mipmapBlur}
        />
      )}

      {/* Tone Mapping */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

// 간단한 후처리 (Bloom만)
export function SimpleBloom({ intensity = 0.5, threshold = 0.9 }: { intensity?: number; threshold?: number }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={intensity}
        luminanceThreshold={threshold}
        luminanceSmoothing={0.025}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
