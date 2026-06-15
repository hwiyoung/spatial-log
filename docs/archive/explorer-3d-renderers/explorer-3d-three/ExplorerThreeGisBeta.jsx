import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { getCategoryInfo } from '../../constants.js'
import Explorer3dControls from '../../components/Explorer3dControls.jsx'
import Explorer3dFocusCard from '../../components/Explorer3dFocusCard.jsx'
import Explorer3dLegend from '../../components/Explorer3dLegend.jsx'
import Explorer3dTooltip from '../../components/Explorer3dTooltip.jsx'
import { getAsset3dSummary } from '../explorer-3d/getAsset3dSummary.js'
import { getRelationStyle } from '../relations/relationStyles.js'
import { getThreeAssetItems } from './assetToThreePosition.js'
import { createThreeAssetObject, disposeThreeObject } from './threeVisualPolicy.js'

const DEFAULT_CAMERA = {
  theta: -0.62,
  phi: 1.0,
  radius: 28,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function makeCameraTarget() {
  return new THREE.Vector3(0, 1.4, 0)
}

function applyCamera(camera, state) {
  if (!camera) return
  const sinPhi = Math.sin(state.phi)
  const target = state.target || makeCameraTarget()
  camera.position.set(
    target.x + state.radius * sinPhi * Math.sin(state.theta),
    target.y + state.radius * Math.cos(state.phi),
    target.z + state.radius * sinPhi * Math.cos(state.theta),
  )
  camera.lookAt(target)
}

function getCategoryCounts(items) {
  return (items || []).reduce((counts, item) => {
    const category = item.properties?.data_category || 'unknown'
    counts[category] = (counts[category] || 0) + 1
    return counts
  }, {})
}

function projectAssetToScreen(asset, camera, canvas) {
  if (!asset || !camera || !canvas) return null
  const vector = new THREE.Vector3(
    asset.position.x,
    asset.position.y + asset.objectHeight + 0.8,
    asset.position.z,
  )
  vector.project(camera)

  return {
    ...asset,
    x: clamp((vector.x * 0.5 + 0.5) * 100, 6, 94),
    y: clamp((-vector.y * 0.5 + 0.5) * 100, 8, 92),
    height: 12,
  }
}

function createRelationGroup({
  threeAssets,
  relationOverlayEnabled,
  relationOverlayModel,
}) {
  const group = new THREE.Group()
  group.name = 'selected-relation-lines'
  if (!relationOverlayEnabled) return group

  const assetById = new Map(threeAssets.map(asset => [asset.itemId, asset]))
  ;(relationOverlayModel?.visibleRelations || []).forEach(relation => {
    const source = assetById.get(relation.sourceItemId)
    const target = assetById.get(relation.targetItemId)
    if (!source || !target) return

    const style = getRelationStyle(relation.rel)
    const points = [
      new THREE.Vector3(source.position.x, source.position.y + source.objectHeight + 0.28, source.position.z),
      new THREE.Vector3(target.position.x, target.position.y + target.objectHeight + 0.28, target.position.z),
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = style.dashArray
      ? new THREE.LineDashedMaterial({
        color: style.color,
        dashSize: Math.max(0.16, style.dashArray[0] * 0.08),
        gapSize: Math.max(0.1, (style.dashArray[1] || 2) * 0.08),
        transparent: true,
        opacity: 0.95,
      })
      : new THREE.LineBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: 0.95,
      })
    const line = new THREE.Line(geometry, material)
    if (style.dashArray) line.computeLineDistances()
    group.add(line)

    const sourceDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 10),
      new THREE.MeshBasicMaterial({ color: '#F4F6FA' }),
    )
    sourceDot.position.copy(points[0])
    sourceDot.userData.decorative = true
    group.add(sourceDot)

    const targetDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 16, 10),
      new THREE.MeshBasicMaterial({ color: style.markerColor || style.color }),
    )
    targetDot.position.copy(points[1])
    targetDot.userData.decorative = true
    group.add(targetDot)
  })

  return group
}

