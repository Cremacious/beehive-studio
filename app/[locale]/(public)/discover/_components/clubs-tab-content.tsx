import { getClubsAction } from '@/lib/actions/book-clubs.actions'
import { ClubCard } from '@/app/[locale]/(app)/clubs/_components/club-card'

export async function ClubsTabContent({ locale }: { locale: string }) {
  const result = await getClubsAction({ filter: 'discover', limit: 24 })
  if (!result.success) {
    return (
      <p style={{ color: 'var(--status-error)' }} className="italic">
        Failed to load clubs.
      </p>
    )
  }
  const rows = result.data.rows
  if (rows.length === 0) {
    return (
      <p className="text-[var(--canvas-dark-ink-muted)] italic text-center py-12">
        No discoverable clubs yet. Be the first to create one.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {rows.map((club) => (
        <ClubCard key={club.id} club={club} locale={locale} />
      ))}
    </div>
  )
}
