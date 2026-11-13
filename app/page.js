import Link from 'next/link'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Braces, Check, ChevronRight,
  CircleDot, Clock3, Code2, Download, FileCode2, FileJson2, Fingerprint,
  FolderKanban, GitBranch, Sparkles, Terminal,
} from 'lucide-react'
import BrandMark from '../components/BrandMark'

const checks = [
  { severity: 'HIGH', name: 'tx.origin authorization pattern', location: 'Vault.sol · line 28', className: 'landing-severity-high' },
  { severity: 'REVIEW', name: 'Timestamp-dependent logic', location: 'Vault.sol · line 64', className: 'landing-severity-medium' },
  { severity: 'INFO', name: 'SPDX license header missing', location: 'Vault.sol · line 1', className: 'landing-severity-info' },
]

const features = [
  { icon: FolderKanban, eyebrow: '01 / ORGANIZE', title: 'Projects with context', description: 'Group Solidity files by project and EVM network so your review work stays easy to navigate.' },
  { icon: Code2, eyebrow: '02 / INSPECT', title: 'Readable source view', description: 'Open uploaded contracts with line numbers beside the findings that deserve a closer look.' },
  { icon: Fingerprint, eyebrow: '03 / CHECK', title: 'Focused pattern checks', description: 'Surface a small set of common Solidity patterns, with clear severity labels and review notes.' },
  { icon: Clock3, eyebrow: '04 / TRACE', title: 'A review trail', description: 'Keep scan summaries with each project and revisit previous results from audit history.' },
  { icon: FileJson2, eyebrow: '05 / SHARE', title: 'Portable reports', description: 'Export results as JSON or Markdown, or print a report to save it as a PDF.' },
  { icon: GitBranch, eyebrow: '06 / CONTROL', title: 'Visible code changes', description: 'Review suggested fixes before applying them; automatic edits are limited to an SPDX header.' },
]

const workflow = [
  ['Create a project', 'Choose a name and EVM network to give your contract review a home.'],
  ['Add Solidity source', 'Upload a .sol file and inspect it with a readable, numbered source view.'],
  ['Run a pattern check', 'Scan for a small set of known patterns and inspect each match in context.'],
  ['Review and export', 'Decide what needs attention, then save a JSON or Markdown summary.'],
]

const coverage = [
  ['Authorization', 'tx.origin usage'],
  ['Time dependence', 'block.timestamp usage'],
  ['External execution', 'delegatecall usage'],
  ['Low-level calls', 'call usage'],
  ['Source metadata', 'Missing SPDX header'],
]

