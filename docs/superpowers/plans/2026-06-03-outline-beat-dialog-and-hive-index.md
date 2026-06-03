# Outline beat dialog + hive outline index — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the click-to-cycle status model on outline beats with a popup dialog (title, description, curated 8-color swatch, single-select label badge); ship a forum-style index on `/hive/[hiveId]/outline` plus a detail route at `/hive/[hiveId]/outline/[outlineId]`.

**Architecture:** Beat data shape extends additively (`color`/`label` optional, `status` deprecated but readable). A pure migration helper in `lib/outline/migrate-beat-status.ts` maps legacy `status` → `color` at read time inside the existing `readContent()`. The shared `<BeatDialog>` lives in studio's outline folder and is imported by both studio and hive surfaces. The hive surface reverts from the multi-outline mapping wrapper (shipped in `b925bb0`) to a single-outline shape; a new dynamic route hosts the single-outline surface, and the existing `page.tsx` becomes a forum-style index.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (Dialog primitive already re-skinned), Drizzle ORM, vitest.

**Spec:** [docs/superpowers/specs/2026-06-03-outline-beat-dialog-and-hive-index-design.md](../specs/2026-06-03-outline-beat-dialog-and-hive-index-design.md)

---

## File Structure

**New files:**
- `lib/outline/migrate-beat-status.ts` — pure helper, status → color mapping
- `lib/outline/__tests__/migrate-beat-status.test.ts` — unit tests
- `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-label-badge.tsx` — shared presentational badge
- `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog.tsx` — shared dialog component
- `app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx` — new dynamic detail route
- `app/[locale]/(app)/hive/[hiveId]/outline/_components/outline-index.tsx` — new forum-style index client component
- `lib/actions/__tests__/get-hive-outline-by-id.test.ts` — surface-shape test for the new server action

**Modified files:**
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` — extend `Beat` type, plumb dialog state, call migration helper in `readContent()`, rewire `addBeat`/`patchBeat` to dialog
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx` — `OutlineBeatRow` accepts `onEditClick` prop; remove inline-edit title + status cycle + delete-from-row
- `app/globals.css` — add 8 `--beat-*` color tokens (dark mode + light-mode overrides)
- `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx` — revert to single-outline shape; wire BeatDialog state
- `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx` — becomes the index page (renders `<OutlineIndex>`)
- `lib/actions/hive-content.actions.ts` — add `getHiveOutlineByIdAction` (keep `getHiveOutlineView` for the index list)
- `AGENTS.md` — record ship + smoke checklist

---

## Task 1: Extend Beat type + migration helper

**Goal:** Land additive types and a pure migration helper. No UI yet. Tests cover the four status→color mappings + idempotency.

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx:35-44` — extend `Beat` type, add `BeatColor`/`BeatLabel` exports
- Create: `lib/outline/migrate-beat-status.ts`
- Create: `lib/outline/__tests__/migrate-beat-status.test.ts`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` (inside `readContent`) — call migration helper on every beat

- [ ] **Step 1.1: Write the failing test file**

Create `lib/outline/__tests__/migrate-beat-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { migrateBeatStatus, type LegacyBeat } from '../migrate-beat-status'

describe('migrateBeatStatus', () => {
  it('maps idea → yellow and drops status', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'idea' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('yellow')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('maps drafting → orange and drops status', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'drafting' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('orange')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('maps done → lime and drops status', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'done' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('lime')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('leaves beats without status untouched', () => {
    const input: LegacyBeat = { id: 'a', title: 't' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBeUndefined()
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('does NOT overwrite an explicit color (idempotent)', () => {
    const input: LegacyBeat = { id: 'a', title: 't', status: 'idea', color: 'purple' }
    const out = migrateBeatStatus(input)
    expect(out.color).toBe('purple')
    expect((out as { status?: string }).status).toBeUndefined()
  })

  it('preserves all other fields', () => {
    const input: LegacyBeat = {
      id: 'a',
      title: 't',
      description: 'd',
      status: 'idea',
      linkedChapterId: 'ch1',
      act: 'Act I',
    }
    const out = migrateBeatStatus(input)
    expect(out.id).toBe('a')
    expect(out.title).toBe('t')
    expect(out.description).toBe('d')
    expect(out.linkedChapterId).toBe('ch1')
    expect(out.act).toBe('Act I')
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
npm test -- lib/outline/__tests__/migrate-beat-status.test.ts
```

Expected: FAIL with module-not-found on `'../migrate-beat-status'`.

- [ ] **Step 1.3: Implement the migration helper**

Create `lib/outline/migrate-beat-status.ts`:

```ts
/**
 * Beat type fields the migrator touches. Mirrors the relevant shape from
 * outline-board.tsx without coupling to its full Beat type — this module
 * is consumed by readContent() at read time and must stay pure.
 */
export type LegacyBeat = {
  id: string
  title: string
  description?: string
  status?: 'idea' | 'drafting' | 'done'
  color?: 'yellow' | 'orange' | 'pink' | 'purple' | 'blue' | 'mint' | 'lime' | 'slate' | null
  label?: string | null
  linkedChapterId?: string | null
  act?: string | null
}

const STATUS_TO_COLOR = {
  idea: 'yellow',
  drafting: 'orange',
  done: 'lime',
} as const

/**
 * Maps a legacy `status` field to `color`, then drops `status` from the
 * returned beat. If the beat already has an explicit `color`, the existing
 * value wins (idempotent — re-running on already-migrated content is a no-op).
 * Beats without `status` and without `color` are returned with `color` left
 * undefined (caller renders a hollow dashed dot).
 */
export function migrateBeatStatus(beat: LegacyBeat): LegacyBeat {
  const { status, ...rest } = beat
  if (rest.color !== undefined) return rest
  if (status === undefined) return rest
  return { ...rest, color: STATUS_TO_COLOR[status] }
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
npm test -- lib/outline/__tests__/migrate-beat-status.test.ts
```

