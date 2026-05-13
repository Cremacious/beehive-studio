import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getSparkAction, getSparkEntryAction, getSparkEntryCommentsAction } from '@/lib/actions/sparks.actions'
import { SparkVoteButton } from '../../../../_components/spark-vote-button'
import { SparkEntryCommentsPanel } from '../../../../_components/spark-entry-comments-panel'

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

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Top nav */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-2.5 flex items-center justify-between">
        <Link href={`/${locale}/discover/spark/${sparkId}`} className="text-[#888] text-[13px] hover:text-white transition-colors">
          ← Back to Spark
        </Link>
        <SparkVoteButton
          entryId={entry.id}
          initialVoted={entry.userHasVoted}
          initialCount={entry.voteCount}
          status={spark.status}
          isOwnEntry={isOwnEntry}
          isAuthenticated={!!userId}
        />
      </div>

      {/* Prompt context bar */}
      <div className="px-6 py-2.5 bg-[#181818] border-b border-[#2a2a2a]">
        <p className="text-[#555] text-[12px]">
          ⚡ Spark prompt: <span className="text-[#888] italic">&quot;{spark.prompt}&quot;</span>
        </p>
      </div>

      {/* Entry content */}
      <div className="max-w-[640px] mx-auto px-6 py-9">
        {/* Author header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0" />
          <div>
            <p className="text-[#aaa] text-[13px] font-semibold">{entry.authorDisplayName ?? entry.authorUsername ?? 'Anonymous'}</p>
            <p className="text-[#555] text-[11px]">{entry.wordCount} words · submitted {timeAgo(entry.createdAt)}</p>
          </div>
        </div>

        {/* Full prose */}
        <div className="text-[#ccc] text-[16px] leading-[1.9] whitespace-pre-wrap">
          {entry.content}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#2a2a2a] mx-6" />

      {/* Comments */}
      <div className="max-w-[640px] mx-auto px-6 py-6">
        <SparkEntryCommentsPanel
          entryId={entryId}
          initialComments={comments}
          hasMore={commentsHasMore}
          isAuthenticated={!!userId}
          locale={locale}
        />
      </div>
    </div>
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
