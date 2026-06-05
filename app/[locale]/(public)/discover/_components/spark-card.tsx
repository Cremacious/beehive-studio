import Link from 'next/link'
import type { SparkSummary } from '@/lib/actions/sparks.actions'
import { StatusPill } from './status-pill'
import { VisibilityPill } from './visibility-pill'

function timeLeft(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return ''
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? ` · ${days}d left` : ` · ${hours}h left`
}

export function SparkCard({ spark, locale }: { spark: SparkSummary; locale: string }) {
  const showStatusPill = spark.status !== 'OPEN'
  const showVisibilityPill = spark.visibility !== 'PUBLIC'
  return (
    <Link href={`/${locale}/sparks/${spark.id}`} className="block">
      <div className={`border border-[#2a2a2a] rounded-lg p-4 cursor-pointer hover:border-[#3a3a3a] transition-colors ${
        spark.status === 'VOTING' ? 'bg-[#1a1a2a] border-[#3a3a5a]' : 'bg-[#1a1a1a]'
      }`}>
        <div className="flex justify-between items-start mb-2.5 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {showStatusPill && <StatusPill status={spark.status} />}
            {showVisibilityPill && <VisibilityPill visibility={spark.visibility} />}
            {spark.status === 'OPEN' && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#FFC300]">
                Open{timeLeft(spark.deadline)}
              </span>
            )}
          </div>
          <span className="text-[#555] text-[11px] shrink-0">{spark.entryCount} entries</span>
        </div>
        <p className="text-white text-[14px] font-semibold leading-snug mb-2.5">&ldquo;{spark.prompt}&rdquo;</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-5 h-5 rounded-full bg-[#2a2a2a] shrink-0" />
          <span className="text-[#666] text-[11px]">
            by <span className="text-[#aaa]">{spark.creatorDisplayName ?? spark.creatorUsername ?? 'Unknown'}</span>
          </span>
          {spark.wordLimit && (
            <span className="text-[#444] text-[11px]">· max {spark.wordLimit} words</span>
          )}
        </div>
        {spark.status === 'CLOSED' && spark.winnerUsername && (
          <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
            <span className="text-[11px] text-[#FFC300]">🏆 {spark.winnerUsername}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
