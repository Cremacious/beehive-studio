'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Slim site footer. Mounted at the root layout so it appears across the app.
 *
 * Hidden on the studio editor route (/{locale}/studio/{bookId} exactly) — the
 * editor needs full vertical space for the binder + canvas + status bar.
 * Library (/studio) and details (/studio/{bookId}/details) still get the footer.
 */
export function AppFooter() {
  const pathname = usePathname() ?? ''

  // Match `/{locale}/studio/{bookId}` exactly — no trailing segments.
  // Editor is a single dynamic segment after `studio`; deeper paths like
  // `/details` are NOT the editor.
  const isEditor = /^\/[^/]+\/studio\/[^/]+\/?$/.test(pathname)
  if (isEditor) return null

  // Extract locale for link prefixes (defaults to 'en' when pathname is short).
  const localeFromPath = pathname.split('/')[1] || 'en'

  return (
    <footer
      className="w-full mt-auto"
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'linear-gradient(180deg, #1d1e20 0%, #181a1c 100%)',
      }}
    >
      <div className="mx-auto max-w-[1920px] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div
          className="flex items-center gap-2"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <span
            className="font-bold tracking-wide"
            style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
          >
            Beehive Studio
          </span>
          <span aria-hidden="true">·</span>
          <span>Get buzzed about writing!</span>
        </div>
        <nav
          className="flex items-center gap-4"
          aria-label="Footer"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <Link
            href={`/${localeFromPath}/discover`}
            className="hover:text-[var(--brand)] transition-colors"
          >
            Discover
          </Link>
          <Link
            href={`/${localeFromPath}/pricing`}
            className="hover:text-[var(--brand)] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href={`/${localeFromPath}/privacy`}
            className="hover:text-[var(--brand)] transition-colors"
          >
            Privacy
          </Link>
          <Link
            href={`/${localeFromPath}/terms`}
            className="hover:text-[var(--brand)] transition-colors"
          >
            Terms
          </Link>
          <Link
            href={`/${localeFromPath}/dmca`}
            className="hover:text-[var(--brand)] transition-colors"
          >
            DMCA
          </Link>
        </nav>
      </div>
    </footer>
  )
}
