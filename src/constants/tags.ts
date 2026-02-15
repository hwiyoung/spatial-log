/** 시스템 태그 접두사 */
export const TAG_PREFIX = {
  GROUP: 'group:',
  PARENT: 'parent:',
} as const

/** 시스템 태그 값 */
export const TAG = {
  GROUP_MAIN: 'group:main',
  GROUP_MATERIAL: 'group:material',
  GROUP_TEXTURE: 'group:texture',
} as const

/** 시스템 태그 여부 (group: 또는 parent: 접두사) */
export function isSystemTag(tag: string): boolean {
  return tag.startsWith(TAG_PREFIX.GROUP) || tag.startsWith(TAG_PREFIX.PARENT)
}

/** 사용자 정의 태그만 필터링 */
export function getUserTags(tags: string[]): string[] {
  return tags.filter(t => !isSystemTag(t))
}
