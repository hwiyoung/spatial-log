import * as THREE from 'three'
import { getAsset3dStateVisual } from '../explorer-3d/asset3dVisualPolicy.js'

const THREE_COLOR_FALLBACK = '#8899AA'

function colorValue(color) {
  if (typeof color === 'string' && color.startsWith('#')) return color
  return THREE_COLOR_FALLBACK
}

function makeMaterial(color, {
  opacity = 1,
  emissive = '#000000',
  roughness = 0.62,
  metalness = 0.08,
} = {}) {
  return new THREE.MeshStandardMaterial({
    color: colorValue(color),
    emissive: colorValue(emissive),
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
  })
}

function makeLineMaterial(color, opacity = 1) {
  return new THREE.LineBasicMaterial({
    color: colorValue(color),
    transparent: opacity < 1,
    opacity,
  })
}

function setPickableUserData(object, itemId) {
  object.traverse(child => {
    child.userData.itemId = itemId
    child.userData.pickable = Boolean(child.isMesh && !child.userData.decorative)
  })
}

function addFocusRing(group, color, radius, y, {
  selected = false,
  dashed = false,
} = {}) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, selected ? 0.045 : 0.032, 8, 64),
    makeMaterial(color, {
      opacity: selected ? 0.95 : 0.76,
      emissive: selected ? color : '#000000',
      roughness: 0.35,
    }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = y
  ring.userData.decorative = true
  group.add(ring)

  if (dashed) {
    const inner = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 32 }, (_, index) => {
          const angle = (index / 32) * Math.PI * 2
          return new THREE.Vector3(Math.cos(angle) * radius * 0.78, y + 0.012, Math.sin(angle) * radius * 0.78)
        }),
      ),
      makeLineMaterial(color, 0.62),
    )
    inner.userData.decorative = true
    group.add(inner)
  }
}

function addDraftBadge(group, color, y) {
  const badge = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    makeMaterial(color, { emissive: color, roughness: 0.3 }),
  )
  badge.position.set(0.34, y + 0.18, 0.34)
  badge.userData.decorative = true
  group.add(badge)
}

function addActualZMarker(group, y) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 12),
    makeMaterial('#F4F6FA', { emissive: '#7AA0FF', roughness: 0.2 }),
  )
  marker.position.set(-0.34, y + 0.16, 0.34)
  marker.userData.decorative = true
  group.add(marker)
}

function makeBox(width, height, depth, material, yOffset = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.y = yOffset + height / 2
  return mesh
}

function makeAssetCore(asset, material, accentMaterial) {
  const shape = asset.visualPolicy.shape
  const height = asset.objectHeight
  const width = asset.footprint

  if (shape === 'scan-tower') {
    const group = new THREE.Group()
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.35, width * 0.52, height, 16, 1, true),
      material,
    )
    tower.position.y = height / 2
    group.add(tower)
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2
      const radius = width * (0.26 + (index % 4) * 0.08)
      const point = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), accentMaterial)
      point.position.set(Math.cos(angle) * radius, 0.2 + (height * index) / 15, Math.sin(angle) * radius)
      group.add(point)
    }
    return group
  }

  if (shape === 'tile-stack') {
    const group = new THREE.Group()
    const layers = 4
    for (let index = 0; index < layers; index += 1) {
      const layer = makeBox(width * (1 - index * 0.08), height / 5, width * 0.86, index % 2 ? accentMaterial : material, index * height * 0.22)
      layer.position.x = index * 0.035
      layer.position.z = -index * 0.035
      group.add(layer)
    }
    return group
  }

  if (shape === 'model-prism') {
    const mesh = makeBox(width * 0.9, height, width * 0.72, material)
    mesh.rotation.y = Math.PI / 7
    return mesh
  }

  if (shape === 'map-plate') {
    const plate = makeBox(width * 1.55, 0.12, width * 1.18, material)
    plate.rotation.y = -Math.PI / 14
    return plate
  }

  if (shape === 'photo-card') {
    const card = makeBox(width * 1.08, Math.max(0.46, height * 0.58), 0.1, material, 0.1)
    card.rotation.x = -Math.PI / 18
    return card
  }

  if (shape === 'dome-card') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      material,
    )
    dome.position.y = Math.max(0.32, height * 0.44)
    return dome
  }

  if (shape === 'media-card') {
    const group = new THREE.Group()
    const card = makeBox(width * 1.05, Math.max(0.42, height * 0.52), 0.1, material, 0.08)
    group.add(card)
    const play = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.08, 3), accentMaterial)
    play.rotation.z = -Math.PI / 2
    play.position.set(0, card.position.y, 0.08)
    group.add(play)
    return group
  }

  if (shape === 'document-sheet') {
    const sheet = makeBox(width * 0.9, Math.max(0.34, height * 0.42), 0.08, material, 0.08)
    sheet.rotation.z = Math.PI / 36
    return sheet
  }

  return makeBox(width, height * 0.55, width * 0.8, material, 0.05)
}

export function createThreeAssetObject(asset, {
  isSelected = false,
  isRelated = false,
  isHovered = false,
  isDimmed = false,
  relationStyle = null,
} = {}) {
  const state = getAsset3dStateVisual({
    item: asset.item,
    isSelected,
    isRelated,
    isHovered,
    relationStyle,
  })
  const opacity = isDimmed ? 0.25 : state.isArchived ? 0.36 : isRelated || isSelected ? 1 : 0.82
  const material = makeMaterial(state.accentColor, {
    opacity,
    emissive: isSelected ? state.accentColor : '#000000',
    roughness: 0.54,
  })
  const accentMaterial = makeMaterial(state.borderColor, {
    opacity: state.isArchived ? 0.44 : 0.94,
    emissive: isSelected || isRelated ? state.borderColor : '#000000',
    roughness: 0.36,
  })
  const group = new THREE.Group()
  const core = makeAssetCore(asset, material, accentMaterial)
  group.add(core)

  const ringRadius = Math.max(asset.footprint * 0.82, 0.56)
  if (isSelected) {
    addFocusRing(group, '#7AA0FF', ringRadius + 0.22, 0.05, { selected: true })
  } else if (isRelated) {
    addFocusRing(group, relationStyle?.markerColor || state.accentColor, ringRadius + 0.13, 0.045, { dashed: true })
  } else if (isHovered) {
    addFocusRing(group, '#F4F6FA', ringRadius + 0.06, 0.04)
  }

  if (state.isDraft) addDraftBadge(group, '#F0B42A', asset.objectHeight)
  if (asset.elevation?.isActualElevation) addActualZMarker(group, asset.objectHeight)

  group.position.set(asset.position.x, asset.position.y, asset.position.z)
  group.userData.itemId = asset.itemId
  group.userData.asset = asset
  setPickableUserData(group, asset.itemId)
  return group
}

export function disposeThreeObject(object) {
  object?.traverse?.(child => {
    if (child.geometry) child.geometry.dispose()
    if (Array.isArray(child.material)) {
      child.material.forEach(material => material.dispose?.())
    } else {
      child.material?.dispose?.()
    }
  })
}
