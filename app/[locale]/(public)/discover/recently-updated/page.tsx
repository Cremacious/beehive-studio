import { DiscoverRailSubPage } from '../_components/discover-rail-sub-page'
import { getRecentlyUpdatedBooksAction } from '@/lib/actions/discover.actions'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function RecentlyUpdatedPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getRecentlyUpdatedBooksAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Recently Updated. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage
      title="Recently Updated"
      description="Books with new chapters in the last 7 days. Drive return visits."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/recently-updated`}
    />
  )
}