Expected: PASS, 6/6 tests.

- [ ] **Step 1.5: Extend Beat type in outline-board.tsx**

Open `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`. Replace lines 35-44 (the `BeatStatus`/`Beat` block) with:

```ts
export type BeatStatus = 'idea' | 'drafting' | 'done'

export type BeatColor =
  | 'yellow' | 'orange' | 'pink' | 'purple'
  | 'blue' | 'mint' | 'lime' | 'slate'

export type BeatLabel =
  | 'character' | 'scene' | 'plot_point' | 'subplot'
  | 'world_building' | 'character_arc' | 'conflict' | 'note'

export type Beat = {
  id: string
  title: string
  description?: string
  color?: BeatColor | null
  label?: BeatLabel | null
  linkedChapterId?: string | null
  act?: string | null
  /** @deprecated read-only legacy; mapped to `color` by readContent() */
  status?: BeatStatus
}
```

- [ ] **Step 1.6: Call migration helper inside readContent**

In the same file, find `readContent()` (around line 69). At the top of the file, add the import:

```ts
import { migrateBeatStatus } from '@/lib/outline/migrate-beat-status'
```

Inside `readContent`, in the branch where `Array.isArray(c.beats)` is true (around lines 74-81), change the return to:

```ts
if (Array.isArray(c.beats)) {
  return {
    beats: c.beats.map(b => migrateBeatStatus(b as Beat) as Beat),
    actsOrder: c.actsOrder,
    collapsedActs: c.collapsedActs,
    helpBannerDismissed: c.helpBannerDismissed,
  }
}
```

The `as Beat` casts bridge the `LegacyBeat`/`Beat` divergence — the migrator's input/output shape is structurally compatible with `Beat`.

- [ ] **Step 1.7: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 1.8: Commit**

```bash
git add lib/outline/migrate-beat-status.ts lib/outline/__tests__/migrate-beat-status.test.ts "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx"
git commit -m "$(cat <<'EOF'
feat(outline): extend Beat type with color + label; migrate legacy status

Beat type gains optional color (8-swatch curated palette) and label
(8 fixed values), single-select. status is preserved on the type for
legacy reads but new writes never set it.

New pure helper lib/outline/migrate-beat-status.ts maps legacy status
to color at read time inside readContent(): idea -> yellow, drafting
-> orange, done -> lime. Idempotent: beats with an explicit color
already set are left alone; beats without status and without color
return undefined (caller renders a hollow dashed dot).

No DB migration (content is jsonb on binder_items). Next save drops
the status field from JSON.

6 unit tests covering all four mappings + idempotency + field
preservation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Beat color CSS tokens

**Goal:** Add 8 `--beat-*` CSS variables to globals.css with light- and dark-mode variants. Pure CSS, no behavior change.

**Files:**
- Modify: `app/globals.css` — add to the `:root` block and the existing `[data-editor-theme="light"] [data-slot="outline-pane"]` block in outline-board.tsx's inline `<style>` (NOT globals — the light overrides must live in the scoped block)

- [ ] **Step 2.1: Add dark-mode tokens to globals.css `:root`**

Open `app/globals.css`. Find the `:root` block (around line 60-75 where `--paper-*` tokens live). After the last `--paper-*` line, add:

```css
  /* Beat dot colors — outline beat color-code palette. Dark-mode values
     tuned for legibility against --canvas-dark-200 (dark walnut). Light
     overrides live scoped in outline-board.tsx so they only apply inside
     the outline surface (cream paper). */
  --beat-yellow: oklch(0.85 0.16 90);
  --beat-orange: oklch(0.74 0.16 50);
  --beat-pink:   oklch(0.74 0.16 0);
  --beat-purple: oklch(0.70 0.18 295);
  --beat-blue:   oklch(0.70 0.16 240);
  --beat-mint:   oklch(0.78 0.14 165);
  --beat-lime:   oklch(0.80 0.16 130);
  --beat-slate:  oklch(0.65 0.04 250);
```

- [ ] **Step 2.2: Add light-mode overrides inside the scoped outline block**

Open `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`. Find the inline `<style>` block starting around line 372 with the `[data-editor-theme="light"] [data-slot="outline-pane"] {` selector. After the existing `--paper-300` override line (around line 400), add:

```css
          /* Light-mode beat colors — darker, more saturated to read on
             paper-200 cream canvas. */
          --beat-yellow: oklch(0.70 0.18 85);
          --beat-orange: oklch(0.65 0.18 50);
          --beat-pink:   oklch(0.65 0.18 0);
          --beat-purple: oklch(0.58 0.20 295);
          --beat-blue:   oklch(0.55 0.18 245);
          --beat-mint:   oklch(0.60 0.14 165);
          --beat-lime:   oklch(0.65 0.16 130);
          --beat-slate:  oklch(0.50 0.04 250);
```

- [ ] **Step 2.3: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2.4: Commit**

```bash
git add app/globals.css "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx"
git commit -m "$(cat <<'EOF'
feat(outline): add 8 --beat-* color tokens (dark + light variants)

Dark values land in globals.css :root. Light overrides live inside the
existing [data-editor-theme="light"] [data-slot="outline-pane"] block
in outline-board.tsx so they scope to the outline surface only (cream
paper). Palette: yellow, orange, pink, purple, blue, mint, lime,
slate. Tuned for legibility against both --canvas-dark-200 and
--paper-200.

No behavior change — tokens not yet consumed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: BeatLabelBadge component

**Goal:** Ship the shared presentational badge. Non-interactive `<span>` pill. Hidden when label is null.

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-label-badge.tsx`

- [ ] **Step 3.1: Create the component**

Create `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-label-badge.tsx`:

```tsx
'use client'

import type { BeatLabel } from './outline-board'

const LABEL_DISPLAY: Record<BeatLabel, string> = {
  character: 'Character',
  scene: 'Scene',
  plot_point: 'Plot point',
  subplot: 'Subplot',
  world_building: 'World building',
  character_arc: 'Character arc',
  conflict: 'Conflict',
  note: 'Note',
}

export function BeatLabelBadge({ label }: { label: BeatLabel | null | undefined }) {
  if (!label) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        color: 'var(--outline-ink-strong)',
        background: 'oklch(from var(--outline-ink-strong) l c h / 0.08)',
        border: '1px solid var(--outline-rule)',
        whiteSpace: 'nowrap',
      }}
    >
      {LABEL_DISPLAY[label]}
    </span>
  )
}

