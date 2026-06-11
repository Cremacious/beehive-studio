import type { ReactNode } from 'react'

/**
 * Shared chrome for legal pages (cookies / privacy / terms / dmca).
 * Inherits the layout's page bg, applies token-aligned typography.
 */
export function LegalPage({
  title,
  updated,
  preHeader,
  children,
}: {
  title: string
  updated?: string
  preHeader?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {preHeader}
      <h1
        className="font-display"
        style={{
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--canvas-dark-ink-strong)',
          marginBottom: 8,
        }}
      >
        {title}
      </h1>
      {updated ? (
        <p
          className="font-mono text-[11px] uppercase tracking-[0.14em] mb-12"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {updated}
        </p>
      ) : null}
      <div
        className="legal-body space-y-8 leading-relaxed text-[14px]"
        style={{ color: 'var(--canvas-dark-ink)' }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Section heading for legal pages. h2 + body paragraph(s).
 */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2
        className="font-display font-bold mb-3"
        style={{
          fontSize: 18,
          color: 'var(--canvas-dark-ink-strong)',
          letterSpacing: '-0.01em',
        }}
      >
        {heading}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
