import Link from 'next/link'
import { Users } from 'lucide-react'

type Hive = { id: string; name: string; memberCount: number; isPublic: boolean }

export function MyHivesPanel({ locale, hives }: { locale: string; hives: Hive[] }) {
  const visible = hives.slice(0, 5)
  const hasMore = hives.length > 5

  return (
    <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Your Hives</h3>
        <span className="text-xs text-muted-foreground">{hives.length}</span>
      </header>

      {hives.length === 0 ? (
        <div className="flex flex-col gap-2 text-center py-2">
          <p className="text-xs text-muted-foreground">Join or create a Hive to write together.</p>
          <Link
            href={`/${locale}/discover?tab=hives`}
            className="text-xs px-3 py-1.5 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors inline-block"
          >
            Browse Hives
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(h => (
            <li key={h.id}>
              <Link
                href={`/${locale}/hive/${h.id}`}
                className="flex items-center justify-between gap-2 text-xs text-foreground hover:text-brand transition-colors"
              >
                <span className="truncate">{h.name}</span>
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Users size={10} />
                  {h.memberCount}
                </span>
              </Link>
            </li>
          ))}
          {hasMore && (
            <li>
              <Link href={`/${locale}/discover?tab=hives`} className="text-xs text-brand hover:underline">
                View all ({hives.length})
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
