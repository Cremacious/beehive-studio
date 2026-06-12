import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DiscoverRailSubPage } from '../_components/discover-rail-sub-page'
import { getFollowingFeedAction } from '@/lib/actions/discover.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function FollowingPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/following`)}`,
    )
  }

  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getFollowingFeedAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Following. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage
      title="From Authors You Follow"
      description="Recent updates from authors you follow."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/following`}
    />
  )
}
