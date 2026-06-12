import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getRecentlyActiveHivesAction,
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

export default async function RecentlyActiveHivesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = ALLOWED_SIZES.includes(sp.size as SizeBucket)
    ? (sp.size as SizeBucket)
    : 'any'
  const result = await getRecentlyActiveHivesAction({
    genre,
    size,
    cursor: sp.cursor,
  })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Recently active. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<HiveCard>
      title="Recently active"
      description="Hives with any activity in the last 7 days, most-recent first."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/hives/recently-active`}
      emptyMessage="No Hives have been active in the last 7 days. Try a different filter."
      renderCard={(item, loc) => (
        <DiscoverHiveCard hive={item} locale={loc} variant="grid" />
      )}
    />
  )
}
