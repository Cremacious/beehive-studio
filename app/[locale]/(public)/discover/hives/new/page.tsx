import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getNewHivesAction,
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

export default async function NewHivesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = ALLOWED_SIZES.includes(sp.size as SizeBucket)
    ? (sp.size as SizeBucket)
    : 'any'
  const result = await getNewHivesAction({
    genre,
    size,
    cursor: sp.cursor,
  })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load New communities. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<HiveCard>
      title="New communities"
      description="Hives that became discoverable in the last 30 days."
      result={result.data}
      locale={locale}
      loadMoreAction="new"
      loadMoreHrefBase={`/${locale}/discover/hives/`}
      emptyMessage="No new Hives in the last 30 days. Check back soon."
      renderCard={(item, loc) => (
        <DiscoverHiveCard hive={item} locale={loc} variant="grid" />
      )}
    />
  )
}
