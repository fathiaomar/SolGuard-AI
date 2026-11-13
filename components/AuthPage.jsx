'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { getSupabaseClient } from '../lib/supabase'
import { getSafeReturnPath } from '../lib/auth-redirect.mjs'
import BrandMark from './BrandMark'

export default function AuthPage({ mode }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)

  const getConfirmationRedirect = () => {
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', getSafeReturnPath(
      new URLSearchParams(window.location.search).get('next'),
      window.location.origin,
    ))
    return callbackUrl.toString()
  }

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('auth_error')
    if (authError === 'confirmation_failed') {
      setError('Email confirmation failed or expired. Sign in if your account is already confirmed, or create a new account.')
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setConfirmationPending(false)

    if (mode === 'signup' && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }

    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: getConfirmationRedirect(),
          },
        })
        if (authError) throw authError

        if (data.session) {
          window.location.assign(getSafeReturnPath(
            new URLSearchParams(window.location.search).get('next'),
            window.location.origin,
          ))
          return
        }

        setConfirmationPending(true)
        setMessage('Account created. Check your email for a verification link, then sign in.')
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) throw authError
      window.location.assign(getSafeReturnPath(
        new URLSearchParams(window.location.search).get('next'),
        window.location.origin,
      ))
    } catch (authError) {
      console.error('Authentication request failed.', authError)
      if (authError.message?.includes('Authentication is not configured')) {
        setError(authError.message)
      } else if (authError.message?.toLowerCase().includes('invalid login credentials')) {
        setError('Email or password is incorrect.')
      } else if (authError.message?.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.')
      } else if (authError.message?.toLowerCase().includes('email not confirmed')) {
        setConfirmationPending(true)
        setError('Please verify your email before signing in. Check your inbox for the confirmation link.')
      } else {
        setError(authError.message || 'Authentication failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const resendConfirmation = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const { error: resendError } = await getSupabaseClient().auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getConfirmationRedirect() },
      })
      if (resendError) throw resendError
      setMessage('A new confirmation email has been sent. Check your inbox and spam folder.')
    } catch (resendError) {
      console.error('Unable to resend the Supabase confirmation email.', resendError)
      setError(resendError.message || 'Confirmation email could not be sent. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="relative grid min-h-screen overflow-hidden bg-[#070a12] text-slate-100 lg:grid-cols-[1.05fr_.95fr]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(34,211,238,.1),transparent_35%),radial-gradient(ellipse_at_80%_90%,rgba(124,58,237,.09),transparent_40%)]" />
    <section className="relative hidden flex-col justify-between border-r border-white/[0.06] p-10 lg:flex xl:p-14">
      <Link href="/" className="flex items-center gap-3"><BrandMark /><span className="text-sm font-semibold tracking-wide">SolGuard <span className="text-cyan-300">AI</span></span></Link>
      <div className="max-w-lg"><div className="mb-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">A safer way to ship</div><h1 className="text-5xl font-semibold leading-[1.12] tracking-tight text-white">Security starts<br />with <span className="text-cyan-300">visibility.</span></h1><p className="mt-5 max-w-md text-sm leading-7 text-slate-400">Bring your Solidity projects together, review common risk patterns, and keep audit notes close to your code.</p><div className="mt-9 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200"><ShieldCheck size={18} /></div><div><div className="text-xs font-medium text-slate-200">Built for security-minded teams</div><div className="mt-1 text-[10px] text-slate-500">Solidity · EVM · Pattern checks</div></div></div></div>
      <p className="text-[10px] text-slate-600">Secure authentication powered by Supabase</p>
    </section>
    <section className="relative flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-[410px]">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft size={14} /> Back to home</Link>
        <div className="mb-7 lg:hidden"><BrandMark /></div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{mode === 'signup' ? 'Get started' : 'Welcome back'}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{mode === 'signup' ? 'Create your workspace' : 'Sign in to your workspace'}</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">{mode === 'signup' ? 'Start organizing your smart contract projects.' : 'Continue to your smart contract workspace.'}</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-xs text-rose-200">{error}</div>}
        {message && <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-xs leading-5 text-emerald-200">{message}</div>}
        {confirmationPending && <button type="button" disabled={loading || !email.trim()} onClick={resendConfirmation} className="mt-3 text-xs font-medium text-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">Resend confirmation email</button>}
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === 'signup' && <label className="block text-xs font-medium text-slate-300">Full name<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /></label>}
          <label className="block text-xs font-medium text-slate-300">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /></label>
          <label className="block text-xs font-medium text-slate-300">Password<div className="relative mt-2"><input required type={visible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} className="w-full rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-3 pr-11 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /><button type="button" onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200" aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <button type="submit" disabled={loading} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} {!loading && <ArrowRight size={14} />}</button>
        </form>
        <div className="mt-6 text-center text-xs text-slate-500">{mode === 'signup' ? 'Already have an account?' : 'New to SolGuard AI?'} <Link className="font-medium text-cyan-300 hover:text-cyan-200" href={mode === 'signup' ? '/login' : '/signup'}>{mode === 'signup' ? 'Sign in' : 'Create account'}</Link></div>
      </div>
    </section>
  </main>
}
