import { describe, it, expect } from 'vitest'
import { detectFileFormat, generateId, formatFileSize } from './storage'

describe('detectFileFormat', () => {
  describe('3D model formats', () => {
    it('should detect GLTF format', () => {
      expect(detectFileFormat('model.gltf')).toBe('gltf')
      expect(detectFileFormat('Model.GLTF')).toBe('gltf')
    })

    it('should detect GLB format', () => {
      expect(detectFileFormat('model.glb')).toBe('glb')
    })

    it('should detect OBJ format', () => {
      expect(detectFileFormat('model.obj')).toBe('obj')
      expect(detectFileFormat('complex.model.obj')).toBe('obj')
    })

    it('should detect FBX format', () => {
      expect(detectFileFormat('model.fbx')).toBe('fbx')
    })

    it('should detect PLY format', () => {
      expect(detectFileFormat('pointcloud.ply')).toBe('ply')
    })

    it('should detect LAS format', () => {
      expect(detectFileFormat('scan.las')).toBe('las')
    })

    it('should detect E57 format', () => {
      expect(detectFileFormat('scan.e57')).toBe('e57')
    })
  })

  describe('3D Tiles formats', () => {
    it('should detect B3DM format as 3dtiles', () => {
      expect(detectFileFormat('tile.b3dm')).toBe('3dtiles')
    })

    it('should detect I3DM format as 3dtiles', () => {
      expect(detectFileFormat('instance.i3dm')).toBe('3dtiles')
    })

    it('should detect PNTS format as 3dtiles', () => {
      expect(detectFileFormat('points.pnts')).toBe('3dtiles')
    })

    it('should detect CMPT format as 3dtiles', () => {
      expect(detectFileFormat('composite.cmpt')).toBe('3dtiles')
    })
  })

  describe('Gaussian Splatting formats', () => {
    it('should detect SPLAT format', () => {
      expect(detectFileFormat('scene.splat')).toBe('splat')
    })

    it('should detect KSPLAT format', () => {
      expect(detectFileFormat('scene.ksplat')).toBe('splat')
    })
  })

  describe('image formats', () => {
    it('should detect JPG/JPEG format', () => {
      expect(detectFileFormat('photo.jpg')).toBe('image')
      expect(detectFileFormat('photo.jpeg')).toBe('image')
      expect(detectFileFormat('PHOTO.JPG')).toBe('image')
    })

    it('should detect PNG format', () => {
      expect(detectFileFormat('image.png')).toBe('image')
    })

    it('should detect GIF format', () => {
      expect(detectFileFormat('animation.gif')).toBe('image')
    })

    it('should detect WebP format', () => {
      expect(detectFileFormat('modern.webp')).toBe('image')
    })

    it('should detect TIFF format', () => {
      expect(detectFileFormat('photo.tiff')).toBe('image')
      expect(detectFileFormat('photo.tif')).toBe('image')
    })

    it('should detect BMP format', () => {
      expect(detectFileFormat('old.bmp')).toBe('image')
    })
  })

  describe('unknown formats', () => {
    it('should return other for unknown extensions', () => {
      expect(detectFileFormat('document.pdf')).toBe('other')
      expect(detectFileFormat('file.txt')).toBe('other')
      expect(detectFileFormat('archive.zip')).toBe('other')
    })

    it('should handle files without extension', () => {
      expect(detectFileFormat('filename')).toBe('other')
    })
  })
})

describe('generateId', () => {
  it('should generate a valid UUID format', () => {
    const id = generateId()
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidRegex)
  })

  it('should generate unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(100)
  })

  it('should generate 36 character strings', () => {
    const id = generateId()
    expect(id.length).toBe(36)
  })
})

describe('formatFileSize', () => {
  it('should format 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1)).toBe('1 B')
  })

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2048)).toBe('2 KB')
  })

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    expect(formatFileSize(1024 * 1024 * 5.5)).toBe('5.5 MB')
  })

  it('should format gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
  })

  it('should format terabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB')
  })

  it('should round to one decimal place', () => {
    expect(formatFileSize(1024 * 1.234)).toBe('1.2 KB')
    expect(formatFileSize(1024 * 1.256)).toBe('1.3 KB')
  })
})
