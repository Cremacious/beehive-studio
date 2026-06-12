import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getFollowingClubsAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import { DiscoverClubCard } from '../../_components/discover-club-card'
import { isValidGenre } from '@/lib/discover/genres'
import { auth } from '@/lib/auth'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function FollowingClubsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/discover/clubs/following`)}`,
    )
  }

  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const result = await getFollowingClubsAction({ genre, cursor: sp.cursor })

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
    <DiscoverRailSubPage<ClubCard>
      title="From writers you follow"
      description="Active Clubs run by writers you follow."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/clubs/following`}
      emptyMessage="No Clubs from writers you follow. Try following more writers."
      renderCard={(item, loc) => (
        <DiscoverClubCard club={item} locale={loc} variant="grid" />
      )}
    />
  )
}
