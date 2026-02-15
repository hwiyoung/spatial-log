/** URL 스킴 검증: http/https/mailto만 허용 (XSS 방지) */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url
    return ''
  } catch {
    return ''
  }
}
