'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Ghost } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { AnnotationRow } from '@/lib/actions/hive-annotations.actions'
import type { SuggestionRow } from '@/lib/actions/hive-suggestions.actions'
import type { CollabMutations } from '@/lib/hooks/use-collab-data'

const ORPHAN_REJECT_NOTE = 'Orphaned — original text was deleted'

type Props = {
  orphanedAnnotations: AnnotationRow[]
  orphanedSuggestions: SuggestionRow[]
  mutate: CollabMutations
}

export function OrphanSection({
  orphanedAnnotations,
  orphanedSuggestions,
  mutate,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const total = orphanedAnnotations.length + orphanedSuggestions.length
  if (total === 0) return null

  async function dismissAnnotation(id: string) {
    setPendingId(id)
    try {
      const res = await mutate.resolveAnnotation(id)
      if (!res.success) toast.error(res.error)
    } finally {
      setPendingId(null)
    }
  }

  async function dismissSuggestion(id: string) {
    setPendingId(id)
    try {
      const res = await mutate.rejectSuggestion(id, ORPHAN_REJECT_NOTE)
      if (!res.success) toast.error(res.error)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
        borderRadius: 'var(--r-card)',
        border: 'var(--br-card)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="m-3 p-3"
    >
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-2 text-left text-[11px] font-comfortaa font-bold uppercase tracking-wider"
        style={{ color: 'var(--brand)' }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Ghost className="h-3.5 w-3.5" />
        <span>Orphaned ({total})</span>
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          {orphanedAnnotations.map((a) => {
            const name =
              a.author.username ?? a.author.displayName ?? 'Unknown'
            return (
              <div
                key={a.id}
                style={{
                  borderRadius: 'var(--r-row)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                }}
                className="px-2.5 py-2"
              >
                <div className="text-[10.5px] text-muted-foreground">
                  @{name} · annotation
                </div>
                {a.selectedText ? (
                  <p className="mt-1 text-[11.5px] italic text-muted-foreground line-clamp-2">
                    &ldquo;{a.selectedText}&rdquo;
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] text-foreground line-clamp-2">
                  {a.body}
                </p>
                <div className="mt-1.5 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissAnnotation(a.id)}
                    disabled={pendingId === a.id}
                  >
                    {pendingId === a.id ? 'Dismissing…' : 'Dismiss'}
                  </Button>
                </div>
              </div>
            )
          })}
          {orphanedSuggestions.map((s) => {
            const name =
              s.author.username ?? s.author.displayName ?? 'Unknown'
            return (
              <div
                key={s.id}
                style={{
                  borderRadius: 'var(--r-row)',
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                }}
                className="px-2.5 py-2"
              >
                <div className="text-[10.5px] text-muted-foreground">
                  @{name} · suggestion
                </div>
                {s.originalExcerpt ? (
                  <p className="mt-1 text-[11.5px] italic line-through text-muted-foreground line-clamp-2">
                    &ldquo;{s.originalExcerpt}&rdquo;
                  </p>
                ) : null}
                {s.suggestedText ? (
                  <p className="mt-1 text-[12px] text-foreground line-clamp-2">
                    → {s.suggestedText}
                  </p>
                ) : null}
                <div className="mt-1.5 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissSuggestion(s.id)}
                    disabled={pendingId === s.id}
                  >
                    {pendingId === s.id ? 'Dismissing…' : 'Dismiss'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
