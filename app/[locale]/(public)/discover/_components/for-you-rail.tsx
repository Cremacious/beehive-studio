import type { BookCard } from '@/lib/actions/discover.actions'
import type { SparkCard } from '@/lib/actions/discover-sparks.actions'
import type { HiveCard } from '@/lib/actions/discover-hives.actions'
import type { ListCard } from '@/lib/actions/discover-lists.actions'
import type { ClubCard } from '@/lib/actions/discover-clubs.actions'
import { RailBookCard } from './rail-book-card'
import { RailSparkCard } from './rail-spark-card'
import { RailHiveCard } from './rail-hive-card'
import { RailListCard } from './rail-list-card'
import { RailClubCard } from './rail-club-card'

export type ForYouItem =
  | { kind: 'book'; data: BookCard }
  | { kind: 'spark'; data: SparkCard }
  | { kind: 'hive'; data: HiveCard }
  | { kind: 'list'; data: ListCard }
  | { kind: 'club'; data: ClubCard }

type Props = {
  items: ForYouItem[]
  locale: string
}

export function ForYouRail({ items, locale }: Props) {
  if (items.length === 0) return null

  return (
    <section
      className="rounded-[var(--r-card)]"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
      aria-label="For you"
    >
      <header className="flex flex-col gap-1 px-5 pt-5 pb-3">
        <h2
          className="font-bold"
          style={{
            fontFamily: 'var(--font-display, var(--font-sans))',
            color: 'var(--brand)',
            fontSize: '18px',
            lineHeight: 1.2,
          }}
        >
          For you
        </h2>
        <p
          className="font-mono uppercase tracking-wider"
          style={{
            fontSize: '11px',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          See all from people you follow
        </p>
      </header>

      <ul
        className="flex gap-3 snap-x snap-mandatory overflow-x-auto px-5 pb-5"
        role="list"
      >
        {items.map((item) => (
          <li
            key={`${item.kind}-${item.data.id}`}
            className="snap-start shrink-0"
          >
            {item.kind === 'book' && (
              <RailBookCard book={item.data} locale={locale} />
            )}
            {item.kind === 'spark' && (
              <RailSparkCard spark={item.data} locale={locale} />
            )}
            {item.kind === 'hive' && (
              <RailHiveCard hive={item.data} locale={locale} />
            )}
            {item.kind === 'list' && (
              <RailListCard list={item.data} locale={locale} />
            )}
            {item.kind === 'club' && (
              <RailClubCard club={item.data} locale={locale} />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
