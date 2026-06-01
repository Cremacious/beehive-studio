'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Editor } from '@tiptap/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createAnnotationAction } from '@/lib/actions/hive-annotations.actions'
import type { AnnotationLayer } from '@/lib/tiptap-extensions/hive-annotation-mark'

type LayerCard = {
  layer: AnnotationLayer
  label: string
  subtitle: string
  // T3 source-of-truth color (no CSS var exists for these — inline oklch).
  dot: string
}

const LAYER_CARDS: LayerCard[] = [
  {
    layer: 'GRAMMAR',
    label: 'Grammar',
    subtitle: 'Spelling, punctuation, mechanics',
    dot: 'oklch(0.72 0.10 165)',
  },
  {
    layer: 'PLOT',
    label: 'Plot',
    subtitle: 'Structure, pacing, beats',
    dot: 'oklch(0.72 0.13 25)',
  },
  {
    layer: 'TONE',
    label: 'Tone',
    subtitle: 'Voice, mood, register',
    dot: 'oklch(0.72 0.13 290)',
  },
  {
    layer: 'CONTINUITY',
    label: 'Continuity',
    subtitle: 'World rules, facts, refs',
    dot: 'oklch(0.72 0.10 200)',
  },
  {
    layer: 'GENERAL',
    label: 'General',
    subtitle: 'Other feedback',
    dot: 'oklch(0.74 0.13 80)',
  },
]

const SNIPPET_LIMIT = 120

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  editor: Editor
  hiveId: string
  chapterId: string
  from: number
  to: number
  selectedText: string
  onSuccess?: () => void
}

export function AnnotateModal({
  open,
  onOpenChange,
  editor,
  hiveId,
  chapterId,
  from,
  to,
  selectedText,
  onSuccess,
}: Props) {
  const [layer, setLayer] = useState<AnnotationLayer>('GENERAL')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const trimmedSnippet =
    selectedText.length > SNIPPET_LIMIT
      ? `${selectedText.slice(0, SNIPPET_LIMIT)}…`
      : selectedText

  const canSubmit = body.trim().length > 0 && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await createAnnotationAction({
        hiveId,
        chapterId,
        layer,
        body: body.trim(),
        selectionStart: from,
        selectionEnd: to,
        selectedText,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Apply the mark locally so the gutter can anchor against it.
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setHiveAnnotation({ annotationId: result.data.id, layer })
        .run()
      toast.success('Annotation added')
      onSuccess?.()
      // Reset local state for next open.
      setBody('')
      setLayer('GENERAL')
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return
    if (!next) {
      setBody('')
      setLayer('GENERAL')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add annotation</DialogTitle>
          <DialogDescription>
            Pick a layer and leave feedback on the selected passage.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {LAYER_CARDS.map((card) => {
            const active = card.layer === layer
            return (
              <button
                key={card.layer}
                type="button"
                onClick={() => setLayer(card.layer)}
                aria-pressed={active}
                className={
                  'flex-1 min-w-[140px] rounded-md border px-3 py-2 text-left transition ' +
                  (active
                    ? 'border-2 border-brand bg-brand/10'
                    : 'border-border hover:border-brand/60')
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: card.dot }}
                  />
                  <span className="text-sm font-medium">{card.label}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  {card.subtitle}
                </div>
              </button>
            )
          })}
        </div>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave your feedback…"
          rows={5}
          autoFocus
        />

        <p className="text-xs italic text-muted-foreground">
          On: &ldquo;{trimmedSnippet}&rdquo;
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Submitting…' : 'Submit annotation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
