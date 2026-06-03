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
import { createSuggestionAction } from '@/lib/actions/hive-suggestions.actions'

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
  /** Same contract as AnnotateModal's flushPendingSave — flush studio
   *  editor's pending autosave before AND after the mark is applied so the
   *  suggestion mark lands cleanly in DB without racing the 2s debounce. */
  flushPendingSave?: () => Promise<void>
}

export function SuggestModal({
  open,
  onOpenChange,
  editor,
  hiveId,
  chapterId,
  from,
  to,
  selectedText,
  onSuccess,
  flushPendingSave,
}: Props) {
  const [suggestedText, setSuggestedText] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const trimmed = suggestedText.trim()
  const canSubmit =
    trimmed.length > 0 && trimmed !== selectedText.trim() && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      // Flush pending editor autosave first — see annotate-modal for the
      // rationale (avoid stale-DB-read race with debounced typing save).
      if (flushPendingSave) {
        try { await flushPendingSave() } catch { /* already toasted */ }
      }
      const result = await createSuggestionAction({
        hiveId,
        chapterId,
        selectionStart: from,
        selectionEnd: to,
        originalExcerpt: selectedText,
        suggestedText: trimmed,
        body: body.trim() || undefined,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setHiveSuggestion({ suggestionId: result.data.id })
        .run()
      // Force the locally-applied mark into the DB before the 2s debounce.
      if (flushPendingSave) {
        try { await flushPendingSave() } catch { /* already toasted */ }
      }
      toast.success('Suggestion submitted')
      onSuccess?.()
      setSuggestedText('')
      setBody('')
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return
    if (!next) {
      setSuggestedText('')
      setBody('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Suggest an edit</DialogTitle>
          <DialogDescription>
            Propose a replacement for the selected passage. The author can
            accept or reject.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Replacing
          </div>
          <p className="text-sm line-through text-muted-foreground">
            {selectedText}
          </p>
        </div>

        <Textarea
          value={suggestedText}
          onChange={(e) => setSuggestedText(e.target.value)}
          placeholder="Your replacement…"
          rows={4}
          autoFocus
        />

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional: explain your suggestion"
          rows={3}
        />

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Submitting…' : 'Submit suggestion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