export { LABEL_DISPLAY as BEAT_LABEL_DISPLAY }
```

The component reads `--outline-ink-strong` and `--outline-rule` which already theme-flip per the existing outline scoped style. Light mode renders darker text on paper; dark mode renders cream text on walnut.

- [ ] **Step 3.2: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3.3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/beat-label-badge.tsx"
git commit -m "$(cat <<'EOF'
feat(outline): add BeatLabelBadge shared presentational component

Non-interactive <span> pill, returns null when label is null/undefined.
Renders against existing --outline-ink-strong + --outline-rule tokens
so theme-flip is automatic. Also exports BEAT_LABEL_DISPLAY map so the
dialog can reuse the same label display strings.

Not yet wired into beat rows.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: BeatDialog component

**Goal:** Ship the shared dialog. Manages internal form state, calls `onSave({ title, description, color, label })`. Auto-focuses title on open. Enter saves. Esc cancels.

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog.tsx`

- [ ] **Step 4.1: Create the dialog component**

Create `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog.tsx`:

```tsx
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
  defaultAct: _defaultAct, // intentionally consumed by caller, not surfaced in UI
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

  // Reset form state every time the dialog opens with a new initial.
  // useState's lazy initializer only fires on first render, so without this
  // the prior beat's values would leak into the next dialog open.
  useEffect(() => {
    if (!open) return
    setTitle(initial.title ?? '')
    setDescription(initial.description ?? '')
    setColor(initial.color ?? null)
    setLabel(initial.label ?? null)
  }, [open, initial])

  // Auto-focus title on open. Full-select in edit mode.
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
    if (!t) return // require a title
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
                      background: `var(--beat-${c})`,
                      border: active ? '2px solid white' : '0',
                      boxShadow: active
                        ? `0 0 0 2px var(--beat-${c})`
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
```

- [ ] **Step 4.2: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4.3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog.tsx"
git commit -m "$(cat <<'EOF'
feat(outline): add shared BeatDialog component

Handles both create + edit modes via prop. Built on shadcn Dialog
primitive (chrome inherited). Auto-focuses title input on open; full-
selects in edit mode. Enter in title saves; Esc cancels via Dialog
primitive default. Save calls onSave({title, description, color,
label}) then onOpenChange(false).

8 color swatches + "no color" hollow ring + 8 label pills + "None"
dashed pill. Color/label active states use brand-yellow accent.
Description optional (collapses to undefined if blank).

Edit mode renders a destructive "Delete beat" button on the left of
the footer; click opens shared ConfirmDialog. readOnly mode disables
all inputs and collapses the footer to a single "Close" button (BETA_
READER path on hive side).

useState lazy initializer is paired with a useEffect that re-syncs
state from `initial` every time the dialog opens — without it the
prior beat's values would leak into the next dialog session.

Not yet wired into beat rows.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire dialog into studio outline (remove inline-edit + status cycle)

**Goal:** OutlineBoard manages dialog state; clicking title or color dot opens dialog; "+ Add beat" buttons open create-mode dialog; inline title edit and status-cycle behavior are removed.

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx` — `OutlineBeatRow` accepts new `onEditClick` prop, removes inline title edit, removes status-cycle on dot, removes row-level delete button (delete moves into dialog), wires new `<BeatLabelBadge>`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` — `OutlineBoard` plumbs `dialogState` and renders `<BeatDialog>`; `addBeat`/`patchBeat`/delete flow rewires
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-act-group.tsx` — "+ Add beat" per-act button calls the new openCreate(actName)

- [ ] **Step 5.1: Update OutlineBeatRow signature + render**

Open `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx`. Locate the `OutlineBeatRow` component. Make the following changes:

Add to the props type:

```ts
onEditClick?: (beat: Beat) => void
```

Replace the inline contenteditable title element with a `<button>` that calls `onEditClick(beat)`:

```tsx
<button
  type="button"
  onClick={() => onEditClick?.(beat)}
  aria-label={`Edit beat: ${beat.title || 'untitled'}`}
  className="text-left font-comfortaa font-semibold text-sm hover:underline"
  style={{
    background: 'transparent',
    border: 0,
    color: 'var(--outline-ink-strong)',
    padding: 0,
    cursor: 'pointer',
    minWidth: 0,
  }}
>
  {beat.title || <span style={{ fontStyle: 'italic', opacity: 0.55 }}>Untitled beat</span>}
