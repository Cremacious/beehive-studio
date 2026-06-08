import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
  getSparkAction,
  getSparkEntryAction,
  getSparkEntryCommentsAction,
} from '@/lib/actions/sparks.actions'
import { SparkVoteButton } from '../../../../discover/_components/spark-vote-button'
import { SparkEntryCommentsPanel } from '../../../../discover/_components/spark-entry-comments-panel'
import { deriveTitle } from '@/lib/sparks/derive-title'

type Props = { params: Promise<{ locale: string; sparkId: string; entryId: string }> }

export default async function SparkEntryPage({ params }: Props) {
  const { locale, sparkId, entryId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const [sparkResult, entryResult, commentsResult] = await Promise.all([
    getSparkAction(sparkId),
    getSparkEntryAction(sparkId, entryId),
    getSparkEntryCommentsAction(entryId, 1),
  ])

  if (!sparkResult.success || !entryResult.success) notFound()
  const spark = sparkResult.data
  const entry = entryResult.data
  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false

  const isOwnEntry = userId === entry.authorUserId
  const displayTitle = deriveTitle(entry.title, entry.content)
  const authorLabel = entry.authorDisplayName ?? entry.authorUsername ?? 'Anonymous'
  const paragraphs = entry.content.split(/\n\n+/).filter((p) => p.trim().length > 0)

  return (
    <main className="cm-main">
      <div className="cm-wrap w-3xl" data-screen-label="Spark entry reader">
        <Link
          href={`/${locale}/sparks/${sparkId}`}
          className="eyebrow-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            marginBottom: 6,
          }}
        >
          ← Spark · {spark.prompt}
        </Link>

        <header style={{ marginBottom: 22 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: '-0.02em',
              lineHeight: 1.08,
              color: 'var(--canvas-dark-ink-strong)',
              margin: '12px 0 16px',
              textWrap: 'balance',
            }}
          >
            {displayTitle}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span className="avatar s40 a-mint" aria-hidden="true">
              {authorLabel.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--canvas-dark-ink-strong)',
                }}
              >
                {authorLabel}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--canvas-dark-ink-muted)',
                  marginTop: 2,
                }}
              >
                {entry.authorUsername ? `@${entry.authorUsername} · ` : ''}
                {entry.wordCount} words · submitted {timeAgo(entry.createdAt)}
              </div>
            </div>
          </div>
        </header>

        <article
          style={{
            fontFamily: 'var(--font-prose)',
            fontSize: 18,
            lineHeight: 1.75,
            color: 'var(--canvas-dark-ink)',
          }}
        >
          {paragraphs.length > 0 ? (
            paragraphs.map((para, i) => (
              <p
                key={i}
                style={{ margin: '0 0 1.3em', textWrap: 'pretty', whiteSpace: 'pre-wrap' }}
              >
                {para}
              </p>
            ))
          ) : (
            <p style={{ margin: '0 0 1.3em', whiteSpace: 'pre-wrap' }}>{entry.content}</p>
          )}
        </article>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '20px 0',
            margin: '8px 0 28px',
            borderTop:
              '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
            borderBottom:
              '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
          }}
        >
          <SparkVoteButton
            entryId={entry.id}
            initialVoted={entry.userHasVoted}
            initialCount={entry.voteCount}
            status={spark.status}
            isOwnEntry={isOwnEntry}
            isAuthenticated={!!userId}
          />
        </div>

        <SparkEntryCommentsPanel
          entryId={entryId}
          initialComments={comments}
          hasMore={commentsHasMore}
          isAuthenticated={!!userId}
          locale={locale}
        />
      </div>
    </main>
  )
}

function timeAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
