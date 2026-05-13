import Link from 'next/link'
import type { SparkSummary } from '@/lib/actions/sparks.actions'

const STATUS_STYLES = {
  OPEN: { badge: '⚡ OPEN', bg: 'bg-[#2a1a00]', text: 'text-[#FFC300]' },
  VOTING: { badge: '🗳 VOTING', bg: 'bg-[#1a1a3a]', text: 'text-[#8888ff]' },
  CLOSED: { badge: '✓ CLOSED', bg: 'bg-[#1e1e1e]', text: 'text-[#444]' },
}

function timeLeft(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return ''
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? ` · ${days}d left` : ` · ${hours}h left`
}

export function SparkCard({ spark, locale }: { spark: SparkSummary; locale: string }) {
  const style = STATUS_STYLES[spark.status]
  return (
    <Link href={`/${locale}/discover/spark/${spark.id}`} className="block">
      <div className={`border border-[#2a2a2a] rounded-lg p-4 cursor-pointer hover:border-[#3a3a3a] transition-colors ${
        spark.status === 'VOTING' ? 'bg-[#1a1a2a] border-[#3a3a5a]' : 'bg-[#1a1a1a]'
      }`}>
        <div className="flex justify-between items-start mb-2.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
            {style.badge}{spark.status === 'OPEN' ? timeLeft(spark.deadline) : ''}
          </span>
          <span className="text-[#555] text-[11px]">{spark.entryCount} entries</span>
        </div>
        <p className="text-white text-[14px] font-semibold leading-snug mb-2.5">"{spark.prompt}"</p>
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
