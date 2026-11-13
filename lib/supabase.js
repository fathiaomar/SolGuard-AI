import { createBrowserClient } from '@supabase/ssr'

let supabase

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.')
  }

  if (!supabase) {
    supabase = createBrowserClient(url, anonKey)
  }

  return supabase
}
