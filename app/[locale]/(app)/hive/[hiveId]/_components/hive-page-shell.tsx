'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export type HivePageShellProps = {
  /** Outer max-width tier per spec §2. */
  width: 'standard' | 'wide'
  /** Page title — Comfortaa bold 28px brand-yellow. Omit to skip the panel header entirely (e.g. wiki entry editor that owns its own header). */
  title?: string
  /** Subtitle under title — plain Geist 13px muted. Optional. */
  subtitle?: string
  /** Back-link config. Renders mono uppercase link ABOVE the panel. Omit on top-level pages. */
  back?: { href: string; label: string }
  /**
   * Top-right slot of the panel header. Holds ONE OF:
   *  - a single primary CTA (brand pill <button>),
   *  - a 2-button group (gap-2 flex of two action buttons),
   *  - a status/role pill (<HivePill> instance).
   * The caller is responsible for the exact shape; the shell only renders the slot.
   */
  headerSlot?: ReactNode
  /** Mobile (issue #50): hide the panel header on phones when the page renders
   * its own mobile header/CTA in the body. Desktop is unaffected. */
  headerHideOnMobile?: boolean
  /** Mobile (issue #50): drop the page-x gutters + panel chrome on phones so
   * the content (prose / editor) goes edge-to-edge. Desktop is unaffected. */
  mobileBleed?: boolean
  /** Page body — rendered directly inside the panel under the header. */
  children: ReactNode
}

// Maps the shell's two width modes onto the shared page-width tiers
// (issue #49). `standard` keeps the narrow reading measure; `wide` steps
// up to the shared `standard` tier for the roomier hive/club surfaces.
const TIER_CLASS: Record<HivePageShellProps['width'], string> = {
  standard: 'tier-prose',
  wide: 'tier-standard',
}

export function HivePageShell({
  width,
  title,
  subtitle,
  back,
  headerSlot,
  headerHideOnMobile,
  mobileBleed,
  children,
}: HivePageShellProps) {
  return (
    <div
      className={`page-x ${TIER_CLASS[width]} py-6 max-md:py-4 flex flex-col min-h-screen`}
      data-mobile-bleed={mobileBleed ? '' : undefined}
    >
      {back && (
        <div className="page-head" style={{ marginBottom: 18 }}>
          <Link href={back.href} className="back">
            <span className="icn">
              <ArrowLeft />
            </span>
            <span>Back to {back.label}</span>
          </Link>
        </div>
      )}

      <section
        className="rounded-[var(--r-card)] overflow-hidden flex-1"
        data-mobile-bleed-panel={mobileBleed ? '' : undefined}
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderTop: 'var(--br-card)',
          boxShadow: 'var(--sh-card)',
        }}
      >
        {(title || subtitle || headerSlot) && (
          <header className={`flex items-start justify-between gap-4 px-6 pt-6 pb-4 max-md:px-4 max-md:pt-4 max-md:flex-col max-md:items-stretch max-md:gap-3${headerHideOnMobile ? ' max-md:hidden' : ''}`}>
            <div className="min-w-0 flex-1">
              {title && (
                <h1
                  className="font-comfortaa text-[28px] font-bold leading-tight max-md:text-[22px]"
                  style={{ color: 'var(--brand)' }}
                >
                  {title}
                </h1>
              )}
              {subtitle && (
                <p
                  className="mt-1 text-[13px]"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {headerSlot && <div className="shrink-0 max-md:w-full">{headerSlot}</div>}
          </header>
        )}
        {children}
      </section>
    </div>
  )
}
