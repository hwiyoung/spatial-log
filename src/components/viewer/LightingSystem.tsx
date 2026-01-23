// 개선된 조명 시스템
// 프리셋 기반 3점 조명 시스템

import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { LIGHTING_PRESETS, type RenderingQualityOptions } from '@/utils/renderingOptions'

interface LightingSystemProps {
  preset?: keyof typeof LIGHTING_PRESETS
  quality: RenderingQualityOptions
  customAmbient?: number
  customIntensity?: number
}

export default function LightingSystem({
  preset = 'studio',
  quality,
  customAmbient,
  customIntensity,
}: LightingSystemProps) {
  const keyLightRef = useRef<THREE.DirectionalLight>(null)
  const fillLightRef = useRef<THREE.DirectionalLight>(null)
  const rimLightRef = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()

  const config = LIGHTING_PRESETS[preset] || LIGHTING_PRESETS.studio
  const ambientIntensity = customAmbient ?? config.ambient ?? quality.ambientIntensity
  const intensityMultiplier = customIntensity ?? 1

  // 그림자 설정
  useEffect(() => {
    if (keyLightRef.current && quality.shadowsEnabled) {
      keyLightRef.current.castShadow = true
      keyLightRef.current.shadow.mapSize.width = quality.shadowMapSize
      keyLightRef.current.shadow.mapSize.height = quality.shadowMapSize
      keyLightRef.current.shadow.camera.near = 0.5
      keyLightRef.current.shadow.camera.far = 50
      keyLightRef.current.shadow.camera.left = -10
      keyLightRef.current.shadow.camera.right = 10
      keyLightRef.current.shadow.camera.top = 10
      keyLightRef.current.shadow.camera.bottom = -10
      keyLightRef.current.shadow.bias = -0.0001
    }
  }, [quality.shadowsEnabled, quality.shadowMapSize])

  // 씬에 그림자 활성화
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = quality.shadowsEnabled
        obj.receiveShadow = quality.shadowsEnabled
      }
    })
  }, [scene, quality.shadowsEnabled])

  return (
    <>
      {/* 환경광 */}
      <ambientLight intensity={ambientIntensity} />

      {/* 키 라이트 (주 광원) */}
      <directionalLight
        ref={keyLightRef}
        position={config.key.position}
        intensity={config.key.intensity * intensityMultiplier}
        color={config.key.color || '#ffffff'}
        castShadow={quality.shadowsEnabled}
      />

      {/* 필 라이트 (보조 광원) */}
      {config.fill && (
        <directionalLight
          ref={fillLightRef}
          position={config.fill.position}
          intensity={config.fill.intensity * intensityMultiplier}
          color={config.fill.color || '#ffffff'}
        />
      )}

      {/* 림 라이트 (역광) */}
      {config.rim && (
        <directionalLight
          ref={rimLightRef}
          position={config.rim.position}
          intensity={config.rim.intensity * intensityMultiplier}
          color={config.rim.color || '#ffffff'}
        />
      )}
    </>
  )
}

// 간단한 조명 컴포넌트 (기존 호환성 유지)
export function SimpleLighting({
  ambientIntensity = 0.4,
  directionalIntensity = 1.0,
  shadowsEnabled = true,
  shadowMapSize = 2048,
}: {
  ambientIntensity?: number
  directionalIntensity?: number
  shadowsEnabled?: boolean
  shadowMapSize?: number
}) {
  const mainLightRef = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()

  useEffect(() => {
    if (mainLightRef.current && shadowsEnabled) {
      mainLightRef.current.castShadow = true
      mainLightRef.current.shadow.mapSize.width = shadowMapSize
      mainLightRef.current.shadow.mapSize.height = shadowMapSize
      mainLightRef.current.shadow.camera.near = 0.5
      mainLightRef.current.shadow.camera.far = 50
      mainLightRef.current.shadow.camera.left = -10
      mainLightRef.current.shadow.camera.right = 10
      mainLightRef.current.shadow.camera.top = 10
      mainLightRef.current.shadow.camera.bottom = -10
    }
  }, [shadowsEnabled, shadowMapSize])

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = shadowsEnabled
        obj.receiveShadow = shadowsEnabled
      }
    })
  }, [scene, shadowsEnabled])

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        ref={mainLightRef}
        position={[10, 10, 5]}
        intensity={directionalIntensity}
        castShadow={shadowsEnabled}
      />
      <directionalLight
        position={[-5, 5, -5]}
        intensity={directionalIntensity * 0.3}
      />
    </>
  )
}
