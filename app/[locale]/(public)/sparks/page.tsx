import Link from 'next/link'
import { Plus, Sparkles, Search, Flame, Vote, Archive } from 'lucide-react'
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
          back={{ href: `/${locale}/community`, label: 'community' }}
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
            <div className="section-head">
              <span className="ico"><Flame /></span>
              <h2 className="title">Live now</h2>
              <span className="pill">{active.length} accepting</span>
            </div>
            {active.length === 0 ? (
              <section className="panel">
                <div className="empty empty-inline">
                  <span className="glyph">
                    <Sparkles />
                  </span>
                  <h2>No active sparks</h2>
                  <p>
                    Sparks are short writing prompts with real deadlines. Start one
                    and see who shows up.
                  </p>
                  <div className="cta-row">
                    <Link href={`/${locale}/sparks/new`} className="btn-brand">
                      <Plus />
                      Start a Spark
                    </Link>
                    <Link
                      href={`/${locale}/discover?tab=sparks`}
                      className="btn-tile"
                    >
                      <Search />
                      Browse past sparks
                    </Link>
                  </div>
                </div>
              </section>
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
            <div className="section-head">
              <span className="ico"><Vote /></span>
              <h2 className="title">Pick your favorites</h2>
              <span className="pill">{voting.length} in voting</span>
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
            <div className="section-head">
              <span className="ico"><Archive /></span>
              <h2 className="title">Wrapped up</h2>
              <span className="pill">{closed.length} closed</span>
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