export default function ExplorerThreeGisBeta({
  items = [],
  collections = [],
  selectedId,
  onSelectItem,
  relationOverlayEnabled = false,
  relationOverlayModel = null,
  relationRecords = [],
  mockMode = false,
  onWebglUnavailable,
}) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const pickablesRef = useRef([])
  const assetGroupRef = useRef(null)
  const relationGroupRef = useRef(null)
  const animationFrameRef = useRef(null)
  const dragRef = useRef({ active: false, dragged: false, x: 0, y: 0 })
  const cameraStateRef = useRef({
    ...DEFAULT_CAMERA,
    target: makeCameraTarget(),
  })
  const [hoveredId, setHoveredId] = useState(null)
  const [focusSelected, setFocusSelected] = useState(Boolean(selectedId))
  const [webglFailed, setWebglFailed] = useState(false)
  const [cameraVersion, setCameraVersion] = useState(0)

  useEffect(() => {
    setFocusSelected(Boolean(selectedId))
  }, [selectedId])

  const threeAssets = useMemo(
    () => getThreeAssetItems(items, {
      selectedId,
      focusSelected,
    }),
    [items, selectedId, focusSelected],
  )
  const categoryCounts = useMemo(() => getCategoryCounts(items), [items])
  const assetById = useMemo(
    () => new Map(threeAssets.map(asset => [asset.itemId, asset])),
    [threeAssets],
  )
  const relatedRelationByItem = useMemo(() => {
    const map = new Map()
    if (relationOverlayEnabled) {
      ;(relationOverlayModel?.visibleRelations || []).forEach(relation => {
        map.set(relation.relatedItemId, relation)
      })
    }
    return map
  }, [relationOverlayEnabled, relationOverlayModel])
  const activeRels = useMemo(
    () => new Set((relationOverlayModel?.visibleRelations || []).map(relation => relation.rel)),
    [relationOverlayModel],
  )
  const selectedAsset = selectedId ? assetById.get(selectedId) : null
  const hoveredAsset = hoveredId ? assetById.get(hoveredId) : null
  const selectedSummary = selectedAsset
    ? getAsset3dSummary(selectedAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null
  const hoverSummary = hoveredAsset
    ? getAsset3dSummary(hoveredAsset, {
      collections,
      relationRecords,
      relationOverlayModel,
      mockMode,
    })
    : null
  const hoverScreenAsset = useMemo(
    () => projectAssetToScreen(hoveredAsset, cameraRef.current, canvasRef.current),
    [hoveredAsset, cameraVersion],
  )

  const bumpCameraVersion = useCallback(() => {
    setCameraVersion(version => version + 1)
  }, [])

  const updateCamera = useCallback(() => {
    applyCamera(cameraRef.current, cameraStateRef.current)
    bumpCameraVersion()
  }, [bumpCameraVersion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      })
    } catch (error) {
      console.warn('Three.js WebGL renderer failed:', error)
      setWebglFailed(true)
      onWebglUnavailable?.()
      return undefined
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0D111A')
    scene.fog = new THREE.Fog('#0D111A', 28, 58)

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1000)
    cameraRef.current = camera
    sceneRef.current = scene
    rendererRef.current = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    scene.add(new THREE.AmbientLight('#F4F6FA', 0.62))
    const keyLight = new THREE.DirectionalLight('#FFFFFF', 1.25)
    keyLight.position.set(6, 12, 8)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#7AA0FF', 0.58)
    fillLight.position.set(-10, 6, -8)
    scene.add(fillLight)

    const grid = new THREE.GridHelper(28, 14, '#355B68', '#273440')
    grid.position.y = 0
    scene.add(grid)

    const horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 18),
      new THREE.MeshBasicMaterial({
        color: '#162033',
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    )
    horizon.position.set(0, 8, -15)
    horizon.rotation.x = Math.PI / 2.8
    horizon.userData.decorative = true
    scene.add(horizon)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      updateCamera()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      resizeObserver.disconnect()
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (assetGroupRef.current) disposeThreeObject(assetGroupRef.current)
      if (relationGroupRef.current) disposeThreeObject(relationGroupRef.current)
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      pickablesRef.current = []
    }
  }, [onWebglUnavailable, updateCamera])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (assetGroupRef.current) {
      scene.remove(assetGroupRef.current)
      disposeThreeObject(assetGroupRef.current)
    }
    if (relationGroupRef.current) {
      scene.remove(relationGroupRef.current)
      disposeThreeObject(relationGroupRef.current)
    }

    const assetGroup = new THREE.Group()
    assetGroup.name = 'three-asset-constellation'
    const pickables = []

    threeAssets.forEach(asset => {
      const isSelected = asset.itemId === selectedId
      const relatedRelation = relatedRelationByItem.get(asset.itemId)
      const isRelated = Boolean(relatedRelation) && !isSelected
      const isDimmed = Boolean(selectedId && relationOverlayEnabled && !isSelected && !isRelated)
      const object = createThreeAssetObject(asset, {
        isSelected,
        isRelated,
        isHovered: asset.itemId === hoveredId,
        isDimmed,
        relationStyle: getRelationStyle(relatedRelation?.rel),
      })
      object.traverse(child => {
        if (child.userData.pickable) pickables.push(child)
      })
      assetGroup.add(object)
    })

    const relationGroup = createRelationGroup({
      threeAssets,
      relationOverlayEnabled,
      relationOverlayModel,
    })

    scene.add(assetGroup)
    scene.add(relationGroup)
    assetGroupRef.current = assetGroup
    relationGroupRef.current = relationGroup
    pickablesRef.current = pickables
    updateCamera()
  }, [
    threeAssets,
    selectedId,
    hoveredId,
    relationOverlayEnabled,
    relationOverlayModel,
    relatedRelationByItem,
    updateCamera,
  ])

  const getPointerAssetId = useCallback((event) => {
    const canvas = canvasRef.current
    const camera = cameraRef.current
    if (!canvas || !camera) return null
    const rect = canvas.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = raycasterRef.current
    raycaster.setFromCamera(pointer, camera)
    const [hit] = raycaster.intersectObjects(pickablesRef.current, false)
    return hit?.object?.userData?.itemId || null
  }, [])

  const handlePointerDown = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { active: true, dragged: false, x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = event => {
    const drag = dragRef.current
    if (drag.active) {
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.dragged = true
      drag.x = event.clientX
      drag.y = event.clientY
      const state = cameraStateRef.current
      state.theta -= dx * 0.008
      state.phi = clamp(state.phi + dy * 0.006, 0.46, 1.36)
      updateCamera()
      return
    }

    const nextHoveredId = getPointerAssetId(event)
    setHoveredId(current => current === nextHoveredId ? current : nextHoveredId)
  }

  const handlePointerUp = event => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const wasDragging = dragRef.current.dragged
    dragRef.current.active = false
    dragRef.current.dragged = false
    if (wasDragging) return
    const itemId = getPointerAssetId(event)
    const item = items.find(candidate => candidate.id === itemId)
    if (item) onSelectItem?.(item)
  }

  const handlePointerLeave = () => {
    dragRef.current.active = false
    dragRef.current.dragged = false
    setHoveredId(null)
  }

  const handleWheel = event => {
    event.preventDefault()
    const state = cameraStateRef.current
    state.radius = clamp(state.radius + event.deltaY * 0.018, 9, 52)
    updateCamera()
  }

  const resetCamera = useCallback(() => {
    setHoveredId(null)
    setFocusSelected(false)
    cameraStateRef.current = {
      ...DEFAULT_CAMERA,
      target: makeCameraTarget(),
    }
    updateCamera()
  }, [updateCamera])

  const handleKeyDown = event => {
    const state = cameraStateRef.current
    if (event.key === 'ArrowLeft') state.theta += 0.08
    else if (event.key === 'ArrowRight') state.theta -= 0.08
    else if (event.key === 'ArrowUp') state.phi = clamp(state.phi - 0.06, 0.46, 1.36)
    else if (event.key === 'ArrowDown') state.phi = clamp(state.phi + 0.06, 0.46, 1.36)
    else if (event.key === '+' || event.key === '=') state.radius = clamp(state.radius - 1.2, 9, 52)
    else if (event.key === '-') state.radius = clamp(state.radius + 1.2, 9, 52)
    else if (event.key === '0') {
      resetCamera()
      return
    } else {
      return
    }
    event.preventDefault()
    updateCamera()
  }

  if (webglFailed) {
    return (
      <div style={rootStyle}>
        <div style={fallbackStyle}>WebGL renderer unavailable. Pseudo fallback is being used.</div>
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div style={rootStyle}>
        <BetaBadge count={0} />
        <div style={emptyStyle}>
          <div style={emptyTitleStyle}>검색 결과 없음</div>
          <div style={emptyHintStyle}>검색어와 필터를 조정하면 true 3D asset map이 다시 표시됩니다.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={rootStyle}>
      <canvas
        ref={canvasRef}
        style={canvasStyle}
        aria-label="True 3D GIS selected asset constellation spike"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />
      <BetaBadge count={items.length} />
      <Explorer3dControls
        focusSelected={focusSelected}
        selectedLabel={selectedSummary?.label}
        relationOverlayEnabled={relationOverlayEnabled}
        onResetView={resetCamera}
      />
      <SceneCategoryCounts categoryCounts={categoryCounts} />
      <ThreeSpikeNotice
        relationOverlayEnabled={relationOverlayEnabled}
        missingCount={relationOverlayModel?.missingTargets?.length || 0}
      />
      <Explorer3dLegend
        activeRels={activeRels}
        relationOverlayEnabled={relationOverlayEnabled}
        missingTargets={relationOverlayModel?.missingTargets || []}
      />
      <Explorer3dFocusCard
        asset={selectedAsset}
        summary={selectedSummary}
        relationOverlayEnabled={relationOverlayEnabled}
      />
      <Explorer3dTooltip asset={hoverScreenAsset} summary={hoverSummary} />
    </div>
  )
}

