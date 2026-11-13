'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, Check, Menu, Search } from 'lucide-react'
import Sidebar from './Sidebar'
import { getSupabaseClient } from '../lib/supabase'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/audits': 'Audit history',
  '/reports': 'Reports',
  '/settings': 'Settings',
}
const NOTIFICATION_READ_KEY = 'audit-ai-notification-read-v1'

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [profile, setProfile] = useState({ displayName: 'Auditor workspace', email: '' })
  const [authenticated, setAuthenticated] = useState(false)
  const [notificationItems, setNotificationItems] = useState([])
  const [readNotificationIds, setReadNotificationIds] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] = useState(true)
  const [searchItems, setSearchItems] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const pathname = usePathname()
  const router = useRouter()
  const title = pageTitles[pathname] || (pathname.startsWith('/projects/') ? 'Project overview' : 'Workspace')

  useEffect(() => {
    let selectedAppearance = 'dark'
    const updateTheme = (settings) => {
      selectedAppearance = settings?.appearance || 'dark'
      setInAppNotificationsEnabled(settings?.notifications?.inApp !== false)
      setProfile({
        displayName: settings?.displayName || 'Auditor workspace',
        email: settings?.email || '',
      })
      const resolvedTheme = selectedAppearance === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : selectedAppearance
      setTheme(resolvedTheme)
    }

    const refreshWorkspace = async (providedWorkspace) => {
      try {
        let workspace = providedWorkspace
        if (!workspace) {
          const response = await fetch('/api/workspace', { cache: 'no-store' })
          if (!response.ok) throw new Error('Workspace data could not be loaded.')
          workspace = await response.json()
        }
        updateTheme(workspace.settings)
        const projects = Array.isArray(workspace.projects) ? workspace.projects : []
        const audits = Array.isArray(workspace.audits) ? workspace.audits : []
        setNotificationItems(audits.slice(0, 8))
        setSearchItems([
          ...projects.map((project) => ({
            id: `project-${project.id}`,
            title: project.name,
            detail: `${project.network || 'EVM'} project · ${project.contracts?.length || 0} contracts`,
            href: `/projects/${project.id}`,
            kind: 'Project',
          })),
          ...projects.flatMap((project) => (project.contracts || []).map((contract) => ({
            id: `contract-${contract.id}`,
            title: contract.name,
            detail: `${project.name} · ${project.network || 'EVM'} contract`,
            href: `/projects/${project.id}/contracts/${contract.id}`,
            kind: 'Contract',
          }))),
          ...audits.map((audit) => ({
            id: `scan-${audit.id}`,
            title: audit.contractName,
            detail: `${audit.projectName} · ${audit.findings?.length || 0} review items`,
            href: `/audits/${audit.id}`,
            kind: 'Scan',
          })),
        ])
        const savedReadIds = window.localStorage.getItem(NOTIFICATION_READ_KEY)
        const parsedReadIds = savedReadIds ? JSON.parse(savedReadIds) : []
        if (!Array.isArray(parsedReadIds)) throw new Error('Saved notification state is invalid.')
        setReadNotificationIds(parsedReadIds)
        setNotificationError('')
      } catch (error) {
        console.error('Unable to load workspace data for search and notifications.', error)
        setNotificationError('Workspace notifications and search could not be loaded.')
      }
    }

    void refreshWorkspace()

    const handleWorkspaceChange = (event) => {
      if (event.detail) void refreshWorkspace(event.detail)
      else void refreshWorkspace()
    }
    const handleStorageChange = () => { void refreshWorkspace() }
    const handleSettingsChange = (event) => updateTheme(event.detail)
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    const handleSystemThemeChange = (event) => {
      if (selectedAppearance === 'system') setTheme(event.matches ? 'light' : 'dark')
    }
    const colorScheme = window.matchMedia('(prefers-color-scheme: light)')
    window.addEventListener('audit-workspace-changed', handleWorkspaceChange)
    window.addEventListener('audit-settings-changed', handleSettingsChange)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('keydown', handleShortcut)
    colorScheme.addEventListener('change', handleSystemThemeChange)

    let authSubscription
    try {
      const supabase = getSupabaseClient()
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error('Unable to load the authentication session.', error)
          return
        }
        updateAuthUser(data.session?.user)
        if (data.session?.user) void refreshWorkspace()
      }).catch((error) => console.error('Unable to load the authentication session.', error))

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        updateAuthUser(session?.user)
        if (session?.user) void refreshWorkspace()
        else {
          setSearchItems([])
          setNotificationItems([])
        }
      })
      authSubscription = data.subscription
    } catch (error) {
      console.error('Supabase authentication is unavailable.', error)
    }

    return () => {
      window.removeEventListener('audit-settings-changed', handleSettingsChange)
      window.removeEventListener('audit-workspace-changed', handleWorkspaceChange)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('keydown', handleShortcut)
      colorScheme.removeEventListener('change', handleSystemThemeChange)
      authSubscription?.unsubscribe()
    }
  }, [])

  function updateAuthUser(user) {
    setAuthenticated(Boolean(user))
    if (user) {
      setProfile({
        displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'SolGuard user',
        email: user.email || '',
      })
    }
  }

  const signOut = async () => {
    try {
      const { error } = await getSupabaseClient().auth.signOut()
      if (error) throw error
      router.replace('/login')
    } catch (error) {
      console.error('Unable to sign out.', error)
    }
  }

  const unreadCount = notificationItems.filter((item) => !readNotificationIds.includes(item.id)).length
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return []
    return searchItems.filter((item) => `${item.title} ${item.detail} ${item.kind}`.toLocaleLowerCase().includes(query)).slice(0, 8)
  }, [searchItems, searchQuery])

  const markNotificationsRead = () => {
    const nextReadIds = [...new Set([...readNotificationIds, ...notificationItems.map((item) => item.id)])]
    try {
      window.localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify(nextReadIds))
      setReadNotificationIds(nextReadIds)
      setNotificationError('')
    } catch (error) {
      console.error('Unable to save notification read state.', error)
      setNotificationError('Read status could not be saved.')
    }
  }

  return (
    <div data-theme={theme} className={`app-theme min-h-screen ${theme === 'light' ? 'app-theme-light' : 'bg-[#070a12] text-slate-100'}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} displayName={profile.displayName} email={profile.email} authenticated={authenticated} onSignOut={signOut} />
      <div className="min-h-screen md:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/[0.06] bg-[#080c15]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg border border-white/10 p-2 text-slate-300 md:hidden" aria-label="Open menu"><Menu size={18} /></button>
            <div>
              <div className="text-sm font-medium text-slate-100">{title}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">Workspace <span className="mx-1 text-slate-700">/</span> {title}</div>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative">
              <label className="workspace-search flex h-9 w-[min(34vw,220px)] min-w-[112px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2.5 text-slate-500 sm:w-56 sm:px-3">
                <Search size={14} className="shrink-0" />
                <input ref={searchInputRef} role="combobox" aria-label="Search projects, contracts, and scans" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={searchOpen && Boolean(searchQuery.trim())} aria-controls="workspace-search-results" value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true) }} placeholder="Search..." className="w-full min-w-0 bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600 sm:text-xs" />
                <span className="hidden shrink-0 rounded border border-white/10 px-1 text-[9px] sm:inline">Ctrl K</span>
              </label>
              {searchOpen && searchQuery.trim() && <div id="workspace-search-results" role="listbox" aria-label="Search results" className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-[#100a1a] shadow-2xl shadow-black/50">
                {searchResults.length ? searchResults.map((item) => <Link key={item.id} role="option" aria-selected="false" href={item.href} onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="flex items-start gap-3 border-b border-white/[0.04] px-3.5 py-3 last:border-0 hover:bg-white/[0.04]">
                  <span className="mt-0.5 rounded-md border border-violet-300/10 bg-violet-300/[0.05] px-1.5 py-1 text-[8px] text-violet-200">{item.kind}</span>
                  <span className="min-w-0"><span className="block truncate text-[10px] font-medium text-slate-200">{item.title}</span><span className="mt-1 block truncate text-[9px] text-slate-500">{item.detail}</span></span>
                </Link>) : <p className="px-4 py-4 text-[10px] text-slate-500">No projects, contracts, or scans match “{searchQuery.trim()}”.</p>}
              </div>}
            </div>
            <div className="relative">
              <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-xl border border-white/[0.08] p-2 text-slate-400 transition hover:bg-white/[0.04] hover:text-white" aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="workspace-notifications">
                <Bell size={16} />
                {inAppNotificationsEnabled && unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-300 px-1 text-[8px] font-semibold text-slate-950">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {notificationsOpen && <section id="workspace-notifications" aria-label="Recent notifications" className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#100a1a] shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                  <div><h2 className="text-xs font-semibold text-slate-100">Recent activity</h2><p className="mt-1 text-[9px] text-slate-500">Contract scan notifications</p></div>
                  <button type="button" onClick={markNotificationsRead} disabled={!unreadCount} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-violet-200 transition hover:bg-white/[0.05] disabled:opacity-40"><Check size={11} /> Mark all read</button>
                </div>
                {!inAppNotificationsEnabled && <p className="border-b border-white/[0.06] px-4 py-2 text-[9px] text-slate-500">In-app notifications are turned off in Settings.</p>}
                {notificationError && <p role="alert" className="px-4 py-3 text-[10px] text-rose-300">{notificationError}</p>}
                {notificationItems.length ? <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.05]">
                  {notificationItems.map((item) => {
                    const unread = !readNotificationIds.includes(item.id)
                    return <Link key={item.id} href={`/audits/${item.id}`} onClick={() => { markNotificationsRead(); setNotificationsOpen(false) }} className="flex gap-3 px-4 py-3 transition hover:bg-white/[0.035]">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread && inAppNotificationsEnabled ? 'bg-orange-300' : 'bg-slate-700'}`} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium text-slate-200">Scan complete · {item.contractName}</span><span className="mt-1 block truncate text-[9px] text-slate-500">{item.projectName} · {(item.findings || []).length} review items</span><span className="mt-1 block text-[9px] text-slate-600">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent scan'}</span></span>
                    </Link>
                  })}
                </div> : <p className="px-4 py-6 text-center text-[10px] text-slate-500">No scan notifications yet. Run a pattern check to see activity here.</p>}
              </section>}
            </div>
            <div className="workspace-profile-avatar grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-[10px] font-semibold text-cyan-200">{profile.displayName.trim().slice(0, 2).toUpperCase()}</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  )
}
