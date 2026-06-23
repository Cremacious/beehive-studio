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
    </svg>
  </span>
)

const colHead = 'font-mono text-[11px] uppercase tracking-[0.08em] mb-3.5'
const linkClass = 'text-[13.5px] transition-colors hover:text-[var(--canvas-dark-ink-strong)]'

function FootCol({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string; external?: boolean }[]
}) {
  return (
    <div>
      <h4 className={colHead} style={{ color: 'var(--canvas-dark-ink-faint)' }}>{title}</h4>
      <ul className="grid gap-2.5 list-none p-0 m-0">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className={linkClass} style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

const socialClass =
  'w-9 h-9 rounded-[12px] grid place-items-center transition-colors hover:text-[var(--brand)]'

/**
 * Full marketing footer for the landing page. The slim app-wide AppFooter is
 * suppressed on the landing route so this is the only footer guests see.
 */
export function MarketingFooter({ locale }: { locale: string }) {
  return (
    <footer
      style={{
        background: 'oklch(0.225 0.004 256)',
        borderTop: '1px solid oklch(1 0 0 / 0.05)',
      }}
    >
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 pt-14 pb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href={`/${locale}`} className="flex items-center gap-2.5 font-display font-bold text-[17px]">
              <LogoMark />
              Beehive Studio
            </Link>
            <p className="text-[13px] leading-relaxed max-w-[22rem] mt-3.5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
              A late-night indie bookshop for writing. Built with care, one chapter at a time.
            </p>
            <div className="flex gap-2.5 mt-[18px]">
              <a href="https://x.com" aria-label="X" className={socialClass} style={{ border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--canvas-dark-ink-faint)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M18.244 2H21l-6.52 7.45L22 22h-6.812l-4.74-6.198L4.86 22H2.1l6.978-7.974L2 2h6.99l4.288 5.665L18.244 2Zm-2.39 18.25h1.885L7.27 3.66H5.247l10.607 16.59Z" />
                </svg>
              </a>
              <a href="https://github.com" aria-label="GitHub" className={socialClass} style={{ border: '1px solid oklch(1 0 0 / 0.08)', color: 'var(--canvas-dark-ink-faint)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.6.24 2.78.12 3.07.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
                </svg>
              </a>
            </div>
          </div>

          <FootCol
            title="Product"
            links={[
              { label: 'Studio', href: `/${locale}/studio` },
              { label: 'Hives', href: `/${locale}/hives` },
              { label: 'Sparks', href: `/${locale}/sparks` },
              { label: 'Discover', href: `/${locale}/discover` },
            ]}
          />
          <FootCol
            title="Community"
            links={[
              { label: 'Reading lists', href: `/${locale}/reading-lists` },
              { label: 'Book clubs', href: `/${locale}/clubs` },
              { label: 'Community', href: `/${locale}/community` },
            ]}
          />
          <FootCol
            title="Company"
            links={[
              { label: 'Pricing', href: `/${locale}/pricing` },
              { label: 'Privacy', href: `/${locale}/privacy` },
              { label: 'Terms', href: `/${locale}/terms` },
              { label: 'DMCA', href: `/${locale}/dmca` },
            ]}
          />
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-2.5 py-[22px] text-[12px]"
          style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)', color: 'var(--canvas-dark-ink-faint)' }}
        >
          <span>&copy; 2026 Beehive Studio</span>
          <span>Get buzzed about writing!</span>
        </div>
      </div>
    </footer>
  )
}
