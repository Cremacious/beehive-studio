import type { DiscoverWriter } from '@/lib/actions/discover.actions'

type Props = { writers: DiscoverWriter[] }

export function WritersStrip({ writers }: Props) {
  if (writers.length === 0) return null

  return (
    <div className="border border-[#2a2a2a] rounded-lg p-4">
      <p className="text-[#888] text-[11px] uppercase tracking-widest mb-3">Writers to Follow</p>
      <div className="flex gap-4">
        {writers.map(writer => (
          <div key={writer.userId} className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-sm">
              {writer.avatarUrl ? (
                <img src={writer.avatarUrl} alt={writer.username ?? ''} className="w-full h-full object-cover" />
              ) : '✍'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13px] truncate">{writer.displayName ?? writer.username}</p>
              <p className="text-[#666] text-[11px]">{writer.bookCount} book{writer.bookCount !== 1 ? 's' : ''}</p>
            </div>
            <button className="ml-auto shrink-0 px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#aaa] rounded text-[11px] hover:border-[#3a3a3a] hover:text-white transition-colors cursor-pointer">
              + Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
