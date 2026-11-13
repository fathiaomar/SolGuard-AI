const ALLOWED_RETURN_PATHS = ['/dashboard', '/projects', '/audits', '/reports', '/settings']

export function getSafeReturnPath(value, origin) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard'
  }

  const destination = new URL(value, origin)
  const allowed = ALLOWED_RETURN_PATHS.some((path) =>
    destination.pathname === path || destination.pathname.startsWith(`${path}/`))

  if (destination.origin !== new URL(origin).origin || !allowed) return '/dashboard'
  return `${destination.pathname}${destination.search}${destination.hash}`
}
