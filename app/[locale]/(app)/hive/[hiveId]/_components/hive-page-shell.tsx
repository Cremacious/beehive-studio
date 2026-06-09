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
  /** Page body — rendered directly inside the panel under the header. */
  children: ReactNode
}

const WIDTH_CLASS: Record<HivePageShellProps['width'], string> = {
  standard: 'max-w-3xl',
  wide: 'max-w-5xl',
}

export function HivePageShell({
  width,
  title,
  subtitle,
  back,
  headerSlot,
  children,
}: HivePageShellProps) {
  return (
    <div className={`mx-auto w-full ${WIDTH_CLASS[width]} p-6 flex flex-col min-h-screen`}>
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
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderTop: 'var(--br-card)',
          boxShadow: 'var(--sh-card)',
        }}
      >
        {(title || subtitle || headerSlot) && (
          <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="min-w-0 flex-1">
              {title && (
                <h1
                  className="font-comfortaa text-[28px] font-bold leading-tight"
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
            {headerSlot && <div className="shrink-0">{headerSlot}</div>}
          </header>
        )}
        {children}
      </section>
    </div>
  )
}
