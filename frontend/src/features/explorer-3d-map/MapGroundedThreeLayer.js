import * as THREE from 'three'
import { getRelationStyle } from '../relations/relationStyles.js'
import { disposeThreeObject } from '../explorer-3d-three/threeVisualPolicy.js'
import { createMapGroundedAssetObject, getRelationEndpoint } from './mapGroundedVisualPolicy.js'

function makeRelationGroup({ assets = [], relationOverlayEnabled = false, relationOverlayModel = null }) {
  const group = new THREE.Group()
  group.name = 'map-grounded-selected-relation-lines'
  if (!relationOverlayEnabled) return group

  const assetById = new Map(assets.map(asset => [asset.itemId, asset]))
  ;(relationOverlayModel?.visibleRelations || []).forEach(relation => {
    const source = assetById.get(relation.sourceItemId)
    const target = assetById.get(relation.targetItemId)
    const sourcePoint = getRelationEndpoint(source)
    const targetPoint = getRelationEndpoint(target)
    if (!sourcePoint || !targetPoint) return

    const style = getRelationStyle(relation.rel)
    const points = [
      new THREE.Vector3(sourcePoint.x, sourcePoint.y, sourcePoint.z),
      new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z),
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
    })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 180
    group.add(line)

    const sourceDot = new THREE.Mesh(
      new THREE.SphereGeometry(source.transform.scale * 0.08, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#F4F6FA', depthTest: false, depthWrite: false }),
    )
    sourceDot.position.copy(points[0])
    sourceDot.renderOrder = 190
    sourceDot.userData.decorative = true
    group.add(sourceDot)

    const targetDot = new THREE.Mesh(
      new THREE.SphereGeometry(target.transform.scale * 0.11, 12, 8),
      new THREE.MeshBasicMaterial({ color: style.markerColor || style.color, depthTest: false, depthWrite: false }),
    )
    targetDot.position.copy(points[1])
    targetDot.renderOrder = 190
    targetDot.userData.decorative = true
    group.add(targetDot)
  })

  return group
}

export class MapGroundedThreeLayer {
  constructor({
    id = 'map-grounded-three-assets',
    assets = [],
    selectedId = null,
    hoveredId = null,
    relationOverlayEnabled = false,
    relationOverlayModel = null,
    onError = null,
  } = {}) {
    this.id = id
    this.type = 'custom'
    this.renderingMode = '3d'
    this.assets = assets
    this.selectedId = selectedId
    this.hoveredId = hoveredId
    this.relationOverlayEnabled = relationOverlayEnabled
    this.relationOverlayModel = relationOverlayModel
    this.onError = onError
    this.camera = null
    this.scene = null
    this.renderer = null
    this.map = null
    this.assetGroup = null
    this.relationGroup = null
    this.sceneSignature = null
  }

  onAdd(map, gl) {
    try {
      this.map = map
      this.camera = new THREE.Camera()
      this.scene = new THREE.Scene()
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      })
      this.renderer.autoClear = false
      this.scene.add(new THREE.AmbientLight('#F4F6FA', 0.74))
      const light = new THREE.DirectionalLight('#FFFFFF', 0.96)
      light.position.set(0.4, -0.7, 1)
      this.scene.add(light)
      this.rebuild()
      this.map?.triggerRepaint()
    } catch (error) {
      console.warn('Map-grounded Three custom layer failed:', error)
      this.onError?.(error)
    }
  }

  update({
    assets = this.assets,
    selectedId = this.selectedId,
    hoveredId = this.hoveredId,
    relationOverlayEnabled = this.relationOverlayEnabled,
    relationOverlayModel = this.relationOverlayModel,
  } = {}) {
    this.assets = assets
    this.selectedId = selectedId
    this.hoveredId = hoveredId
    this.relationOverlayEnabled = relationOverlayEnabled
    this.relationOverlayModel = relationOverlayModel
    const nextSignature = this.getSceneSignature()
    if (nextSignature !== this.sceneSignature) {
      this.rebuild(nextSignature)
    }
    this.map?.triggerRepaint()
  }

  getSceneSignature() {
    const assetKey = this.assets
      .map(asset => {
        const transform = asset.transform || {}
        return [
          asset.itemId,
          transform.x?.toFixed?.(8),
          transform.y?.toFixed?.(8),
          transform.z?.toFixed?.(8),
          transform.scale?.toExponential?.(4),
        ].join(':')
      })
      .join('|')
    const relKey = (this.relationOverlayModel?.visibleRelations || [])
      .map(relation => `${relation.id}:${relation.rel}:${relation.sourceItemId}:${relation.targetItemId}`)
      .join('|')
    return [
      assetKey,
      this.selectedId || '',
      this.relationOverlayEnabled ? 'rel-on' : 'rel-off',
      relKey,
    ].join('||')
  }

  rebuild(nextSignature = this.getSceneSignature()) {
    if (!this.scene) return
    if (this.assetGroup) {
      this.scene.remove(this.assetGroup)
      disposeThreeObject(this.assetGroup)
    }
    if (this.relationGroup) {
      this.scene.remove(this.relationGroup)
      disposeThreeObject(this.relationGroup)
    }

    const relatedRelationByItem = new Map()
    if (this.relationOverlayEnabled) {
      ;(this.relationOverlayModel?.visibleRelations || []).forEach(relation => {
        relatedRelationByItem.set(relation.relatedItemId, relation)
      })
    }

    const assetGroup = new THREE.Group()
    assetGroup.name = 'map-grounded-three-assets'
    this.assets.forEach(asset => {
      const isSelected = asset.itemId === this.selectedId
      const relatedRelation = relatedRelationByItem.get(asset.itemId)
      const isRelated = Boolean(relatedRelation) && !isSelected
      const isDimmed = Boolean(this.selectedId && this.relationOverlayEnabled && !isSelected && !isRelated)
      const object = createMapGroundedAssetObject(asset, {
        isSelected,
        isRelated,
        isHovered: asset.itemId === this.hoveredId,
        isDimmed,
        relationStyle: getRelationStyle(relatedRelation?.rel),
      })
      assetGroup.add(object)
    })

    const relationGroup = makeRelationGroup({
      assets: this.assets,
      relationOverlayEnabled: this.relationOverlayEnabled,
      relationOverlayModel: this.relationOverlayModel,
    })

    this.scene.add(assetGroup)
    this.scene.add(relationGroup)
    this.assetGroup = assetGroup
    this.relationGroup = relationGroup
    this.sceneSignature = nextSignature
  }

  render(gl, matrix) {
    if (!this.renderer || !this.scene || !this.camera) return
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix)
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    this.renderer.resetState()
  }

  onRemove() {
    this.dispose()
  }

  dispose() {
    if (this.assetGroup) disposeThreeObject(this.assetGroup)
    if (this.relationGroup) disposeThreeObject(this.relationGroup)
    this.renderer?.dispose()
    this.assetGroup = null
    this.relationGroup = null
    this.renderer = null
    this.scene = null
    this.camera = null
  }
}
