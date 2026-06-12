import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getTrendingHivesAction,
  type HiveCard,
  type SizeBucket,
} from '@/lib/actions/discover-hives.actions'
import { DiscoverHiveCard } from '../../_components/discover-hive-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; size?: string; cursor?: string }>
}

const ALLOWED_SIZES: SizeBucket[] = ['any', 'small', 'mid', 'large']

export default async function TrendingHivesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = ALLOWED_SIZES.includes(sp.size as SizeBucket)
    ? (sp.size as SizeBucket)
    : 'any'
  const result = await getTrendingHivesAction({
    genre,
    size,
    cursor: sp.cursor,
  })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Trending now. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<HiveCard>
      title="Trending now"
      description="Active Hives in the last 7 days, weighted by buzz posts, discussions, chapter updates, and submissions."
      result={result.data}
      locale={locale}
      loadMoreAction="trending"
      loadMoreHrefBase={`/${locale}/discover/hives/`}
      emptyMessage="No active Hives match this filter yet. Try a different size or genre."
      renderCard={(item, loc) => (
        <DiscoverHiveCard hive={item} locale={loc} variant="grid" />
      )}
    />
  )
}
