'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export function OverflowBanner() {
  const params = useParams<{ locale: string }>()
  return (
    <div
      data-slot="overflow-banner"
      className="mx-4 my-2 px-4 py-3 flex items-center justify-between gap-3"
      style={{
        background:
          'linear-gradient(180deg, oklch(from var(--color-brand) l c h / 0.15), oklch(from var(--color-brand) l c h / 0.08))',
        boxShadow: 'var(--sh-tile)',
        border: 'var(--br-card)',
        borderRadius: 'var(--r-card)',
        borderLeft: '4px solid var(--color-brand)',
      }}
    >
      <div>
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          This book is read-only on the Free plan
        </p>
        <p
          className="text-xs"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Upgrade to keep editing all your books.
        </p>
      </div>
      <Link
        href={`/${params.locale}/pricing`}
        className="text-sm font-semibold px-4 py-2 hover:bg-brand-hover transition-colors shrink-0"
        style={{
          background: 'var(--color-brand)',
          color: 'var(--brand-ink)',
          borderRadius: 'var(--r-pill)',
        }}
      >
        Upgrade
      </Link>
    </div>
  )
}
