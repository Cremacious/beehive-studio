import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getSparkAction, getSparkEntriesAction, getSparkEntryAction } from '@/lib/actions/sparks.actions'
import { SparkEntryCard } from '../../../discover/_components/spark-entry-card'
import { SparkSubmitPanel } from '../../../discover/_components/spark-submit-panel'
import { StatusPill } from '../../../discover/_components/status-pill'
import { VisibilityPill } from '../../../discover/_components/visibility-pill'
import { Countdown } from '../../../discover/_components/countdown'
import { PageHead } from '@/components/community/page-head'
import { SparkLikeButton } from '@/components/community/spark-like-button'

type Props = { params: Promise<{ locale: string; sparkId: string }> }

export default async function SparkDetailPage({ params }: Props) {
  const { locale, sparkId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const [sparkResult, entriesResult] = await Promise.all([
    getSparkAction(sparkId),
    getSparkEntriesAction(sparkId, 'top', 1),
  ])

  if (!sparkResult.success) notFound()
  const spark = sparkResult.data
  const entries = entriesResult.success ? entriesResult.data.entries : []
  const entriesHasMore = entriesResult.success ? entriesResult.data.hasMore : false

  const isCreator = userId === spark.creatorUserId
  const hasUserEntry = entries.some((e) => e.authorUserId === userId)

  // Fetch winner/creator-choice entry author names for CLOSED spark banner
  let winnerEntry: { authorDisplayName: string | null; authorUsername: string | null } | null = null
  let creatorChoiceEntry: { authorDisplayName: string | null; authorUsername: string | null } | null = null

  if (spark.status === 'CLOSED') {
    const [w, cc] = await Promise.all([
      spark.winnerEntryId
        ? getSparkEntryAction(sparkId, spark.winnerEntryId)
        : Promise.resolve(null),
      spark.creatorChoiceEntryId && spark.creatorChoiceEntryId !== spark.winnerEntryId
        ? getSparkEntryAction(sparkId, spark.creatorChoiceEntryId)
        : Promise.resolve(null),
    ])
    if (w?.success) winnerEntry = w.data
    if (cc?.success) creatorChoiceEntry = cc.data
  }

  const deadlineStr = spark.deadline.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const creatorLabel =
    spark.creatorUsername
      ? `@${spark.creatorUsername}`
      : (spark.creatorDisplayName ?? 'Unknown')

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl">
        <PageHead
          back={{ href: `/${locale}/community/sparks`, label: 'sparks' }}
          eyebrow={`Spark · ${creatorLabel}`}
          title={spark.title}
          subtitle={
            <span className="flex flex-wrap items-center gap-3">
              <StatusPill status={spark.status} />
              <VisibilityPill visibility={spark.visibility} />
              {spark.status === 'VOTING' && spark.votingEndsAt ? (
                <span className="deadline">
                  <Clock size={14} />
                  <Countdown to={spark.votingEndsAt} prefix="Voting ends in" />
                </span>
              ) : null}
              <span className="meta-mono">{spark.entryCount} entries</span>
              <span className="meta-mono">closes {deadlineStr}</span>
              {spark.wordLimit ? (
                <span className="meta-mono">max {spark.wordLimit} words</span>
              ) : null}
              <SparkLikeButton
                sparkId={spark.id}
                initialLiked={spark.viewerLiked}
                initialCount={spark.likeCount}
                isAuthenticated={!!userId}
                locale={locale}
                size="md"
              />
            </span>
          }
        />

        {/* Prompt hero blockquote */}
        {spark.prompt ? (
          <blockquote
            className="max-w-[65ch]"
            style={{
              margin: '0 0 22px 0',
              borderLeft: '4px solid var(--brand)',
              paddingLeft: '16px',
              color: 'var(--canvas-dark-ink)',
              fontFamily: 'var(--font-prose)',
              fontSize: '18px',
              fontStyle: 'italic',
              lineHeight: 1.55,
            }}
          >
            {spark.prompt}
          </blockquote>
        ) : null}

        {/* Optional Context section */}
        {spark.description ? (
          <section style={{ marginBottom: 22 }} className="max-w-[65ch]">
            <div
              className="eyebrow-mono"
              style={{ marginBottom: 6 }}
            >
              CONTEXT
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-prose)',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--canvas-dark-ink)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {spark.description}
            </p>
          </section>
        ) : null}


        {/* CLOSED: Winner banner */}
        {spark.status === 'CLOSED' && spark.winnerEntryId && (
          <section
            className="panel panel-pad"
            style={{ marginBottom: 22, borderColor: 'oklch(from var(--brand) l c h / 0.4)' }}
          >
            <p
              style={{
                color: 'var(--brand)',
                fontSize: 13,
                fontWeight: 600,
                margin: 0,
              }}
            >
              Most Voted:{' '}
              <span style={{ color: 'var(--canvas-dark-ink-strong)' }}>
                {winnerEntry?.authorDisplayName ?? winnerEntry?.authorUsername ?? 'Unknown'}
              </span>
            </p>
            {spark.creatorChoiceEntryId && spark.creatorChoiceEntryId !== spark.winnerEntryId && (
              <p
                style={{
                  color: 'var(--canvas-dark-ink-muted)',
                  fontSize: 12,
                  marginTop: 6,
                  marginBottom: 0,
                }}
              >
                ★ Creator&apos;s choice:{' '}
                <span style={{ color: 'var(--canvas-dark-ink)' }}>
                  {creatorChoiceEntry?.authorDisplayName ??
                    creatorChoiceEntry?.authorUsername ??
                    'Unknown'}
                </span>
              </p>
            )}
          </section>
        )}

        {/* Submit panel (OPEN + authenticated + not creator + no existing entry).
            The spark creator can't enter their own spark; hide the form rather
            than surfacing a NOT_ALLOWED error on every submit attempt. */}
        {spark.status === 'OPEN' && userId && !isCreator && !hasUserEntry && (
          <section className="panel" style={{ marginBottom: 22 }}>
            <SparkSubmitPanel sparkId={sparkId} wordLimit={spark.wordLimit} />
          </section>
        )}

        {/* Creator's own-spark notice during OPEN — replaces the submit form. */}
        {spark.status === 'OPEN' && userId && isCreator && (
          <section
            className="panel panel-pad"
            style={{ marginBottom: 22, textAlign: 'center' }}
          >
            <p className="meta" style={{ margin: 0 }}>
              You created this Spark. Once entries arrive, you'll pick a creator's choice winner.
            </p>
          </section>
        )}

        {/* Sign-in prompt for guests during OPEN */}
        {spark.status === 'OPEN' && !userId && (
          <section
            className="panel panel-pad"
            style={{ marginBottom: 22, textAlign: 'center' }}
          >
            <p className="meta" style={{ margin: 0 }}>
              <Link
                href={`/${locale}/sign-in`}
                style={{ color: 'var(--brand)', textDecoration: 'none' }}
              >
                Sign in
              </Link>{' '}
              to submit an entry.
            </p>
          </section>
        )}

        {/* VOTING/CLOSED submissions-closed notice */}
        {spark.status !== 'OPEN' && (
          <section
            className="panel panel-pad"
            style={{ marginBottom: 22, textAlign: 'center' }}
          >
            <div className="eyebrow-mono" style={{ marginBottom: 8 }}>
              {spark.status === 'VOTING' ? 'Submissions closed' : 'Spark closed'}
            </div>
            <p className="meta" style={{ margin: 0 }}>
              {spark.status === 'VOTING'
                ? 'Entries are locked while voting is open. Cast your vote by liking your favorites below.'
                : 'Voting has ended. Browse the final entries below.'}
            </p>
          </section>
        )}

        {/* Entries */}
        <section className="panel" aria-label="Entries" style={{ marginBottom: 22 }}>
          <div
            className="eyebrow-mono"
            style={{ padding: '14px 18px 8px', borderBottom: '1px solid var(--canvas-dark-300)' }}
          >
            {spark.entryCount} {spark.entryCount === 1 ? 'Entry' : 'Entries'}
          </div>
          {entries.length === 0 ? (
            <p
              className="meta"
              style={{ padding: '32px 18px', textAlign: 'center', margin: 0 }}
            >
              No entries yet. Be the first!
            </p>
          ) : (
            <div className="flex flex-col gap-2.5" style={{ padding: 14 }}>
              {entries.map((entry) => (
                <SparkEntryCard
                  key={entry.id}
                  entry={entry}
                  sparkId={sparkId}
                  locale={locale}
                  sparkStatus={spark.status}
                  currentUserId={userId}
                  isSparkCreator={isCreator}
                />
              ))}
            </div>
          )}
          {entriesHasMore && (
            <p
              className="meta"
              style={{
                textAlign: 'center',
                padding: '0 18px 16px',
                margin: 0,
                cursor: 'pointer',
              }}
            >
              Show more entries
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
