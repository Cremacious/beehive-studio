import Link from 'next/link'
import { Star } from 'lucide-react'

export type FeaturedKind = 'book' | 'spark' | 'hive' | 'list' | 'club' | 'mixed'

export type SlimFeaturedSource = {
  title: string
  caption: string
  href: string
}

type Props = {
  kind: FeaturedKind
  featured: SlimFeaturedSource | null
}

export function SlimFeaturedStrip({ kind, featured }: Props) {
  if (!featured) return null

  return (
    <Link
      href={featured.href}
      className="block rounded-[var(--r-row)] px-3 py-2 group transition-shadow hover:shadow-[var(--sh-tile)]"
      style={{
        background:
          'linear-gradient(90deg, oklch(from var(--brand) l c h / 0.20), oklch(from var(--brand) l c h / 0.04))',
        border: '1px solid oklch(from var(--brand) l c h / 0.3)',
      }}
      data-featured-kind={kind}
      aria-label={`Featured: ${featured.title}`}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <Star
          size={12}
          className="text-[var(--brand)] flex-shrink-0"
          fill="currentColor"
          aria-hidden="true"
        />
        <span className="font-bold tracking-[0.06em] uppercase text-[var(--brand)] flex-shrink-0">
          Featured
        </span>
        <span className="text-[var(--canvas-dark-ink-muted)]">·</span>
        <span className="font-bold text-[var(--canvas-dark-ink-strong)] truncate">
          {featured.title}
        </span>
        <span className="text-[var(--canvas-dark-ink-muted)] truncate">
          · {featured.caption}
        </span>
      </div>
    </Link>
  )
}
