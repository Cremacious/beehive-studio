import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getFeaturedHiveAction,
  getTrendingHivesAction,
  getRecentlyActiveHivesAction,
  getNewHivesAction,
  getLookingForCollaboratorsHivesAction,
} from '@/lib/actions/discover-hives.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverHiveRail } from '../../../_components/discover-hive-rail'
import { FeaturedHiveHero } from '../../../_components/featured-hive-hero'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export default async function HiveGenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, trending, recentlyActive, newHives, lookingForCollab] =
    await Promise.all([
      getFeaturedHiveAction({ genre: slug }),
      getTrendingHivesAction({ genre: slug }),
      getRecentlyActiveHivesAction({ genre: slug }),
      getNewHivesAction({ genre: slug }),
      getLookingForCollaboratorsHivesAction({ genre: slug }),
    ])

  const label = GENRE_LABEL[slug]

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=hives`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Hives
      </Link>

      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Hives genre hub
        </p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {label}
        </h1>
      </header>

      {hero.success && hero.data && (
        <FeaturedHiveHero hive={hero.data} locale={locale} />
      )}

      {trending.success && (
        <DiscoverHiveRail
          title={`Trending ${label} Hives`}
          subPageHref={`/${locale}/discover/hives/trending?genre=${slug}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {recentlyActive.success && (
        <DiscoverHiveRail
          title={`Recently active in ${label}`}
          subPageHref={`/${locale}/discover/hives/recently-active?genre=${slug}`}
          result={recentlyActive.data}
          locale={locale}
        />
      )}
      {newHives.success && (
        <DiscoverHiveRail
          title={`New ${label} communities`}
          subPageHref={`/${locale}/discover/hives/new?genre=${slug}`}
          result={newHives.data}
          locale={locale}
        />
      )}
      {lookingForCollab.success && (
        <DiscoverHiveRail
          title={`Looking for collaborators (${label})`}
          subPageHref={`/${locale}/discover/hives/looking-for-collaborators?genre=${slug}`}
          result={lookingForCollab.data}
          locale={locale}
        />
      )}
    </main>
  )
}
