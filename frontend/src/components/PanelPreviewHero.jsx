import { mockPreviewAssets } from '../mocks/fixtures/mockPreviewAssets.js'
import { getPreviewContract } from '../features/preview/getPreviewContract.js'
import PreviewRenderer from './PreviewRenderer'

export default function PanelPreviewHero({ item, mockMode = false }) {
  const contract = getPreviewContract(
    item,
    mockMode ? mockPreviewAssets : null,
    { isMock: mockMode },
  )

  return <PreviewRenderer contract={contract} />
}
