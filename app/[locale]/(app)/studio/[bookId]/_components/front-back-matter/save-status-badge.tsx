'use client'

import { cn } from '@/lib/utils'

export type FormSaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved'

type Props = {
  status: FormSaveStatus
}

// Small badge shown in form headers so users know autosave is wired up.
// The studio's main toolbar has its own indicator for chapter saves;
// FM/BM forms write through a different path (updateBinderItemAction) so
// they need their own visible indicator.
export function SaveStatusBadge({ status }: Props) {
  if (status === 'idle') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.10em] font-semibold"
        style={{ color: 'currentColor' }}
      >
        Auto-saves as you type
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] uppercase tracking-wide',
        status === 'unsaved' && 'text-brand',
        status === 'saving' && 'text-muted-foreground animate-pulse',
        status === 'saved' && 'text-muted-foreground',
      )}
    >
      {status === 'saved' && '● Saved'}
      {status === 'saving' && '○ Saving…'}
      {status === 'unsaved' && '● Unsaved'}
    </span>
  )
}
