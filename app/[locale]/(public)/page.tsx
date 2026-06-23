import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { MarketingNav } from './_components/marketing-nav'
import { MarketingFooter } from './_components/marketing-footer'

/* ── shared chrome styles (mirror the auth forms / design system) ── */
const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  borderTop: 'var(--br-card)',
}
const tileStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  borderRadius: 'var(--r-btn)',
  boxShadow: 'var(--sh-tile)',
  borderTop: 'var(--br-card)',
}
const recessedStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  borderRadius: 'var(--r-row)',
}
const brandCta =
  'font-display font-bold rounded-full inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-px'
const ghostCta =
  'font-display font-semibold rounded-full inline-flex items-center justify-center gap-2 transition-all'

/* pillar accent tints (reuse existing categorical token hues) */
const ACCENTS = {
  studio: 'oklch(0.80 0.140 88)',
  hive: 'oklch(0.74 0.12 145)',
  sparks: 'oklch(0.78 0.13 70)',
  discover: 'oklch(0.72 0.11 230)',
} as const

const ArrowIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)
const Check = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  // Authed visitors already get the shared AppNav from (public)/layout.tsx, so
  // render the marketing nav for guests only to avoid stacking two nav bars.
  const session = await auth.api.getSession({ headers: await headers() })
  const isGuest = !session?.user

  return (
    <div style={{ background: 'oklch(0.255 0.004 256)', color: 'var(--canvas-dark-ink)' }}>
      {isGuest && <MarketingNav locale={locale} />}

      {/* ── HERO ── */}
      <section className="relative overflow-hidden text-center">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, oklch(from var(--brand) l c h / 0.10), transparent 65%)' }}
        />
        <div className="relative max-w-[760px] mx-auto px-6 pt-20 sm:pt-[84px]">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] mb-7"
            style={{ border: '1px solid oklch(1 0 0 / 0.1)', background: 'var(--canvas-dark-200)', color: 'var(--canvas-dark-ink-muted)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand)' }} />
            Now in open beta. Hives 1.0 just shipped
          </div>
          <h1 className="font-display font-bold leading-[1.02] tracking-[-0.015em]" style={{ fontSize: 'clamp(42px, 7vw, 72px)' }}>
            Write the book.<br />Find your <span style={{ color: 'var(--brand)' }}>readers</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-[36rem] text-[19px] leading-relaxed" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Beehive is a calm writing studio with a community baked in. Draft in peace, share with people you trust, and publish to readers who actually finish books.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}/sign-up`} className={`${brandCta} px-[26px] py-[15px] text-[15px]`} style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>
              Start writing free <ArrowIcon />
            </Link>
            <a href="#features" className={`${ghostCta} px-[22px] py-[14px] text-[15px]`} style={{ border: '1px solid oklch(1 0 0 / 0.12)', color: 'var(--canvas-dark-ink)' }}>
              See how it works
            </a>
          </div>
          <p className="mt-6 text-[12.5px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
            Free forever for solo writers. No credit card. Export EPUB, PDF, and DOCX.
          </p>
        </div>

        {/* editor showcase */}
        <div className="relative max-w-[1000px] mx-auto px-6 mt-14">
          <div className="overflow-hidden text-left" style={panelStyle}>
            <div className="flex items-center gap-2 px-3.5 py-[11px]" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--canvas-dark-400)' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--canvas-dark-400)' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--canvas-dark-400)' }} />
              <span className="ml-2 text-[12px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>studio &middot; The Cartographer&rsquo;s Wife &middot; Ch. 03</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[170px_1fr_200px] min-h-[340px]">
              {/* binder */}
              <aside className="hidden md:block py-3.5 px-2" style={{ borderRight: '1px solid oklch(1 0 0 / 0.05)', background: 'var(--canvas-dark-150)' }}>
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase px-2 pb-2" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Manuscript</div>
                {[['01', 'The signal'], ['02', 'Low tide']].map(([n, t]) => (
                  <div key={n} className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>{n}</span> {t}
                  </div>
                ))}
                <div className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12.5px]" style={{ background: 'oklch(from var(--brand) l c h / 0.12)', color: 'var(--brand)' }}>
                  <span className="font-mono text-[10px]" style={{ color: 'oklch(from var(--brand) l c h / 0.7)' }}>03</span> Cartography
                </div>
                <div className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>04</span> <span className="italic">Drafting&hellip;</span>
                </div>
              </aside>
              {/* prose */}
              <div className="p-[26px]">
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Chapter 03</div>
                <h3 className="font-display font-bold text-[20px] mt-[3px] mb-4">Cartography</h3>
                <div className="text-[15px] leading-[1.75] space-y-3" style={{ fontFamily: 'var(--font-prose)', color: 'var(--canvas-dark-ink-muted)' }}>
                  <p>She mapped the harbour the way other people kept a diary: in tide marks, in the slant of mast shadows, in the small inaccuracies the sea forgave each morning.</p>
                  <p>The lighthouse was not where the charts said it was, but she still drew it in, faintly, in pencil she could erase if anyone official ever asked.</p>
                </div>
              </div>
              {/* hive feedback */}
              <aside className="hidden md:block py-4 px-3" style={{ borderLeft: '1px solid oklch(1 0 0 / 0.05)', background: 'var(--canvas-dark-150)' }}>
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Hive feedback</div>
                {[['R', 'Rin', 'Love this opening. The harbour reads like a character.'], ['M', 'Maya', '"forgave" is doing a lot of work. Keep it.']].map(([i, n, body]) => (
                  <div key={n} className="p-[11px] mb-2.5" style={tileStyle}>
                    <div className="flex items-center gap-[7px] mb-1.5">
                      <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold" style={{ background: 'oklch(from var(--accent-hive, oklch(0.74 0.12 145)) l c h / 0.25)', color: ACCENTS.hive }}>{i}</span>
                      <span className="text-[12px] font-semibold">{n}</span>
                    </div>
                    <p className="text-[11.5px] leading-snug" style={{ color: 'var(--canvas-dark-ink-muted)' }}>{body}</p>
                  </div>
                ))}
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES (zigzag) ── */}
      <section id="features" className="py-24">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="text-center max-w-[36rem] mx-auto mb-16">
            <div className="font-mono text-[12px] tracking-[0.16em] uppercase mb-3" style={{ color: 'var(--brand)' }}>Three rooms, one studio</div>
            <h2 className="font-display font-bold leading-[1.12] tracking-[-0.01em]" style={{ fontSize: 'clamp(30px, 4.5vw, 44px)' }}>
              Everything a writer needs.<br />Nothing they don&rsquo;t.
            </h2>
          </div>

          {/* Studio */}
          <FeatureRow
            accent={ACCENTS.studio}
            index="01"
            kicker="Write"
            title="A studio built for long-form"
            body="Chapters, scenes, outlines, characters, and research in one Scrivener-style workspace. The editor auto-saves every keystroke and gets out of your way."
            bullets={['Outline, corkboard, and wiki views', 'Word goals and daily streaks', 'Import DOCX, export EPUB and PDF']}
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /></svg>}
            visual={
              <div className="p-[22px]" style={tileStyle}>
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase mb-3.5" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Studio binder</div>
                <BinderRow n="03" t="Cartography" w="1,348" active />
                <BinderRow n="04" t="Drafting…" w="274" />
                <BinderRow n="05" t="Tin coast" w="2,011" />
                <div className="mt-3.5 p-3" style={recessedStyle}>
                  <div className="font-mono text-[10px] mb-2" style={{ color: 'var(--canvas-dark-ink-faint)' }}>DAILY GOAL</div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--canvas-dark-300)' }}>
                    <div className="h-full" style={{ width: '62%', background: 'var(--brand)' }} />
                  </div>
                  <div className="font-mono text-[10px] mt-[7px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>748 / 1,200 words</div>
                </div>
              </div>
            }
          />

          {/* Hives */}
          <FeatureRow
            flip
            accent={ACCENTS.hive}
            index="02"
            kicker="Together"
            title="Collaboration that respects the draft"
            body="Invite trusted readers and co-writers into a Hive. Share outlines and chapters, gather inline edits and comments, and approve changes on your own schedule."
            bullets={['Roles, submissions, and approvals', 'Inline rewrites with a diff view', 'Shared word goals and milestones']}
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z" /></svg>}
            visual={
              <div className="p-[22px]" style={tileStyle}>
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase mb-3.5" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Hive activity</div>
                <ActivityRow av="M" avBg={`oklch(from ${ACCENTS.hive} l c h / 0.25)`} avColor={ACCENTS.hive} time="2m">
                  Maya suggested an edit on <span style={{ color: 'var(--brand)' }}>Ch. 3</span>
                </ActivityRow>
                <ActivityRow av="R" time="14m">Rin left 3 comments on the outline</ActivityRow>
                <ActivityRow av="J" time="1h">June approved your submission</ActivityRow>
              </div>
            }
          />

          {/* Sparks + Discover */}
          <FeatureRow
            accent={ACCENTS.discover}
            index="03"
            kicker="Readers"
            title="Sparks and a community of readers"
            body="Beat the blank page with Sparks, our writing-prompt contests. Then publish chapters to a real audience and grow a following through reading lists and book clubs."
            bullets={['Writing prompts you can win', 'Reading lists and book clubs', 'A feed curated by people, not metrics']}
            icon={<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>}
            visual={
              <div className="p-[22px]" style={tileStyle}>
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase mb-3.5" style={{ color: 'var(--canvas-dark-ink-faint)' }}>This week&rsquo;s Spark</div>
                <div className="p-3.5 mb-3.5" style={recessedStyle}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.06em] rounded-full px-2 py-[3px]" style={{ background: `oklch(from ${ACCENTS.sparks} l c h / 0.18)`, color: ACCENTS.sparks }}>Voting open</span>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>ends in 2 days</span>
                  </div>
                  <h4 className="font-display font-bold text-[15px] mt-3 mb-1.5">Write a goodbye that isn&rsquo;t sad</h4>
                  <div className="font-mono text-[10px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>48 entries &middot; 312 votes</div>
                </div>
                <div className="font-mono text-[10px] tracking-[0.08em] uppercase mb-3.5" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Trending stories</div>
                <div className="grid grid-cols-4 gap-2">
                  <Spine bg="#3a2a1a" title="Salt Harbour" />
                  <Spine bg="#1c2a3a" title="Night Work" />
                  <Spine bg="var(--brand)" title="Honey Road" dark />
                  <Spine bg="#2c1f33" title="The Cipher" italic />
                </div>
              </div>
            }
          />
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section id="pricing" className="py-24" style={{ background: 'oklch(0.225 0.004 256)', borderTop: '1px solid oklch(1 0 0 / 0.05)', borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}>
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="text-center max-w-[36rem] mx-auto mb-12">
            <div className="font-mono text-[12px] tracking-[0.16em] uppercase mb-3" style={{ color: 'var(--brand)' }}>Simple pricing</div>
            <h2 className="font-display font-bold leading-[1.12]" style={{ fontSize: 'clamp(30px, 4.5vw, 44px)' }}>
              Start free.<br />Upgrade when you&rsquo;re ready.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] max-w-[820px] mx-auto">
            {/* Free */}
            <div className="p-[30px]" style={panelStyle}>
              <div className="font-mono text-[11px] tracking-[0.08em] uppercase" style={{ color: 'var(--canvas-dark-ink-faint)' }}>Free</div>
              <div className="font-display font-bold text-[34px] my-2">$0<small className="text-[14px] font-medium" style={{ color: 'var(--canvas-dark-ink-faint)' }}> / forever</small></div>
              <p className="text-[13.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>For solo writers finding their feet.</p>
              <ul className="grid gap-2.5 list-none p-0 my-5">
                {['Up to 3 books', 'Full Studio editor', 'Hives and community', 'Publish to readers'].map((f) => (
                  <li key={f} className="flex gap-2.5 text-[14px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    <span style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }}><Check /></span> {f}
                  </li>
                ))}
              </ul>
              <Link href={`/${locale}/sign-up`} className={`${ghostCta} w-full py-[13px] text-[14.5px]`} style={{ border: '1px solid oklch(1 0 0 / 0.12)', color: 'var(--canvas-dark-ink)' }}>
                Start writing free
              </Link>
            </div>
            {/* Premium */}
            <div className="p-[30px] relative" style={{ ...panelStyle, border: '1px solid oklch(from var(--brand) l c h / 0.35)' }}>
              <span className="absolute -top-[11px] right-[22px] font-mono text-[10px] font-bold uppercase tracking-[0.06em] rounded-full px-2.5 py-1" style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>Most popular</span>
              <div className="font-mono text-[11px] tracking-[0.08em] uppercase" style={{ color: 'var(--brand)' }}>Premium</div>
              <div className="font-display font-bold text-[34px] my-2">$8<small className="text-[14px] font-medium" style={{ color: 'var(--canvas-dark-ink-faint)' }}> / month</small></div>
              <p className="text-[13.5px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>For writers going the distance.</p>
              <ul className="grid gap-2.5 list-none p-0 my-5">
                {['Unlimited books and Hives', 'Full version history', 'Publishing and export toolkit', 'Import from DOCX, PDF, EPUB'].map((f) => (
                  <li key={f} className="flex gap-2.5 text-[14px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    <span style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }}><Check /></span> {f}
                  </li>
                ))}
              </ul>
              <Link href={`/${locale}/pricing`} className={`${brandCta} w-full py-[13px] text-[14.5px]`} style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>
                See full pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section className="py-24" style={{ background: 'linear-gradient(180deg, oklch(0.225 0.004 256), oklch(0.255 0.004 256))' }}>
        <div className="max-w-[620px] mx-auto px-6 text-center">
          <h2 className="font-display font-bold leading-[1.1]" style={{ fontSize: 'clamp(32px, 5vw, 46px)' }}>
            Your first chapter is one click away.
          </h2>
          <p className="mt-4 max-w-[28rem] mx-auto text-[16px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            A blank page and a small audience of readers who actually care. That is the whole pitch.
          </p>
          <div className="mt-7 flex justify-center">
            <Link href={`/${locale}/sign-up`} className={`${brandCta} px-7 py-[15px] text-[15px]`} style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>
              Start writing free <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter locale={locale} />
    </div>
  )
}

