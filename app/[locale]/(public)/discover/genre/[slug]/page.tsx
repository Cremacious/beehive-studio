import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getFeaturedFreshBookAction,
  getTrendingBooksAction,
  getRisingStarsBooksAction,
  getRecentlyUpdatedBooksAction,
  getNewReleasesBooksAction,
  getBestOngoingBooksAction,
} from '@/lib/actions/discover.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverRail } from '../../_components/discover-rail'
import { FeaturedFreshHero } from '../../_components/featured-fresh-hero'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export default async function GenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, trending, rising, recentlyUpdated, newReleases, bestOngoing] =
    await Promise.all([
      getFeaturedFreshBookAction({ genre: slug }),
      getTrendingBooksAction({ genre: slug }),
      getRisingStarsBooksAction({ genre: slug }),
      getRecentlyUpdatedBooksAction({ genre: slug }),
      getNewReleasesBooksAction({ genre: slug }),
      getBestOngoingBooksAction({ genre: slug }),
    ])

  const label = GENRE_LABEL[slug]

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Discover
      </Link>

      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Genre hub
        </p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {label}
        </h1>
      </header>

      {hero.success && hero.data && (
        <div className="mb-6">
          <FeaturedFreshHero book={hero.data} locale={locale} />
        </div>
      )}

      {trending.success && (
        <DiscoverRail
          title={`Trending ${label}`}
          subPageHref={`/${locale}/discover/trending?genre=${slug}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {rising.success && (
        <DiscoverRail
          title={`Rising Stars in ${label}`}
          subPageHref={`/${locale}/discover/rising?genre=${slug}`}
          result={rising.data}
          locale={locale}
        />
      )}
      {recentlyUpdated.success && (
        <DiscoverRail
          title={`Recently Updated ${label}`}
          subPageHref={`/${locale}/discover/recently-updated?genre=${slug}`}
          result={recentlyUpdated.data}
          locale={locale}
        />
      )}
      {newReleases.success && (
        <DiscoverRail
          title={`New ${label}`}
          subPageHref={`/${locale}/discover/new-releases?genre=${slug}`}
          result={newReleases.data}
          locale={locale}
        />
      )}
      {bestOngoing.success && (
        <DiscoverRail
          title={`Best Ongoing ${label}`}
          subPageHref={`/${locale}/discover/best-ongoing?genre=${slug}`}
          result={bestOngoing.data}
          locale={locale}
        />
      )}
    </main>
  )
}