</button>
```

Replace the status-cycle dot click handler. The dot is now a `<button>` that ALSO opens the dialog (passive visual + accessible click target):

```tsx
<button
  type="button"
  onClick={() => onEditClick?.(beat)}
  aria-label={`Edit beat: ${beat.title || 'untitled'}`}
  title={beat.color ? `Color: ${beat.color}` : 'Edit beat'}
  style={{
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: beat.color ? `var(--beat-${beat.color})` : 'transparent',
    border: beat.color ? '0' : '1px dashed var(--outline-rule)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  }}
/>
```

Add the BeatLabelBadge import at the top of the file:

```ts
import { BeatLabelBadge } from './beat-label-badge'
```

Render `<BeatLabelBadge label={beat.label} />` immediately after the title button (before any right-aligned meta column).

Remove the row-level delete button if one exists. Delete now lives inside the dialog.

Remove any inline contenteditable / `onBlur` rename logic on the title — title-rename happens via the dialog.

Remove the existing `onCycleStatus` prop usage internally (drop the click handler that called it). The prop itself can be removed from `OutlineBeatRow`'s type — search the file for it and delete.

- [ ] **Step 5.2: Update OutlineBoard — add dialog state**

Open `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`. At the top of the file, add the import:

```ts
import { BeatDialog } from './beat-dialog'
```

Inside the `OutlineBoard` component body (above the existing `useState` declarations), add:

```ts
type DialogState =
  | { mode: 'closed' }
  | { mode: 'create'; defaultAct: string | null }
  | { mode: 'edit'; beatId: string }

const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' })

function openCreate(act: string | null = null) {
  setDialogState({ mode: 'create', defaultAct: act })
}

function openEdit(beat: Beat) {
  setDialogState({ mode: 'edit', beatId: beat.id })
}

function closeDialog() {
  setDialogState({ mode: 'closed' })
}

const editingBeat: Beat | null =
  dialogState.mode === 'edit'
    ? beats.find(b => b.id === dialogState.beatId) ?? null
    : null
```

- [ ] **Step 5.3: Update OutlineBoard — replace addBeat callsites**

Find the existing `addBeat` function in OutlineBoard (around line 200-220 — search for `function addBeat`). Replace its callsites:

- The "+ Add beat" button at the top of the body (the dashed full-width button) → `onClick={() => openCreate(null)}`
- Any "+ New Act" or per-act add buttons that previously called `addBeat(actName)` → `onClick={() => openCreate(actName)}`

The `addBeat` function itself stays for now — it's called by the dialog's save handler in step 5.4.

- [ ] **Step 5.4: Update OutlineBoard — render the dialog**

At the very bottom of the JSX return (just before the closing `</section>` or `</div>` of OutlineBoard's root element), add:

```tsx
<BeatDialog
  open={dialogState.mode !== 'closed'}
  mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
  initial={editingBeat ?? {}}
  defaultAct={dialogState.mode === 'create' ? dialogState.defaultAct : null}
  onOpenChange={open => { if (!open) closeDialog() }}
  onSave={patch => {
    if (dialogState.mode === 'create') {
      const id = createId()
      const newBeat: Beat = {
        id,
        title: patch.title ?? '',
        description: patch.description,
        color: patch.color,
        label: patch.label,
        act: dialogState.defaultAct,
        linkedChapterId: null,
      }
      commit({ beats: [...beats, newBeat] })
    } else if (dialogState.mode === 'edit' && editingBeat) {
      const next = beats.map(b =>
        b.id === editingBeat.id
          ? { ...b, ...patch }
          : b,
      )
      commit({ beats: next })
    }
  }}
  onDelete={
    dialogState.mode === 'edit' && editingBeat
      ? () => {
          commit({ beats: beats.filter(b => b.id !== editingBeat.id) })
        }
      : undefined
  }
/>
```

Make sure `createId` is imported at the top:

```ts
import { createId } from '@paralleldrive/cuid2'
```

(If it's already imported, skip.)

- [ ] **Step 5.5: Update OutlineBoard — pass onEditClick into OutlineBeatRow**

Find where `<OutlineBeatRow>` is rendered (inside the act-group rendering loop). Add the prop:

```tsx
<OutlineBeatRow
  /* …existing props… */
  onEditClick={openEdit}
/>
```

Remove the existing `onCycleStatus` prop from the JSX (it no longer exists on OutlineBeatRow).

- [ ] **Step 5.6: Update outline-act-group.tsx — "+ Add beat" wiring**

Open `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-act-group.tsx`. The per-act header has an "+ Add beat" button that calls a prop (likely `onAddBeat`). Verify the prop signature accepts the act name; if it currently calls `addBeat(actName)`, the parent will rewire it to `openCreate(actName)` via the OutlineBoard caller — no change needed here. (If the act-group accepts an `onAddBeat: () => void` prop and the parent maps it, the change in OutlineBoard is sufficient.)

If outline-act-group has any other beat-creation affordance (e.g. an empty-act drop zone with "+ Add a beat"), ensure each calls back up to the parent's open-create flow.

- [ ] **Step 5.7: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If the hive surface (`hive-outline-surface.tsx`) breaks because `OutlineBeatRow`'s old props changed shape, mark `onEditClick` as optional on the row (it already is — `onEditClick?:` in step 5.1) and DO NOT wire it on the hive side yet. The hive will get its own wiring in Task 7.

- [ ] **Step 5.8: Run existing test suite**

```bash
npm test
```

Expected: 100% pass (plus the 6 new tests from Task 1).

- [ ] **Step 5.9: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx" "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx" "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-act-group.tsx"
git commit -m "$(cat <<'EOF'
feat(outline): wire BeatDialog into studio; remove inline edit + status cycle

OutlineBeatRow now accepts onEditClick. Inline contenteditable title
is removed — title renders as a button that opens the dialog. Color
dot is no longer a status cycler; click also opens the dialog. Row-
level delete button removed (delete moves into the dialog). New
BeatLabelBadge renders between the title and the right-side meta.

OutlineBoard owns dialog state via a tagged-union DialogState. "+ Add
a beat" buttons (top-level + per-act) call openCreate(act). Clicking
a beat's title or dot calls openEdit(beat). The dialog's onSave
appends a new beat (create) or maps the existing beats array (edit);
onDelete filters out the edited beat. All three paths route through
the existing commit() debounce, so the 2s save + state-isolation
pattern from 2e8311b is preserved.

Hive surface is intentionally NOT yet wired — OutlineBeatRow's
onEditClick prop is optional, so the hive renders un-clickable beat
titles until Task 7 lands the per-surface wiring.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add getHiveOutlineByIdAction + test

**Goal:** New server action that fetches one outline by id, asserts hive membership + cross-hive escape. Drives the upcoming hive detail page.

**Files:**
- Modify: `lib/actions/hive-content.actions.ts` — append the new action; reuse `HiveOutlineEntry` type
- Create: `lib/actions/__tests__/get-hive-outline-by-id.test.ts`

- [ ] **Step 6.1: Write the failing test**

Create `lib/actions/__tests__/get-hive-outline-by-id.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}))

