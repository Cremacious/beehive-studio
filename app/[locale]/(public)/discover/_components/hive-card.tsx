import type { HiveSummary } from '@/lib/actions/hive.actions'

export function HiveCard({ hive, locale }: { hive: HiveSummary; locale: string }) {
  return (
    <div className="border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a] hover:border-[#3a3a3a] transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-white text-[14px] font-semibold leading-snug">{hive.name}</h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          hive.status === 'ACTIVE' ? 'bg-[#1a2a1a] text-[#44aa44]' : 'bg-[#1e1e1e] text-[#555]'
        }`}>
          {hive.status}
        </span>
      </div>
      {hive.description && (
        <p className="text-[#666] text-[12px] leading-relaxed mb-3 line-clamp-2">{hive.description}</p>
      )}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-[#555] text-[11px]">
          <span>{hive.memberCount} members</span>
        </div>
        <button
          disabled
          className="px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#555] rounded text-[11px] opacity-60 cursor-not-allowed"
          title="Coming soon"
        >
          Request to Join
        </button>
      </div>
    </div>
  )
}
