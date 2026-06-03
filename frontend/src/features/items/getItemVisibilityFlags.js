import { getItemStatus } from './getItemStatus.js'
import { getProjectContext } from './getProjectContext.js'

export function getItemVisibilityFlags(item, collections = []) {
  const status = getItemStatus(item)
  const projectContext = getProjectContext(item, collections)
  return {
    isDraft: status === 'draft',
    isPublished: status === 'published',
    isArchived: status === 'archived',
    isUnknownStatus: status === 'unknown',
    isUnassigned: projectContext.isUnassigned,
  }
}
