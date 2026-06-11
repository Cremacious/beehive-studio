import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getFollowingSparksAction,
  type SparkCard,
} from '@/lib/actions/discover-sparks.actions'
import { DiscoverSparkCard } from '../../_components/discover-spark-card'
import { isValidGenre } from '@/lib/discover/genres'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function FollowingSparksPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/sparks/following`)}`,
    )
  }

  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getFollowingSparksAction({ genre, cursor: sp.cursor })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load From writers you follow. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<SparkCard>
      title="From writers you follow"
      description="Recent prompts from writers you follow."
      result={result.data}
      locale={locale}
      loadMoreAction="following"
      loadMoreHrefBase={`/${locale}/discover/sparks/`}
      emptyMessage="No recent prompts from writers you follow."
      renderCard={(item, loc) => (
        <DiscoverSparkCard spark={item} locale={loc} variant="grid" />
      )}
    />
  )
}
