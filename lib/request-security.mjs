export function isSameOriginRequest(request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    const originUrl = new URL(origin)
    return origin === originUrl.origin && originUrl.origin === new URL(request.url).origin
  } catch {
    return false
  }
}