vi.mock('@/lib/hive/permissions', () => ({
  requireHiveMember: vi.fn(async () => 'CONTRIBUTOR'),
  type: {},
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: {
        findFirst: vi.fn(),
      },
      binderItems: {
        findFirst: vi.fn(),
      },
      userProfiles: {
        findFirst: vi.fn(),
      },
    },
  },
}))

import * as actions from '../hive-content.actions'

describe('getHiveOutlineByIdAction', () => {
  it('exports the action', () => {
    expect(typeof actions.getHiveOutlineByIdAction).toBe('function')
  })

  it('takes two string args', () => {
    expect(actions.getHiveOutlineByIdAction.length).toBe(2)
  })
})
```

- [ ] **Step 6.2: Run test — verify it fails**

```bash
npm test -- lib/actions/__tests__/get-hive-outline-by-id.test.ts
```

Expected: FAIL (`actions.getHiveOutlineByIdAction is undefined`).

- [ ] **Step 6.3: Add the action**

Open `lib/actions/hive-content.actions.ts`. Find the `getHiveOutlineView` function. Immediately after its closing `}`, add:

```ts
export async function getHiveOutlineByIdAction(
  hiveId: string,
  outlineId: string,
): Promise<ActionResult<{
  entry: HiveOutlineEntry
  chapters: Array<{ id: string; title: string; order: number }>
  viewerRole: HiveRole
}>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || !hive.bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  const outline = await db.query.binderItems.findFirst({
    where: and(
      eq(binderItems.id, outlineId),
      eq(binderItems.bookId, hive.bookId),
      eq(binderItems.type, 'outline'),
    ),
  })
  if (!outline) return { success: false, error: 'OUTLINE_NOT_FOUND' }

  const chapterItems = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'chapter')),
    columns: { id: true, title: true, order: true },
    orderBy: [asc(binderItems.order)],
  })

  let lastEditedByUsername: string | null = null
  if (outline.lastEditedBy) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, outline.lastEditedBy),
      columns: { username: true },
    })
    lastEditedByUsername = profile?.username ?? null
  }

  return {
    success: true,
    data: {
      entry: {
        outline: toBinderItemRow(outline),
        lastEditedByUsername,
        lastEditedAt: outline.updatedAt ?? null,
      },
      chapters: chapterItems,
      viewerRole: role,
    },
  }
}
```

The imports (`requireAuth`, `requireHiveMember`, `db`, `hives`, `binderItems`, `userProfiles`, `eq`, `and`, `asc`, `toBinderItemRow`, `HiveOutlineEntry`, `HiveRole`, `ActionResult`) are all already at the top of the file. If `toBinderItemRow` is module-private and not yet at the top, it already exists — leave it.

- [ ] **Step 6.4: Run test — verify it passes**

```bash
npm test -- lib/actions/__tests__/get-hive-outline-by-id.test.ts
```

Expected: PASS, 2/2.

- [ ] **Step 6.5: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6.6: Commit**

```bash
git add lib/actions/hive-content.actions.ts lib/actions/__tests__/get-hive-outline-by-id.test.ts
git commit -m "$(cat <<'EOF'
feat(hive): add getHiveOutlineByIdAction with cross-hive escape guard

New server action fetches a single outline by id, asserts the viewer
is a hive member, asserts the outline belongs to THIS hive's book
(cross-hive escape guard — same posture as T13 chapter view). Returns
{ entry: HiveOutlineEntry, chapters, viewerRole } shaped to drop into
the existing HiveOutlineSurface single-entry consumer (Task 7).

Surface-shape test mirrors lib/actions/__tests__/reading-actions.test
.ts (vi.mock require-auth + permissions + db; static top-level import
of the action module).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Simplify hive-outline-surface + wire BeatDialog

**Goal:** Revert hive-outline-surface from the multi-outline wrapper (b925bb0) to a single-outline shape. Add its own dialog state machine, mirroring studio's OutlineBoard.

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx`

- [ ] **Step 7.1: Revert the surface to single-outline shape**

Open `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx`. Replace the top-level `HiveOutlineData` type and the `HiveOutlineSurface` wrapper component (the one that maps over `data.outlines`):

```ts
type HiveOutlineData = {
  bookId: string
  entry: {
    outline: BinderItemRow
    lastEditedByUsername: string | null
    lastEditedAt: Date | null
  }
  chapters: ChapterRef[]
  viewerRole: HiveRole
}

