import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getSparkAction, getSparkEntriesAction, getSparkEntryAction } from '@/lib/actions/sparks.actions'
import { SparkEntryCard } from '../../_components/spark-entry-card'
import { SparkSubmitPanel } from '../../_components/spark-submit-panel'

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
  const hasUserEntry = entries.some(e => e.authorUserId === userId)

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

  // Format deadline
  const deadlineStr = spark.deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const STATUS_STYLES = {
    OPEN: { badge: '⚡ OPEN', bg: 'bg-[#2a1a00]', text: 'text-[#FFC300]' },
    VOTING: { badge: '🗳 VOTING', bg: 'bg-[#1a1a3a]', text: 'text-[#8888ff]' },
    CLOSED: { badge: '✓ CLOSED', bg: 'bg-[#1e1e1e]', text: 'text-[#555]' },
  }
  const statusStyle = STATUS_STYLES[spark.status]

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Nav */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-2.5">
        <Link href={`/${locale}/discover?tab=sparks`} className="text-[#888] text-[13px] hover:text-white transition-colors">
          ← Sparks
        </Link>
      </div>

      {/* Hero */}
      <div className="px-6 py-6 border-b border-[#2a2a2a]">
        <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full mb-3 ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.badge}
        </span>
        <p className="text-white text-[20px] font-bold leading-snug max-w-[640px] mb-3">&ldquo;{spark.prompt}&rdquo;</p>
        <div className="flex items-center gap-2 text-[#666] text-[12px] flex-wrap">
          <div className="w-5 h-5 rounded-full bg-[#2a2a2a]" />
          <span>by <span className="text-[#aaa]">{spark.creatorDisplayName ?? spark.creatorUsername ?? 'Unknown'}</span></span>
          <span>·</span>
          <span>{spark.entryCount} entries</span>
          <span>·</span>
          <span>closes {deadlineStr}</span>
          {spark.wordLimit && <><span>·</span><span>max {spark.wordLimit} words</span></>}
        </div>
      </div>

      {/* CLOSED: Winner banner */}
      {spark.status === 'CLOSED' && spark.winnerEntryId && (
        <div className="px-6 py-4 bg-[#1a1500] border-b border-[#3a2a00]">
          <p className="text-[#FFC300] text-[13px] font-semibold">
            🏆 Most Voted: <span className="text-white">{winnerEntry?.authorDisplayName ?? winnerEntry?.authorUsername ?? 'Unknown'}</span>
          </p>
          {spark.creatorChoiceEntryId && spark.creatorChoiceEntryId !== spark.winnerEntryId && (
            <p className="text-[#888] text-[12px] mt-1">
              ⭐ Creator&apos;s choice: <span className="text-[#aaa]">{creatorChoiceEntry?.authorDisplayName ?? creatorChoiceEntry?.authorUsername ?? 'Unknown'}</span>
            </p>
          )}
        </div>
      )}

      {/* Submit panel (OPEN + authenticated + no existing entry) */}
      {spark.status === 'OPEN' && userId && !hasUserEntry && (
        <SparkSubmitPanel sparkId={sparkId} wordLimit={spark.wordLimit} />
      )}

      {/* Sign-in prompt for guests during OPEN */}
      {spark.status === 'OPEN' && !userId && (
        <div className="px-6 py-4 bg-[#181818] border-b border-[#2a2a2a] text-[#666] text-[13px]">
          <Link href={`/${locale}/sign-in`} className="text-[#FFC300] hover:underline">Sign in</Link> to submit an entry
        </div>
      )}

      {/* Entries */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#555] text-[11px] uppercase tracking-wider">{spark.entryCount} Entries</p>
        </div>
        {entries.length === 0 ? (
          <p className="text-[#555] text-[13px] py-8 text-center">No entries yet. Be the first!</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {entries.map(entry => (
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
          <p className="text-[#555] text-[12px] text-center mt-4 cursor-pointer hover:text-white transition-colors">
            Show more entries
          </p>
        )}
      </div>
    </div>
  )
}
