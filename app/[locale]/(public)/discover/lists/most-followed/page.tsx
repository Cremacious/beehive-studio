import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getMostFollowedListsAction,
  type ListCard,
} from '@/lib/actions/discover-lists.actions'
import { DiscoverListCard } from '../../_components/discover-list-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function MostFollowedListsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getMostFollowedListsAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Most followed. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<ListCard>
      title="Most followed"
      description="All-time most-followed Lists across the platform."
      result={result.data}
      locale={locale}
      loadMoreAction="most-followed"
      loadMoreHrefBase={`/${locale}/discover/lists/`}
      emptyMessage="No followed Lists yet. Check back soon."
      renderCard={(item, loc) => (
        <DiscoverListCard list={item} locale={loc} variant="grid" />
      )}
    />
  )
}
