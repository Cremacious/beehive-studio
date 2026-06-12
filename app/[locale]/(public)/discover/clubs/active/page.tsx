import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getActiveClubsAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import { DiscoverClubCard } from '../../_components/discover-club-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function ActiveClubsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getActiveClubsAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Active. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<ClubCard>
      title="Active"
      description="Clubs with discussions, book changes, or new members in the last 7 days."
      result={result.data}
      locale={locale}
      loadMoreAction="active"
      loadMoreHrefBase={`/${locale}/discover/clubs/`}
      emptyMessage="No active Clubs right now. Check back soon."
      renderCard={(item, loc) => (
        <DiscoverClubCard club={item} locale={loc} variant="grid" />
      )}
    />
  )
}
