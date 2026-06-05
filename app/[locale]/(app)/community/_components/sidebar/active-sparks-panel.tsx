import Link from 'next/link'
import { Zap } from 'lucide-react'
import type { ActiveSparkEntry } from '@/lib/types/community'

const STATUS_LABEL: Record<ActiveSparkEntry['status'], string> = {
  submitted: 'Submitted',
  voting: 'Voting open',
  awaiting_winner: 'Awaiting winner',
  won: 'Won!',
}

export function ActiveSparksPanel({
  locale,
  entries,
}: {
  locale: string
  entries: ActiveSparkEntry[]
}) {
  return (
    <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <Zap size={14} className="text-brand" />
        <h3 className="text-sm font-semibold text-foreground">Your Sparks</h3>
      </header>

      {entries.length === 0 ? (
        <div className="text-center py-2">
          <Link
            href={`/${locale}/discover?tab=sparks`}
            className="text-xs px-3 py-1.5 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors inline-block"
          >
            Try a Spark
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.slice(0, 3).map(e => (
            <li key={e.entryId}>
              <Link
                href={`/${locale}/sparks/${e.sparkId}`}
                className="flex flex-col gap-1 text-xs hover:text-brand transition-colors group"
              >
                <span className="text-foreground truncate group-hover:text-brand">{e.sparkPrompt}</span>
                <span className={`text-[10px] inline-block w-fit px-1.5 py-0.5 rounded border ${
                  e.status === 'won'
                    ? 'bg-brand/20 text-brand border-brand/40'
                    : 'text-muted-foreground border-border'
                }`}>
                  {STATUS_LABEL[e.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
