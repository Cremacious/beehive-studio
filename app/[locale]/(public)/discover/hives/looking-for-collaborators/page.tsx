import { DiscoverRailSubPage } from '../../_components/discover-rail-sub-page'
import {
  getLookingForCollaboratorsHivesAction,
  type HiveCard,
} from '@/lib/actions/discover-hives.actions'
import { DiscoverHiveCard } from '../../_components/discover-hive-card'
import { isValidGenre } from '@/lib/discover/genres'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; cursor?: string }>
}

export default async function LookingForCollaboratorsHivesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams
  const genre = sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  // Looking-for-collaborators locks size to Small internally; ignore ?size= param.
  const result = await getLookingForCollaboratorsHivesAction({
    genre,
    cursor: sp.cursor,
  })

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
          Failed to load Looking for collaborators. Try again later.
        </p>
      </main>
    )
  }

  return (
    <DiscoverRailSubPage<HiveCard>
      title="Looking for collaborators"
      description="Small Hives (2 to 5 members) with recent activity. Room to grow."
      result={result.data}
      locale={locale}
      loadMorePath={`/${locale}/discover/hives/looking-for-collaborators`}
      emptyMessage="No small Hives are currently looking for collaborators. Try a different genre."
      renderCard={(item, loc) => (
        <DiscoverHiveCard hive={item} locale={loc} variant="grid" />
      )}
    />
  )
}
