'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, FileClock, FolderKanban, LayoutDashboard, LogOut, Settings, X } from 'lucide-react'
import BrandMark from './BrandMark'

const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Audit history', href: '/audits', icon: FileClock },
  { label: 'Reports', href: '/reports', icon: Activity },
]

export default function Sidebar({ open = false, onClose, displayName = 'Auditor workspace', email = '', authenticated = false, onSignOut }) {
  const pathname = usePathname()

  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-slate-950/70 md:hidden" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.07] bg-[#090d18] px-4 py-5 transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between px-2">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
            <BrandMark />
            <span>
              <span className="block text-sm font-semibold tracking-wide text-white">SolGuard <span className="text-cyan-300">AI</span></span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Smart contract security</span>
            </span>
          </Link>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 md:hidden" aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href === '/projects' && pathname.startsWith('/projects/'))
            return (
              <Link key={href} href={href} onClick={onClose} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-cyan-400/[0.09] font-medium text-cyan-200 ring-1 ring-cyan-300/10' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}>
                <Icon size={17} className={active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-slate-300'} />
                {label}
                {label === 'Audit history' && <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">Live</span>}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto">
          <Link href="/settings" onClick={onClose} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${pathname === '/settings' ? 'bg-cyan-400/[0.09] text-cyan-200' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}>
            <Settings size={17} className="text-slate-500" /> Settings
          </Link>
          <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] px-2 pt-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-pink-500 text-xs font-bold text-slate-950">{displayName.trim().slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-200">{displayName}</div>
              <div className="truncate text-[10px] text-slate-500">{email || (authenticated ? 'Signed in' : 'Preview account')}</div>
            </div>
            {authenticated ? <button type="button" onClick={onSignOut} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.05] hover:text-white" aria-label="Sign out"><LogOut size={15} /></button> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          </div>
        </div>
      </aside>
    </>
  )
}
