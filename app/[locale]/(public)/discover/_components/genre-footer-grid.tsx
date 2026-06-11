import Link from 'next/link'
import { GENRES, GENRE_LABEL, GENRE_ICON, type GenreSlug } from '@/lib/discover/genres'

type Props = {
  counts: Record<GenreSlug, number>
  locale: string
  /**
   * Optional link base override. Default `/${locale}/discover/genre/`.
   * Sparks home passes `/${locale}/discover/sparks/genre/`.
   */
  linkBase?: string
  /** Heading override. Default "Browse by genre". */
  title?: string
  /** Per-tile count suffix. Default "books". */
  countLabel?: string
}

const panelChrome = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  borderTop: '1px solid var(--br-card)',
} as const

const tileChrome = {
  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  boxShadow: 'var(--sh-tile)',
} as const

export function GenreFooterGrid({
  counts,
  locale,
  linkBase,
  title,
  countLabel,
}: Props) {
  const base = linkBase ?? `/${locale}/discover/genre/`
  const heading = title ?? 'Browse by genre'
  const suffix = countLabel ?? 'books'
  return (
    <section style={panelChrome} className="p-5">
      <h2 className="font-[family-name:var(--font-comfortaa)] font-bold text-[18px] text-[var(--brand)] mb-4">
        {heading}
      </h2>
      <ul className="grid grid-cols-7 gap-3">
        {GENRES.map((slug) => {
          const Icon = GENRE_ICON[slug]
          return (
            <li key={slug}>
              <Link
                href={`${base}${slug}`}
                className="flex flex-col items-center gap-2 p-4 rounded-[var(--r-btn)] hover:ring-2 hover:ring-[var(--brand)] transition-shadow"
                style={tileChrome}
              >
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'oklch(from var(--brand) l c h / 0.14)' }}
                >
                  <Icon size={18} className="text-[var(--brand)]" />
                </span>
                <span className="text-[12px] font-medium text-[var(--canvas-dark-ink-strong)]">
                  {GENRE_LABEL[slug]}
                </span>
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
                  {counts[slug] ?? 0} {suffix}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
