import Link from 'next/link'
import type { TopListTag } from '@/lib/actions/reading-lists-hub.actions'

type Props = {
  tags: TopListTag[]
  activeTags: string[]
  locale: string
  /** Other querystring params to preserve when toggling a tag. */
  preserve: { tab?: string; sort?: string }
}

/**
 * Horizontal scrollable chip strip of top reading-list tags. Multi-select:
 * clicking a chip toggles its presence in the `?tags=a,b` URL param. The
 * active chips are highlighted brand-yellow.
 */
export function ListsTagFilterStrip({
  tags,
  activeTags,
  locale,
  preserve,
}: Props) {
  if (tags.length === 0) return null

  const activeSet = new Set(activeTags)

  function buildHref(toggle: string): string {
    const next = activeSet.has(toggle)
      ? activeTags.filter((t) => t !== toggle)
      : [...activeTags, toggle]
    const params = new URLSearchParams()
    if (preserve.tab && preserve.tab !== 'all') params.set('tab', preserve.tab)
    if (preserve.sort && preserve.sort !== 'recent')
      params.set('sort', preserve.sort)
    if (next.length > 0) params.set('tags', next.join(','))
    const qs = params.toString()
    return `/${locale}/community/reading-lists${qs ? `?${qs}` : ''}`
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1"
      style={{ marginBottom: 12 }}
      aria-label="Filter by tag"
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--canvas-dark-ink-muted)',
          flexShrink: 0,
          marginRight: 4,
        }}
      >
        Tags
      </span>
      {tags.map((t) => {
        const active = activeSet.has(t.tag)
        return (
          <Link
            key={t.tag}
            href={buildHref(t.tag)}
            className="inline-flex items-center no-underline transition-colors flex-shrink-0"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
              padding: '4px 10px',
              borderRadius: 'var(--r-pill, 999px)',
              background: active
                ? 'oklch(from var(--brand) l c h / 0.14)'
                : 'rgba(255,255,255,0.06)',
              color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
              border: active
                ? '1px solid var(--brand)'
                : '1px solid transparent',
              fontWeight: 600,
            }}
            aria-pressed={active}
          >
            <span>#{t.tag}</span>
            <span
              style={{
                marginLeft: 6,
                opacity: 0.6,
                fontSize: 10,
              }}
            >
              {t.count}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
