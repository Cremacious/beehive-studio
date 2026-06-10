import Link from 'next/link'

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)

const ArrowIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
)

const LogoMark = () => (
  <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand/15 border border-brand/30">
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
      <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none"/>
    </svg>
  </span>
)

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <div className="min-h-screen bg-[#141414] text-white scrollbar-custom">

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 backdrop-blur bg-[#141414]/80 border-b border-border/70">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <LogoMark />
            <span className="mainFont font-bold text-[17px] tracking-tight">Beehive Studio</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[14px]">
            <a href="#studio" className="text-white/75 hover:text-white transition-colors">Studio</a>
            <a href="#hive" className="text-white/75 hover:text-white transition-colors">Hive</a>
            <a href="#discover" className="text-white/75 hover:text-white transition-colors">Discover</a>
            <span className="w-px h-5 bg-border"/>
            <Link href={`/${locale}/sign-in`} className="text-white/75 hover:text-white transition-colors">Sign in</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/sign-in`} className="hidden sm:inline-flex md:hidden text-white/75 hover:text-white transition-colors text-sm">Sign in</Link>
            <Link
              href={`/${locale}/sign-up`}
              className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full px-4 py-2 text-sm inline-flex items-center gap-1.5 shadow-[0_6px_24px_-8px_rgba(255,195,0,0.5)] hover:bg-brand-hover hover:-translate-y-px transition-all"
            >
              Start writing
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-glow pointer-events-none"/>
        <div className="absolute inset-0 hex-bg opacity-60 pointer-events-none [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent_75%)]"/>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-16 lg:pt-24 pb-20 grid lg:grid-cols-12 gap-12 items-center">
          {/* Left: copy */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-white/70 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"/>
              Now in open beta. Hive 1.0 just shipped
            </div>

            <h1 className="mainFont font-bold text-[44px] sm:text-[56px] lg:text-[64px] leading-[1.04] tracking-tight text-balance">
              Craft your story.<br/>
              Grow your <span className="text-brand">hive</span>.
            </h1>

            <p className="mt-6 text-[17px] lg:text-[18px] leading-relaxed text-white/70 max-w-xl text-pretty">
              The professional writing studio where authors write, collaborate, and publish to a community of readers. Drafting, planning, and feedback, all in one warm, focused workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/sign-up`}
                className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full px-6 py-3 text-[15px] inline-flex items-center gap-2 shadow-[0_6px_24px_-8px_rgba(255,195,0,0.5)] hover:bg-brand-hover hover:-translate-y-px transition-all"
              >
                Start writing free
                <ArrowIcon />
              </Link>
              <a
                href="#discover"
                className="rounded-full px-5 py-3 text-[15px] inline-flex items-center gap-2 border border-border text-white hover:border-brand/50 hover:text-brand hover:bg-brand/[0.04] transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Explore stories
              </a>
            </div>

            <div className="mt-10 flex items-center gap-5 text-xs text-white/50">
              <div className="flex items-center gap-2"><CheckIcon/>Free forever for solo writers</div>
              <div className="flex items-center gap-2"><CheckIcon/>No credit card</div>
              <div className="hidden sm:flex items-center gap-2"><CheckIcon/>Export EPUB / PDF / DOCX</div>
            </div>
          </div>

          {/* Right: Studio preview mock */}
          <div className="lg:col-span-6">
            <div className="relative">
              {/* Floating chips */}
              <div className="absolute -top-3 -left-3 z-20 hidden md:flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-[11px] font-medium shadow-lg">
                <span className="w-2 h-2 rounded-full bg-green-400"/>
                <span className="text-white/80">Maya is editing Chapter 3</span>
              </div>
              <div className="absolute -bottom-4 -right-3 z-20 hidden md:flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-[11px] font-medium shadow-lg">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-brand" fill="currentColor">
                  <path d="M12 2l2.39 7.36H22l-6.19 4.5L18.2 21 12 16.5 5.8 21l2.39-7.14L2 9.36h7.61z"/>
                </svg>
                <span className="text-white/80">+148 words / 1,200 goal</span>
              </div>

              {/* Window chrome */}
              <div className="bg-card rounded-2xl paper-stack overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3a3a3a]"/>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3a3a3a]"/>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3a3a3a]"/>
                  <div className="ml-3 flex-1 flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span className="text-[12px] text-white/50 font-medium">studio · The Cartographer&apos;s Wife</span>
                  </div>
                  <span className="text-[10px] text-white/40 hidden sm:inline">Auto-saved 2s ago</span>
                </div>

                <div className="grid grid-cols-[160px_1fr] min-h-[420px]">
                  {/* Sidebar */}
                  <aside className="border-r border-border bg-[#191919] py-3 px-2 text-[12px]">
                    <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-white/40 font-semibold">Manuscript</div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded text-white/70">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                        <span>Part I: Salt</span>
                      </div>
                      <div className="ml-4 space-y-0.5">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-white/60 hover:bg-white/5">
                          <span className="text-white/30 tabular-nums text-[10px]">01</span>
                          <span>The signal</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-white/60 hover:bg-white/5">
                          <span className="text-white/30 tabular-nums text-[10px]">02</span>
                          <span>Low tide</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-brand/10 text-brand">
                          <span className="text-brand/70 tabular-nums text-[10px]">03</span>
                          <span className="font-medium">Cartography</span>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-white/40 hover:bg-white/5">
                          <span className="text-white/30 tabular-nums text-[10px]">04</span>
                          <span className="italic">Drafting…</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded text-white/70 mt-2">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>
                        <span>Part II: Compass</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded text-white/70">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>
                        <span>Research</span>
                      </div>
                    </div>
                  </aside>

                  {/* Editor pane */}
                  <div className="p-6 lg:p-7 relative">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Chapter 03</div>
                        <h3 className="mainFont font-bold text-[20px] mt-0.5">Cartography</h3>
                      </div>
                      <div className="flex items-center -space-x-1.5">
                        <span className="w-6 h-6 rounded-full bg-brand/20 border border-[#141414] flex items-center justify-center text-[10px] font-bold text-brand">M</span>
                        <span className="w-6 h-6 rounded-full bg-[#3a3a3a] border border-[#141414] flex items-center justify-center text-[10px] font-bold text-white/80">R</span>
                        <span className="w-6 h-6 rounded-full bg-[#3a3a3a] border border-[#141414] flex items-center justify-center text-[10px] font-bold text-white/80">J</span>
                      </div>
                    </div>

                    <div className="font-[family-name:var(--font-fraunces)] text-white/88 text-[14px] lg:text-[15px] leading-[1.75] space-y-3">
                      <p>She mapped the harbour the way other people kept a diary: in tide marks, in the slant of mast shadows, in the small inaccuracies the sea forgave each morning.</p>
                      <p>The lighthouse was not where the charts said it was. It had not been there for forty years, but she still drew it in, faintly, in pencil that she could erase if anyone <span className="bg-brand/15 text-white px-0.5 rounded-sm">official</span> ever asked.</p>
                      <p>By Tuesday the fog had a name and a temperament. By Thursday it had moved in.<span className="caret"/></p>
                    </div>

                    {/* Inline comment */}
                    <div className="absolute right-5 top-28 hidden md:block w-44">
                      <div className="bg-[#252525] border border-border rounded-xl p-3 text-[11px] paper-stack">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center text-[9px] font-bold text-brand">R</span>
                          <span className="font-semibold text-white">Rin</span>
                          <span className="text-white/40 text-[10px]">2m</span>
                        </div>
                        <p className="text-white/80 leading-snug">Love this opening. Feels like the harbour is a character. Keep &quot;forgave&quot;?</p>
                      </div>
                    </div>

                    {/* Status bar */}
                    <div className="absolute left-7 right-7 bottom-4 flex items-center justify-between text-[10px] text-white/40">
                      <div className="flex items-center gap-3 tabular-nums">
                        <span>1,348 words</span>
                        <span>·</span>
                        <span>5 min read</span>
                        <span>·</span>
                        <span className="text-brand">3 comments</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                        <span>Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE COLUMNS ── */}
      <section id="studio" className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-28">
        <div className="max-w-2xl mb-14">
          <div className="text-brand text-[12px] font-semibold tracking-[0.16em] uppercase mb-3">Three rooms, one studio</div>
          <h2 className="mainFont font-bold text-[36px] lg:text-[44px] leading-tight tracking-tight">
            Everything a writer needs.<br/>
            Nothing they don&apos;t.
          </h2>
          <p className="mt-5 text-white/65 text-[16px] leading-relaxed max-w-xl">
            Beehive is built around how books actually get written: heads-down drafting, the occasional second pair of eyes, and a reader at the end of the tunnel.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {/* Studio */}
          <article className="paper-stack paper-stack-hover bg-card rounded-2xl p-7 group">
            <div className="flex items-center justify-between mb-6">
              <span className="inline-flex w-11 h-11 rounded-xl bg-brand/[0.12] border border-brand/25 items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h5"/>
                </svg>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold tabular-nums">01 · Write</span>
            </div>
            <h3 className="mainFont font-bold text-[24px] mb-2">Studio</h3>
            <p className="text-white/65 text-[14.5px] leading-relaxed mb-6">
              A Scrivener-style workspace for long-form. Chapters, scenes, collections, research, all drafted in a calm, distraction-free editor that auto-saves every keystroke.
            </p>
            <div className="bg-[#171717] rounded-xl border border-border p-3 mb-5">
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between px-2 py-1.5 rounded bg-brand/10 text-brand">
                  <span className="flex items-center gap-2"><span className="tabular-nums text-[10px] text-brand/60">03</span>Cartography</span>
                  <span className="tabular-nums text-[10px]">1,348</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded text-white/55">
                  <span className="flex items-center gap-2"><span className="tabular-nums text-[10px] text-white/30">04</span>Drafting…</span>
                  <span className="tabular-nums text-[10px]">274</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 rounded text-white/55">
                  <span className="flex items-center gap-2"><span className="tabular-nums text-[10px] text-white/30">05</span>Tin coast</span>
                  <span className="tabular-nums text-[10px]">2,011</span>
                </div>
              </div>
            </div>
            <ul className="space-y-2 text-[13px] text-white/65">
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Outline, scene, and wiki views</li>
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Word goals & daily streaks</li>
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Import DOCX · export EPUB</li>
            </ul>
          </article>

          {/* Hive */}
          <article id="hive" className="paper-stack paper-stack-hover bg-card rounded-2xl p-7 group relative overflow-hidden">
            <div className="relative flex items-center justify-between mb-6">
              <span className="inline-flex w-11 h-11 rounded-xl bg-brand/[0.12] border border-brand/25 items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"/>
                  <path d="M12 7 L16 9.5 L16 13.5 L12 16 L8 13.5 L8 9.5 Z"/>
                </svg>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold tabular-nums">02 · Together</span>
            </div>
            <h3 className="mainFont font-bold text-[24px] mb-2">Hive</h3>
            <p className="text-white/65 text-[14.5px] leading-relaxed mb-6">
              Async collaboration that respects the draft. Invite trusted readers and co-writers, share outlines and chapters, and gather inline edits and comments on your schedule.
            </p>
            <div className="bg-[#171717] rounded-xl border border-border p-3 mb-5 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center text-[10px] font-bold text-brand">M</span>
                <span className="text-white/80 flex-1 truncate">Maya suggested an edit on <span className="text-brand">Ch. 3</span></span>
                <span className="text-white/40 tabular-nums">2m</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-6 h-6 rounded-full bg-[#2f2f2f] flex items-center justify-center text-[10px] font-bold text-white/80">R</span>
                <span className="text-white/80 flex-1 truncate">Rin left 3 comments on the outline</span>
                <span className="text-white/40 tabular-nums">14m</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-6 h-6 rounded-full bg-[#2f2f2f] flex items-center justify-center text-[10px] font-bold text-white/80">J</span>
                <span className="text-white/80 flex-1 truncate">June approved your chapter submission</span>
                <span className="text-white/40 tabular-nums">1h</span>
              </div>
            </div>
            <ul className="space-y-2 text-[13px] text-white/65">
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Roles, submissions & approvals</li>
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Inline rewrites with diff view</li>
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Shared word goals & milestones</li>
            </ul>
          </article>

          {/* Discover */}
          <article className="paper-stack paper-stack-hover bg-card rounded-2xl p-7 group">
            <div className="flex items-center justify-between mb-6">
              <span className="inline-flex w-11 h-11 rounded-xl bg-brand/[0.12] border border-brand/25 items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                </svg>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold tabular-nums">03 · Readers</span>
            </div>
            <h3 className="mainFont font-bold text-[24px] mb-2">Discover</h3>
            <p className="text-white/65 text-[14.5px] leading-relaxed mb-6">
              Publish chapters to a real audience of readers, not an algorithm. Build a following through reading lists, sparks, and clubs curated by people who actually finish books.
            </p>
            <div className="bg-[#171717] rounded-xl border border-border p-3 mb-5">
              <div className="grid grid-cols-4 gap-1.5">
                <div className="aspect-[2/3] rounded-md spine bg-[#3a2a1a] relative overflow-hidden">
                  <div className="absolute inset-x-0 bottom-0 h-3 bg-black/30"/>
                  <div className="absolute top-1 left-1 text-[6px] font-[family-name:var(--font-fraunces)] text-white/80 leading-tight">SALT<br/>HARBOUR</div>
                </div>
                <div className="aspect-[2/3] rounded-md spine bg-[#1c2a3a] relative overflow-hidden">
                  <div className="absolute top-1 left-1 text-[6px] font-[family-name:var(--font-fraunces)] text-white/80 leading-tight">NIGHT<br/>WORK</div>
                </div>
                <div className="aspect-[2/3] rounded-md spine bg-brand relative overflow-hidden">
                  <div className="absolute top-1 left-1 text-[6px] font-[family-name:var(--font-fraunces)] text-black leading-tight font-bold">HONEY<br/>ROAD</div>
                </div>
                <div className="aspect-[2/3] rounded-md spine bg-[#2c1f33] relative overflow-hidden">
                  <div className="absolute top-1 left-1 text-[6px] font-[family-name:var(--font-fraunces)] text-white/80 leading-tight">THE<br/>CIPHER</div>
                </div>
              </div>
            </div>
            <ul className="space-y-2 text-[13px] text-white/65">
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Reading lists & book clubs</li>
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Writing prompts (&quot;sparks&quot;)</li>
              <li className="flex items-start gap-2"><span className="text-brand mt-0.5">→</span> Friends, likes, and a real feed</li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── STORIES DRIFT BAND ── */}
      <section id="discover" className="border-y border-border/70 bg-[#171717] py-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-7 flex items-end justify-between gap-6">
          <div>
            <div className="text-brand text-[12px] font-semibold tracking-[0.16em] uppercase mb-2">From the hive</div>
            <h3 className="mainFont font-bold text-[26px] lg:text-[30px] tracking-tight">Stories being written right now</h3>
          </div>
          <Link href={`/${locale}/discover`} className="text-brand hover:underline underline-offset-4 text-sm hidden sm:inline-flex items-center gap-1.5">
            Browse all
            <ArrowIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#171717] to-transparent z-10 pointer-events-none"/>
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#171717] to-transparent z-10 pointer-events-none"/>
          <div className="flex gap-4 drift w-max">
            {/* 7 cards + duplicates for seamless loop */}
            {[
              { bg: '#3a2a1a', title: 'Salt\nHarbour', author: 'M. Vance', ch: 12, readers: '1.2k', dark: false },
              { bg: '#1c2a3a', title: 'Night\nWork', author: 'R. Okafor', ch: 4, readers: '318', dark: false },
              { bg: 'brand', title: 'The Honey\nRoad', author: 'J. Adelekan', ch: 21, readers: '4.6k', dark: true },
              { bg: '#2c1f33', title: 'The Cipher\nKeeper', author: 'H. Lin', ch: 9, readers: '882', dark: false, italic: true },
              { bg: '#2a1818', title: 'Low\nFrequencies', author: 'D. Marsh', ch: 17, readers: '2.1k', dark: false },
              { bg: '#1a2a22', title: 'Greenhouse\nLetters', author: 'P. Castellan', ch: 6, readers: '540', dark: false },
              { bg: '#33291a', title: 'Wax &\nTin', author: 'A. Brunet', ch: 2, readers: '96', dark: false },
            ].flatMap((book, i) =>
              [false, true].map((isDupe) => (
                <div
                  key={`${i}-${isDupe}`}
                  className="w-48 shrink-0 paper-stack bg-card rounded-xl p-3"
                  aria-hidden={isDupe || undefined}
                >
                  <div
                    className={`aspect-[2/3] rounded-lg mb-3 relative overflow-hidden ${book.bg === 'brand' ? 'bg-brand' : 'spine'}`}
                    style={book.bg !== 'brand' ? { backgroundColor: book.bg } : undefined}
                  >
                    <div className="absolute inset-2 border border-white/20 rounded-sm flex flex-col justify-between p-2"
                      style={book.bg === 'brand' ? { borderColor: 'rgba(0,0,0,0.3)' } : undefined}
                    >
                      <div className={`font-[family-name:var(--font-fraunces)] text-[14px] leading-tight ${book.italic ? 'italic' : ''} ${book.dark ? 'text-black font-semibold' : 'text-white/90'}`}>
                        {book.title.split('\n').map((line, j) => (
                          <span key={j}>{line}{j < book.title.split('\n').length - 1 && <br/>}</span>
                        ))}
                      </div>
                      <div className={`text-[9px] uppercase tracking-wider ${book.dark ? 'text-black/60' : 'text-white/50'}`}>{book.author}</div>
                    </div>
                  </div>
                  <div className="text-[13px] font-medium truncate">{book.title.replace('\n', ' ')}</div>
                  <div className="text-[11px] text-white/50 tabular-nums">Ch. {String(book.ch).padStart(2, '0')} · {book.readers} readers</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── BIG CTA ── */}
      <section className="border-t border-border/70 bg-gradient-to-b from-[#171717] to-[#141414]">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-20 text-center relative">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent"/>
          <h2 className="mainFont font-bold text-[36px] lg:text-[48px] leading-tight tracking-tight">
            Your hive is waiting.
          </h2>
          <p className="mt-4 text-white/65 text-[16px] max-w-lg mx-auto">
            A blank page and a small audience of readers who actually care. That&apos;s the whole pitch.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/sign-up`}
              className="bg-brand text-[#0a0a0a] font-bold mainFont rounded-full px-7 py-3.5 text-[15px] inline-flex items-center gap-2 shadow-[0_6px_24px_-8px_rgba(255,195,0,0.5)] hover:bg-brand-hover hover:-translate-y-px transition-all"
            >
              Start writing free
              <ArrowIcon />
            </Link>
            <a href="#" className="rounded-full px-5 py-3.5 text-[15px] border border-border text-white hover:border-brand/50 hover:text-brand hover:bg-brand/[0.04] transition-all">
              Read the changelog
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/70 bg-[#121212]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <Link href={`/${locale}`} className="flex items-center gap-2.5 mb-4">
                <LogoMark />
                <span className="mainFont font-bold text-[17px]">Beehive Studio</span>
              </Link>
              <p className="text-[13px] text-white/55 leading-relaxed max-w-sm">
                A late-night indie bookshop for writing. Built with care, one chapter at a time.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a href="#" className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-white/60 hover:text-brand hover:border-brand/40 transition-colors" aria-label="X / Twitter">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M18.244 2H21l-6.52 7.45L22 22h-6.812l-4.74-6.198L4.86 22H2.1l6.978-7.974L2 2h6.99l4.288 5.665L18.244 2Zm-2.39 18.25h1.885L7.27 3.66H5.247l10.607 16.59Z"/>
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-white/60 hover:text-brand hover:border-brand/40 transition-colors" aria-label="GitHub">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.24 2.78.12 3.07.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z"/>
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-white/60 hover:text-brand hover:border-brand/40 transition-colors" aria-label="RSS">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M4 4v3c8.28 0 15 6.72 15 15h3C22 12.05 13.95 4 4 4Zm0 6v3c4.97 0 9 4.03 9 9h3c0-6.63-5.37-12-12-12Zm2 8a2 2 0 1 0 .001 4.001A2 2 0 0 0 6 18Z"/>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-3 mainFont">Product</div>
              <ul className="space-y-2 text-[13.5px]">
                <li><a href="#studio" className="text-white/75 hover:text-white transition-colors">Studio</a></li>
                <li><a href="#hive" className="text-white/75 hover:text-white transition-colors">Hive</a></li>
                <li><a href="#discover" className="text-white/75 hover:text-white transition-colors">Discover</a></li>
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Sparks</a></li>
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-3 mainFont">Community</div>
              <ul className="space-y-2 text-[13.5px]">
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Reading lists</a></li>
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Book clubs</a></li>
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Writers we love</a></li>
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Newsletter</a></li>
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">Discord</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-3 mainFont">Company</div>
              <ul className="space-y-2 text-[13.5px]">
                <li><a href="#" className="text-white/75 hover:text-white transition-colors">About</a></li>
                <li><Link href={`/${locale}/privacy`} className="text-white/75 hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href={`/${locale}/terms`} className="text-white/75 hover:text-white transition-colors">Terms</Link></li>
                <li><Link href={`/${locale}/dmca`} className="text-white/75 hover:text-white transition-colors">DMCA</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-white/40">
            <div>© 2026 Beehive Studio</div>
            <div className="flex items-center gap-4">
              <span>v2.0 · open beta</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                All systems honey
              </span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