export function HiveOutlineSurface({
  data,
  hiveId: _hiveId,
  locale,
}: {
  data: HiveOutlineData
  hiveId: string
  locale: string
}) {
  return (
    <HiveOutlineSurfaceInner
      outline={data.entry.outline}
      chapters={data.chapters}
      viewerRole={data.viewerRole}
      lastEditedByUsername={data.entry.lastEditedByUsername}
      lastEditedAt={data.entry.lastEditedAt}
      bookId={data.bookId}
      locale={locale}
    />
  )
}
```

The empty-state branch (the "No outlines yet" block) is no longer this component's responsibility — the index page handles that. The detail-page route handles "outline not found" via `notFound()` (Task 8).

Pass `locale` through to `HiveOutlineSurfaceInner` so the empty-outline "Open the book in the studio" link continues to render.

- [ ] **Step 7.2: Update HiveOutlineSurfaceInner — add dialog state**

In the same file, locate `HiveOutlineSurfaceInner`. At the top of the component body, after the existing useState declarations (`beats`, `saveStatus`, `linkingBeatId`, `pendingActs`, `newActDraft`), add:

```ts
import { createId } from '@paralleldrive/cuid2'
import { BeatDialog } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog'

// inside HiveOutlineSurfaceInner:
type DialogState =
  | { mode: 'closed' }
  | { mode: 'create'; defaultAct: string | null }
  | { mode: 'edit'; beatId: string }

const [dialogState, setDialogState] = useState<DialogState>({ mode: 'closed' })

function openCreate(act: string | null = null) {
  if (readOnly) return
  setDialogState({ mode: 'create', defaultAct: act })
}

function openEdit(beat: Beat) {
  setDialogState({ mode: 'edit', beatId: beat.id })
}

function closeDialog() {
  setDialogState({ mode: 'closed' })
}

const editingBeat: Beat | null =
  dialogState.mode === 'edit'
    ? beats.find(b => b.id === dialogState.beatId) ?? null
    : null
```

Add the `createId` import at the top of the file if not already present.

- [ ] **Step 7.3: Rewire "+ Add beat" buttons to openCreate**

In `HiveOutlineSurfaceInner`, find the existing inline `addBeat` function and the buttons that call it. Replace button click handlers from `() => addBeat()` to `() => openCreate(null)`, and from `() => addBeat(group.act)` to `() => openCreate(group.act)`.

If the existing `addBeat` function is no longer referenced anywhere, delete it.

- [ ] **Step 7.4: Wire onEditClick into OutlineBeatRow render**

Find the `<OutlineBeatRow>` render call inside the map over `group.beats`. Add the prop:

```tsx
<OutlineBeatRow
  /* …existing props… */
  onEditClick={openEdit}
/>
```

Remove any `onCycleStatus` prop on the row — it no longer exists.

- [ ] **Step 7.5: Render the BeatDialog at the end**

At the very bottom of `HiveOutlineSurfaceInner`'s return JSX (after the `HiveChapterLinkPopover` mount), add:

```tsx
<BeatDialog
  open={dialogState.mode !== 'closed'}
  mode={dialogState.mode === 'edit' ? 'edit' : 'create'}
  initial={editingBeat ?? {}}
  defaultAct={dialogState.mode === 'create' ? dialogState.defaultAct : null}
  readOnly={readOnly}
  onOpenChange={open => { if (!open) closeDialog() }}
  onSave={patch => {
    if (readOnly) return
    if (dialogState.mode === 'create') {
      const id = createId()
      const newBeat: Beat = {
        id,
        title: patch.title ?? '',
        description: patch.description,
        color: patch.color,
        label: patch.label,
        act: dialogState.defaultAct,
        linkedChapterId: null,
      }
      commit([...beats, newBeat])
    } else if (dialogState.mode === 'edit' && editingBeat) {
      commit(beats.map(b => b.id === editingBeat.id ? { ...b, ...patch } : b))
    }
  }}
  onDelete={
    dialogState.mode === 'edit' && editingBeat && !readOnly
      ? () => commit(beats.filter(b => b.id !== editingBeat.id))
      : undefined
  }
/>
```

Note: this surface's `commit()` takes a `Beat[]` directly (not a partial), per the existing pattern in the file. Match that signature.

- [ ] **Step 7.6: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `BinderItemRow`'s `content` is `unknown` and TS complains about the cast inside the surface, the existing code already handles that — use the existing `readBeats` helper for the initial state seed.

- [ ] **Step 7.7: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx"
git commit -m "$(cat <<'EOF'
feat(hive/outline): single-outline shape + BeatDialog wiring

Reverts HiveOutlineSurface from the multi-outline mapping wrapper
shipped in b925bb0 to a single-outline shape — the new index +
detail routes (Tasks 8-9) drive navigation, so the surface only
needs to render one outline at a time. Data type narrows from
{outlines: HiveOutlineEntry[]} to {entry: HiveOutlineEntry}; the
multi-outline empty-state branch moves to the index page.

HiveOutlineSurfaceInner now owns its own dialog state (tagged-union,
mirrors OutlineBoard from Task 5). "+ Add a beat" buttons call
openCreate(act). OutlineBeatRow gets onEditClick={openEdit}.

readOnly path (BETA_READER) is preserved: openCreate is a no-op,
onSave bails, onDelete is undefined. BeatDialog's own readOnly prop
collapses the footer to a Close button.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Hive outline detail route

**Goal:** New dynamic route `/hive/[hiveId]/outline/[outlineId]/page.tsx` hosts `<HiveOutlineSurface>` for a single outline. Calls Task 6's action, handles NOT_FOUND with `notFound()`.

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx`

