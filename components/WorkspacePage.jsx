 'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '../lib/supabase'
import AuditResults from './AuditResults'
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bug, Check, ChevronDown,
  HelpCircle, Clock3, Code2, FileCode2, FileJson2, FilePlus2, FileText, FolderKanban,
  Eye, Gauge, Layers3, Loader2, LockKeyhole, Monitor, Moon, Palette, Plus, Search,
  Shield, ShieldAlert, ShieldCheck, Sparkles, Sun, Trash2, Upload, User, X,
} from 'lucide-react'

const EMPTY_WORKSPACE = {
  projects: [],
  audits: [],
  settings: {
    displayName: 'Auditor workspace',
    email: '',
    notifications: { inApp: true, email: false, security: true },
    appearance: 'dark',
  },
}

function formatDate(value) {
  if (!value) return 'Not audited yet'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function getSourceInventory(source = '') {
  const count = (pattern) => [...source.matchAll(pattern)].length
  const pragma = source.match(/^\s*pragma\s+solidity\s+([^;]+);/m)?.[1]?.trim() || 'Not specified'
  return {
    lines: source ? source.split(/\r?\n/).length : 0,
    bytes: new TextEncoder().encode(source).length,
    contracts: count(/\b(?:contract|interface|library)\s+[A-Za-z_$][\w$]*/g),
    functions: count(/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g),
    events: count(/\bevent\s+[A-Za-z_$][\w$]*\s*\(/g),
    modifiers: count(/\bmodifier\s+[A-Za-z_$][\w$]*\s*\(/g),
    imports: count(/^\s*import\s+[^;]+;/gm),
    pragma,
  }
}

function Button({ children, variant = 'secondary', className = '', ...props }) {
  const variants = {
    primary: 'border-cyan-300/30 bg-cyan-300 text-slate-950 hover:bg-cyan-200 shadow-[0_6px_25px_rgba(34,211,238,.12)]',
    secondary: 'border-white/[0.09] bg-white/[0.035] text-slate-200 hover:bg-white/[0.07]',
    ghost: 'border-transparent bg-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white',
  }
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>{children}</button>
}

function PageIntro({ eyebrow, title, description, children }) {
  return (
    <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80"><span className="h-px w-5 bg-cyan-300/60" />{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

function Panel({ children, className = '' }) {
  return <section className={`rounded-2xl border border-white/[0.07] bg-[#0b101b] ${className}`}>{children}</section>
}

function Severity({ severity }) {
  const styles = {
    Critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    High: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
    Medium: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    Low: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
    Info: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
  }
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${styles[severity] || styles.Info}`}>{severity}</span>
}

export default function WorkspacePage({ mode, projectId, auditId, contractId }) {
  const router = useRouter()
  const fileInput = useRef(null)
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE)
  const [ready, setReady] = useState(false)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [modal, setModal] = useState(false)
  const [aiReviewTarget, setAiReviewTarget] = useState(null)
  const [aiConsent, setAiConsent] = useState(false)
  const [aiReviewError, setAiReviewError] = useState('')
  const [aiProviderStatus, setAiProviderStatus] = useState({ state: 'idle', model: '' })
  const [projectName, setProjectName] = useState('')
  const [network, setNetwork] = useState('Ethereum')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const showSuccessNotice = (message) => {
    if (workspace.settings.notifications?.inApp !== false) setNotice(message)
  }

  useEffect(() => {
    let active = true
    fetch('/api/workspace', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Workspace data could not be loaded.')
        if (active) {
          setWorkspace({
            ...EMPTY_WORKSPACE,
            ...data,
            projects: Array.isArray(data.projects) ? data.projects : [],
            audits: Array.isArray(data.audits) ? data.audits : [],
            settings: { ...EMPTY_WORKSPACE.settings, ...data.settings },
          })
          setWorkspaceLoaded(true)
          setStorageError('')
        }
      })
      .catch((error) => {
        console.error('Unable to load the authenticated workspace.', error)
        if (active) setStorageError(error.message || 'Workspace data could not be loaded.')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => { active = false }
  }, [])

  const persist = async (action) => {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Workspace changes could not be saved.')
      const saved = {
        ...EMPTY_WORKSPACE,
        ...data,
        projects: Array.isArray(data.projects) ? data.projects : [],
        audits: Array.isArray(data.audits) ? data.audits : [],
        settings: { ...EMPTY_WORKSPACE.settings, ...data.settings },
      }
      setWorkspace(saved)
      setStorageError('')
      window.dispatchEvent(new CustomEvent('audit-workspace-changed', { detail: saved }))
      window.dispatchEvent(new CustomEvent('audit-settings-changed', { detail: saved.settings }))
      return true
    } catch (error) {
      console.error('Unable to save the authenticated workspace.', error)
      setStorageError(error.message || 'Workspace changes could not be saved.')
      return false
    }
  }

  const project = workspace.projects.find((item) => item.id === projectId)
  const selectedContract = project?.contracts?.find((item) => item.id === contractId)
  const selectedAudit = workspace.audits.find((item) => item.id === auditId)
  const projectAudits = project ? workspace.audits.filter((item) => item.projectId === project.id) : []
  const scannedContractCount = project?.contracts?.filter((contract) => projectAudits.some((audit) => audit.contractId === contract.id || audit.contractName === contract.name)).length || 0
  const filteredProjects = useMemo(() => workspace.projects.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase())), [workspace.projects, filter])

  const createProject = async (event) => {
    event.preventDefault()
    if (!projectName.trim()) return
    const created = {
      id: crypto.randomUUID(),
      name: projectName.trim(),
      network,
      createdAt: new Date().toISOString(),
      contracts: [],
    }
    if (await persist({
      action: 'create_project', id: created.id, name: created.name, network: created.network,
    })) {
      setProjectName('')
      setModal(false)
      router.push(`/projects/${created.id}`)
    }
  }

  const deleteProject = async (targetProject) => {
    const auditCount = workspace.audits.filter((audit) => audit.projectId === targetProject.id).length
    const confirmation = `Delete "${targetProject.name}" and its ${targetProject.contracts?.length || 0} contract(s)${auditCount ? ` and ${auditCount} scan report(s)` : ''}? This cannot be undone.`
    if (!window.confirm(confirmation)) return
    if (await persist({ action: 'delete_project', projectId: targetProject.id })) {
      setNotice(`Project "${targetProject.name}" was deleted.`)
      if (mode === 'project' || mode === 'contract') router.push('/projects')
    }
  }

  const deleteContract = async (targetProject, targetContract) => {
    const confirmation = `Delete "${targetContract.name}" from "${targetProject.name}" and remove its associated scan reports? This cannot be undone.`
    if (!window.confirm(confirmation)) return
    if (await persist({ action: 'delete_contract', contractId: targetContract.id })) {
      if (mode === 'contract' && targetContract.id === contractId) {
        router.push(`/projects/${targetProject.id}`)
      } else {
        showSuccessNotice(`${targetContract.name} was removed from ${targetProject.name}.`)
      }
    }
  }

  const addContract = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !project) return
    if (!file.name.toLowerCase().endsWith('.sol')) {
      setNotice('Choose a Solidity source file with a .sol extension.')
      return
    }
    if (file.size > 500 * 1024) {
      setNotice('Files must be 500 KB or smaller.')
      return
    }
    try {
      const source = await file.text()
      const contract = { id: crypto.randomUUID(), name: file.name, size: file.size, source, uploadedAt: new Date().toISOString() }
      if (await persist({
        action: 'create_contract', id: contract.id, projectId: project.id, name: contract.name, source: contract.source,
      })) {
        showSuccessNotice(`${file.name} added to ${project.name}.`)
      }
    } catch (error) {
      console.error('Unable to read the selected Solidity file.', error)
      setNotice('The selected file could not be read.')
    }
  }

  const runAudit = async (targetProject, targetContract) => {
    if (!targetContract) {
      setNotice('Upload a Solidity contract before starting a scan.')
      return
    }
    setBusy(true)
    setNotice('')
    const audit = {
      id: crypto.randomUUID(),
      projectId: targetProject.id,
      projectName: targetProject.name,
      contractId: targetContract.id,
      contractName: targetContract.name,
      createdAt: new Date().toISOString(),
      findings: [],
      scanType: 'Static AST pattern analysis',
    }
    const saved = await persist({
      action: 'create_audit', id: audit.id, projectId: targetProject.id, contractId: targetContract.id,
    })
    setBusy(false)
    if (saved) router.push(`/audits/${audit.id}`)
  }

  const openAiReview = async (targetProject, targetContract) => {
    setAiReviewTarget({ project: targetProject, contract: targetContract })
    setAiConsent(false)
    setAiReviewError('')
    setAiProviderStatus({ state: 'checking', model: '' })
    try {
      const response = await fetch('/api/audits/ai', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI provider status could not be checked.')
      setAiProviderStatus({
        state: data.configured ? 'ready' : 'missing',
        model: data.model || '',
      })
    } catch (error) {
      console.error('Unable to check AI provider configuration.', error)
      setAiProviderStatus({ state: 'error', model: error.message || 'AI provider status could not be checked.' })
    }
  }

  const confirmAiReview = async () => {
    if (!aiReviewTarget || !aiConsent || busy || aiProviderStatus.state !== 'ready') return
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/audits/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: aiReviewTarget.contract.id, confirmed: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI review could not be completed.')

      const audit = { ...data.audit, projectName: aiReviewTarget.project.name }
      const updatedWorkspace = {
        ...workspace,
        audits: [audit, ...workspace.audits],
      }
      setWorkspace(updatedWorkspace)
      setStorageError('')
      setAiReviewTarget(null)
      setAiConsent(false)
      setAiReviewError('')
      window.dispatchEvent(new CustomEvent('audit-workspace-changed', { detail: updatedWorkspace }))
      router.push(`/audits/${audit.id}`)
    } catch (error) {
      console.error('Unable to complete the explicitly requested AI review.', error)
      setAiReviewError(error.message || 'AI review could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  const exportReport = (audit, format) => {
    if (!audit) return
    const payload = {
      title: `Audit report: ${audit.contractName}`,
      project: audit.projectName,
      generatedAt: audit.createdAt,
      scanType: audit.scanType || 'Legacy scan (no saved analysis)',
      summary: audit.summary || '',
      analysis: audit.analysis || {},
      findings: Array.isArray(audit.findings) ? audit.findings : [],
    }
    let content
    let type
    let extension
    if (format === 'json') {
      content = JSON.stringify(payload, null, 2)
      type = 'application/json'
      extension = 'json'
    } else {
      const findingSections = payload.findings.map((finding) => `### ${finding.severity}: ${finding.title}\n\n- **Line:** ${finding.line}\n- **Recommendation:** ${finding.recommendation}`).join('\n\n')
      const gasSections = (payload.analysis.gasSuggestions || []).map((item) => `### ${item.title}\n\n${item.detail}${item.line ? `\n\n- **Line:** ${item.line}` : ''}`).join('\n\n')
      const practiceSections = (payload.analysis.bestPractices || []).map((item) => `### ${item.title}\n\n${item.detail}${item.line ? `\n\n- **Line:** ${item.line}` : ''}`).join('\n\n')
      content = `# ${payload.title}\n\n- **Project:** ${payload.project}\n- **Generated:** ${formatDate(payload.generatedAt)}\n- **Scan type:** ${payload.scanType}\n\n## Summary\n\n${payload.summary || 'No summary was provided.'}\n\n## Findings\n\n${findingSections || 'No findings were saved.'}\n\n## Gas review prompts\n\n${gasSections || 'No gas review prompts were saved.'}\n\n## Best-practice review\n\n${practiceSections || 'No best-practice suggestions were saved.'}\n`
      type = 'text/markdown'
      extension = 'md'
    }
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${audit.contractName.replace(/\.sol$/i, '')}-audit.${extension}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const applyLicenseFix = async (targetProject, targetContract) => {
    const source = targetContract.source || ''
    if (/^\s*\/\/\s*SPDX-License-Identifier:/m.test(source)) {
      showSuccessNotice('The source already has an SPDX identifier.')
      return
    }
    const licenseId = window.prompt('Enter the SPDX license identifier that applies to this source (for example, MIT or UNLICENSED).')
    if (!licenseId) return
    if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(licenseId.trim())) {
      setNotice('Enter one valid SPDX license identifier.')
      return
    }
    const fixedSource = `// SPDX-License-Identifier: ${licenseId.trim()}\n${source.replace(/^(?:\uFEFF)?(?:\s*\n)*/, '')}`
    if (await persist({
      action: 'update_contract', contractId: targetContract.id, source: fixedSource,
    })) {
      showSuccessNotice('SPDX identifier added to the saved source file.')
    }
  }

  if (!ready) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-cyan-300" /></div>
  if (!workspaceLoaded) return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-rose-300/15 bg-rose-300/[0.035] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-300/10 text-rose-200"><HelpCircle size={19} /></div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white">Workspace setup needs attention</h1>
          <p role="alert" className="mt-2 text-xs leading-5 text-rose-100/80">{storageError || 'Workspace data could not be loaded.'}</p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/15 p-4 text-xs leading-6 text-slate-400">
        <p>To enable project, upload, and review buttons:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open your Supabase project and choose <strong className="text-slate-200">SQL Editor</strong>.</li>
          <li>Run the latest <code className="text-violet-200">supabase-schema.sql</code> from this repository.</li>
          <li>Reload this page after Supabase reports that the query succeeded.</li>
        </ol>
        <p className="mt-3 text-[10px] text-slate-500">The database is missing a required column. Buttons are disabled here to avoid pretending changes were saved.</p>
      </div>
      <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}><ArrowRight size={14} /> Reload workspace</Button>
    </div>
  )

  const totalFindings = workspace.audits.reduce((count, item) => count + (item.findings || []).filter((finding) => finding.severity !== 'Info').length, 0)
  const latestAudits = workspace.audits.slice(0, 5)
  const selectedAuditProject = selectedAudit && workspace.projects.find((item) => item.id === selectedAudit.projectId)
  const selectedAuditContract = selectedAuditProject?.contracts?.find((item) => item.id === selectedAudit.contractId)
  const auditSourceIsCurrent = Boolean(selectedAuditContract && (
    !selectedAuditContract.updatedAt ||
    !selectedAudit.createdAt ||
    new Date(selectedAuditContract.updatedAt).getTime() <= new Date(selectedAudit.createdAt).getTime()
  ))

  return (
    <div className="animate-fade-in">
      {storageError && <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200"><HelpCircle size={16} className="mt-0.5 shrink-0" />{storageError}</div>}
      {notice && <div role="status" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3 text-xs text-cyan-100"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button></div>}

      {mode === 'dashboard' && (
        <>
          <div className="mb-7 overflow-hidden rounded-3xl border border-cyan-300/[0.12] bg-[radial-gradient(ellipse_at_80%_0%,rgba(34,211,238,.12),transparent_40%),linear-gradient(120deg,#0d1421,#0a0f1a_65%,#101022)] p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">Smart contract workspace</div>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">Ship contracts with<br className="hidden sm:block" /> <span className="text-cyan-300">confidence.</span></h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">Organize Solidity projects, inspect common risk patterns, and keep audit notes together in one place.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => setModal(true)}><Plus size={15} /> Create new project</Button>
                  <Link href="/projects"><span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.07]">Explore projects <ArrowRight size={14} /></span></Link>
                </div>
              </div>
              <div className="w-full rounded-2xl border border-white/[0.07] bg-black/15 p-4 lg:max-w-[390px]">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-xs font-medium text-slate-200">Workspace at a glance</div><div className="mt-1 text-[9px] text-slate-500">Your saved project activity</div></div>
                  <Link href="/projects" className="inline-flex items-center gap-1 text-[9px] text-cyan-200 hover:text-cyan-100">Projects <ArrowUpRight size={11} /></Link>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ['Projects', workspace.projects.length],
                    ['Contracts', workspace.projects.reduce((sum, item) => sum + (item.contracts?.length || 0), 0)],
                    ['Scans', workspace.audits.length],
                  ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2"><div className="text-[8px] text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-100">{value}</div></div>)}
                </div>
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <div className="text-[8px] font-medium uppercase tracking-[0.12em] text-slate-500">Latest scan</div>
                  {latestAudits[0] ? <Link href={`/audits/${latestAudits[0].id}`} className="mt-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]">
                    <span className="min-w-0"><span className="block truncate text-[10px] font-medium text-slate-200">{latestAudits[0].contractName}</span><span className="mt-1 block truncate text-[9px] text-slate-500">{latestAudits[0].projectName} · {formatDate(latestAudits[0].createdAt)}</span></span>
                    <span className="shrink-0 text-[9px] text-violet-200">View details <ArrowUpRight size={11} className="ml-1 inline" /></span>
                  </Link> : <p className="mt-2 text-[9px] text-slate-500">No scans yet. Add a contract to begin a pattern check.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total projects', value: workspace.projects.length, detail: 'In this workspace', icon: FolderKanban, color: 'text-cyan-300', bg: 'bg-cyan-300/10' },
              { label: 'Contracts', value: workspace.projects.reduce((sum, item) => sum + (item.contracts?.length || 0), 0), detail: 'Solidity files added', icon: Code2, color: 'text-violet-300', bg: 'bg-violet-300/10' },
              { label: 'Scans run', value: workspace.audits.length, detail: 'AST pattern scans', icon: Gauge, color: 'text-emerald-300', bg: 'bg-emerald-300/10' },
              { label: 'Patterns flagged', value: totalFindings, detail: 'Excludes informational', icon: Bug, color: 'text-orange-300', bg: 'bg-orange-300/10' },
            ].map((stat) => <Panel key={stat.label} className="p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">{stat.label}</div><div className="mt-2 text-2xl font-semibold text-white">{stat.value}</div><div className="mt-1 text-[10px] text-slate-600">{stat.detail}</div></div><div className={`grid h-9 w-9 place-items-center rounded-xl ${stat.bg} ${stat.color}`}><stat.icon size={17} /></div></div></Panel>)}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
            <Panel>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Recent projects</h2><p className="mt-1 text-[11px] text-slate-500">Your latest contract workspaces</p></div><Link href="/projects" className="text-[11px] text-cyan-300 hover:text-cyan-200">View all <ArrowUpRight size={13} className="ml-1 inline" /></Link></div>
              {workspace.projects.length ? <div className="divide-y divide-white/[0.05]">{workspace.projects.slice(0, 4).map((item) => <ProjectRow key={item.id} project={item} />)}</div> : <EmptyState icon={Layers3} title="Start with a project" description="Create a workspace for your Solidity contracts, then upload a file to run a server-side pattern check." action={<Button variant="secondary" onClick={() => setModal(true)}><Plus size={14} /> Create project</Button>} />}
            </Panel>
            <Panel>
              <div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Recent activity</h2><p className="mt-1 text-[11px] text-slate-500">Latest scans in your workspace</p></div>
              {latestAudits.length ? <div className="divide-y divide-white/[0.05]">{latestAudits.slice(0, 4).map((audit) => <AuditRow key={audit.id} audit={audit} />)}</div> : <EmptyState icon={Clock3} title="No scans yet" description="Your scan history will show up here." compact />}
            </Panel>
          </div>
        </>
      )}

      {mode === 'projects' && (
        <>
          <PageIntro eyebrow="Your workspace" title="Projects" description="Keep contracts and their scan history organized by project.">
            <Button variant="primary" onClick={() => setModal(true)}><Plus size={15} /> Create project</Button>
          </PageIntro>
          <label className="mb-5 flex max-w-sm items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-slate-500"><Search size={14} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter projects..." className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600" /></label>
          {filteredProjects.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filteredProjects.map((item) => <ProjectCard key={item.id} project={item} auditCount={workspace.audits.filter((audit) => audit.projectId === item.id).length} onDelete={() => deleteProject(item)} />)}</div> : <EmptyState icon={FolderKanban} title={filter ? 'No matching projects' : 'No projects yet'} description={filter ? 'Try another project name.' : 'Create your first project to start organizing Solidity contracts.'} action={!filter && <Button variant="primary" onClick={() => setModal(true)}><Plus size={14} /> Create project</Button>} />}
        </>
      )}

      {mode === 'project' && (
        !project ? <MissingState title="Project not found" backHref="/projects" backLabel="Back to projects" /> : (
          <>
            <Link href="/projects" className="mb-5 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft size={14} /> All projects</Link>
            <PageIntro eyebrow={`${project.network} network`} title={project.name} description={`Created ${formatDate(project.createdAt)} · ${project.contracts?.length || 0} Solidity ${(project.contracts?.length || 0) === 1 ? 'file' : 'files'}`}>
              <input ref={fileInput} type="file" accept=".sol,text/plain" className="hidden" onChange={addContract} />
              <Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={14} /> Add contract</Button>
              <Button variant="primary" disabled={!project.contracts?.length || busy} onClick={() => runAudit(project, project.contracts?.[0])}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Pattern check</Button>
              {project.contracts?.[0] && <Button disabled={busy} onClick={() => openAiReview(project, project.contracts[0])}><Sparkles size={14} /> AI review</Button>}
            </PageIntro>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Contracts', project.contracts?.length || 0],
                ['Contracts scanned', scannedContractCount],
                ['Pending', Math.max(0, (project.contracts?.length || 0) - scannedContractCount)],
                ['Total scans', projectAudits.length],
              ].map(([label, value]) => <Panel key={label} className="p-4"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value}</div></Panel>)}
            </div>
            <Panel>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Contracts</h2><p className="mt-1 text-[11px] text-slate-500">Upload .sol files up to 500 KB each</p></div><span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-slate-400">{project.contracts?.length || 0} files</span></div>
              {project.contracts?.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{project.contracts.map((contract) => {
                const contractAudits = projectAudits.filter((audit) => audit.contractId === contract.id || audit.contractName === contract.name)
                const latestContractAudit = contractAudits[0]
                return <article key={contract.id} className="rounded-xl border border-white/[0.07] bg-black/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><FileCode2 size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${project.id}/contracts/${contract.id}`} className="block truncate text-xs font-semibold text-slate-200 hover:text-cyan-200">{contract.name}</Link>
                      <div className="mt-1 truncate text-[9px] text-slate-500">{project.name} · {project.network}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[8px] ${latestContractAudit ? 'border-emerald-300/10 bg-emerald-300/[0.05] text-emerald-200' : 'border-amber-300/10 bg-amber-300/[0.04] text-amber-100'}`}>{latestContractAudit ? 'Scanned' : 'Pending'}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[9px] text-slate-500">
                    <span>{Math.max(1, Math.ceil((contract.size || 0) / 1024))} KB</span>
                    <span>Added {formatDate(contract.uploadedAt)}</span>
                  </div>
                  {latestContractAudit && <div className="mt-2 text-[9px] text-slate-600">Last scan {formatDate(latestContractAudit.createdAt)} · {contractAudits.length} scan{contractAudits.length === 1 ? '' : 's'}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/projects/${project.id}/contracts/${contract.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] px-2 py-2 text-[9px] text-slate-300 transition hover:bg-white/[0.04]"><Code2 size={12} /> View contract</Link>
                    {latestContractAudit && <Link href={`/audits/${latestContractAudit.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-300/15 bg-violet-300/[0.05] px-2 py-2 text-[9px] text-violet-200 transition hover:bg-violet-300/[0.1]"><Eye size={12} /> View audit</Link>}
                    <Button className="px-2 py-2 text-[9px]" onClick={() => deleteContract(project, contract)}><Trash2 size={12} /> Delete</Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button variant="primary" className="px-2 py-2 text-[9px]" disabled={busy} onClick={() => runAudit(project, contract)}>{busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Pattern check</Button>
                    <Button className="px-2 py-2 text-[9px]" disabled={busy} onClick={() => openAiReview(project, contract)}><Sparkles size={12} /> AI review</Button>
                  </div>
                </article>
              })}</div> : <EmptyState icon={FilePlus2} title="Add your first contract" description="Upload a Solidity file to view its source and run a server-side pattern check." action={<Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={14} /> Browse .sol file</Button>} />}
            </Panel>
            {projectAudits.length > 0 && <Panel className="mt-5"><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">Project scan history</h2></div><div className="divide-y divide-white/[0.05]">{projectAudits.map((audit) => <AuditRow key={audit.id} audit={audit} />)}</div></Panel>}
          </>
        )
      )}

      {mode === 'contract' && (
        !project || !selectedContract ? <MissingState title="Contract not found" backHref={projectId ? `/projects/${projectId}` : '/projects'} backLabel="Back to project" /> : (
          <ContractDetail project={project} contract={selectedContract} latestAudit={projectAudits.find((audit) => audit.contractId === selectedContract.id)} busy={busy} onRun={() => runAudit(project, selectedContract)} onAiReview={() => openAiReview(project, selectedContract)} onApplyFix={() => applyLicenseFix(project, selectedContract)} onDelete={() => deleteContract(project, selectedContract)} />
        )
      )}

      {mode === 'audits' && (
        <>
          <PageIntro eyebrow="Scan history" title="Audit history" description="Review pattern checks and optional AI-assisted findings for your contracts." />
          <Panel>
            {workspace.audits.length ? <div className="divide-y divide-white/[0.05]">{workspace.audits.map((audit) => <AuditRow key={audit.id} audit={audit} />)}</div> : <EmptyState icon={Clock3} title="No audit history" description="Run a scan from one of your projects to see results here." action={<Link href="/projects"><span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/[0.05]">Go to projects <ArrowRight size={14} /></span></Link>} />}
          </Panel>
        </>
      )}

      {mode === 'audit' && (
        !selectedAudit ? <MissingState title="Scan not found" backHref="/audits" backLabel="Back to audit history" /> : (
          <>
            <Link href="/audits" className="mb-5 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft size={14} /> Audit history</Link>
            <PageIntro eyebrow={`${selectedAudit.scanType || 'Legacy scan (no saved analysis)'} · ${formatDate(selectedAudit.createdAt)}`} title={selectedAudit.contractName} description={`Project: ${selectedAudit.projectName}.`}>
              {selectedAuditProject && selectedAuditContract && <Link href={`/projects/${selectedAuditProject.id}/contracts/${selectedAuditContract.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.07]"><Code2 size={14} /> View contract</Link>}
              {selectedAuditProject && selectedAuditContract && <Button variant="primary" disabled={busy} onClick={() => runAudit(selectedAuditProject, selectedAuditContract)}><Gauge size={14} /> Run pattern check</Button>}
              {selectedAuditProject && selectedAuditContract && <Button disabled={busy} onClick={() => openAiReview(selectedAuditProject, selectedAuditContract)}><Sparkles size={14} /> Run AI review</Button>}
              <Button onClick={() => exportReport(selectedAudit, 'md')}><FileText size={14} /> Markdown</Button>
              <Button onClick={() => exportReport(selectedAudit, 'json')}><FileJson2 size={14} /> JSON</Button>
              <Button variant="primary" onClick={() => window.print()}><ArrowDownToLine size={14} /> Print / PDF</Button>
            </PageIntro>
            {workspace.settings.notifications?.inApp !== false && <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-[11px] leading-5 text-slate-300"><Check size={15} className="mt-0.5 shrink-0 text-cyan-200" /><span>Review saved.</span></div>}
            {!selectedAuditContract && <p className="mb-5 rounded-xl border border-white/[0.06] p-4 text-[10px] leading-5 text-slate-500">The original source is no longer available in your workspace. Source metrics and source-line context are unavailable; the saved findings remain available.</p>}
            {selectedAuditContract && !auditSourceIsCurrent && <p className="mb-5 rounded-xl border border-white/[0.06] p-4 text-[10px] leading-5 text-slate-500">Historical results · contract source updated after this review. Re-run the review to match findings with the current source.</p>}
            {['Heuristic preview', 'Legacy scan (no saved analysis)'].includes(selectedAudit.scanType) ? (
              <Panel className="p-5">
                <h2 className="text-sm font-semibold text-slate-200">Legacy preview</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">This older record has no saved pattern analysis. Run a new pattern check to analyze the current contract source.</p>
              </Panel>
            ) : (
              <>
                {selectedAuditProject && selectedAuditContract && <div className="mb-5"><Link href={`/projects/${selectedAuditProject.id}/contracts/${selectedAuditContract.id}`} className="inline-flex items-center gap-2 rounded-lg border border-violet-300/15 bg-violet-300/[0.05] px-3 py-2 text-[10px] font-medium text-violet-200 hover:bg-violet-300/[0.1]"><Code2 size={13} /> Open source and contract inventory</Link></div>}
                <AuditResults audit={selectedAudit} contract={auditSourceIsCurrent ? selectedAuditContract : null} onApplyFix={() => auditSourceIsCurrent && selectedAuditProject && selectedAuditContract && applyLicenseFix(selectedAuditProject, selectedAuditContract)} />
              </>
            )}
          </>
        )
      )}

      {mode === 'reports' && (
        <>
          <PageIntro eyebrow="Export center" title="Reports" description="Download a scan report as JSON or Markdown, or print it to save as PDF." />
          {workspace.audits.length ? <Panel><div className="divide-y divide-white/[0.05]">{workspace.audits.map((audit) => <div key={audit.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FileText size={17} /></div><div className="min-w-0"><Link href={`/audits/${audit.id}`} className="block truncate text-xs font-medium text-slate-200 hover:text-cyan-200">{audit.contractName}</Link><div className="mt-1 text-[10px] text-slate-500">{audit.projectName} · {formatDate(audit.createdAt)} · {audit.findings.length} findings</div></div></div><div className="flex flex-wrap gap-2"><Button className="px-3 py-2 text-[10px]" onClick={() => exportReport(audit, 'json')}><FileJson2 size={13} /> JSON</Button><Button className="px-3 py-2 text-[10px]" onClick={() => exportReport(audit, 'md')}><FileText size={13} /> Markdown</Button><Link href={`/audits/${audit.id}`}><span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] px-3 py-2 text-[10px] font-medium text-slate-200 transition hover:bg-white/[0.07]"><ArrowDownToLine size={13} /> PDF / Print</span></Link></div></div>)}</div></Panel> : <EmptyState icon={FileText} title="No reports to export" description="Reports become available after you run a scan on a contract." action={<Link href="/projects"><span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/[0.05]">Browse projects <ArrowRight size={14} /></span></Link>} />}
        </>
      )}

      {mode === 'settings' && <SettingsPage settings={workspace.settings} onSave={(settings) => persist({ action: 'update_settings', settings })} />}

      {aiReviewTarget && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) setAiReviewTarget(null) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="ai-review-title" className="w-full max-w-lg rounded-2xl border border-violet-300/15 bg-[#0c1220] p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Sparkles size={18} /></div><h2 id="ai-review-title" className="mt-4 text-lg font-semibold text-white">Send source for AI review?</h2><p className="mt-2 text-xs leading-5 text-slate-400">This request sends <strong className="text-slate-200">{aiReviewTarget.contract.name}</strong> to OpenAI for analysis. OpenAI processes the source under its API terms and policies.</p></div>
            <button type="button" aria-label="Close dialog" disabled={busy} onClick={() => setAiReviewTarget(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white disabled:opacity-50"><X size={17} /></button>
          </div>
          <div role="status" className={`mt-4 rounded-lg border p-3 text-[11px] ${aiProviderStatus.state === 'ready' ? 'border-emerald-300/10 bg-emerald-300/[0.03] text-emerald-200' : 'border-white/[0.07] bg-white/[0.02] text-slate-400'}`}>
            {aiProviderStatus.state === 'checking' && 'Checking AI provider...'}
            {aiProviderStatus.state === 'ready' && `OpenAI key configured · ${aiProviderStatus.model}. Available quota is checked when the review runs.`}
            {aiProviderStatus.state === 'missing' && <>AI provider is not configured. Add <code className="text-violet-200">OPENAI_API_KEY</code> to <code className="text-violet-200">.env.local</code>, then restart the server.</>}
            {aiProviderStatus.state === 'error' && aiProviderStatus.model}
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] p-4 text-xs leading-5 text-slate-300"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-violet-300" /><span>Send this contract source to OpenAI for analysis. I authorize this request.</span></label>
          {aiReviewError && <p role="alert" className="mt-3 rounded-lg border border-rose-300/15 bg-rose-300/[0.05] p-3 text-[10px] leading-5 text-rose-200">{aiReviewError}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" disabled={busy} onClick={() => setAiReviewTarget(null)}>Cancel</Button><Button type="button" variant="primary" disabled={!aiConsent || busy || aiProviderStatus.state !== 'ready'} onClick={confirmAiReview}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Send and review</Button></div>
        </section>
      </div>}

      {modal && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false) }}><form onSubmit={createProject} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1220] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><FolderKanban size={19} /></div><h2 className="mt-4 text-lg font-semibold text-white">Create a project</h2><p className="mt-1 text-xs text-slate-500">Set up a workspace for your contracts.</p></div><button type="button" aria-label="Close dialog" onClick={() => setModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={17} /></button></div><label className="mt-6 block text-xs font-medium text-slate-300">Project name<input autoFocus required value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Treasury contracts" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40" /></label><label className="mt-4 block text-xs font-medium text-slate-300">Blockchain network<select value={network} onChange={(event) => setNetwork(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111827] px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-300/40">{['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon', 'BNB Chain', 'Other EVM'].map((item) => <option key={item}>{item}</option>)}</select></label><div className="mt-6 flex justify-end gap-2"><Button type="button" onClick={() => setModal(false)}>Cancel</Button><Button type="submit" variant="primary"><Plus size={14} /> Create project</Button></div></form></div>}
    </div>
  )
}

function ProjectRow({ project }) {
  return <Link href={`/projects/${project.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.025]"><div className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-cyan-200"><FolderKanban size={16} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-200">{project.name}</div><div className="mt-1 text-[10px] text-slate-500">{project.network} · {project.contracts?.length || 0} contracts</div></div><div className="hidden text-[10px] text-slate-500 sm:block">{formatDate(project.lastAuditAt || project.createdAt)}</div><ArrowUpRight size={14} className="text-slate-600" /></Link>
}

function ProjectCard({ project, auditCount, onDelete }) {
  const contracts = project.contracts?.length || 0
  return <article className="group rounded-2xl border border-white/[0.07] bg-[#0b101b] p-5 transition hover:border-cyan-300/20 hover:bg-[#0d1421]">
    <div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.06] text-cyan-200"><FolderKanban size={18} /></div><span className="flex items-center gap-1.5 rounded-full border border-emerald-300/10 bg-emerald-300/[0.05] px-2 py-1 text-[9px] text-emerald-200"><span className="h-1 w-1 rounded-full bg-emerald-300" /> Active</span></div>
    <h3 className="mt-5 truncate text-sm font-semibold text-white">{project.name}</h3><div className="mt-1 text-[11px] text-slate-500">{project.network} network</div>
    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4"><div><div className="text-[10px] text-slate-600">Contracts</div><div className="mt-1 text-xs text-slate-300">{contracts}</div></div><div><div className="text-[10px] text-slate-600">Scans</div><div className="mt-1 text-xs text-slate-300">{auditCount}</div></div></div>
    <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500"><span>Updated {formatDate(project.lastAuditAt || project.createdAt)}</span><span>{formatDate(project.createdAt)}</span></div>
    <div className="mt-4 flex gap-2">
      <Link href={`/projects/${project.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.09] px-3 py-2.5 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-300/[0.15]"><Eye size={13} /> View project</Link>
      <button type="button" onClick={onDelete} aria-label={`Delete ${project.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/10 px-3 py-2.5 text-[10px] text-rose-300/80 transition hover:border-rose-300/25 hover:bg-rose-300/[0.06] hover:text-rose-200"><Trash2 size={12} /> Delete</button>
    </div>
  </article>
}

function AuditRow({ audit }) {
  const actionable = audit.findings?.filter((item) => item.severity !== 'Info').length || 0
  return <Link href={`/audits/${audit.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.025]"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/[0.08] text-violet-200"><Shield size={16} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-200">{audit.contractName}</div><div className="mt-1 truncate text-[10px] text-slate-500">{audit.projectName} · {formatDate(audit.createdAt)}</div></div><div className="hidden text-right sm:block"><div className="text-xs text-slate-300">{actionable} flagged</div><div className="mt-1 text-[9px] text-slate-600">Pattern scan</div></div><ArrowUpRight size={14} className="shrink-0 text-slate-600" /></Link>
}

function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return <div className={`flex flex-col items-center text-center ${compact ? 'px-5 py-9' : 'px-6 py-14'}`}><div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.025] text-slate-500"><Icon size={19} /></div><h3 className="mt-4 text-xs font-medium text-slate-200">{title}</h3><p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div>
}

function MissingState({ title, backHref, backLabel }) {
  return <EmptyState icon={HelpCircle} title={title} description="It may have been removed or this link may be out of date." action={<Link href={backHref}><span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/[0.05]"><ArrowLeft size={14} /> {backLabel}</span></Link>} />
}

function FindingCard({ finding, onApplyFix }) {
  const [open, setOpen] = useState(false)
  return <Panel className="overflow-hidden"><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.035] text-slate-400"><ShieldAlert size={16} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Severity severity={finding.severity} /><span className="text-[10px] text-slate-500">Line {finding.line}</span></div><h3 className="mt-2 text-sm font-medium text-slate-100">{finding.title}</h3>{open && <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs leading-5 text-slate-400"><div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Recommendation</div>{finding.recommendation}</div>}</div><div className="flex gap-2 sm:justify-end"><Button className="px-3 py-2 text-[10px]" onClick={() => setOpen(!open)}>{open ? 'Hide details' : 'View fix'} <ChevronDown size={12} className={open ? 'rotate-180' : ''} /></Button>{finding.autoFixable && onApplyFix && <Button variant="primary" className="px-3 py-2 text-[10px]" onClick={onApplyFix}><Check size={12} /> Choose license</Button>}</div></div></Panel>
}

function ContractDetail({ project, contract, latestAudit, busy, onRun, onAiReview, onApplyFix, onDelete }) {
  const findings = latestAudit?.findings || []
  const reviewIsCurrent = !latestAudit?.createdAt || !contract.updatedAt ||
    new Date(latestAudit.createdAt).getTime() >= new Date(contract.updatedAt).getTime()
  const lines = (contract.source || '').split('\n')
  const inventory = getSourceInventory(contract.source || '')
  return <>
    <Link href={`/projects/${project.id}`} className="mb-5 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200"><ArrowLeft size={14} /> {project.name}</Link>
    <PageIntro eyebrow={`${project.network} · Contract source`} title={contract.name} description={`${Math.max(1, Math.ceil((contract.size || 0) / 1024))} KB · uploaded ${formatDate(contract.uploadedAt)}`}>
      <Button onClick={onDelete}><Trash2 size={14} /> Delete contract</Button>
      <Button onClick={onRun} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Pattern check</Button>
      <Button variant="primary" onClick={onAiReview} disabled={busy}><Sparkles size={14} /> AI review</Button>
    </PageIntro>
    <Panel className="mb-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xs font-semibold text-slate-200">Contract overview</h2><p className="mt-1 text-[9px] text-slate-500">Source inventory · text-based counts, not compiler analysis</p></div>
        <span className="rounded-full border border-violet-300/10 bg-violet-300/[0.05] px-2.5 py-1 text-[9px] text-violet-200">Solidity {inventory.pragma}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ['Lines', inventory.lines],
          ['Contracts / types', inventory.contracts],
          ['Functions', inventory.functions],
          ['Events', inventory.events],
          ['Modifiers', inventory.modifiers],
          ['Imports', inventory.imports],
          ['Source size', `${Math.max(1, Math.ceil(inventory.bytes / 1024))} KB`],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.05] bg-black/10 p-3"><div className="text-[9px] text-slate-500">{label}</div><div className="mt-1.5 text-sm font-semibold text-slate-200">{value}</div></div>)}
      </div>
    </Panel>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div className="flex items-center gap-2 text-xs text-slate-300"><FileCode2 size={14} className="text-violet-200" />{contract.name}</div><span className="rounded-md border border-white/[0.07] px-2 py-1 text-[9px] text-slate-500">Solidity source</span></div>
        <div className="max-h-[650px] overflow-auto bg-[#080b12] py-3 font-mono text-[11px] leading-[1.8]">{lines.map((line, index) => <div key={index} className="flex min-w-max px-4 hover:bg-white/[0.025]"><span className="mr-5 w-7 select-none text-right text-slate-700">{index + 1}</span><code className="whitespace-pre text-slate-300">{line || ' '}</code></div>)}</div>
      </Panel>
      <div><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Latest review</h2><p className="mt-1 text-[10px] text-slate-500">{findings.length} item{findings.length === 1 ? '' : 's'} to review</p></div><span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.05] px-2 py-1 text-[9px] text-cyan-200">{latestAudit?.scanType || 'Not reviewed'}</span></div>{latestAudit && !reviewIsCurrent && <p className="mb-3 rounded-lg border border-white/[0.06] p-3 text-[10px] leading-5 text-slate-500">Historical results · source changed after this review.</p>}{findings.length ? <div className="space-y-3">{findings.map((finding) => <div key={finding.id}><FindingCard finding={finding} onApplyFix={reviewIsCurrent && finding.autoFixable ? onApplyFix : undefined} /></div>)}</div> : <p className="rounded-xl border border-white/[0.06] p-4 text-[11px] leading-5 text-slate-500">No saved review for this contract yet. Run a pattern check or choose AI review.</p>}</div>
    </div>
  </>
}

function SettingsPage({ settings, onSave }) {
  const [name, setName] = useState(settings.displayName || '')
  const [email, setEmail] = useState(settings.email || '')
  const [accountUser, setAccountUser] = useState(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [notifications, setNotifications] = useState({
    inApp: settings.notifications?.inApp !== false,
    email: settings.notifications?.email === true,
    security: settings.notifications?.security !== false,
  })
  const [appearance, setAppearance] = useState(settings.appearance || 'dark')
  const [section, setSection] = useState('profile')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')
  const [profileError, setProfileError] = useState(false)
  const [securityStatus, setSecurityStatus] = useState('')
  const [securityError, setSecurityError] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaFactors, setMfaFactors] = useState([])
  const [totpSetup, setTotpSetup] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [appearanceStatus, setAppearanceStatus] = useState('')

  useEffect(() => {
    let active = true
    const loadAccount = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!active) return
        const user = sessionData.session?.user || null
        setAccountUser(user)
        if (user) {
          const { data, error } = await supabase.auth.getUser()
          if (error) throw error
          if (!active) return
          if (!data.user) throw new Error('Signed-in account could not be verified. Please sign in again.')
          setAccountUser(data.user)
          setName(data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '')
          setEmail(data.user.email || '')
          const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors()
          if (factorError) throw factorError
          if (active) setMfaFactors(factors.totp || [])
        }
      } catch (error) {
        console.error('Unable to load account settings.', error)
        if (active) setAccountError(error.message || 'Account details could not be loaded.')
      } finally {
        if (active) setAccountLoading(false)
      }
    }
    loadAccount()
    return () => { active = false }
  }, [])

  const markSaved = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  const save = async () => {
    setSaving(true)
    setProfileStatus('')
    setProfileError(false)
    try {
      const displayName = name.trim()
      if (!displayName) throw new Error('Enter a display name before saving.')
      let savedEmail = email.trim()
      if (accountUser) {
        const updates = {
          data: { ...accountUser.user_metadata, full_name: displayName },
        }
        const requestedEmail = email.trim()
        if (requestedEmail && requestedEmail !== accountUser.email) updates.email = requestedEmail
        const { data, error } = await getSupabaseClient().auth.updateUser(updates)
        if (error) throw error
        if (data.user) setAccountUser(data.user)
        savedEmail = data.user?.email || accountUser.email || ''
        if (requestedEmail && requestedEmail !== accountUser.email) {
          setEmail(savedEmail)
          setProfileStatus('Profile updated. Confirm the email change using the link sent to the new address.')
        } else {
          setProfileStatus('Your account profile was updated.')
        }
      } else {
        setProfileStatus('Browser profile saved. Sign in to update account details.')
      }
      if (!await onSave({
        ...settings,
        displayName,
        email: savedEmail,
        notifications,
        appearance,
      })) throw new Error('Settings could not be saved to your account.')
      markSaved()
    } catch (error) {
      console.error('Unable to save profile settings.', error)
      setProfileStatus(error.message || 'Profile changes could not be saved.')
      setProfileError(true)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setSecurityStatus('')
    setSecurityError(false)
    if (!accountUser) {
      setSecurityStatus('Sign in before changing an account password.')
      setSecurityError(true)
      return
    }
    if (newPassword.length < 8) {
      setSecurityStatus('Use at least 8 characters for the new password.')
      setSecurityError(true)
      return
    }
    if (newPassword !== confirmPassword) {
      setSecurityStatus('The new password and confirmation do not match.')
      setSecurityError(true)
      return
    }
    setSaving(true)
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      setSecurityStatus('Password updated for your signed-in account.')
    } catch (error) {
      console.error('Unable to update the account password.', error)
      setSecurityStatus(error.message || 'Password could not be updated.')
      setSecurityError(true)
    } finally {
      setSaving(false)
    }
  }

  const beginTotpSetup = async () => {
    setSecurityStatus('')
    setSecurityError(false)
    setSaving(true)
    try {
      const { data, error } = await getSupabaseClient().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'SolGuard AI',
      })
      if (error) throw error
      setTotpSetup({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
      setTotpCode('')
    } catch (error) {
      console.error('Unable to start authenticator setup.', error)
      setSecurityStatus(error.message || 'Authenticator setup could not be started.')
      setSecurityError(true)
    } finally {
      setSaving(false)
    }
  }

  const verifyTotpSetup = async (event) => {
    event.preventDefault()
    if (!totpSetup) return
    setSaving(true)
    setSecurityStatus('')
    setSecurityError(false)
    try {
      const { error } = await getSupabaseClient().auth.mfa.challengeAndVerify({
        factorId: totpSetup.id,
        code: totpCode.replace(/\s/g, ''),
      })
      if (error) throw error
      const { data, error: factorError } = await getSupabaseClient().auth.mfa.listFactors()
      if (factorError) throw factorError
      setMfaFactors(data.totp || [])
      setTotpSetup(null)
      setTotpCode('')
      setSecurityStatus('Authenticator verified and two-factor authentication is enabled.')
    } catch (error) {
      console.error('Unable to verify the authenticator code.', error)
      setSecurityStatus(error.message || 'The authenticator code could not be verified.')
      setSecurityError(true)
    } finally {
      setSaving(false)
    }
  }

  const removeTotpFactor = async (factorId) => {
    if (!window.confirm('Turn off this authenticator factor?')) return
    setSaving(true)
    setSecurityStatus('')
    setSecurityError(false)
    try {
      const { error } = await getSupabaseClient().auth.mfa.unenroll({ factorId })
      if (error) throw error
      setMfaFactors((factors) => factors.filter((factor) => factor.id !== factorId))
      setSecurityStatus('Authenticator removed from this account.')
    } catch (error) {
      console.error('Unable to remove the authenticator factor.', error)
      setSecurityStatus(error.message || 'Authenticator could not be removed.')
      setSecurityError(true)
    } finally {
      setSaving(false)
    }
  }

  const selectAppearance = async (value) => {
    setAppearance(value)
    setSaved(false)
    setAppearanceStatus('')
    if (await onSave({ ...settings, appearance: value })) {
      markSaved()
      setAppearanceStatus('Theme saved and applied.')
    } else {
      setAppearanceStatus('Theme could not be saved.')
    }
  }
  const verifiedMfaFactors = mfaFactors.filter((factor) => factor.status === 'verified')
  const sections = [
    { id: 'profile', label: 'Profile & account', icon: User },
    { id: 'security', label: 'Password & security', icon: LockKeyhole },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ]

  return <>
    <PageIntro eyebrow="Preferences" title="Settings" description="Manage your account, security, notifications, and appearance." />
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#0b101b] p-2 lg:h-fit lg:flex-col">
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => { setSection(id); setSaved(false) }} role="tab" aria-selected={section === id} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${section === id ? 'bg-cyan-300/[0.09] font-medium text-cyan-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}>
            <Icon size={16} className={section === id ? 'text-cyan-200' : 'text-slate-500'} />{label}
          </button>
        ))}
      </nav>

      <section role="tabpanel" className="min-w-0">
        {section === 'profile' && <Panel className="p-5 sm:p-6">
          <SettingsHeading icon={User} title="Profile & account" description="Manage the name and email address associated with this workspace." />
          {accountError && <p role="alert" className="mt-4 rounded-lg border border-rose-300/15 bg-rose-300/[0.05] p-3 text-[10px] text-rose-200">{accountError}</p>}
          <div className="mt-6 flex items-center gap-4 border-b border-white/[0.06] pb-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-base font-semibold text-cyan-100">{(name || 'AU').trim().slice(0, 2).toUpperCase()}</div>
            <div><div className="text-sm font-medium text-slate-100">{name || 'Auditor workspace'}</div><div className="mt-1 text-xs text-slate-500">{email || 'No email address added'}</div><div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] ${accountUser ? 'border-emerald-300/10 bg-emerald-300/[0.04] text-emerald-100/70' : 'border-amber-300/10 bg-amber-300/[0.04] text-amber-100/70'}`}>{accountLoading ? 'Checking account…' : accountUser ? 'Supabase account' : 'Browser profile'}</div></div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SettingsInput label="Display name" value={name} onChange={setName} placeholder="Your name or workspace" />
            <SettingsInput label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          </div>
          <SettingsNote className="mt-5">{accountUser ? 'Profile and preferences are stored in your Supabase account. Changing the email sends a confirmation link; your sign-in email stays the same until you confirm it.' : 'Sign in to update account details.'}</SettingsNote>
          {profileStatus && <p role="status" className={`mt-4 text-[10px] ${profileError ? 'text-rose-300' : 'text-emerald-300'}`}>{profileStatus}</p>}
        </Panel>}

        {section === 'security' && <div className="space-y-4">
          <Panel className="p-5 sm:p-6">
            <SettingsHeading icon={LockKeyhole} title="Password & security" description="Change your Supabase account password and manage an authenticator factor." />
            {!accountUser && <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-[11px] leading-5 text-amber-100/80">Sign in to manage password or authenticator security. <Link href="/login" className="ml-1 underline underline-offset-2">Go to sign in</Link></div>}
            <form onSubmit={changePassword} className="mt-5 rounded-xl border border-white/[0.06] p-4">
              <h3 className="text-xs font-medium text-slate-200">Change password</h3>
              <p className="mt-1 text-[10px] text-slate-500">Choose a new password with at least 8 characters.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SettingsInput label="New password" type="password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" />
                <SettingsInput label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" />
              </div>
              <Button type="submit" className="mt-4" disabled={!accountUser || saving}><LockKeyhole size={13} /> Update password</Button>
            </form>
            <div className="mt-4 rounded-xl border border-white/[0.06] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-xs font-medium text-slate-200">Authenticator app</h3><p className="mt-1 text-[10px] text-slate-500">Use a time-based one-time password (TOTP) app for two-factor authentication.</p></div>
                {verifiedMfaFactors.length > 0 ? <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.05] px-2.5 py-1 text-[9px] text-emerald-200">Enabled</span> : <Button onClick={beginTotpSetup} disabled={!accountUser || saving}><ShieldCheck size={13} /> Set up authenticator</Button>}
              </div>
              {verifiedMfaFactors.map((factor) => <div key={factor.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.05] px-3 py-2.5"><div><div className="text-[10px] font-medium text-slate-200">{factor.friendly_name || 'Authenticator app'}</div><div className="mt-1 text-[9px] text-slate-500">Verified two-factor method</div></div><Button onClick={() => removeTotpFactor(factor.id)} disabled={saving}><Trash2 size={12} /> Remove</Button></div>)}
              {totpSetup && <form onSubmit={verifyTotpSetup} className="mt-4 rounded-xl border border-violet-300/10 bg-violet-300/[0.035] p-4">
                <h4 className="text-[11px] font-medium text-slate-200">Connect your authenticator</h4>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Image src={totpSetup.qrCode} alt="Authenticator setup QR code" width={144} height={144} unoptimized className="h-36 w-36 rounded-lg bg-white p-2" />
                  <div className="min-w-0 flex-1"><p className="text-[10px] leading-5 text-slate-400">Scan this QR code or enter the setup key manually, then verify the 6-digit code from your authenticator app.</p><code className="mt-2 block break-all rounded-lg border border-white/[0.06] bg-black/20 p-2 text-[9px] text-violet-200">{totpSetup.secret}</code><label className="mt-3 block text-[10px] text-slate-300">Verification code<input required inputMode="numeric" autoComplete="one-time-code" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/40" /></label></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" variant="primary" disabled={saving || totpCode.trim().length < 6}><Check size={13} /> Verify and enable</Button><Button type="button" onClick={() => setTotpSetup(null)}>Cancel</Button></div>
              </form>}
              {securityStatus && <p role="status" className={`mt-3 text-[10px] ${securityError ? 'text-rose-300' : 'text-emerald-300'}`}>{securityStatus}</p>}
            </div>
          </Panel>
          <Panel className="p-5 sm:p-6">
            <SettingsHeading icon={ShieldCheck} title="Data & privacy" description="Understand where your project data is stored." />
            <SettingsNote className="mt-5">Projects, contract source, and scan results are stored in your Supabase account. An AI review sends the selected source to OpenAI after you authorize the request.</SettingsNote>
          </Panel>
        </div>}

        {section === 'notifications' && <Panel className="p-5 sm:p-6">
          <SettingsHeading icon={Bell} title="Notifications" description="Choose which workspace messages are enabled." />
          <div className="mt-5 divide-y divide-white/[0.06]">
            <SettingsToggle title="In-app messages" description="Show confirmations and validation messages while using the workspace." checked={notifications.inApp} onChange={(checked) => setNotifications((current) => ({ ...current, inApp: checked }))} />
            <div className="flex items-center justify-between gap-4 py-4 opacity-60"><div><div className="text-xs font-medium text-slate-300">Email notifications</div><div className="mt-1 text-[10px] text-slate-500">Email delivery is unavailable because no mail service is connected.</div></div><span className="rounded-full border border-white/[0.08] px-2 py-1 text-[9px] text-slate-500">Not configured</span></div>
          </div>
          <SettingsNote className="mt-3">In-app messages appear in the workspace and recent scans are listed from the bell menu. Preferences are saved to your Supabase profile. Email delivery and operating-system push notifications are not connected.</SettingsNote>
        </Panel>}

        {section === 'appearance' && <Panel className="p-5 sm:p-6">
          <SettingsHeading icon={Palette} title="Appearance" description="Choose how SolGuard AI looks in this browser." />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { id: 'light', title: 'Light', description: 'Bright surfaces', icon: Sun },
              { id: 'dark', title: 'Dark', description: 'Dim surfaces', icon: Moon },
              { id: 'system', title: 'System', description: 'Follow device', icon: Monitor },
            ].map(({ id, title, description, icon: Icon }) => (
              <button key={id} type="button" onClick={() => selectAppearance(id)} aria-pressed={appearance === id} className={`rounded-xl border p-4 text-left transition ${appearance === id ? 'border-cyan-300/35 bg-cyan-300/[0.07]' : 'border-white/[0.07] bg-white/[0.015] hover:border-white/15'}`}>
                <div className="flex items-center justify-between"><Icon size={17} className={appearance === id ? 'text-cyan-200' : 'text-slate-500'} />{appearance === id && <span className="text-[9px] font-medium text-cyan-200">Selected</span>}</div>
                <div className="mt-4 text-xs font-medium text-slate-200">{title}</div><div className="mt-1 text-[10px] text-slate-500">{description}</div>
              </button>
            ))}
          </div>
          <SettingsNote className="mt-5">Selecting a theme applies it across the workspace and saves it to your Supabase profile immediately.</SettingsNote>
          {appearanceStatus && <p role="status" className={`mt-3 text-[10px] ${appearanceStatus.includes('could not') ? 'text-rose-300' : 'text-emerald-300'}`}>{appearanceStatus}</p>}
        </Panel>}

        {(section === 'profile' || section === 'notifications') && <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={save} disabled={saving || (section === 'profile' && accountLoading)}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save changes</Button>
          {saved && <span role="status" className="text-xs text-emerald-300">{accountUser && section === 'profile' ? 'Account and workspace profile saved.' : 'Settings saved to your account.'}</span>}
        </div>}
      </section>
    </div>
  </>
}

function SettingsHeading({ icon: Icon, title, description }) {
  return <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Icon size={17} /></div><div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-1 text-[10px] text-slate-500">{description}</p></div></div>
}

function SettingsInput({ label, type = 'text', value, onChange, placeholder }) {
  return <label className="block text-xs font-medium text-slate-300">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /></label>
}

function SettingsNote({ children, className = '' }) {
  return <div className={`rounded-xl border border-white/[0.06] bg-black/20 p-4 text-[11px] leading-5 text-slate-400 ${className}`}>{children}</div>
}

function SettingsToggle({ title, description, checked, onChange }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 py-4"><span><span className="block text-xs font-medium text-slate-200">{title}</span><span className="mt-1 block text-[10px] leading-5 text-slate-500">{description}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 shrink-0 accent-cyan-300" /></label>
}
