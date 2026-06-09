import { Hexagon, Users } from 'lucide-react'
import type { HiveSummary } from '@/lib/actions/hive.actions'

export function HiveCard({ hive }: { hive: HiveSummary; locale: string }) {
  const isActive = hive.status === 'ACTIVE'
  return (
    <div
      className="p-4 transition-transform"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderTop: 'var(--br-card)',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
      }}
    >
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            <Hexagon size={15} strokeWidth={2} />
          </span>
          <h3
            className="text-[14px] font-bold leading-snug truncate"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {hive.name}
          </h3>
        </div>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-[var(--r-pill)] shrink-0"
          style={{
            color: isActive
              ? 'var(--status-final)'
              : 'var(--canvas-dark-ink-muted)',
            background: isActive
              ? 'oklch(from var(--status-final) l c h / 0.16)'
              : 'oklch(1 0 0 / 0.05)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {hive.status}
        </span>
      </div>
      {hive.description && (
        <p
          className="text-[12px] leading-relaxed mb-3 line-clamp-2"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {hive.description}
        </p>
      )}
      <div className="flex items-center justify-between mt-3">
        <span
          className="inline-flex items-center gap-1.5 text-[11px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Users size={11} />
          {hive.memberCount} member{hive.memberCount === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          disabled
          className="inline-flex items-center h-7 px-3 rounded-[var(--r-pill)] text-[11px] cursor-not-allowed opacity-60"
          style={{
            background: 'var(--canvas-dark-300)',
            color: 'var(--canvas-dark-ink-muted)',
          }}
          title="Coming soon"
        >
          Request to Join
        </button>
      </div>
    </div>
  )
}
