import { DiscoverRailSubPage } from '../_components/discover-rail-sub-page'
import { getNewReleasesBooksAction } from '@/lib/actions/discover.actions'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function NewReleasesPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getNewReleasesBooksAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load New Releases. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage
      title="New Releases"
      description="Recently published books, discovered in the last 30 days."
      result={result.data}
      locale={locale}
      loadMoreAction="new-releases"
    />
  )
}
