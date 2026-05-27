import { ContinueWritingHero } from './continue-writing-hero'
import { StudioStats } from './studio-stats'
import type { BookSummary, StudioStats as StudioStatsT } from '@/lib/actions/book.actions'

type Props = {
  recentBook: BookSummary
  stats: StudioStatsT
  locale: string
}

export function StudioHeader({ recentBook, stats, locale }: Props) {
  return (
    <section
      className="grid mb-12"
      style={{
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
        gap: '20px',
      }}
    >
      <ContinueWritingHero book={recentBook} locale={locale} />
      <StudioStats stats={stats} />
    </section>
  )
}
