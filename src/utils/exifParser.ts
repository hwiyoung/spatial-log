// EXIF 파서 - 이미지에서 GPS 및 메타데이터 추출

export interface ExifData {
  // GPS 정보
  latitude?: number
  longitude?: number
  altitude?: number

  // 카메라 정보
  make?: string
  model?: string

  // 촬영 정보
  dateTime?: Date
  orientation?: number

  // 이미지 정보
  imageWidth?: number
  imageHeight?: number
}

export interface GpsCoordinates {
  latitude: number
  longitude: number
  altitude?: number
}

// EXIF 태그 ID
const EXIF_TAGS = {
  // GPS IFD
  GPSLatitudeRef: 0x0001,
  GPSLatitude: 0x0002,
  GPSLongitudeRef: 0x0003,
  GPSLongitude: 0x0004,
  GPSAltitudeRef: 0x0005,
  GPSAltitude: 0x0006,

  // Image IFD
  Make: 0x010f,
  Model: 0x0110,
  Orientation: 0x0112,
  DateTime: 0x0132,

  // EXIF IFD
  DateTimeOriginal: 0x9003,
  ExifImageWidth: 0xa002,
  ExifImageHeight: 0xa003,
} as const

// GPS 좌표를 십진수로 변환
function convertDMSToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  ref: string
): number {
  let decimal = degrees + minutes / 60 + seconds / 3600
  if (ref === 'S' || ref === 'W') {
    decimal = -decimal
  }
  return decimal
}

// JPEG에서 EXIF 데이터 추출
export async function extractExifFromFile(file: File): Promise<ExifData | null> {
  if (!file.type.startsWith('image/')) {
    return null
  }

  // TIFF/BMP는 EXIF가 없거나 다른 형식
  if (file.type === 'image/bmp' || file.type === 'image/gif') {
    return null
  }

  const arrayBuffer = await file.arrayBuffer()
  return parseExif(arrayBuffer)
}

// ArrayBuffer에서 EXIF 파싱
export function parseExif(buffer: ArrayBuffer): ExifData | null {
  const view = new DataView(buffer)

  // JPEG 시그니처 확인 (0xFFD8)
  if (view.getUint16(0) !== 0xffd8) {
    return null
  }

  let offset = 2
  const length = view.byteLength

  while (offset < length) {
    // 마커 확인
    if (view.getUint8(offset) !== 0xff) {
      offset++
      continue
    }

    const marker = view.getUint8(offset + 1)

    // APP1 마커 (EXIF)
    if (marker === 0xe1) {
      // "Exif\0\0" 시그니처 확인
      const exifSignature = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      )

      if (exifSignature === 'Exif') {
        const tiffOffset = offset + 10 // TIFF 헤더 시작
        return parseTiffHeader(view, tiffOffset)
      }
    }

    // 다른 마커는 건너뛰기
    if (marker === 0xd9 || marker === 0xda) {
      break // EOI 또는 SOS - EXIF 검색 종료
    }

    const segmentSize = view.getUint16(offset + 2)
    offset += 2 + segmentSize
  }

  return null
}

