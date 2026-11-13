'use client'

import { useMemo, useState } from 'react'
import {
  BookOpen, Check, ChevronDown, Code2, Flame, Gauge, Search, ShieldAlert,
  Sparkles, Wrench,
} from 'lucide-react'

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info']
const SEVERITY_STYLES = {
  Critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  High: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  Medium: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  Low: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  Info: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
}

function inventory(source = '') {
  const count = (pattern) => [...source.matchAll(pattern)].length
  return {
    lines: source ? source.split(/\r?\n/).length : 0,
    contracts: count(/\b(?:contract|interface|library)\s+[A-Za-z_$][\w$]*/g),
    functions: count(/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g),
    events: count(/\bevent\s+[A-Za-z_$][\w$]*\s*\(/g),
    modifiers: count(/\bmodifier\s+[A-Za-z_$][\w$]*\s*\(/g),
    stateVariables: count(/\b(?:uint(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|address|bool|string|bytes(?:\d+)?|mapping\s*\([^;]*?\))\s+(?:(?:public|private|internal|constant|immutable)\s+)*[A-Za-z_$][\w$]*\s*(?:=|;)/g),
  }
}

function Panel({ children, className = '' }) {
  return <section className={`rounded-2xl border border-white/[0.07] bg-[#0b101b] ${className}`}>{children}</section>
}

function Severity({ value }) {
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${SEVERITY_STYLES[value] || SEVERITY_STYLES.Info}`}>{value || 'Info'}</span>
}

function sourceExcerpt(source, line) {
  if (!source || !Number.isInteger(line) || line < 1) return ''
  return source.split(/\r?\n/)[line - 1] || ''
}

function findingCategory(finding) {
  const text = `${finding.title} ${finding.recommendation}`.toLowerCase()
  if (/reentr|call|delegatecall|transfer|send/.test(text)) return 'External calls'
  if (/access|authorization|owner|role|origin/.test(text)) return 'Access control'
  if (/timestamp|random/.test(text)) return 'Time dependence'
  if (/overflow|arithmetic/.test(text)) return 'Arithmetic'
  if (/license|spdx/.test(text)) return 'Metadata'
  return 'Review'
}

function findingSource(audit, contract) {
  const source = contract?.source || ''
  const findings = Array.isArray(audit.findings) ? audit.findings : []
  const savedAnalysis = audit.analysis || {}
  const severityCounts = SEVERITIES.map((severity) => ({
    severity,
    count: findings.filter((finding) => finding.severity === severity).length,
  }))
  const metrics = inventory(source)
  const score = Math.min(100, findings.reduce((total, finding) => total + (
    { Critical: 40, High: 25, Medium: 12, Low: 5 }[finding.severity] || 0
  ), 0))
  const sourceLines = source.split(/\r?\n/)
  const detectedGasSuggestions = []

  if (source && /\b(?:for|while)\s*\(/.test(source)) {
    detectedGasSuggestions.push({
      title: 'Review loop storage access',
      description: 'Loops are present. Check whether each iteration reads or writes state unnecessarily, and compare optimized alternatives with compiler gas reports.',
      line: sourceLines.findIndex((line) => /\b(?:for|while)\s*\(/.test(line)) + 1,
    })
  }
  if (source && metrics.stateVariables > 1) {
    detectedGasSuggestions.push({
      title: 'Review storage layout',
      description: `${metrics.stateVariables} state-variable declarations were detected by a text scan. Check declaration order and storage packing with compiler storage-layout output; no savings are estimated here.`,
      line: null,
    })
  }

  const detectedBestPractices = []
  if (source && !/^\s*\/\/\s*SPDX-License-Identifier:/m.test(source)) {
    detectedBestPractices.push({
      title: 'Add an SPDX license identifier',
      detail: 'The source does not begin with an SPDX-License-Identifier comment.',
      status: 'Needs review',
    })
  }
  if (source && !/^\s*pragma\s+solidity\s+[^;]+;/m.test(source)) {
    detectedBestPractices.push({
      title: 'Declare the Solidity compiler version',
      detail: 'No Solidity pragma was detected. Pin or constrain the compiler version used for reproducible builds.',
      status: 'Needs review',
    })
  }
  if (source && /\.\s*(?:call|delegatecall|staticcall)\s*(?:\{|\()/.test(source)) {
    detectedBestPractices.push({
      title: 'Review low-level external calls',
      detail: 'Low-level calls were found. Verify target trust, success handling, state-update ordering, and reentrancy protections in context.',
      status: 'Review',
    })
  }
  if (source && metrics.events === 0 && metrics.contracts > 0) {
    detectedBestPractices.push({
      title: 'Check event coverage',
      detail: 'No event declarations were detected. Confirm important state changes are observable to off-chain consumers where appropriate.',
      status: 'Suggestion',
    })
  }
  for (const finding of findings) {
    const category = findingCategory(finding)
    if (!detectedBestPractices.some((practice) => practice.title === `Review ${category.toLowerCase()}`)) {
      detectedBestPractices.push({
        title: `Review ${category.toLowerCase()}`,
        detail: finding.recommendation,
        status: 'Finding',
      })
    }
  }

  return {
    source,
    severityCounts,
    metrics: { ...metrics, ...(savedAnalysis.metrics || {}) },
    score,
    gasOpportunities: Array.isArray(savedAnalysis.gasSuggestions) ? savedAnalysis.gasSuggestions : detectedGasSuggestions,
    bestPractices: Array.isArray(savedAnalysis.bestPractices) ? savedAnalysis.bestPractices : detectedBestPractices,
  }
}

export default function AuditResults({ audit, contract, onApplyFix }) {
  const [tab, setTab] = useState('Overview')
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('All severities')
  const [expanded, setExpanded] = useState({})
  const data = useMemo(() => findingSource(audit, contract), [audit, contract])
  const findings = audit.findings || []
  const filteredFindings = findings.filter((finding) => {
    const matchesText = `${finding.title} ${finding.recommendation} ${findingCategory(finding)}`.toLowerCase().includes(query.toLowerCase())
    return matchesText && (severityFilter === 'All severities' || finding.severity === severityFilter)
  })
  const hasSpdxIdentifier = /^\s*\/\/\s*SPDX-License-Identifier:/m.test(data.source)
  const patchableFindings = findings.filter((finding) => finding.autoFixable && contract && !hasSpdxIdentifier)
  const tabs = [
    { name: 'Overview', icon: Gauge },
    { name: 'Vulnerabilities', icon: ShieldAlert, count: findings.length },
    { name: 'Gas', icon: Flame, count: data.gasOpportunities.length },
    { name: 'Best Practices', icon: BookOpen },
    { name: 'Patches', icon: Wrench, count: patchableFindings.length },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Panel className="p-4"><div className="text-[10px] text-slate-500">Priority score</div><div className="mt-2 text-2xl font-semibold text-cyan-200">{data.score}<span className="ml-1 text-xs text-slate-600">/ 100</span></div></Panel>
        {data.severityCounts.filter(({ severity }) => severity !== 'Info').map(({ severity, count }) => <Panel key={severity} className="p-4"><div className="flex items-center justify-between"><div className="text-[10px] text-slate-500">{severity}</div><Severity value={severity} /></div><div className="mt-2 text-2xl font-semibold text-white">{count}</div><div className="mt-1 text-[9px] text-slate-600">Findings to verify</div></Panel>)}
      </div>

      <Panel className="overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] p-2">
          {tabs.map(({ name, icon: Icon, count }) => <button key={name} type="button" onClick={() => setTab(name)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[10px] transition ${tab === name ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}><Icon size={13} />{name}{count > 0 && <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px]">{count}</span>}</button>)}
        </div>

        {tab === 'Overview' && <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-white/[0.05] bg-black/10 p-4">
            <h2 className="text-xs font-semibold text-slate-200">Finding distribution</h2>
            <div className="mt-4 flex flex-wrap gap-2">{data.severityCounts.map(({ severity, count }) => <div key={severity} className="flex min-w-[92px] flex-1 items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2"><Severity value={severity} /><span className="text-xs text-slate-300">{count}</span></div>)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-black/10 p-4">
            <h2 className="text-xs font-semibold text-slate-200">Code metrics</h2>
            <p className="mt-1 text-[9px] text-slate-500">Text-based inventory; not compiler analysis.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{[
              ['Total lines', data.metrics.lines],
              ['Contracts / types', data.metrics.contracts],
              ['Functions', data.metrics.functions],
              ['Events', data.metrics.events],
              ['Modifiers', data.metrics.modifiers],
              ['State vars*', data.metrics.stateVariables],
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[0.05] p-2.5"><div className="text-[9px] text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-200">{value}</div></div>)}</div>
            <p className="mt-2 text-[9px] text-slate-600">*State variable count is an approximate text scan.</p>
          </div>
          {audit.summary && <div className="rounded-xl border border-white/[0.05] bg-black/10 p-4 lg:col-span-2"><h2 className="text-xs font-semibold text-slate-200">Summary</h2><p className="mt-2 text-xs leading-6 text-slate-400">{audit.summary}</p></div>}
        </div>}

        {tab === 'Vulnerabilities' && <div className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search findings..." className="w-full rounded-lg border border-white/[0.08] bg-black/15 py-2.5 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/30" /></label>
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded-lg border border-white/[0.08] bg-[#0c1220] px-3 py-2.5 text-xs text-slate-300 outline-none"><option>All severities</option>{SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}</select>
          </div>
          <p className="mt-3 text-[10px] text-slate-500">Showing {filteredFindings.length} of {findings.length} findings.</p>
          <div className="mt-3 space-y-2">{filteredFindings.map((finding, index) => {
            const key = finding.id || `${finding.title}-${index}`
            const isExpanded = Boolean(expanded[key])
            const excerpt = sourceExcerpt(data.source, finding.line)
            return <article key={key} className="rounded-xl border border-white/[0.06] bg-black/10">
              <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))} className="flex w-full items-center gap-3 p-3 text-left">
                <Severity value={finding.severity} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-slate-200">{finding.title}</span><span className="mt-1 block text-[9px] text-slate-500">{findingCategory(finding)} · Line {finding.line || 1}</span></span>
                <ChevronDown size={14} className={`shrink-0 text-slate-500 transition ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && <div className="border-t border-white/[0.05] p-4">
                {excerpt && <pre className="mb-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20 p-3 text-[10px] leading-5 text-slate-300"><code>{`${finding.line}: ${excerpt}`}</code></pre>}
                <div className="text-[9px] font-semibold uppercase tracking-wider text-cyan-200">Recommendation</div><p className="mt-1 text-[11px] leading-5 text-slate-400">{finding.recommendation}</p>
              </div>}
            </article>
          })}{filteredFindings.length === 0 && <p className="rounded-lg border border-white/[0.05] p-4 text-xs text-slate-500">No findings match these filters.</p>}</div>
        </div>}

        {tab === 'Gas' && <div className="space-y-3 p-4">
          {data.gasOpportunities.map((item) => <div key={`${item.title}-${item.line}`} className="rounded-xl border border-white/[0.06] p-4"><div className="flex items-center gap-2 text-[11px] font-medium text-slate-200"><Flame size={14} className="text-amber-300" />{item.title}</div><p className="mt-2 text-[10px] leading-5 text-slate-500">{item.detail || item.description}</p>{item.line && <div className="mt-2 text-[9px] text-slate-600">Potential location · line {item.line}</div>}</div>)}
          {data.gasOpportunities.length === 0 && <p className="rounded-xl border border-white/[0.06] p-4 text-[11px] leading-5 text-slate-500">No gas suggestions were generated for this contract.</p>}
        </div>}

        {tab === 'Best Practices' && <div className="space-y-2 p-4">
          {data.bestPractices.map((practice) => <div key={practice.title} className="rounded-xl border border-white/[0.06] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[11px] font-medium text-slate-200">{practice.title}</h3><span className="rounded-full border border-white/[0.07] px-2 py-1 text-[9px] text-slate-500">{practice.status || 'AI suggestion'}{practice.line ? ` · line ${practice.line}` : ''}</span></div><p className="mt-2 text-[10px] leading-5 text-slate-500">{practice.detail}</p></div>)}
          {data.bestPractices.length === 0 && <p className="rounded-xl border border-white/[0.06] p-4 text-[11px] text-slate-500">No additional best-practice prompts were generated for this source.</p>}
        </div>}

        {tab === 'Patches' && <div className="space-y-3 p-4">
          {patchableFindings.map((finding) => <div key={finding.id || finding.title} className="flex flex-col gap-3 rounded-xl border border-white/[0.06] p-4 sm:flex-row sm:items-center"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-300/[0.08] text-violet-200"><Code2 size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Severity value={finding.severity} /><h3 className="text-[11px] font-medium text-slate-200">{finding.title}</h3></div><p className="mt-2 text-[10px] leading-5 text-slate-500">{finding.recommendation}</p><pre className="mt-2 overflow-x-auto rounded-lg border border-white/[0.05] bg-black/20 p-2 text-[10px] leading-5 text-emerald-200"><code>{'+ // SPDX-License-Identifier: <your-license-id>'}</code></pre><p className="mt-1 text-[9px] text-slate-600">Choose the license that actually applies before saving this change.</p></div><button type="button" disabled={!onApplyFix} onClick={onApplyFix} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"><Check size={12} />Choose license and apply</button></div>)}
          {patchableFindings.length === 0 && <div className="rounded-xl border border-white/[0.06] p-4"><p className="text-[11px] text-slate-300">No deterministic fixes are available for this report.</p><p className="mt-2 text-[10px] leading-5 text-slate-500">Recommendations for other findings are available under Vulnerabilities. No replacement code is generated or applied automatically.</p></div>}
        </div>}
      </Panel>
    </div>
  )
}
