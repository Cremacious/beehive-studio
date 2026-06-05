import { getDiscoverableListsAction } from '@/lib/actions/reading-lists.actions'
import { ListCard } from '@/app/[locale]/(app)/reading-lists/_components/list-card'

export async function ListsTabContent({ locale }: { locale: string }) {
  const result = await getDiscoverableListsAction({ limit: 24 })
  if (!result.success) {
    return <p className="text-red-400">Failed to load lists.</p>
  }
  const rows = result.data.rows
  if (rows.length === 0) {
    return (
      <p className="text-[var(--canvas-dark-ink-muted)] italic text-center py-12">
        No discoverable lists yet. Be the first to create one.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {rows.map((list) => (
        <ListCard key={list.id} list={list} locale={locale} />
      ))}
    </div>
  )
}
