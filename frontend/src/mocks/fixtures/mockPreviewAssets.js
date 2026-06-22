const svgThumb = (label, fill, accent) => (
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='${fill.replace('#', '%23')}'/%3E%3Crect x='32' y='32' width='576' height='296' rx='18' fill='none' stroke='${accent.replace('#', '%23')}' stroke-width='6'/%3E%3Ctext x='56' y='194' fill='white' font-family='Arial,sans-serif' font-size='38' font-weight='700'%3E${encodeURIComponent(label)}%3C/text%3E%3C/svg%3E`
)

export const mockPreviewAssets = {
  'seongsu-pc-basement-draft': {
    status: 'available',
    thumbnailHref: svgThumb('Seongsu LiDAR', '#243447', '#E05555'),
    previewHref: 'mock://preview/seongsu-pc-basement-draft',
    previewType: 'thumbnail',
  },
  'seongsu-model-lobby-bim': {
    status: 'pending',
    thumbnailHref: null,
    previewHref: 'mock://preview/seongsu-model-lobby-bim',
    previewType: 'model-screenshot',
  },
  'seongsu-tiles-shell-beta': {
    status: 'missing',
    thumbnailHref: null,
    previewHref: null,
    previewType: '3d-tiles-placeholder',
  },
  'seongsu-ortho-rooftop': {
    status: 'available',
    thumbnailUrl: svgThumb('Rooftop Ortho Preview', '#273827', '#9055C8'),
    thumbnailHref: svgThumb('Rooftop Ortho', '#273827', '#9055C8'),
    previewHref: 'mock://preview/seongsu-ortho-rooftop',
    previewType: 'image',
    mimeType: 'image/svg+xml',
  },
  'seongsu-image-facade-set': {
    status: 'available',
    previewUrl: svgThumb('Facade Preview', '#17354A', '#35A5E0'),
    thumbnailHref: svgThumb('Facade Photos', '#17354A', '#35A5E0'),
    previewHref: 'mock://preview/seongsu-image-facade-set',
    previewType: 'image-set',
    mimeType: 'image/svg+xml',
  },
  'seongsu-panorama-lobby': {
    status: 'failed',
    thumbnailHref: null,
    previewHref: 'mock://preview/seongsu-panorama-lobby',
    previewType: 'panorama',
    failureReason: 'Equirectangular metadata is missing.',
  },
  'seongsu-video-safety': {
    status: 'available',
    thumbnailHref: svgThumb('Safety Video', '#3A2020', '#E04040'),
    previewHref: 'mock://preview/seongsu-video-safety',
    previewType: 'video',
  },
  'seongsu-document-permit-draft': {
    status: 'missing',
    thumbnailHref: null,
    previewHref: null,
    previewType: 'document',
  },
  'bulguksa-pointcloud-dabotap': {
    status: 'available',
    thumbnailHref: svgThumb('Dabotap LiDAR', '#2A2238', '#E05555'),
    previewHref: 'mock://preview/bulguksa-pointcloud-dabotap',
    previewType: 'thumbnail',
  },
  'bulguksa-model-dabotap-photogrammetry': {
    status: 'failed',
    thumbnailHref: null,
    previewHref: 'mock://preview/bulguksa-model-dabotap-photogrammetry',
    previewType: 'model-screenshot',
    failureReason: 'Texture atlas was not generated.',
  },
  'bulguksa-tiles-site-context': {
    status: 'pending',
    thumbnailHref: null,
    previewHref: 'mock://preview/bulguksa-tiles-site-context',
    previewType: '3d-tiles-placeholder',
  },
  'bulguksa-ortho-main-zone': {
    status: 'available',
    thumbnailHref: svgThumb('Bulguksa Ortho', '#1F3238', '#9055C8'),
    previewHref: 'mock://preview/bulguksa-ortho-main-zone',
    previewType: 'image',
    mimeType: 'image/tiff',
    label: 'Unsupported TIFF ortho mock',
  },
  'bulguksa-image-drone-set': {
    status: 'missing',
    thumbnailHref: null,
    previewHref: null,
    previewType: 'image-set',
  },
  'bulguksa-panorama-main-hall': {
    status: 'available',
    thumbnailHref: svgThumb('Main Hall Pano', '#3A2C16', '#E87830'),
    previewHref: 'mock://preview/bulguksa-panorama-main-hall',
    previewType: 'panorama',
  },
  'bulguksa-video-survey-walkthrough': {
    status: 'failed',
    thumbnailHref: null,
    previewHref: 'mock://preview/bulguksa-video-survey-walkthrough',
    previewType: 'video',
    failureReason: 'Codec probe timed out.',
  },
  'bulguksa-document-precision-report': {
    status: 'available',
    thumbnailHref: svgThumb('Survey Report', '#283038', '#8899AA'),
    previewHref: 'mock://preview/bulguksa-document-precision-report',
    previewType: 'document',
  },
  'inbox-pointcloud-unknown-scan': {
    status: 'pending',
    thumbnailHref: null,
    previewHref: 'mock://preview/inbox-pointcloud-unknown-scan',
    previewType: 'thumbnail',
  },
  'inbox-model-damaged-obj': {
    status: 'failed',
    thumbnailHref: null,
    previewHref: 'mock://preview/inbox-model-damaged-obj',
    previewType: 'model-screenshot',
    failureReason: 'Mesh file is incomplete.',
  },
  'inbox-tiles-test-area': {
    status: 'available',
    thumbnailHref: svgThumb('Inbox Tiles', '#1E3432', '#50AAAF'),
    previewHref: 'mock://preview/inbox-tiles-test-area',
    previewType: '3d-tiles-placeholder',
  },
  'inbox-ortho-no-site': {
    status: 'missing',
    thumbnailHref: null,
    previewHref: null,
    previewType: 'image',
  },
  'inbox-image-field-photo': {
    status: 'available',
    thumbnailHref: null,
    previewUrl: '/mock-preview/broken-field-photo.svg',
    previewHref: 'mock://preview/inbox-image-field-photo',
    previewType: 'image',
    mimeType: 'image/svg+xml',
    isBrokenMock: true,
  },
  'inbox-panorama-room-raw': {
    status: 'pending',
    thumbnailHref: null,
    previewHref: 'mock://preview/inbox-panorama-room-raw',
    previewType: 'panorama',
  },
  'inbox-video-raw-mp4': {
    status: 'missing',
    thumbnailHref: null,
    previewHref: null,
    previewType: 'video',
  },
  'inbox-document-contract-draft': {
    status: 'failed',
    thumbnailHref: null,
    previewHref: 'mock://preview/inbox-document-contract-draft',
    previewType: 'document',
    failureReason: 'PDF text extraction failed.',
  },
}

export function getMockPreviewAsset(itemId) {
  return mockPreviewAssets[itemId] || { status: 'missing', thumbnailHref: null, previewHref: null }
}
