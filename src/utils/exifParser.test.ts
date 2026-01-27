import { describe, it, expect } from 'vitest'
import {
  type GpsCoordinates,
  isValidGpsCoordinate,
  formatGpsCoordinate,
  parseExif,
} from './exifParser'

describe('isValidGpsCoordinate', () => {
  it('should return false for null or undefined', () => {
    expect(isValidGpsCoordinate(null)).toBe(false)
    expect(isValidGpsCoordinate(undefined)).toBe(false)
  })

  it('should return true for valid coordinates', () => {
    expect(isValidGpsCoordinate({ latitude: 0, longitude: 0 })).toBe(true)
    expect(isValidGpsCoordinate({ latitude: 37.5665, longitude: 126.978 })).toBe(true) // Seoul
    expect(isValidGpsCoordinate({ latitude: -33.8688, longitude: 151.2093 })).toBe(true) // Sydney
    expect(isValidGpsCoordinate({ latitude: 90, longitude: 180 })).toBe(true) // Boundary
    expect(isValidGpsCoordinate({ latitude: -90, longitude: -180 })).toBe(true) // Boundary
  })

  it('should return false for invalid latitude', () => {
    expect(isValidGpsCoordinate({ latitude: 91, longitude: 0 })).toBe(false)
    expect(isValidGpsCoordinate({ latitude: -91, longitude: 0 })).toBe(false)
    expect(isValidGpsCoordinate({ latitude: 100, longitude: 0 })).toBe(false)
  })

  it('should return false for invalid longitude', () => {
    expect(isValidGpsCoordinate({ latitude: 0, longitude: 181 })).toBe(false)
    expect(isValidGpsCoordinate({ latitude: 0, longitude: -181 })).toBe(false)
    expect(isValidGpsCoordinate({ latitude: 0, longitude: 200 })).toBe(false)
  })

  it('should handle coordinates with altitude', () => {
    expect(isValidGpsCoordinate({ latitude: 37.5665, longitude: 126.978, altitude: 100 })).toBe(true)
    expect(isValidGpsCoordinate({ latitude: 37.5665, longitude: 126.978, altitude: -50 })).toBe(true) // Below sea level
  })
})

describe('formatGpsCoordinate', () => {
  it('should format positive coordinates (Northern/Eastern)', () => {
    const coords: GpsCoordinates = { latitude: 37.5665, longitude: 126.978 }
    const formatted = formatGpsCoordinate(coords)
    expect(formatted).toBe('37.566500°N, 126.978000°E')
  })

  it('should format negative coordinates (Southern/Western)', () => {
    const coords: GpsCoordinates = { latitude: -33.8688, longitude: -151.2093 }
    const formatted = formatGpsCoordinate(coords)
    expect(formatted).toBe('33.868800°S, 151.209300°W')
  })

  it('should format zero coordinates', () => {
    const coords: GpsCoordinates = { latitude: 0, longitude: 0 }
    const formatted = formatGpsCoordinate(coords)
    expect(formatted).toBe('0.000000°N, 0.000000°E')
  })

  it('should format mixed positive/negative coordinates', () => {
    const coords: GpsCoordinates = { latitude: -37.5665, longitude: 126.978 }
    const formatted = formatGpsCoordinate(coords)
    expect(formatted).toBe('37.566500°S, 126.978000°E')
  })
})

describe('parseExif', () => {
  it('should return null for non-JPEG data', () => {
    // Create a non-JPEG buffer
    const buffer = new ArrayBuffer(100)
    const view = new DataView(buffer)
    view.setUint16(0, 0x8950) // PNG signature start instead of JPEG

    expect(parseExif(buffer)).toBe(null)
  })

  it('should return null for minimal JPEG without EXIF', () => {
    // Create minimal valid JPEG marker without EXIF
    const buffer = new ArrayBuffer(20)
    const view = new DataView(buffer)
    view.setUint16(0, 0xffd8) // JPEG SOI marker
    view.setUint8(2, 0xff)
    view.setUint8(3, 0xd9) // EOI marker (end)

    expect(parseExif(buffer)).toBe(null)
  })

  it('should throw error for empty buffer', () => {
    const buffer = new ArrayBuffer(0)
    expect(() => parseExif(buffer)).toThrow()
  })

  it('should throw error for too small buffer', () => {
    const buffer = new ArrayBuffer(1)
    expect(() => parseExif(buffer)).toThrow()
  })
})