- [ ] **Step 8.1: Create the detail route**

Create `app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getHiveOutlineByIdAction } from '@/lib/actions/hive-content.actions'
import { HiveOutlineSurface } from '../_components/hive-outline-surface'

export default async function HiveOutlineDetailPage({
  params,
}: {
  params: Promise<{ hiveId: string; outlineId: string; locale: string }>
}) {
  const { hiveId, outlineId, locale } = await params
  const r = await getHiveOutlineByIdAction(hiveId, outlineId)
  if (!r.success) notFound()

  // bookId is preserved on the entry's outline row.
  const bookId = r.data.entry.outline.bookId

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href={`/${locale}/hive/${hiveId}/outline`}
          className="inline-flex items-center gap-1.5 text-xs font-mono mb-4 hover:text-[var(--brand)]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <ArrowLeft size={12} />
          Back to outlines
        </Link>
        <HiveOutlineSurface
          data={{
            bookId,
            entry: r.data.entry,
            chapters: r.data.chapters,
            viewerRole: r.data.viewerRole,
          }}
          hiveId={hiveId}
          locale={locale}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 8.2: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8.3: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(hive/outline): add detail route /hive/[hiveId]/outline/[outlineId]

Server component, calls getHiveOutlineByIdAction (Task 6) and renders
HiveOutlineSurface for one outline. NOT_FOUND or OUTLINE_NOT_FOUND
errors trigger notFound(). Header has a "← Back to outlines" link to
the index route.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Hive outline index page (forum-style table)

**Goal:** Replace `/hive/[hiveId]/outline/page.tsx` (currently renders stacked surface for every outline) with a search + sort + table list. Mirrors the Discussions list reskin from `c44c58d`.

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/outline/_components/outline-index.tsx`
- Modify: `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx` — becomes the index page

- [ ] **Step 9.1: Create the client index component**

Create `app/[locale]/(app)/hive/[hiveId]/outline/_components/outline-index.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ListOrdered } from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { readContent, type Beat, type BeatColor } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

type OutlineSummary = {
  outline: BinderItemRow
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
}

type SortKey = 'recent' | 'alpha' | 'beats'

function relTime(d: Date | null): string {
  if (!d) return '—'
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getBeats(o: BinderItemRow): Beat[] {
  return readContent(o.content).beats
}

function uniqueColorsInUse(beats: Beat[]): BeatColor[] {
  const seen = new Set<BeatColor>()
  const out: BeatColor[] = []
  for (const b of beats) {
    if (b.color && !seen.has(b.color)) {
      seen.add(b.color)
      out.push(b.color)
      if (out.length >= 6) break
    }
  }
  return out
}

export function OutlineIndex({
  outlines,
  hiveId,
  locale,
}: {
  outlines: OutlineSummary[]
  hiveId: string
  locale: string
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let list = outlines
    if (s) list = list.filter(o => o.outline.title.toLowerCase().includes(s))
    if (sort === 'alpha') {
      list = [...list].sort((a, b) => a.outline.title.localeCompare(b.outline.title))
    } else if (sort === 'beats') {
      list = [...list].sort((a, b) => getBeats(b.outline).length - getBeats(a.outline).length)
    } else {
      list = [...list].sort((a, b) => {
        const at = a.lastEditedAt?.getTime() ?? 0
        const bt = b.lastEditedAt?.getTime() ?? 0
        return bt - at
      })
    }
    return list
  }, [outlines, search, sort])

  return (
    <>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-2xl"
          >
            Outlines
          </h1>
          <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
            {outlines.length} {outlines.length === 1 ? 'outline' : 'outlines'} in this hive
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search outline titles…"
          style={{
            background: 'var(--canvas-dark-100)',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-inset)',
            border: 'var(--br-card)',
            color: 'var(--canvas-dark-ink)',
          }}
          className="flex-1 px-3 py-2 text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{
            background: 'var(--canvas-dark-100)',
            borderRadius: 'var(--r-row)',
            boxShadow: 'var(--sh-inset)',
            border: 'var(--br-card)',
            color: 'var(--canvas-dark-ink)',
          }}
          className="px-3 py-2 text-sm font-geist focus:outline-none"
        >
          <option value="recent">Recent</option>
          <option value="alpha">A → Z</option>
          <option value="beats">Most beats</option>
        </select>
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="overflow-hidden"
      >
        <div
          className="grid items-center gap-4 px-5 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]"
          style={{
            gridTemplateColumns: '1fr 90px 130px',
            borderBottom: '1px solid var(--canvas-dark-300)',
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          }}
        >
          <span>Outline</span>
          <span className="text-center inline-flex items-center justify-center gap-1">
            <ListOrdered size={10} />
            Beats
          </span>
          <span className="text-right">Last edit</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-[var(--canvas-dark-ink-strong)]">
              {outlines.length === 0 ? 'No outlines yet' : 'No matches'}
            </p>
            <p className="text-xs font-mono text-[var(--canvas-dark-ink-muted)] mt-1">
              {outlines.length === 0
                ? 'The author can create an outline in the studio.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {filtered.map(o => {
              const beats = getBeats(o.outline)
              const colors = uniqueColorsInUse(beats)
              return (
                <li key={o.outline.id}>
                  <Link
                    href={`/${locale}/hive/${hiveId}/outline/${o.outline.id}`}
                    className="grid items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--canvas-dark-300)]"
                    style={{ gridTemplateColumns: '1fr 90px 130px' }}
                  >
                    <div className="min-w-0">
                      <h3 className="font-comfortaa font-semibold text-base truncate text-[var(--canvas-dark-ink-strong)]">
                        {o.outline.title || 'Untitled outline'}
                      </h3>
                      {colors.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {colors.map(c => (
                            <span
                              key={c}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: `var(--beat-${c})`,
                                display: 'inline-block',
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-comfortaa font-bold text-lg text-[var(--canvas-dark-ink-strong)] leading-none">
                        {beats.length}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mt-0.5">
                        {beats.length === 1 ? 'beat' : 'beats'}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--canvas-dark-ink)]">
                      {relTime(o.lastEditedAt)}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 9.2: Replace the index page**

Open `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx`. Replace the entire file with:

```tsx
import { notFound } from 'next/navigation'
import { getHiveOutlineView } from '@/lib/actions/hive-content.actions'
import { OutlineIndex } from './_components/outline-index'