function BetaBadge({ count }) {
  return (
    <div style={betaBadgeStyle}>
      Three.js Spike · {count} assets
    </div>
  )
}

function SceneCategoryCounts({ categoryCounts }) {
  return (
    <div style={countRowStyle}>
      {Object.entries(categoryCounts).map(([category, count]) => {
        const cat = getCategoryInfo(category)
        return (
          <span key={category} style={{
            padding: '3px 7px',
            borderRadius: 4,
            background: 'rgba(19,22,31,0.82)',
            border: `1px solid ${cat.color}35`,
            color: cat.color,
            fontSize: 11,
            fontWeight: 900,
          }}>
            {cat.icon} {count}
          </span>
        )
      })}
    </div>
  )
}

function ThreeSpikeNotice({ relationOverlayEnabled, missingCount }) {
  return (
    <div style={noticeStyle}>
      <span style={noticeStrongStyle}>True 3D renderer spike</span>
      <span> · selected asset constellation</span>
      {relationOverlayEnabled && (
        <span> · source dot to colored target dot</span>
      )}
      {missingCount > 0 && (
        <span style={noticeWarningStyle}> · missing targets {missingCount}</span>
      )}
    </div>
  )
}

const rootStyle = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#0D111A',
}

const canvasStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  cursor: 'grab',
  touchAction: 'none',
}

