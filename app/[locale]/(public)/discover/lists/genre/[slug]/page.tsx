import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getFeaturedListAction,
  getTrendingListsAction,
  getRecentlyUpdatedListsAction,
  getNewListsAction,
  getMostFollowedListsAction,
} from '@/lib/actions/discover-lists.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverListRail } from '../../../_components/discover-list-rail'
import { FeaturedListHero } from '../../../_components/featured-list-hero'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export default async function ListGenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, trending, recentlyUpdated, newLists, mostFollowed] =
    await Promise.all([
      getFeaturedListAction({ genre: slug }),
      getTrendingListsAction({ genre: slug }),
      getRecentlyUpdatedListsAction({ genre: slug }),
      getNewListsAction({ genre: slug }),
      getMostFollowedListsAction({ genre: slug }),
    ])

  const label = GENRE_LABEL[slug]

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=lists`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Lists
      </Link>

      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Lists genre hub
        </p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {label}
        </h1>
      </header>

      {hero.success && hero.data && (
        <FeaturedListHero list={hero.data} locale={locale} />
      )}

      {trending.success && (
        <DiscoverListRail
          title={`Trending ${label} Lists`}
          subPageHref={`/${locale}/discover/lists/trending?genre=${slug}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {recentlyUpdated.success && (
        <DiscoverListRail
          title={`Recently updated in ${label}`}
          subPageHref={`/${locale}/discover/lists/recently-updated?genre=${slug}`}
          result={recentlyUpdated.data}
          locale={locale}
        />
      )}
      {newLists.success && (
        <DiscoverListRail
          title={`New ${label} Lists`}
          subPageHref={`/${locale}/discover/lists/new?genre=${slug}`}
          result={newLists.data}
          locale={locale}
        />
      )}
      {mostFollowed.success && (
        <DiscoverListRail
          title={`Most followed in ${label}`}
          subPageHref={`/${locale}/discover/lists/most-followed?genre=${slug}`}
          result={mostFollowed.data}
          locale={locale}
        />
      )}
    </main>
  )
}
