// 연관 파일 그룹 타입
export interface FileGroup {
  groupId: string
  mainFile: File | null // OBJ, GLTF 등 메인 모델 파일
  materialFiles: File[] // MTL 파일들
  textureFiles: File[] // 텍스처 파일들
  otherFiles: File[] // 기타 파일들
}

export interface UploadOptions {
  epsg?: number | null
}

export interface SelectedFile {
  file: File
  id: string
  status: 'pending' | 'valid' | 'error'
  error?: string
  isZip?: boolean
  zipContents?: string[] // ZIP 파일 내용 미리보기
  // 파일 그룹 정보
  groupId?: string
  fileType?: 'model' | 'material' | 'texture' | 'other'
  isGrouped?: boolean // 그룹에 속한 파일인지
  // 변환 정보
  requiresConversion?: boolean // 서버 변환이 필요한 파일
  conversionType?: string // 변환 타입 (e.g., 'las_to_copc')
  conversionLabel?: string // 변환 타입 라벨 (e.g., 'LAS → COPC')
}
