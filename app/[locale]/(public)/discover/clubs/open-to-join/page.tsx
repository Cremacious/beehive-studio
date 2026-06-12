import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getOpenToJoinClubsAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import { DiscoverClubCard } from '../../_components/discover-club-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function OpenToJoinClubsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getOpenToJoinClubsAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Open to join. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<ClubCard>
      title="Open to join"
      description="Clubs accepting members right now, sorted by community size."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/clubs/open-to-join`}
      emptyMessage="No open Clubs right now. Check back soon."
      renderCard={(item, loc) => (
        <DiscoverClubCard club={item} locale={loc} variant="grid" />
      )}
    />
  )
}
