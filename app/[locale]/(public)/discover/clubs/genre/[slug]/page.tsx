import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getFeaturedClubAction,
  getTrendingClubsAction,
  getActiveClubsAction,
  getNewClubsAction,
  getOpenToJoinClubsAction,
} from '@/lib/actions/discover-clubs.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverClubRail } from '../../../_components/discover-club-rail'
import { FeaturedClubHero } from '../../../_components/featured-club-hero'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export default async function ClubGenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, trending, active, newClubs, openToJoin] = await Promise.all([
    getFeaturedClubAction({ genre: slug }),
    getTrendingClubsAction({ genre: slug }),
    getActiveClubsAction({ genre: slug }),
    getNewClubsAction({ genre: slug }),
    getOpenToJoinClubsAction({ genre: slug }),
  ])

  const label = GENRE_LABEL[slug]

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=clubs`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Clubs
      </Link>

      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Clubs genre hub
        </p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {label}
        </h1>
      </header>

      {hero.success && hero.data && (
        <FeaturedClubHero club={hero.data} locale={locale} />
      )}

      {trending.success && (
        <DiscoverClubRail
          title={`Trending ${label} Clubs`}
          subPageHref={`/${locale}/discover/clubs/trending?genre=${slug}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {active.success && (
        <DiscoverClubRail
          title={`Active in ${label}`}
          subPageHref={`/${locale}/discover/clubs/active?genre=${slug}`}
          result={active.data}
          locale={locale}
        />
      )}
      {newClubs.success && (
        <DiscoverClubRail
          title={`New ${label} Clubs`}
          subPageHref={`/${locale}/discover/clubs/new?genre=${slug}`}
          result={newClubs.data}
          locale={locale}
        />
      )}
      {openToJoin.success && (
        <DiscoverClubRail
          title={`Open to join in ${label}`}
          subPageHref={`/${locale}/discover/clubs/open-to-join?genre=${slug}`}
          result={openToJoin.data}
          locale={locale}
        />
      )}
    </main>
  )
}
