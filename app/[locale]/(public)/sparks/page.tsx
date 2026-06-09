import Link from 'next/link'
import { Plus, Sparkles, Search } from 'lucide-react'
import { getSparksAction } from '@/lib/actions/sparks.actions'
import { PageHead } from '@/components/community/page-head'
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
      <main className="cm-main">
        <div className="cm-wrap w-5xl">
          <p className="text-red-400 text-sm">Failed to load sparks.</p>
        </div>
      </main>
    )
  }

  const activeAndVoting = activeResult.data.sparks
  const active = activeAndVoting.filter((s) => s.status === 'OPEN')
  const voting = activeAndVoting.filter((s) => s.status === 'VOTING')
  const closed = closedResult.data.sparks
  const allEmpty = active.length === 0 && voting.length === 0 && closed.length === 0

  return (
    <main className="cm-main">
      <div className="cm-wrap w-5xl">
        <PageHead
          title="Sparks"
          subtitle="Quick prompts, real deadlines. Write, share, and vote on the best entries."
          headerSlot={
            <Link href={`/${locale}/sparks/new`} className="btn-brand">
              <Plus />
              New Spark
            </Link>
          }
        />

        {allEmpty ? (
          <section className="panel">
            <div className="empty">
              <span className="glyph">
                <Sparkles />
              </span>
              <h2>No active sparks</h2>
              <p>
                Sparks are short writing prompts with real deadlines. Start one and see who
                shows up — or browse past sparks for inspiration.
              </p>
              <div className="cta-row">
                <Link href={`/${locale}/sparks/new`} className="btn-brand">
                  <Plus />
                  New Spark
                </Link>
                <Link href={`/${locale}/discover?tab=sparks`} className="btn-tile">
                  <Search />
                  Browse closed
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="sec-block">
            <div className="sec-label">
              <h2>Accepting entries</h2>
              <span className="count">
                {active.length} open
              </span>
            </div>
            {active.length === 0 ? (
              <p className="empty-line">
                No active sparks. Be the first to start one.
              </p>
            ) : (
              <div className="grid-3">
                {active.map((s) => (
                  <SparkCard key={s.id} spark={s} locale={locale} />
                ))}
              </div>
            )}
          </div>
        )}

        {voting.length > 0 && (
          <div className="sec-block">
            <div className="sec-label">
              <h2>Voting now</h2>
              <span className="count">{voting.length} in voting</span>
            </div>
            <div className="grid-3">
              {voting.map((s) => (
                <SparkCard key={s.id} spark={s} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {closed.length > 0 && (
          <div className="sec-block" style={{ marginBottom: 0 }}>
            <div className="sec-label">
              <h2>Past sparks</h2>
              <span className="count">{closed.length} closed</span>
            </div>
            <div className="grid-2">
              {closed.map((s) => (
                <SparkCard key={s.id} spark={s} locale={locale} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
