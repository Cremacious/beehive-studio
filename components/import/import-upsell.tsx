'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

type Props = {
  locale: string
  /** Optional override for the pitch line. */
  blurb?: string
}

/**
 * Free-tier upsell card for the import feature. Mirrors the version-history
 * drawer's Premium card pattern (brand-yellow Premium pill, short pitch, Upgrade
 * link to /pricing).
 */
export function ImportUpsell({ locale, blurb }: Props) {
  return (
    <div
      className="relative overflow-hidden flex flex-col gap-2.5"
      style={{
        padding: 20,
        borderRadius: 'var(--r-row)',
        background:
          'radial-gradient(120% 80% at 20% 10%, oklch(from var(--brand) l c h / 0.18), transparent 70%), linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        border: '1px solid oklch(from var(--brand) l c h / 0.30)',
      }}
    >
      <span
        className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-sm uppercase"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.12em',
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <Sparkles size={9} /> Premium
      </span>
      <h4
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--canvas-dark-ink-strong)',
        }}
      >
        Bring your manuscript with you
      </h4>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--canvas-dark-ink-muted)' }}>
        {blurb ??
          'Import a DOCX, PDF, or EPUB and Beehive turns it into editable chapters. Upgrade to unlock importing.'}
      </p>
      <Link
        href={`/${locale}/pricing`}
        className="inline-flex items-center gap-1.5 self-start mt-1 rounded-md px-3 py-1.5"
        style={{
          fontSize: 12,
          fontWeight: 700,
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          fontFamily: 'var(--font-display)',
        }}
      >
        Upgrade →
      </Link>
    </div>
  )
}