const betaBadgeStyle = {
  position: 'absolute',
  top: 48,
  left: 12,
  zIndex: 740,
  padding: '4px 10px',
  borderRadius: 4,
  background: 'rgba(19,22,31,0.92)',
  border: '1px solid rgba(122,160,255,0.42)',
  color: '#9CB5FF',
  fontSize: 12,
  fontWeight: 900,
}

const countRowStyle = {
  position: 'absolute',
  top: 84,
  right: 12,
  zIndex: 710,
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: 430,
}

const noticeStyle = {
  position: 'absolute',
  left: 12,
  top: 82,
  zIndex: 720,
  maxWidth: 440,
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid rgba(122,160,255,0.22)',
  background: 'rgba(12,14,20,0.72)',
  color: 'var(--t3)',
  fontSize: 11,
  fontWeight: 800,
}

const noticeStrongStyle = {
  color: '#F4F6FA',
}

const noticeWarningStyle = {
  color: 'var(--warn)',
}

const fallbackStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--t2)',
  fontSize: 13,
  fontWeight: 900,
}

const emptyStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: 'var(--t3)',
  textAlign: 'center',
  padding: 24,
}

const emptyTitleStyle = {
  color: 'var(--t1)',
  fontSize: 15,
  fontWeight: 900,
}

const emptyHintStyle = {
  color: 'var(--t3)',
  fontSize: 13,
}
