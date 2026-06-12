import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getTrendingClubsAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import { DiscoverClubCard } from '../../_components/discover-club-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function TrendingClubsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getTrendingClubsAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Trending. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<ClubCard>
      title="Trending"
      description="Most active Clubs in the last 7 days."
      result={result.data}
      locale={locale}
      loadMoreAction="trending"
      loadMoreHrefBase={`/${locale}/discover/clubs/`}
      emptyMessage="No trending Clubs yet. Check back soon."
      renderCard={(item, loc) => (
        <DiscoverClubCard club={item} locale={loc} variant="grid" />
      )}
    />
  )
}