// TIFF 헤더 파싱
function parseTiffHeader(view: DataView, tiffStart: number): ExifData | null {
  const exifData: ExifData = {}

  // 바이트 오더 확인 (II = little endian, MM = big endian)
  const byteOrder = view.getUint16(tiffStart)
  const isLittleEndian = byteOrder === 0x4949

  const getUint16 = (offset: number) =>
    view.getUint16(offset, isLittleEndian)
  const getUint32 = (offset: number) =>
    view.getUint32(offset, isLittleEndian)

  // TIFF 매직 넘버 확인 (42)
  if (getUint16(tiffStart + 2) !== 0x002a) {
    return null
  }

  // IFD0 오프셋
  const ifd0Offset = getUint32(tiffStart + 4)

  // IFD0 파싱
  let gpsIfdOffset: number | null = null
  let exifIfdOffset: number | null = null

  const parseIfd = (ifdOffset: number) => {
    const entryCount = getUint16(tiffStart + ifdOffset)

    for (let i = 0; i < entryCount; i++) {
      const entryOffset = tiffStart + ifdOffset + 2 + i * 12
      const tagId = getUint16(entryOffset)
      const dataType = getUint16(entryOffset + 2)
      const numValues = getUint32(entryOffset + 4)
      const valueOffset = entryOffset + 8

      switch (tagId) {
        case 0x8825: // GPS IFD 포인터
          gpsIfdOffset = getUint32(valueOffset)
          break
        case 0x8769: // EXIF IFD 포인터
          exifIfdOffset = getUint32(valueOffset)
          break
        case EXIF_TAGS.Make:
          exifData.make = readString(view, tiffStart, valueOffset, numValues, dataType, getUint32)
          break
        case EXIF_TAGS.Model:
          exifData.model = readString(view, tiffStart, valueOffset, numValues, dataType, getUint32)
          break
        case EXIF_TAGS.Orientation:
          exifData.orientation = getUint16(valueOffset)
          break
        case EXIF_TAGS.DateTime:
          exifData.dateTime = parseExifDate(readString(view, tiffStart, valueOffset, numValues, dataType, getUint32))
          break
      }
    }
  }

  parseIfd(ifd0Offset)

  // GPS IFD 파싱
  if (gpsIfdOffset !== null) {
    const gpsData = parseGpsIfd(view, tiffStart, gpsIfdOffset, isLittleEndian)
    if (gpsData) {
      exifData.latitude = gpsData.latitude
      exifData.longitude = gpsData.longitude
      exifData.altitude = gpsData.altitude
    }
  }

  // EXIF IFD 파싱 (추가 정보)
  if (exifIfdOffset !== null) {
    const exifEntryCount = getUint16(tiffStart + exifIfdOffset)
    for (let i = 0; i < exifEntryCount; i++) {
      const entryOffset = tiffStart + exifIfdOffset + 2 + i * 12
      const tagId = getUint16(entryOffset)
      const dataType = getUint16(entryOffset + 2)
      const numValues = getUint32(entryOffset + 4)
      const valueOffset = entryOffset + 8

      switch (tagId) {
        case EXIF_TAGS.DateTimeOriginal:
          exifData.dateTime = parseExifDate(readString(view, tiffStart, valueOffset, numValues, dataType, getUint32))
          break
        case EXIF_TAGS.ExifImageWidth:
          exifData.imageWidth = dataType === 3 ? getUint16(valueOffset) : getUint32(valueOffset)
          break
        case EXIF_TAGS.ExifImageHeight:
          exifData.imageHeight = dataType === 3 ? getUint16(valueOffset) : getUint32(valueOffset)
          break
      }
    }
  }

  return Object.keys(exifData).length > 0 ? exifData : null
}