export default async function HiveOutlineIndexPage({
  params,
}: {
  params: Promise<{ hiveId: string; locale: string }>
}) {
  const { hiveId, locale } = await params
  const r = await getHiveOutlineView(hiveId)
  if (!r.success) notFound()

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <OutlineIndex
          outlines={r.data.outlines}
          hiveId={hiveId}
          locale={locale}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 9.3: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9.4: Run test suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 9.5: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/outline/_components/outline-index.tsx" "app/[locale]/(app)/hive/[hiveId]/outline/page.tsx"
git commit -m "$(cat <<'EOF'
feat(hive/outline): forum-style index page with search + sort

/hive/[hiveId]/outline now renders a list of outlines instead of
stacking the full surface for each one. Mirrors the Discussions list
reskin from c44c58d: panel-chrome wrapper, column-header strip
(Outline | Beats | Last edit), divide-y rows with 3-col grid.

Each row: outline title + a strip of up to 6 deduplicated --beat-*
color dots in first-appearance order (omitted when no colored
beats), beat count, relTime. Whole row is a <Link> to the new
detail route.

Search filters outline title only. Sort: Recent (default) / A→Z /
Most beats. Empty states: "No outlines yet" (zero outlines) or "No
matches" (filtered to zero).

readContent + Beat type imported from the studio outline-board module
(shared shape, no duplication).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: AGENTS.md update + manual smoke prompt

**Goal:** Record the ship in AGENTS.md per the Working Agreement; provide the smoke checklist for Chris to run.

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 10.1: Update AGENTS.md Resume Here**

Open `AGENTS.md`. Update the "Resume Here" block:

- Bump `Last updated` to today's date.
- Replace `Current focus` paragraph with a summary of the outline beat-dialog + hive-index ship covering: new Beat shape (color + label optional fields, status deprecated), `migrateBeatStatus` helper + readContent integration, 8 `--beat-*` CSS tokens (dark + light), shared `BeatDialog` + `BeatLabelBadge` components, studio + hive surface wiring (both call openCreate/openEdit through the row's onEditClick prop), `getHiveOutlineByIdAction` with cross-hive escape guard, new `/hive/[hiveId]/outline/[outlineId]` detail route, forum-style index at `/hive/[hiveId]/outline`. Note that the multi-outline wrapper from `b925bb0` reverted to single-outline shape since the index drives navigation now.
- Update `Last commit` to the Task 9 SHA (after that task lands).
- Update `Next concrete step` to the smoke checklist (Step 10.2 below).

Add a new entry under `What Has Been Built` headed "Outline Beat Dialog + Hive Outline Index" with task SHAs and a paragraph-per-decision summary mirroring the existing reader-page redesign entry format.

- [ ] **Step 10.2: Add the smoke checklist to AGENTS.md Next concrete step**

Inside `Next concrete step`, list the 10 smoke scenarios from the spec verbatim (the "Carry-forward smoke checklist for Chris" section).

- [ ] **Step 10.3: Verify tsc clean (no code changed but defensive)**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 10.4: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): record outline beat-dialog + hive-index ship

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

After plan completion:

1. **Spec coverage** — every spec section maps to a task:
   - Data model (Section "Data model") → Task 1 (Beat type + migration)
   - Tokens → Task 2
   - Beat dialog → Task 4 (component) + Task 5 (studio wiring) + Task 7 (hive wiring)
   - Beat row changes → Task 5 (studio) + propagates to hive via shared OutlineBeatRow
   - Hive index route → Task 9
   - Detail route → Task 8
   - Persistence (debounce preserved) → Tasks 5 + 7 reuse `commit()`
   - Edge cases (BETA_READER, cross-hive escape, NOT_FOUND, save-after-delete) → covered in Tasks 4, 6, 7, 8
   - Test posture → Tasks 1 (unit) + 6 (surface shape)

2. **Type consistency** — `BeatColor` and `BeatLabel` exported from outline-board.tsx in Task 1; consumed verbatim in Tasks 3, 4, 5, 7, 9. `HiveOutlineEntry` is the existing type from `getHiveOutlineView` and reused in Task 6's new action signature.

3. **No placeholders** — every code block contains the actual content. Token oklch values in Task 2 are concrete (may be tuned during impl but no TBD). Beat dialog component is fully spelled out (no "implement the rest similarly"). The Hive outline detail page passes `bookId` from `r.data.entry.outline.bookId` — verified the `BinderItemRow` shape has `bookId`.

4. **Known fragile spots** — the hive surface change in Task 7 simplifies + restructures a load-bearing file; tsc-clean at step 7.6 is the gate. If `BinderItemRow.content` typing makes `readBeats` call sites fail, the existing `readBeats`/`readContent` pattern is already in place — task instructions reference the existing helpers.

5. **Per-task commit cadence** — each task ends in one commit. Chris's per-task verification preference is honored.

---