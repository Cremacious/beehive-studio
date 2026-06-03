'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { Beat, BeatColor, BeatLabel } from './outline-board'
import { BEAT_LABEL_DISPLAY } from './beat-label-badge'

const COLOR_ORDER: BeatColor[] = [
  'yellow', 'orange', 'pink', 'purple', 'blue', 'mint', 'lime', 'slate',
]

const COLOR_DISPLAY: Record<BeatColor, string> = {
  yellow: 'Yellow',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  blue: 'Blue',
  mint: 'Mint',
  lime: 'Lime',
  slate: 'Slate',
}

// Direct color values mirror --beat-* tokens from globals.css. The dialog
// portals to <body>, outside [data-slot="outline-pane"], so cascading the
// CSS vars from the scoped outline block doesn't reach here reliably. Inline
// the values so swatches always render. Tuned for the dark dialog chrome —
// the equivalent paper-friendly values stay on the beat-row dots which live
// inside the outline pane and pick up the theme-flipped --beat-* tokens.
const COLOR_FILL: Record<BeatColor, string> = {
  yellow: 'oklch(0.85 0.16 90)',
  orange: 'oklch(0.74 0.16 50)',
  pink:   'oklch(0.74 0.16 0)',
  purple: 'oklch(0.70 0.18 295)',
  blue:   'oklch(0.70 0.16 240)',
  mint:   'oklch(0.78 0.14 165)',
  lime:   'oklch(0.80 0.16 130)',
  slate:  'oklch(0.65 0.04 250)',
}

const LABEL_ORDER: BeatLabel[] = [
  'character', 'scene', 'plot_point', 'subplot',
  'world_building', 'character_arc', 'conflict', 'note',
]

type BeatDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial: Partial<Beat>
  defaultAct?: string | null
  onSave: (patch: Partial<Beat>) => void
  onDelete?: () => void
  onOpenChange: (open: boolean) => void
  readOnly?: boolean
}

export function BeatDialog({
  open,
  mode,
  initial,
  defaultAct: _defaultAct,
  onSave,
  onDelete,
  onOpenChange,
  readOnly = false,
}: BeatDialogProps) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [color, setColor] = useState<BeatColor | null>(initial.color ?? null)
  const [label, setLabel] = useState<BeatLabel | null>(initial.label ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTitle(initial.title ?? '')
    setDescription(initial.description ?? '')
    setColor(initial.color ?? null)
    setLabel(initial.label ?? null)
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      const el = titleRef.current
      if (!el) return
      el.focus()
      if (mode === 'edit') el.select()
    })
    return () => cancelAnimationFrame(id)
  }, [open, mode])

  function handleSave() {
    if (readOnly) return
    const t = title.trim()
    if (!t) return
    onSave({
      title: t,
      description: description.trim() || undefined,
      color,
      label,
    })
    onOpenChange(false)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add beat' : 'Edit beat'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Title">
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              disabled={readOnly}
              placeholder="What happens in this beat?"
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-60"
              style={{ background: 'var(--canvas-dark-100)', color: 'var(--canvas-dark-ink)' }}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={readOnly}
              rows={3}
              placeholder="Optional details about this beat…"
              className="w-full px-3 py-2 rounded-md text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-60"
              style={{ background: 'var(--canvas-dark-100)', color: 'var(--canvas-dark-ink)' }}
            />
          </Field>

          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {COLOR_ORDER.map(c => {
                const active = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => !readOnly && setColor(c)}
                    aria-pressed={active}
                    aria-label={COLOR_DISPLAY[c]}
                    title={COLOR_DISPLAY[c]}
                    disabled={readOnly}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: COLOR_FILL[c],
                      border: active ? '2px solid white' : '0',
                      boxShadow: active
                        ? `0 0 0 2px ${COLOR_FILL[c]}`
                        : 'var(--sh-tile)',
                      cursor: readOnly ? 'not-allowed' : 'pointer',
                    }}
                  />
                )
              })}
              <button
                type="button"
                onClick={() => !readOnly && setColor(null)}
                aria-pressed={color === null}
                aria-label="No color"
                title="No color"
                disabled={readOnly}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: color === null
                    ? '2px solid var(--brand)'
                    : '2px dashed var(--canvas-dark-ink-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--canvas-dark-ink-muted)',
                  cursor: readOnly ? 'not-allowed' : 'pointer',
                }}
              >
                ×
              </button>
            </div>
          </Field>

          <Field label="Label">
            <div className="flex flex-wrap gap-1.5">
              {LABEL_ORDER.map(l => {
                const active = label === l
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => !readOnly && setLabel(l)}
                    aria-pressed={active}
                    disabled={readOnly}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 11,
                      fontWeight: active ? 600 : 500,
                      background: active ? 'var(--brand)' : 'transparent',
                      color: active ? 'var(--brand-ink, #1a1a1a)' : 'var(--canvas-dark-ink)',
                      border: active ? '1px solid var(--brand)' : '1px solid var(--canvas-dark-300)',
                      cursor: readOnly ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {BEAT_LABEL_DISPLAY[l]}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => !readOnly && setLabel(null)}
                aria-pressed={label === null}
                disabled={readOnly}
                style={{
                  padding: '5px 11px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 11,
                  fontWeight: 500,
                  background: 'transparent',
                  color: 'var(--canvas-dark-ink-muted)',
                  border: label === null
                    ? '1px solid var(--brand)'
                    : '1px dashed var(--canvas-dark-300)',
                  cursor: readOnly ? 'not-allowed' : 'pointer',
                }}
              >
                None
              </button>
            </div>
          </Field>
        </div>

        <DialogFooter className="!justify-between">
          <div>
            {mode === 'edit' && !readOnly && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-destructive hover:underline"
              >
                Delete beat
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {readOnly ? 'Close' : 'Cancel'}
            </Button>
            {!readOnly && (
              <Button
                onClick={handleSave}
                disabled={!title.trim()}
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink, #1a1a1a)',
                }}
              >
                Save beat
              </Button>
            )}
          </div>
        </DialogFooter>

        {onDelete && (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            variant="destructive"
            title="Delete this beat?"
            description="This cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => {
              setConfirmDelete(false)
              onDelete()
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[10px] font-mono uppercase tracking-wider"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
