export function noBreak(s: string): string {
  return s.replace(/-/g, '&#8209;').replace(/ /g, '&nbsp;')
}

export function cleanUrl(url: string): string {
  if (url && url.endsWith('/')) {
    return url.substring(0, url.length - 1)
  }
  return url
}
