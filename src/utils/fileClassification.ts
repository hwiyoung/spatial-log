import { generateId } from '@/utils/storage'

// 파일 확장자 분류
const MODEL_EXTENSIONS = ['.obj', '.fbx', '.gltf', '.glb']
const MATERIAL_EXTENSIONS = ['.mtl']
const TEXTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.dds', '.ktx', '.ktx2']

/** 파일 확장자에서 포맷 추출 */
export function getFileFormat(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ext
}

/** 파일 타입 분류 */
export function classifyFileType(filename: string): 'model' | 'material' | 'texture' | 'other' {
  const ext = '.' + filename.toLowerCase().split('.').pop()
  if (MODEL_EXTENSIONS.includes(ext)) return 'model'
  if (MATERIAL_EXTENSIONS.includes(ext)) return 'material'
  if (TEXTURE_EXTENSIONS.includes(ext)) return 'texture'
  return 'other'
}

/** 파일의 기본 이름 추출 (확장자 제외) */
export function getBaseName(filename: string): string {
  const parts = filename.split('.')
  if (parts.length > 1) {
    parts.pop()
  }
  return parts.join('.').toLowerCase()
}

/** 파일 분류 결과 타입 */
export interface FileClassification {
  groups: Map<string, { groupId: string; modelFile: File; materials: File[]; textures: File[] }>
  otherFiles: File[]
}

/**
 * 파일 배열을 모델/재질/텍스처 그룹으로 분류
 */
export function classifyFilesIntoGroups(fileArray: File[]): FileClassification {
  const modelFiles: File[] = []
  const materialFiles: File[] = []
  const textureFiles: File[] = []
  const otherFiles: File[] = []

  for (const file of fileArray) {
    const fileType = classifyFileType(file.name)
    switch (fileType) {
      case 'model': modelFiles.push(file); break
      case 'material': materialFiles.push(file); break
      case 'texture': textureFiles.push(file); break
      default: otherFiles.push(file)
    }
  }

  // 모델 파일별로 그룹 생성
  const groups: FileClassification['groups'] = new Map()

  for (const modelFile of modelFiles) {
    const baseName = getBaseName(modelFile.name)
    groups.set(baseName, {
      groupId: generateId(),
      modelFile,
      materials: [],
      textures: [],
    })
  }

  // MTL 파일 연결
  for (const mtlFile of materialFiles) {
    const baseName = getBaseName(mtlFile.name)
    if (groups.has(baseName)) {
      groups.get(baseName)!.materials.push(mtlFile)
    } else if (groups.size === 1) {
      const firstGroup = groups.values().next().value
      if (firstGroup) firstGroup.materials.push(mtlFile)
    } else {
      otherFiles.push(mtlFile)
    }
  }

  // 텍스처 파일 연결
  for (const texFile of textureFiles) {
    if (groups.size === 1) {
      const firstGroup = groups.values().next().value
      if (firstGroup) firstGroup.textures.push(texFile)
    } else if (groups.size > 1) {
      const baseName = getBaseName(texFile.name)
      let matched = false
      for (const [modelBaseName, group] of groups.entries()) {
        if (baseName.includes(modelBaseName) || modelBaseName.includes(baseName)) {
          group.textures.push(texFile)
          matched = true
          break
        }
      }
      if (!matched) {
        const firstGroup = groups.values().next().value
        if (firstGroup) firstGroup.textures.push(texFile)
      }
    } else {
      otherFiles.push(texFile)
    }
  }

  return { groups, otherFiles }
}
