import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getSafeReturnPath } from '../../../lib/auth-redirect.mjs'
import { createSupabaseServerClient } from '../../../lib/supabase-server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const returnPath = getSafeReturnPath(requestUrl.searchParams.get('next'), requestUrl.origin)
  let confirmed = false

  if (code) {
    try {
      const supabase = await createSupabaseServerClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        confirmed = true
      } else {
        console.error('Supabase email confirmation failed.', { code: error.code, status: error.status })
      }
    } catch (error) {
      console.error('Unable to complete Supabase email confirmation.', {
        name: error?.name,
        code: error?.code,
      })
    }
  }

  if (confirmed) redirect(returnPath)

  const loginUrl = new URL('/login', requestUrl.origin)
  loginUrl.searchParams.set('auth_error', 'confirmation_failed')
  return NextResponse.redirect(loginUrl)
}