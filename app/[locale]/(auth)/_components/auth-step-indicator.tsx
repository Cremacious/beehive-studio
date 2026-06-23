/**
 * Three-step indicator for the password-recovery flow:
 *   1. Email  ->  2. Inbox  ->  3. New password
 *
 * Presentational only. `current` is 1-based; steps before `current` render as
 * done (check), the current step is brand-yellow, later steps are recessed.
 * Used by forgot-password (steps 1 and 2) and reset-password (step 3).
 */
const STEPS = ['Email', 'Inbox', 'New password'] as const

export function AuthStepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Password reset steps" className="flex items-center mb-7">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const isActive = n === current
        const isDone = n < current

        const dotStyle: React.CSSProperties = isActive
          ? { background: 'var(--brand)', color: 'var(--brand-ink)' }
          : isDone
            ? { background: 'oklch(from var(--brand) l c h / 0.18)', color: 'var(--brand)' }
            : { background: 'var(--canvas-dark-100)', color: 'var(--canvas-dark-ink-faint)', boxShadow: 'var(--sh-inset)' }

        return (
          <div key={label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? '1' : '0 0 auto' }}>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold font-mono"
                style={dotStyle}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? (
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  n
                )}
              </span>
              <span
                className="text-[11.5px] font-display font-semibold whitespace-nowrap"
                style={{ color: isActive ? 'var(--canvas-dark-ink)' : isDone ? 'var(--canvas-dark-ink-muted)' : 'var(--canvas-dark-ink-faint)' }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="flex-1 h-[1.5px] rounded-full mx-2.5 min-w-[14px]"
                style={{ background: isDone ? 'var(--brand)' : 'var(--canvas-dark-300)' }}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
