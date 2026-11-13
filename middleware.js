<<<<<<< HEAD
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/')
  const isAiReadinessRequest = request.nextUrl.pathname === '/api/audits/ai' &&
    request.method === 'GET'

  if (isAiReadinessRequest) return NextResponse.next()

  if (!url || !anonKey) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 })
    }

    const signInUrl = new URL('/login', request.url)
    signInUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error && ![400, 401, 403].includes(error.status)) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 503 })
    }
    return new NextResponse('Authentication service is unavailable.', { status: 503 })
  }

  if (!user) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const signInUrl = new URL('/login', request.url)
    signInUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/audits/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/api/:path*',
  ],
}
=======
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/')
  const isAiReadinessRequest = request.nextUrl.pathname === '/api/audits/ai' &&
    request.method === 'GET'

  if (isAiReadinessRequest) return NextResponse.next()

  if (!url || !anonKey) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 })
    }

    const signInUrl = new URL('/login', request.url)
    signInUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error && ![400, 401, 403].includes(error.status)) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 503 })
    }
    return new NextResponse('Authentication service is unavailable.', { status: 503 })
  }

  if (!user) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const signInUrl = new URL('/login', request.url)
    signInUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/audits/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/api/:path*',
  ],
}
>>>>>>> 7940fba658c6c72afbc060d3d00fe805b6ced0e4
