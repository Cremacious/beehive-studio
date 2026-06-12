import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getNewClubsAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import { DiscoverClubCard } from '../../_components/discover-club-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function NewClubsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getNewClubsAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load New. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<ClubCard>
      title="New"
      description="Clubs that became discoverable in the last 30 days."
      result={result.data}
      locale={locale}
      loadMoreAction="new"
      loadMoreHrefBase={`/${locale}/discover/clubs/`}
      emptyMessage="No new Clubs in the last 30 days. Check back soon."
      renderCard={(item, loc) => (
        <DiscoverClubCard club={item} locale={loc} variant="grid" />
      )}
    />
  )
}
