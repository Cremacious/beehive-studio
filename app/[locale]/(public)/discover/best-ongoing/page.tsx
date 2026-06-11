import { DiscoverRailSubPage } from '../_components/discover-rail-sub-page'
import { getBestOngoingBooksAction } from '@/lib/actions/discover.actions'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function BestOngoingPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getBestOngoingBooksAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Best Ongoing. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage
      title="Best Ongoing"
      description="Actively updating books above the platform engagement median."
      result={result.data}
      locale={locale}
      loadMoreAction="best-ongoing"
    />
  )
}
