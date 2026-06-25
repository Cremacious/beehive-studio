'use client'

import { toast } from 'sonner'
import { useDismissedTips } from '@/lib/tips/use-dismissed-tips'

// Settings control to replay every one-time tip. Clears the localStorage
// dismissal set so page explainers and coach marks show again as the user
// revisits each surface.
export function ResetTipsSection() {
  const { reset } = useDismissedTips()

  return (
    <section
      className="rounded-[20px] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <h2
        className="font-bold text-[15px] mb-1"
        style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
      >
        Tips and guidance
      </h2>
      <p className="text-[12.5px] mb-5" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
        Beehive shows short one-time tips the first time you visit a page. Reset them to see the guidance again.
      </p>
      <button
        type="button"
        onClick={() => {
          reset()
          toast.success('Tips reset. They will show again as you explore.')
        }}
        className="px-4 py-2 text-[13px] font-semibold rounded-[12px] transition-all"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          color: 'var(--canvas-dark-ink)',
          fontFamily: 'var(--font-display)',
        }}
      >
        Reset tips
      </button>
    </section>
  )
}
