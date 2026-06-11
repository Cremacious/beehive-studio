import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getNewlyOpenedSparksAction,
  type SparkCard,
} from '@/lib/actions/discover-sparks.actions'
import { DiscoverSparkCard } from '../../_components/discover-spark-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function NewlyOpenedPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getNewlyOpenedSparksAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Newly opened. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<SparkCard>
      title="Newly opened"
      description="Recently opened Sparks. Fresh prompts to enter."
      result={result.data}
      locale={locale}
      loadMoreAction="newly-opened"
      loadMoreHrefBase={`/${locale}/discover/sparks/`}
      emptyMessage="No Sparks have opened recently."
      renderCard={(item, loc) => (
        <DiscoverSparkCard spark={item} locale={loc} variant="grid" />
      )}
    />
  )
}
