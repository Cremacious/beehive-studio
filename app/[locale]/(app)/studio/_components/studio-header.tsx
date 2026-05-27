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
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-6">
      <ContinueWritingHero book={recentBook} locale={locale} />
      <StudioStats stats={stats} />
    </div>
  )
}