/* ── section helpers ────────────────────────────────────────────── */

function FeatureRow({
  flip = false,
  accent,
  index,
  kicker,
  title,
  body,
  bullets,
  icon,
  visual,
}: {
  flip?: boolean
  accent: string
  index: string
  kicker: string
  title: string
  body: string
  bullets: string[]
  icon: React.ReactNode
  visual: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-14 items-center mb-16 last:mb-0">
      <div className={flip ? 'md:order-2' : ''}>
        <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] uppercase" style={{ color: accent }}>
          {icon} {index} &middot; {kicker}
        </span>
        <h3 className="font-display font-bold text-[28px] mt-3.5 mb-3">{title}</h3>
        <p className="text-[15px] leading-[1.65]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>{body}</p>
        <ul className="grid gap-[9px] list-none p-0 mt-[18px]">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-[9px] text-[14px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              <span style={{ color: 'var(--brand)' }}>&rarr;</span> {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'md:order-1' : ''}>{visual}</div>
    </div>
  )
}

function BinderRow({ n, t, w, active = false }: { n: string; t: string; w: string; active?: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12.5px]"
      style={active ? { background: 'oklch(from var(--brand) l c h / 0.12)', color: 'var(--brand)' } : { color: 'var(--canvas-dark-ink-muted)' }}
    >
      <span className="font-mono text-[10px]" style={{ color: active ? 'oklch(from var(--brand) l c h / 0.7)' : 'var(--canvas-dark-ink-faint)' }}>{n}</span>
      {t}
      <span className="ml-auto font-mono text-[10px]" style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-faint)' }}>{w}</span>
    </div>
  )
}

function ActivityRow({
  av,
  avBg = 'var(--canvas-dark-400)',
  avColor = 'var(--canvas-dark-ink)',
  time,
  children,
}: {
  av: string
  avBg?: string
  avColor?: string
  time: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 py-[9px] text-[13px] [&:not(:first-child)]:border-t" style={{ color: 'var(--canvas-dark-ink-muted)', borderColor: 'oklch(1 0 0 / 0.05)' }}>
      <span className="w-[26px] h-[26px] rounded-full grid place-items-center text-[11px] font-bold shrink-0" style={{ background: avBg, color: avColor }}>{av}</span>
      <span>{children}</span>
      <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--canvas-dark-ink-faint)' }}>{time}</span>
    </div>
  )
}

function Spine({ bg, title, dark = false, italic = false }: { bg: string; title: string; dark?: boolean; italic?: boolean }) {
  return (
    <div className="rounded-md p-2 relative overflow-hidden" style={{ aspectRatio: '2 / 3', background: bg }}>
      <span className={`text-[11px] leading-[1.1] ${italic ? 'italic' : ''} ${dark ? 'font-semibold' : ''}`} style={{ fontFamily: 'var(--font-prose)', color: dark ? '#000' : '#fff' }}>{title}</span>
    </div>
  )
}
