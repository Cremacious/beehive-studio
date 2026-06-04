import { getSparksAction } from '@/lib/actions/sparks.actions'
import { SparkCard } from '../discover/_components/spark-card'

type Props = { params: Promise<{ locale: string }> }

export default async function SparksIndexPage({ params }: Props) {
  const { locale } = await params
  const [activeResult, closedResult] = await Promise.all([
    getSparksAction('active'),
    getSparksAction('closed'),
  ])

  if (!activeResult.success || !closedResult.success) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
        <p className="text-red-400 text-sm">Failed to load sparks.</p>
      </main>
    )
  }

  const activeAndVoting = activeResult.data.sparks
  const active = activeAndVoting.filter((s) => s.status === 'OPEN')
  const voting = activeAndVoting.filter((s) => s.status === 'VOTING')
  const closed = closedResult.data.sparks

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
      <header className="mb-8">
        <h1
          className="text-3xl font-bold text-[var(--brand)]"
          style={{ fontFamily: 'var(--font-comfortaa)' }}
        >
          Sparks
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mt-1">
          Quick writing prompts. Enter, vote, win.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          Active sparks
        </h2>
        {active.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic text-sm">
            No active sparks. Be the first to start one.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {active.map((s) => (
              <SparkCard key={s.id} spark={s} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {voting.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
            Voting now
          </h2>
          <ul className="space-y-2">
            {voting.map((s) => (
              <li key={s.id}>
                <SparkCard spark={s} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
            Past sparks
          </h2>
          <ul className="space-y-2">
            {closed.map((s) => (
              <li key={s.id}>
                <SparkCard spark={s} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
