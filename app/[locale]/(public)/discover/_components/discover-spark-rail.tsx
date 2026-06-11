import Link from 'next/link'
import { RailSparkCard } from './rail-spark-card'
import type { SparkCard, RailResult } from '@/lib/actions/discover-sparks.actions'

type Props = {
  title: string
  subPageHref: string
  result: RailResult<SparkCard>
  locale: string
  /** When true and books.length === 0, render NOTHING (hide rail entirely). Used by Following. */
  hideWhenEmpty?: boolean
  /** Pass-through to each RailSparkCard. Only Live Now rail consumes it. */
  showUrgencyCaption?: boolean
}

const panelChrome = {
  background:
    'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  boxShadow: 'var(--sh-card)',
  borderTop: '1px solid var(--br-card)',
}

export function DiscoverSparkRail({
  title,
  subPageHref,
  result,
  locale,
  hideWhenEmpty,
  showUrgencyCaption,
}: Props) {
  if (hideWhenEmpty && result.books.length === 0) return null
  if (result.books.length === 0) {
    return (
      <section style={panelChrome} className="mb-6 p-5">
        <header className="flex items-center justify-between mb-3">
          <h2
            className="font-bold text-[18px]"
            style={{
              color: 'var(--brand)',
              fontFamily: 'var(--font-comfortaa)',
            }}
          >
            {title}
          </h2>
        </header>
        <p
          className="text-[13px] italic"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          No Sparks here yet.
        </p>
      </section>
    )
  }
  return (
    <section style={panelChrome} className="mb-6">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2
          className="font-bold text-[18px]"
          style={{
            color: 'var(--brand)',
            fontFamily: 'var(--font-comfortaa)',
          }}
        >
          {title}
        </h2>
        <Link
          href={subPageHref}
          className="text-[11px] uppercase tracking-wider hover:text-[var(--brand)]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          See all →
        </Link>
      </header>
      {result.strictCount < 4 ? (
        <p
          className="px-5 pb-2 text-[10px] uppercase tracking-wider italic"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Filling in with active Sparks while {title} warms up.
        </p>
      ) : null}
      <div className="overflow-x-auto px-5 pb-5">
        <ul className="flex gap-3 snap-x snap-mandatory">
          {result.books.map((book) => (
            <li key={book.id} className="snap-start shrink-0">
              <RailSparkCard
                spark={book}
                locale={locale}
                showUrgencyCaption={showUrgencyCaption}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
