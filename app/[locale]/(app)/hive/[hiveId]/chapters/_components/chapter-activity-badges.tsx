'use client'

type Props = {
  annotationCount: number
  pendingSuggestionCount: number
  canReview: boolean
}

export function ChapterActivityBadges({
  annotationCount,
  pendingSuggestionCount,
  canReview,
}: Props) {
  if (annotationCount === 0 && pendingSuggestionCount === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {annotationCount > 0 && (
        <Badge
          count={annotationCount}
          label="annotation"
          accent="neutral"
        />
      )}
      {pendingSuggestionCount > 0 && (
        <Badge
          count={pendingSuggestionCount}
          label="suggestion"
          accent={canReview ? 'brand' : 'neutral'}
        />
      )}
    </div>
  )
}

function Badge({
  count,
  label,
  accent,
}: {
  count: number
  label: 'annotation' | 'suggestion'
  accent: 'neutral' | 'brand'
}) {
  const isBrand = accent === 'brand'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: isBrand
          ? 'oklch(from var(--color-brand) l c h / 0.14)'
          : 'oklch(from var(--canvas-dark-ink) l c h / 0.06)',
        color: isBrand ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
        border: isBrand
          ? '1px solid oklch(from var(--color-brand) l c h / 0.32)'
          : '1px solid var(--canvas-dark-300)',
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      {count} {pluralize(label, count)}
    </span>
  )
}

function pluralize(label: 'annotation' | 'suggestion', n: number): string {
  return n === 1 ? label : `${label}s`
}
