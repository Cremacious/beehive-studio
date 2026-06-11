import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getFeaturedSparkAction,
  getLiveNowSparksAction,
  getVotingNowSparksAction,
  getHeatingUpSparksAction,
  getNewlyOpenedSparksAction,
  getRecentlyWonSparksAction,
} from '@/lib/actions/discover-sparks.actions'
import { isValidGenre, GENRE_LABEL } from '@/lib/discover/genres'
import { DiscoverSparkRail } from '../../../_components/discover-spark-rail'
import { FeaturedSparkHero } from '../../../_components/featured-spark-hero'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export default async function SparkGenreHubPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isValidGenre(slug)) notFound()

  const [hero, liveNow, votingNow, heatingUp, newlyOpened, recentlyWon] =
    await Promise.all([
      getFeaturedSparkAction({ genre: slug }),
      getLiveNowSparksAction({ genre: slug }),
      getVotingNowSparksAction({ genre: slug }),
      getHeatingUpSparksAction({ genre: slug }),
      getNewlyOpenedSparksAction({ genre: slug }),
      getRecentlyWonSparksAction({ genre: slug }),
    ])

  const label = GENRE_LABEL[slug]

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=sparks`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Sparks
      </Link>

      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)]">
          Sparks genre hub
        </p>
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {label}
        </h1>
      </header>

      {hero.success && hero.data && (
        <FeaturedSparkHero spark={hero.data} locale={locale} />
      )}

      {liveNow.success && (
        <DiscoverSparkRail
          title={`Live now in ${label}`}
          subPageHref={`/${locale}/discover/sparks/live-now?genre=${slug}`}
          result={liveNow.data}
          locale={locale}
          showUrgencyCaption
        />
      )}
      {votingNow.success && (
        <DiscoverSparkRail
          title={`Voting now in ${label}`}
          subPageHref={`/${locale}/discover/sparks/voting-now?genre=${slug}`}
          result={votingNow.data}
          locale={locale}
        />
      )}
      {heatingUp.success && (
        <DiscoverSparkRail
          title={`Heating up in ${label}`}
          subPageHref={`/${locale}/discover/sparks/heating-up?genre=${slug}`}
          result={heatingUp.data}
          locale={locale}
        />
      )}
      {newlyOpened.success && (
        <DiscoverSparkRail
          title={`Newly opened in ${label}`}
          subPageHref={`/${locale}/discover/sparks/newly-opened?genre=${slug}`}
          result={newlyOpened.data}
          locale={locale}
        />
      )}
      {recentlyWon.success && (
        <DiscoverSparkRail
          title={`Recently won in ${label}`}
          subPageHref={`/${locale}/discover/sparks/recently-won?genre=${slug}`}
          result={recentlyWon.data}
          locale={locale}
        />
      )}
    </main>
  )
}
