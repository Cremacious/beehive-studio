import Link from 'next/link'

const LogoMark = () => (
  <span
    className="relative inline-flex items-center justify-center w-[34px] h-[34px] rounded-[11px]"
    style={{
      background: 'oklch(from var(--brand) l c h / 0.14)',
      border: '1px solid oklch(from var(--brand) l c h / 0.3)',
    }}
  >
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#FFC300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z" />
      <path d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z" fill="#FFC300" fillOpacity="0.6" stroke="none" />
    </svg>
  </span>
)

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)

/**
 * Marketing top nav for the public landing page. Rendered only for guests —
 * authed visitors get the shared AppNav from (public)/layout.tsx, so rendering
 * this too would stack two nav bars.
 */
export function MarketingNav({ locale }: { locale: string }) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'oklch(0.255 0.004 256 / 0.82)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid oklch(1 0 0 / 0.05)',
      }}
    >
      <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 font-display font-bold text-[17px]">
          <LogoMark />
          Beehive Studio
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[14px]" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          <a href="#features" className="hover:text-[var(--canvas-dark-ink-strong)] transition-colors">Features</a>
          <a href="#pricing" className="hover:text-[var(--canvas-dark-ink-strong)] transition-colors">Pricing</a>
          <Link href={`/${locale}/discover`} className="hover:text-[var(--canvas-dark-ink-strong)] transition-colors">Discover</Link>
          <Link href={`/${locale}/sign-in`} className="hover:text-[var(--canvas-dark-ink-strong)] transition-colors">Sign in</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/sign-in`}
            className="md:hidden text-[14px] transition-colors hover:text-[var(--canvas-dark-ink-strong)]"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Sign in
          </Link>
          <Link
            href={`/${locale}/sign-up`}
            className="font-display font-bold rounded-full px-[18px] py-[9px] text-[14px] inline-flex items-center gap-1.5 transition-all hover:-translate-y-px"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Start writing
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </header>
  )
}