// GPS IFD 파싱
function parseGpsIfd(
  view: DataView,
  tiffStart: number,
  gpsOffset: number,
  isLittleEndian: boolean
): GpsCoordinates | null {
  const getUint16 = (offset: number) =>
    view.getUint16(offset, isLittleEndian)
  const getUint32 = (offset: number) =>
    view.getUint32(offset, isLittleEndian)

  const entryCount = getUint16(tiffStart + gpsOffset)

  let latitudeRef = 'N'
  let latitude: number[] | null = null
  let longitudeRef = 'E'
  let longitude: number[] | null = null
  let altitudeRef = 0
  let altitude: number | null = null

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = tiffStart + gpsOffset + 2 + i * 12
    const tagId = getUint16(entryOffset)
    // dataType은 파싱에 필요하지만 현재 구현에서는 미사용
    // const dataType = getUint16(entryOffset + 2)
    const valueOffset = entryOffset + 8

    switch (tagId) {
      case EXIF_TAGS.GPSLatitudeRef:
        latitudeRef = String.fromCharCode(view.getUint8(valueOffset))
        break
      case EXIF_TAGS.GPSLatitude:
        latitude = readRationals(view, tiffStart, valueOffset, 3, getUint32, isLittleEndian)
        break
      case EXIF_TAGS.GPSLongitudeRef:
        longitudeRef = String.fromCharCode(view.getUint8(valueOffset))
        break
      case EXIF_TAGS.GPSLongitude:
        longitude = readRationals(view, tiffStart, valueOffset, 3, getUint32, isLittleEndian)
        break
      case EXIF_TAGS.GPSAltitudeRef:
        altitudeRef = view.getUint8(valueOffset)
        break
      case EXIF_TAGS.GPSAltitude: {
        const altRationals = readRationals(view, tiffStart, valueOffset, 1, getUint32, isLittleEndian)
        if (altRationals) {
          altitude = altRationals[0] ?? null
          if (altitude !== null && altitudeRef === 1) {
            altitude = -altitude // Below sea level
          }
        }
        break
      }
    }
  }

  if (latitude && longitude && latitude.length === 3 && longitude.length === 3) {
    return {
      latitude: convertDMSToDecimal(
        latitude[0] ?? 0,
        latitude[1] ?? 0,
        latitude[2] ?? 0,
        latitudeRef
      ),
      longitude: convertDMSToDecimal(
        longitude[0] ?? 0,
        longitude[1] ?? 0,
        longitude[2] ?? 0,
        longitudeRef
      ),
      altitude: altitude ?? undefined,
    }
  }

  return null
}

// 문자열 읽기
function readString(
  view: DataView,
  tiffStart: number,
  valueOffset: number,
  length: number,
  _dataType: number, // 향후 확장을 위해 유지
  getUint32: (offset: number) => number
): string {
  let stringOffset = valueOffset
  if (length > 4) {
    stringOffset = tiffStart + getUint32(valueOffset)
  }

  let result = ''
  for (let i = 0; i < length - 1; i++) {
    const char = view.getUint8(stringOffset + i)
    if (char === 0) break
    result += String.fromCharCode(char)
  }
  return result
}

// Rational 배열 읽기 (GPS 좌표용)
function readRationals(
  view: DataView,
  tiffStart: number,
  valueOffset: number,
  count: number,
  getUint32: (offset: number) => number,
  isLittleEndian: boolean
): number[] | null {
  try {
    const dataOffset = tiffStart + getUint32(valueOffset)
    const values: number[] = []

    for (let i = 0; i < count; i++) {
      const numerator = view.getUint32(dataOffset + i * 8, isLittleEndian)
      const denominator = view.getUint32(dataOffset + i * 8 + 4, isLittleEndian)
      values.push(denominator !== 0 ? numerator / denominator : 0)
    }

    return values
  } catch {
    return null
  }
}

// EXIF 날짜 파싱 (YYYY:MM:DD HH:MM:SS 형식)
function parseExifDate(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined

  const match = dateString.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    return new Date(
      parseInt(match[1] ?? '0', 10),
      parseInt(match[2] ?? '1', 10) - 1,
      parseInt(match[3] ?? '1', 10),
      parseInt(match[4] ?? '0', 10),
      parseInt(match[5] ?? '0', 10),
      parseInt(match[6] ?? '0', 10)
    )
  }
  return undefined
}

// GPS 좌표가 유효한지 확인
export function isValidGpsCoordinate(coords: GpsCoordinates | null | undefined): boolean {
  if (!coords) return false
  return (
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  )
}

// GPS 좌표를 문자열로 포맷
export function formatGpsCoordinate(coords: GpsCoordinates): string {
  const latDir = coords.latitude >= 0 ? 'N' : 'S'
  const lonDir = coords.longitude >= 0 ? 'E' : 'W'
  return `${Math.abs(coords.latitude).toFixed(6)}°${latDir}, ${Math.abs(coords.longitude).toFixed(6)}°${lonDir}`
}