export default function HomePage() {
  return (
    <main className="landing-page min-h-screen overflow-hidden text-slate-100">
      <header className="landing-header sticky top-0 z-30 border-b border-white/[0.06] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SolGuard AI home">
            <BrandMark className="landing-logo" />
            <span className="text-sm font-semibold tracking-tight text-white">SolGuard <span className="landing-brand-accent">AI</span></span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
            <a href="#product" className="landing-nav-link">Product</a>
            <a href="#workflow" className="landing-nav-link">Workflow</a>
            <a href="#coverage" className="landing-nav-link">Coverage</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="landing-nav-link rounded-lg px-2 py-2 sm:px-3">Sign in</Link>
            <Link href="/signup" className="landing-cta landing-cta-small">Get started <ArrowRight size={13} /></Link>
          </div>
        </div>
        <nav aria-label="Mobile main navigation" className="flex items-center justify-center gap-8 border-t border-white/[0.04] py-2.5 md:hidden">
          <a href="#product" className="landing-nav-link">Product</a>
          <a href="#workflow" className="landing-nav-link">Workflow</a>
          <a href="#coverage" className="landing-nav-link">Coverage</a>
        </nav>
      </header>

      <section className="landing-hero relative px-5 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20 lg:pt-24">
        <div className="landing-hero-glow landing-glow-one" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
          <div className="relative">
            <div className="landing-kicker mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-wide">
              <Sparkles size={13} /> Solidity review workspace
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl lg:text-[68px]">
              See the code.
              <span className="landing-headline-accent block">Question the risk.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              A focused workspace for Solidity projects, source review, and lightweight pattern checks—so you can see what to investigate next.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="landing-cta landing-cta-large">Create your workspace <ArrowRight size={15} /></Link>
              <a href="#product" className="landing-secondary-cta">Explore the workspace <ArrowDownRight size={15} /></a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-2"><Braces size={13} className="landing-icon-accent" /> Solidity-first</span>
              <span className="inline-flex items-center gap-2"><CircleDot size={12} className="landing-icon-accent" /> Browser-based checks</span>
              <span className="inline-flex items-center gap-2"><Download size={13} className="landing-icon-accent" /> JSON &amp; Markdown</span>
            </div>
          </div>

          <div className="landing-review relative mx-auto w-full max-w-[620px]">
            <div className="landing-review-orbit" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-2xl border border-violet-200/[0.12] bg-[#130c20]/95 shadow-2xl shadow-black/30">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-violet-300/15 bg-violet-300/[0.08] text-violet-200"><FileCode2 size={15} /></div>
                  <div><div className="text-[11px] font-medium text-slate-200">Vault.sol</div><div className="mt-0.5 text-[9px] text-slate-500">Example review · Ethereum</div></div>
                </div>
                <span className="rounded-full border border-orange-300/15 bg-orange-300/[0.07] px-2.5 py-1 text-[9px] text-orange-200">Illustrative preview</span>
              </div>
              <div className="grid md:grid-cols-[.78fr_1.22fr]">
                <div className="border-b border-white/[0.06] bg-[#100a1b] p-4 font-mono text-[9px] leading-6 text-slate-500 md:border-b-0 md:border-r sm:p-5">
                  <div className="mb-3 flex items-center gap-2 font-sans text-[9px] uppercase tracking-[0.14em] text-slate-600"><Terminal size={12} /> Source excerpt</div>
                  <div><span className="mr-3 text-slate-700">26</span><span className="text-violet-300">function</span> withdraw() {'{'}</div>
                  <div><span className="mr-3 text-slate-700">27</span>  <span className="text-violet-300">require</span>(</div>
                  <div className="rounded bg-orange-300/[0.09] px-1 text-orange-100"><span className="mr-3 text-orange-200/50">28</span>    tx.origin == owner</div>
                  <div><span className="mr-3 text-slate-700">29</span>  );</div>
                  <div><span className="mr-3 text-slate-700">30</span>  _transfer(msg.sender);</div>
                  <div><span className="mr-3 text-slate-700">31</span>{'}'}</div>
                  <div className="mt-5 flex items-center gap-2 text-[9px] text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-orange-300" /> Pattern match · line 28</div>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div><div className="text-[11px] font-medium text-slate-200">Items to review</div><div className="mt-1 text-[9px] text-slate-500">Solidity pattern analysis</div></div>
                    <div className="text-2xl font-semibold tracking-tight text-white">03</div>
                  </div>
                  <div className="space-y-2">
                    {checks.map((check) => (
                      <div key={check.name} className="flex items-center gap-2.5 rounded-lg border border-white/[0.055] bg-white/[0.018] px-2.5 py-2.5">
                        <span className={`landing-severity ${check.className}`}>{check.severity}</span>
                        <div className="min-w-0 flex-1"><div className="truncate text-[9px] font-medium text-slate-300">{check.name}</div><div className="mt-1 text-[8px] text-slate-600">{check.location}</div></div>
                        <ChevronRight size={13} className="shrink-0 text-slate-600" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="relative mt-3 text-right text-[9px] text-slate-600">Illustrative interface · results shown are examples</div>
          </div>
        </div>
      </section>

      <section aria-label="Workspace capabilities" className="px-5 pb-14 sm:px-8 sm:pb-20">
        <div className="landing-capability-strip mx-auto grid max-w-7xl grid-cols-2 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {[
            ['01', 'Solidity', 'Source files'],
            ['05', 'Pattern checks', 'Focused heuristics'],
            ['02', 'Report formats', 'JSON and Markdown'],
            ['EVM', 'Project networks', 'Network-aware setup'],
          ].map(([value, title, caption]) => (
            <div key={title} className="px-4 py-4 sm:px-6 sm:py-5">
              <div className="font-mono text-[10px] text-orange-200">{value}</div>
              <div className="mt-2 text-xs font-medium text-slate-200">{title}</div>
              <div className="mt-1 text-[9px] text-slate-500">{caption}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="scroll-mt-24 border-t border-white/[0.06] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-[.8fr_1.2fr] md:items-end">
            <div>
              <div className="landing-section-label">The workspace</div>
              <h2 className="mt-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">A clearer path from source to review.</h2>
            </div>
            <p className="max-w-xl text-xs leading-6 text-slate-400 md:justify-self-end sm:text-sm">
              Keep the essentials close: your projects, source files, pattern-check results, and portable reports—all in one considered workflow.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, eyebrow, title, description }) => (
              <article key={title} className="landing-feature-card rounded-2xl border border-white/[0.07] bg-[#120b1d] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[0.06] text-violet-200"><Icon size={18} /></span>
                  <span className="font-mono text-[8px] tracking-[0.12em] text-slate-600">{eyebrow}</span>
                </div>
                <h3 className="mt-7 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24 border-t border-white/[0.06] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20">
          <div className="max-w-md">
            <div className="landing-section-label">A practical sequence</div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">From first file to informed next step.</h2>
            <p className="mt-4 text-xs leading-6 text-slate-400 sm:text-sm">Use the scan as a starting point for code review—not as a verdict on contract safety.</p>
            <Link href="/signup" className="landing-inline-link mt-6 inline-flex items-center gap-2 text-xs font-medium">Start a project <ArrowUpRight size={14} /></Link>
          </div>
          <div className="landing-steps divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {workflow.map(([title, description], index) => (
              <div key={title} className="flex items-start gap-4 py-5 sm:gap-6">
                <span className="pt-0.5 font-mono text-[10px] text-orange-200">0{index + 1}</span>
                <div className="flex-1 sm:flex sm:items-center sm:justify-between sm:gap-8">
                  <h3 className="text-xs font-medium text-slate-200">{title}</h3>
                  <p className="mt-1 max-w-sm text-[10px] leading-5 text-slate-500 sm:mt-0">{description}</p>
                </div>
                <Check size={14} className="mt-0.5 text-violet-300/70" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="coverage" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
        <div className="landing-coverage mx-auto grid max-w-7xl gap-8 rounded-3xl border border-violet-300/[0.11] p-6 sm:p-9 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
          <div>
            <div className="landing-section-label">Scope, made clear</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Know what gets checked—and what doesn’t.</h2>
            <p className="mt-4 text-xs leading-6 text-slate-400">
              Pattern checks run on the server. AI review sends the selected source to OpenAI after you authorize the request.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {coverage.map(([title, detail], index) => (
              <div key={title} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#100a1a]/70 p-3.5">
                <span className="font-mono text-[9px] text-violet-300">0{index + 1}</span>
                <div className="min-w-0"><div className="text-[10px] font-medium text-slate-200">{title}</div><div className="mt-1 font-mono text-[9px] text-slate-500">{detail}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 pt-4 sm:px-8 sm:pb-24">
        <div className="landing-final-cta mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-2xl border border-orange-300/[0.12] p-6 sm:flex-row sm:items-center sm:p-9">
          <div>
            <div className="landing-section-label">Start with the code</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">Give your next review a better workspace.</h2>
          </div>
          <Link href="/signup" className="landing-cta landing-cta-large">Create an account <ArrowRight size={15} /></Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="landing-logo landing-logo-small" />
            <span className="text-xs font-semibold tracking-tight text-slate-300">SolGuard <span className="landing-brand-accent">AI</span></span>
          </Link>
          <p className="text-[9px] leading-4 text-slate-600">Browser-based pattern checks are a starting point, not a substitute for an independent security audit.</p>
          <div className="flex items-center gap-4 text-[10px] text-slate-500"><Link href="/login" className="hover:text-white">Sign in</Link><Link href="/signup" className="hover:text-white">Create account</Link></div>
        </div>
      </footer>
    </main>
  )
}
