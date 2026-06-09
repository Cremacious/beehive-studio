import type { DiscoverWriter } from '@/lib/actions/discover.actions'

type Props = { writers: DiscoverWriter[] }

export function WritersStrip({ writers }: Props) {
  if (writers.length === 0) return null

  return (
    <div
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderTop: 'var(--br-card)',
        boxShadow: 'var(--sh-card)',
        borderRadius: 'var(--r-card)',
        padding: '18px 20px',
      }}
    >
      <p
        className="text-[10px] font-mono uppercase tracking-[0.14em] mb-3"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        Writers to Follow
      </p>
      <div className="flex gap-4 flex-wrap">
        {writers.map((writer) => (
          <div key={writer.userId} className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm"
              style={{ background: 'var(--canvas-dark-300)' }}
            >
              {writer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={writer.avatarUrl}
                  alt={writer.username ?? ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                '✍'
              )}
            </div>
            <div className="min-w-0">
              <p
                className="text-[13px] truncate font-semibold"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {writer.displayName ?? writer.username}
              </p>
              <p
                className="text-[11px]"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                {writer.bookCount} book{writer.bookCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              className="ml-auto shrink-0 inline-flex items-center gap-1 h-7 px-3 rounded-[var(--r-pill)] text-[11px] font-semibold cursor-pointer transition-colors"
              style={{
                background:
                  'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
                borderTop: 'var(--br-card)',
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              + Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
