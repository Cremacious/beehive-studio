import type { ReactNode } from 'react'

/**
 * Canonical empty-state component for community + library surfaces.
 * One pattern: dark-iOS panel + icon chip + headline + body + CTA(s).
 *
 * Use `variant="inline"` (default) inside section panels, `variant="hero"`
 * as a full-page hero. The shape is identical — only padding differs.
 *
 * Replaces three competing patterns from before the audit:
 *  .empty.empty-inline (used on /sparks) — now `variant="inline"`
 *  inline-styled hero card (was on /hives) — now `variant="hero"` w/ minimal
 *  full-page honeycomb-cluster (still custom on /studio for the bee theme)
 */
export function EmptyState({
  icon,
  title,
  description,
  ctaPrimary,
  ctaSecondary,
  variant = 'inline',
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  ctaPrimary?: ReactNode
  ctaSecondary?: ReactNode
  variant?: 'inline' | 'hero'
}) {
  const padding = variant === 'hero' ? '64px 28px' : '44px 28px'
  const glyphSize = variant === 'hero' ? 96 : 72
  const glyphRadius = variant === 'hero' ? '28px' : '22px'
  const titleSize = variant === 'hero' ? '26px' : '20px'

  return (
    <section
      className="panel"
      style={{
        padding,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: glyphSize,
          height: glyphSize,
          borderRadius: glyphRadius,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(120% 120% at 30% 20%, oklch(from var(--brand) l c h / 0.18), transparent 60%), linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          color: 'var(--brand)',
          marginBottom: variant === 'hero' ? 28 : 18,
          boxShadow: 'var(--sh-card)',
        }}
      >
        {icon}
      </span>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: titleSize,
          letterSpacing: '-0.01em',
          color: 'var(--canvas-dark-ink-strong)',
          margin: '0 0 10px',
          textWrap: 'balance' as const,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: variant === 'hero' ? 15 : 13,
          color: 'var(--canvas-dark-ink-muted)',
          margin: '0 0 22px',
          maxWidth: '46ch',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
      {(ctaPrimary || ctaSecondary) && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {ctaPrimary}
          {ctaSecondary}
        </div>
      )}
    </section>
  )
}
