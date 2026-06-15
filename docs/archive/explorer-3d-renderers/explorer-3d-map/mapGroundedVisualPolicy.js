import { createThreeAssetObject } from '../explorer-3d-three/threeVisualPolicy.js'

export function createMapGroundedAssetObject(asset, options = {}) {
  const localAsset = {
    ...asset,
    position: { x: 0, y: 0, z: 0 },
  }
  const object = createThreeAssetObject(localAsset, options)
  const transform = asset.transform

  object.position.set(transform.x, transform.y, transform.z)
  object.scale.set(transform.scale, transform.scale, transform.scale)
  object.rotation.x = Math.PI / 2
  object.userData.itemId = asset.itemId
  object.userData.asset = asset
  object.renderOrder = options.isSelected ? 80 : options.isRelated ? 70 : 40
  object.traverse(child => {
    child.renderOrder = object.renderOrder
    if (child.material) {
      child.material.depthTest = true
      if (child.material.transparent) child.material.depthWrite = false
      child.material.polygonOffset = true
      child.material.polygonOffsetFactor = options.isSelected ? -2 : -1
      child.material.polygonOffsetUnits = options.isSelected ? -2 : -1
    }
  })

  return object
}

export function getRelationEndpoint(asset) {
  const transform = asset?.transform
  if (!transform) return null
  const lift = (asset.objectHeight + 1.15) * transform.scale
  return {
    x: transform.x,
    y: transform.y,
    z: transform.z + lift,
  }
}
