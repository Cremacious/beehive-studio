import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getFollowingHivesAction,
  type HiveCard,
  type SizeBucket,
} from '@/lib/actions/discover-hives.actions'
import { DiscoverHiveCard } from '../../_components/discover-hive-card'
import { isValidGenre } from '@/lib/discover/genres'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; size?: string; cursor?: string }>
}

const ALLOWED_SIZES: SizeBucket[] = ['any', 'small', 'mid', 'large']

export default async function FollowingHivesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/hives/following`)}`,
    )
  }

  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = ALLOWED_SIZES.includes(sp.size as SizeBucket)
    ? (sp.size as SizeBucket)
    : 'any'
  const result = await getFollowingHivesAction({
    genre,
    size,
    cursor: sp.cursor,
  })

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
    <DiscoverRailSubPage<HiveCard>
      title="From writers you follow"
      description="Active Hives owned by writers you follow."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/hives/following`}
      emptyMessage="No active Hives from writers you follow. Try following more writers."
      renderCard={(item, loc) => (
        <DiscoverHiveCard hive={item} locale={loc} variant="grid" />
      )}
    />
  )
}
