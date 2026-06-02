# Outline Document Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Outline document UI with iOS-inspired collapsible act drawers, complete drag-and-drop (beats anywhere, acts anywhere, "No Act" parity), a four-surface help system, and a guaranteed light/dark text-contrast pattern that prevents the paper-ink token leak that previously broke Notes.

**Architecture:** `outline-board.tsx` becomes a thin orchestrator (state, persistence, top-level DnD context) that composes four new client components: `OutlineHelpBanner`, `OutlineHelpPanel`, `OutlineActGroup` (the collapsible drawer with its own per-act `SortableContext`), and `OutlineEmptyDropZone`. `outline-card.tsx` is lightly restyled to use ink tokens. Data model gains optional `actsOrder`, `collapsedActs`, `helpBannerDismissed` fields with legacy fallback. Theming uses a local CSS variable bridge on `[data-slot="outline-pane"]`, with the light-mode block explicitly resetting `--paper-ink-*` to literal oklch values (same fix pattern as commit `543feb4` on `note-editor.tsx`).

**Tech Stack:** Next.js 16 App Router, React 18 client components, TypeScript strict, CSS variables + inline styles (no Tailwind for theming-critical surfaces), `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), `lucide-react` icons, `@paralleldrive/cuid2` for ids.

---

## File Structure

**Create:**
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-empty-drop-zone.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-help-banner.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-help-panel.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-act-group.tsx`

**Modify:**
- `lib/outline/group-by-act.ts` — honor `actsOrder` when provided
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx` — restyle with ink tokens + add tooltips
- `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` — full rewrite as orchestrator

**Delete:** none

---

## Task 1: Extend data model + group-by-act helper

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` (only the type exports near the top — full body comes later in Task 8)
- Modify: `lib/outline/group-by-act.ts`

- [ ] **Step 1: Extend `OutlineContent` type in outline-board.tsx**

Open `outline-board.tsx`. Find the existing type:

```ts
export type OutlineContent = { beats: Beat[] }
```

Replace with:

```ts
export type ActKey = string | null  // null = "No Act"

export type OutlineContent = {
  beats: Beat[]
  /** Render order of acts. null sentinel = "No Act". Optional for backward
   *  compatibility — legacy docs derive order from beat insertion order. */
  actsOrder?: ActKey[]
  /** Currently-collapsed acts. null = "No Act". */
  collapsedActs?: ActKey[]
  /** User clicked × on the sticky help banner. */
  helpBannerDismissed?: boolean
}
```

Leave the rest of the file alone for now — Task 8 rewrites the component body.

- [ ] **Step 2: Update `lib/outline/group-by-act.ts` to honor `actsOrder`**

Replace the file contents with:

```ts
import type { Beat as ExistingBeat } from '@/app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board'

// Beat shape used by H2 — adds optional `act`.
export type ActBeat = ExistingBeat & { act?: string | null }

export type ActGroup = {
  /** null = ungrouped ("No Act") */
  act: string | null
  beats: ActBeat[]
}

/**
 * Groups beats into act blocks.
 *
 * - When `actsOrder` is provided, returns groups in that order. Acts listed
 *   in actsOrder that have zero beats still produce an empty group (needed
 *   so the empty-drop-zone can render).
 * - When `actsOrder` is undefined, falls back to insertion order: ungrouped
 *   first, then named acts in order of first appearance.
 * - Beats whose act is not present in actsOrder fall into a synthesized
 *   trailing group (so no data is lost if actsOrder gets out of sync).
 */
export function groupBeatsByAct(
  beats: readonly ActBeat[],
  actsOrder?: ReadonlyArray<string | null>,
): ActGroup[] {
  const byAct = new Map<string | null, ActBeat[]>()
  for (const b of beats) {
    const key = ((b.act ?? '').trim() || null) as string | null
    if (!byAct.has(key)) byAct.set(key, [])
    byAct.get(key)!.push(b)
  }

  if (actsOrder && actsOrder.length > 0) {
    const groups: ActGroup[] = []
    const seen = new Set<string | null>()
    for (const key of actsOrder) {
      const normKey = (typeof key === 'string' ? key.trim() : null) || null
      seen.add(normKey)
      groups.push({ act: normKey, beats: byAct.get(normKey) ?? [] })
    }
    // Trailing groups for acts present in beats but missing from actsOrder.
    for (const [key, list] of byAct) {
      if (!seen.has(key)) groups.push({ act: key, beats: list })
    }
    return groups
  }

  // Legacy fallback — insertion order, ungrouped first.
  const ungrouped = byAct.get(null) ?? []
  const groups: ActGroup[] = []
  if (ungrouped.length) groups.push({ act: null, beats: ungrouped })
  const seen = new Set<string | null>([null])
  for (const b of beats) {
    const key = ((b.act ?? '').trim() || null) as string | null
    if (seen.has(key)) continue
    seen.add(key)
    groups.push({ act: key, beats: byAct.get(key)! })
  }
  return groups
}

/** Distinct act names in order of first appearance — for autocomplete on the
 *  per-act header input. Excludes null/empty. */
export function distinctActs(beats: readonly ActBeat[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of beats) {
    const a = (b.act ?? '').trim()
    if (!a || seen.has(a)) continue
    seen.add(a)
    out.push(a)
  }
  return out
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the new type fields are optional; existing call sites still compile).

- [ ] **Step 4: Commit**

```bash
git add lib/outline/group-by-act.ts "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx"
git commit -m "feat(outline): extend data model with actsOrder + collapsedActs"
```

---

## Task 2: `OutlineEmptyDropZone` component

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-empty-drop-zone.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

/* OutlineEmptyDropZone — dashed "Drop a beat here" zone rendered inside any
 * act with 0 beats. Becomes brand-tinted on dragOver. */

import { useDroppable } from '@dnd-kit/core'

export function OutlineEmptyDropZone({
  actKey,
}: {
  actKey: string | null
}) {
  // Stable id: __empty__:<actKey> — outline-board's onDragEnd parses this.
  const id = `__empty__:${actKey ?? '__noact__'}`
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={
        actKey ? `Drop a beat into ${actKey}` : 'Drop a beat into No Act'
      }
      style={{
        minHeight: 48,
        margin: '8px 12px',
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        color: isOver
          ? 'var(--outline-ink)'
          : 'var(--outline-ink-muted)',
        background: isOver
          ? 'oklch(from var(--color-brand) l c h / 0.08)'
          : 'transparent',
        border: isOver
          ? '1.5px solid oklch(from var(--color-brand) l c h / 0.55)'
          : '1.5px dashed var(--outline-rule-soft)',
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
      }}
    >
      ⋯ Drop a beat here, or click <strong>+ Add</strong> ⋯
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-empty-drop-zone.tsx"
git commit -m "feat(outline): empty-act drop zone component"
```

---

## Task 3: `OutlineHelpBanner` component

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-help-banner.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

/* OutlineHelpBanner — sticky dismissible "how this works" banner.
 * Renders when not dismissed AND beat count < 3. */

import { X } from 'lucide-react'

export function OutlineHelpBanner({
  beatCount,
  dismissed,
  onDismiss,
}: {
  beatCount: number
  dismissed: boolean
  onDismiss: () => void
}) {
  if (dismissed) return null
  if (beatCount >= 3) return null

  return (
    <div
      role="region"
      aria-label="Outline help"
      style={{
        margin: '12px 0',
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--outline-act-cap-bg)',
        borderLeft: '3px solid var(--color-brand)',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12.5,
        color: 'var(--outline-ink)',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden style={{ fontSize: 14 }}>ℹ️</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: 'var(--outline-ink-strong)' }}>Outline basics</strong>
        {' — '}
        Beats are scenes. Acts group beats. Drag the{' '}
        <span style={{ fontFamily: 'monospace' }}>⋮⋮</span> handle to reorder
        beats or move them between acts. Click <strong>?</strong> in the
        header for more.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss help banner"
        title="Dismiss"
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--outline-ink-muted)',
          border: 0,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-help-banner.tsx"
git commit -m "feat(outline): sticky help banner"
```

---

## Task 4: `OutlineHelpPanel` component

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-help-panel.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

/* OutlineHelpPanel — centered modal opened by the ? button in the header
 * strip. Single page of help content. Esc / outside-click dismiss. */

import { useEffect, useRef } from 'react'

export function OutlineHelpPanel({
  open,
  onClose,
  onShowBannerAgain,
}: {
  open: boolean
  onClose: () => void
  onShowBannerAgain: () => void
}) {
  const dismissBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Focus the primary action on open so Esc / Tab work intuitively.
    dismissBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outline-help-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'oklch(0 0 0 / 0.4)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: '100%',
          background: 'var(--outline-drawer-bg)',
          color: 'var(--outline-ink)',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
          padding: '22px 24px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <h2
          id="outline-help-title"
          style={{
            margin: '0 0 4px',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--outline-ink-strong)',
          }}
        >
          What's an outline?
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--outline-ink-muted)' }}>
          A workspace for sketching the shape of your story before you write it.
        </p>

        <Section title="Concepts">
          <ul style={ulStyle}>
            <li><strong>Beat</strong> — a single scene or moment ("Hero meets mentor")</li>
            <li><strong>Act</strong> — a group of beats (Setup, Confrontation, Resolution)</li>
            <li><strong>Linked chapter</strong> — jump from a beat to the chapter you're drafting it in</li>
          </ul>
        </Section>

        <Section title="Drag and drop">
          <ul style={ulStyle}>
            <li>Drag a beat's <code>⋮⋮</code> to reorder within an act</li>
            <li>Drag a beat into another act's header (or its drop zone) to move it</li>
            <li>Drag an act's <code>⋮⋮</code> to reorder whole acts</li>
          </ul>
        </Section>

        <Section title="Status">
          <p style={{ margin: 0, fontSize: 13 }}>
            Click a beat's colored dot to cycle: <em>idea → drafting → done</em>
          </p>
        </Section>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              onShowBannerAgain()
              onClose()
            }}
            style={{
              minHeight: 36,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--outline-ink-muted)',
              border: '1px solid var(--outline-rule)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Show banner again
          </button>
          <button
            ref={dismissBtnRef}
            type="button"
            onClick={onClose}
            style={{
              minHeight: 36,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--color-brand)',
              color: 'oklch(0.18 0.02 60)',
              border: 0,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

const ulStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 13,
  lineHeight: 1.6,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 14 }}>
      <h3
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--outline-ink-muted)',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-help-panel.tsx"
git commit -m "feat(outline): help panel modal"
```

---

## Task 5: `OutlineActGroup` component

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-act-group.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

/* OutlineActGroup — collapsible act drawer (iOS-Settings-table feel).
 *
 * Structure:
 *   ┌─ Cap (tinted, top corners rounded) ──────────────┐
 *   │ ⋮⋮  ▼  Act name (editable)  3 beats   + Add     │
 *   └──────────────────────────────────────────────────┘
 *   ┌─ Drawer (white-ish, bottom corners rounded) ─────┐
 *   │  beat row                                        │
 *   │  beat row                                        │
 *   │  beat row                                        │
 *   └──────────────────────────────────────────────────┘
 *
 * Owns its own per-act SortableContext for beat ordering. The outer
 * outline-board owns the SortableContext for act ordering. */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, GripVertical, Plus } from 'lucide-react'
import type { Beat } from './outline-board'
import { OutlineBeatRow } from './outline-card'
import { OutlineEmptyDropZone } from './outline-empty-drop-zone'

export type OutlineActGroupProps = {
  actKey: string | null  // null = "No Act"
  beats: Beat[]
  startIndex: number  // global 1-based index of first beat in this act
  collapsed: boolean
  onToggleCollapsed: () => void
  onRenameAct: (oldName: string, newName: string) => void
  onAddBeat: () => void
  onPatchBeat: (id: string, patch: Partial<Beat>) => void
  onDeleteBeat: (id: string) => void
  onCycleStatus: (id: string) => void
  onOpenLinkPopover: (id: string) => void
  onUnlink: (id: string) => void
  onJumpToChapter: (chapterId: string) => void
  chapterAvailable: (id: string | null | undefined) => boolean
  chapterTitle: (id: string | null | undefined) => string | null
}

export function OutlineActGroup(props: OutlineActGroupProps) {
  const {
    actKey, beats, startIndex, collapsed,
    onToggleCollapsed, onRenameAct, onAddBeat,
    onPatchBeat, onDeleteBeat, onCycleStatus,
    onOpenLinkPopover, onUnlink, onJumpToChapter,
    chapterAvailable, chapterTitle,
  } = props

  const actId = `__act__:${actKey ?? '__noact__'}`
  const sortable = useSortable({ id: actId, data: { type: 'act' } })
  const dropToHeader = useDroppable({ id: `__acthead__:${actKey ?? '__noact__'}` })

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.55 : 1,
  }

  const isHeaderOver = dropToHeader.isOver

  return (
    <section ref={sortable.setNodeRef} style={wrapperStyle}>
      {/* CAP */}
      <header
        ref={dropToHeader.setNodeRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--outline-act-cap-bg)',
          border: '1px solid var(--outline-rule)',
          borderBottom: collapsed ? '1px solid var(--outline-rule)' : 0,
          borderRadius: collapsed ? 10 : '10px 10px 0 0',
          boxShadow: isHeaderOver
            ? '0 0 0 2px oklch(from var(--color-brand) l c h / 0.55)'
            : undefined,
          transition: 'box-shadow 150ms ease',
        }}
      >
        <button
          type="button"
          aria-label="Drag to reorder acts"
          title="Drag to reorder acts"
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'grab',
            borderRadius: 6,
          }}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand this act' : 'Collapse this act'}
          title={collapsed ? 'Expand this act' : 'Collapse this act'}
          onClick={onToggleCollapsed}
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'pointer',
            borderRadius: 6,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform 150ms ease',
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {actKey === null ? (
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--outline-ink-strong)',
              fontFamily: 'var(--font-display, inherit)',
            }}
          >
            No Act
          </span>
        ) : (
          <input
            defaultValue={actKey}
            placeholder="Act name"
            onBlur={e => onRenameAct(actKey, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                ;(e.target as HTMLInputElement).value = actKey
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            style={{
              fontWeight: 700,
              fontSize: 14,
              background: 'transparent',
              border: 0,
              borderBottom: '1px solid transparent',
              outline: 'none',
              color: 'var(--outline-ink-strong)',
              fontFamily: 'var(--font-display, inherit)',
              padding: '2px 0',
              minWidth: 0,
            }}
          />
        )}

        <span style={{ fontSize: 11, color: 'var(--outline-ink-muted)' }}>
          {beats.length} beat{beats.length === 1 ? '' : 's'}
        </span>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={onAddBeat}
          title={actKey ? `Add a beat to ${actKey}` : 'Add a beat to No Act'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--outline-ink-muted)',
            border: 0,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            minHeight: 28,
          }}
        >
          <Plus className="w-3 h-3" />
          Add beat
        </button>
      </header>

      {/* DRAWER */}
      {!collapsed ? (
        <div
          style={{
            background: 'var(--outline-drawer-bg)',
            border: '1px solid var(--outline-rule)',
            borderTop: 0,
            borderRadius: '0 0 10px 10px',
            overflow: 'hidden',
          }}
        >
          {beats.length === 0 ? (
            <OutlineEmptyDropZone actKey={actKey} />
          ) : (
            <SortableContext
              items={beats.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {beats.map((beat, i) => {
                const idx = startIndex + i
                return (
                  <OutlineBeatRow
                    key={beat.id}
                    beat={beat}
                    index={idx}
                    isLast={i === beats.length - 1}
                    chapterAvailable={chapterAvailable(beat.linkedChapterId)}
                    chapterTitle={chapterTitle(beat.linkedChapterId)}
                    onChange={patch => onPatchBeat(beat.id, patch)}
                    onDelete={() => onDeleteBeat(beat.id)}
                    onCycleStatus={() => onCycleStatus(beat.id)}
                    onOpenLinkPopover={() => onOpenLinkPopover(beat.id)}
                    onUnlink={() => onUnlink(beat.id)}
                    onJumpToChapter={() => {
                      if (beat.linkedChapterId) onJumpToChapter(beat.linkedChapterId)
                    }}
                  />
                )
              })}
            </SortableContext>
          )}
        </div>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS (type mismatches on `OutlineBeatRow` props will be reconciled in Task 6 — but the current OutlineBeatRow signature already accepts these props per the existing file, so it should pass).

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-act-group.tsx"
git commit -m "feat(outline): collapsible act-group drawer"
```

---

## Task 6: Restyle `outline-card.tsx`

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx`

The existing component already has the right shape (drag handle + index + status dot + title + link chip + delete). This task only changes the styling to use ink tokens and adds tooltips. The component signature stays identical.

- [ ] **Step 1: Read current file fully to confirm signature**

Run: read `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx` in full.

- [ ] **Step 2: Rewrite the file**

Replace contents with:

```tsx
'use client'

/* OutlineBeatRow — one beat in the act drawer. Compact iOS-table row
 * with: drag handle · index · status dot · title (editable) · description
 * (editable, optional) · link chip · delete. */

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Link as LinkIcon, Link2Off } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Beat, BeatStatus } from './outline-board'

type Props = {
  beat: Beat
  index: number
  isLast: boolean
  chapterAvailable: boolean
  chapterTitle: string | null
  onChange: (patch: Partial<Beat>) => void
  onDelete: () => void
  onCycleStatus: () => void
  onOpenLinkPopover: () => void
  onUnlink: () => void
  onJumpToChapter: () => void
}

const STATUS_COLOR: Record<BeatStatus, string> = {
  idea: 'oklch(0.78 0.04 240)',
  drafting: 'oklch(0.78 0.16 80)',
  done: 'oklch(0.70 0.16 145)',
}
const STATUS_LABEL: Record<BeatStatus, string> = {
  idea: 'idea',
  drafting: 'drafting',
  done: 'done',
}

export function OutlineBeatRow({
  beat, index, isLast, chapterAvailable, chapterTitle,
  onChange, onDelete, onCycleStatus, onOpenLinkPopover, onUnlink, onJumpToChapter,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const sortable = useSortable({ id: beat.id })

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
    display: 'grid',
    gridTemplateColumns: '28px 26px 14px 1fr auto auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: isLast ? 0 : '1px solid var(--outline-rule)',
    color: 'var(--outline-ink)',
    background: sortable.isDragging
      ? 'oklch(from var(--color-brand) l c h / 0.06)'
      : 'transparent',
  }

  const status: BeatStatus = beat.status ?? 'idea'

  return (
    <>
      <div ref={sortable.setNodeRef} style={rowStyle} data-slot="beat-row">
        {/* Drag handle */}
        <button
          type="button"
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label="Drag to reorder · drag into another act to move"
          title="Drag to reorder · drag into another act to move"
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'grab',
            borderRadius: 6,
          }}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Index */}
        <span
          aria-label={`Beat ${index}`}
          style={{
            width: 26, height: 22,
            display: 'grid', placeItems: 'center',
            borderRadius: 11,
            background: 'oklch(from var(--outline-ink-muted) l c h / 0.12)',
            color: 'var(--outline-ink-muted)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {index}
        </span>

        {/* Status dot — click to cycle */}
        <button
          type="button"
          onClick={onCycleStatus}
          aria-label={`Status: ${STATUS_LABEL[status]} · click to cycle`}
          title={`Status: ${STATUS_LABEL[status]} · click to cycle (idea → drafting → done)`}
          style={{
            width: 14, height: 14,
            borderRadius: 7,
            background: STATUS_COLOR[status],
            border: '1.5px solid var(--outline-drawer-bg)',
            boxShadow: '0 0 0 1px var(--outline-rule)',
            cursor: 'pointer',
            padding: 0,
          }}
        />

        {/* Title + optional description (inline editable) */}
        <div style={{ minWidth: 0 }}>
          <input
            type="text"
            value={beat.title}
            placeholder="Untitled beat"
            onChange={e => onChange({ title: e.target.value })}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'var(--outline-ink-strong)',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
              fontFamily: 'inherit',
            }}
          />
          {beat.description ? (
            <input
              type="text"
              value={beat.description}
              placeholder="Notes…"
              onChange={e => onChange({ description: e.target.value })}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: 'var(--outline-ink-muted)',
                fontSize: 12,
                padding: '2px 0 0',
                fontFamily: 'inherit',
              }}
            />
          ) : null}
        </div>

        {/* Link chip */}
        {beat.linkedChapterId && chapterAvailable ? (
          <button
            type="button"
            onClick={onJumpToChapter}
            title={`Linked to ${chapterTitle ?? 'chapter'} · click to jump`}
            aria-label={`Linked to ${chapterTitle ?? 'chapter'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'oklch(from var(--color-brand) l c h / 0.12)',
              color: 'var(--outline-ink)',
              border: 0,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <LinkIcon className="w-3 h-3" />
            {chapterTitle ?? 'Chapter'}
          </button>
        ) : beat.linkedChapterId ? (
          <button
            type="button"
            onClick={onUnlink}
            title="Linked chapter is missing · click to unlink"
            aria-label="Unlink missing chapter"
            style={{ ...linkButtonBase, color: 'var(--outline-ink-muted)' }}
          >
            <Link2Off className="w-3 h-3" />
            Missing
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenLinkPopover}
            title="Link this beat to a chapter"
            aria-label="Link to a chapter"
            style={{
              ...linkButtonBase,
              color: 'var(--outline-ink-muted)',
              opacity: 0.6,
            }}
          >
            <LinkIcon className="w-3 h-3" />
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="Delete beat"
          aria-label="Delete beat"
          style={{
            width: 28, height: 28,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 0,
            color: 'var(--outline-ink-muted)',
            cursor: 'pointer',
            borderRadius: 6,
            opacity: 0.7,
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this beat?"
        message="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmOpen(false)
          onDelete()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

const linkButtonBase: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  borderRadius: 6,
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS. If `ConfirmDialog` props differ in this repo, adjust the prop names (`title`/`message`/`confirmLabel`/`onConfirm`/`onCancel`) to match — Read the existing `@/components/ui/confirm-dialog` if errors surface and adjust this call accordingly.

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-card.tsx"
git commit -m "refactor(outline): restyle beat row with ink tokens + tooltips"
```

---

## Task 7: Rewrite `outline-board.tsx`

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx` (full rewrite of body — keep the exports added in Task 1)

- [ ] **Step 1: Replace file contents**

```tsx
'use client'

/* OutlineBoard — orchestrator for the Outline document.
 *
 * Composes: header strip · OutlineHelpBanner · OutlineActGroup[] ·
 * footer add-buttons · ChapterLinkPopover · OutlineHelpPanel.
 *
 * Owns: state, persistence (debounced 2s save), top-level DnD context
 * for both act-reorder and beat-move. Per-act SortableContexts for beat
 * order live inside each OutlineActGroup. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createId } from '@paralleldrive/cuid2'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { HelpCircle, Plus } from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { updateBinderItemAction } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { SaveStatusBadge, type FormSaveStatus } from '../front-back-matter/save-status-badge'
import { ChapterLinkPopover } from './chapter-link-popover'
import { OutlineActGroup } from './outline-act-group'
import { OutlineHelpBanner } from './outline-help-banner'
import { OutlineHelpPanel } from './outline-help-panel'
import { groupBeatsByAct, distinctActs } from '@/lib/outline/group-by-act'

// ── Types ──────────────────────────────────────────────────────────────

export type BeatStatus = 'idea' | 'drafting' | 'done'

export type Beat = {
  id: string
  title: string
  description?: string
  status?: BeatStatus
  linkedChapterId?: string | null
  act?: string | null
}

export type ActKey = string | null  // null = "No Act"

export type OutlineContent = {
  beats: Beat[]
  actsOrder?: ActKey[]
  collapsedActs?: ActKey[]
  helpBannerDismissed?: boolean
}

type LegacyCard = {
  id: string
  columnId: string
  title: string
  description?: string
  synopsis?: string
  linkedChapterId?: string
}
type LegacyColumn = { id: string; title: string; cards?: LegacyCard[] }
type LegacyOutlineContent = {
  columns?: LegacyColumn[]
  cards?: LegacyCard[]
}

export function readContent(raw: unknown): OutlineContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { beats: [] }
  }
  const c = raw as Partial<OutlineContent> & LegacyOutlineContent
  if (Array.isArray(c.beats)) {
    return {
      beats: c.beats,
      actsOrder: c.actsOrder,
      collapsedActs: c.collapsedActs,
      helpBannerDismissed: c.helpBannerDismissed,
    }
  }
  // Legacy migration — same logic as before, all beats start at 'idea'.
  if (Array.isArray(c.columns)) {
    const nestedCards: LegacyCard[] = c.columns.flatMap(col =>
      (col.cards ?? []).map(card => ({ ...card, columnId: card.columnId ?? col.id })),
    )
    const flatCards = Array.isArray(c.cards) ? c.cards : []
    const allCards: LegacyCard[] = nestedCards.length > 0 ? nestedCards : flatCards
    const colOrder = c.columns.map(col => col.id)
    return {
      beats: [...allCards]
        .sort((a, b) => {
          const ai = colOrder.indexOf(a.columnId)
          const bi = colOrder.indexOf(b.columnId)
          return (ai < 0 ? colOrder.length : ai) - (bi < 0 ? colOrder.length : bi)
        })
        .map(card => ({
          id: card.id,
          title: card.title ?? '',
          description: card.description ?? card.synopsis,
          status: 'idea' as const,
          linkedChapterId: card.linkedChapterId ?? null,
        })),
    }
  }
  return { beats: [] }
}

const STATUS_CYCLE: BeatStatus[] = ['idea', 'drafting', 'done']
function nextStatus(s: BeatStatus | undefined): BeatStatus {
  const i = STATUS_CYCLE.indexOf((s ?? 'idea') as BeatStatus)
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]!
}

// ── Component ──────────────────────────────────────────────────────────

type Props = { item: BinderItemRow }

export function OutlineBoard({ item }: Props) {
  const { binderItems, setActiveItemId, updateBinderItem } = useBookEditor()
  const initial = useMemo(() => readContent(item.content), [item.id])
  const [beats, setBeats] = useState<Beat[]>(initial.beats)
  const [actsOrder, setActsOrder] = useState<ActKey[]>(initial.actsOrder ?? deriveActsOrder(initial.beats))
  const [collapsedActs, setCollapsedActs] = useState<ActKey[]>(initial.collapsedActs ?? [])
  const [helpBannerDismissed, setHelpBannerDismissed] = useState<boolean>(initial.helpBannerDismissed ?? false)
  const [helpPanelOpen, setHelpPanelOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus>('idle')
  const [linkingBeatId, setLinkingBeatId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // First-open migration: write the flat shape so subsequent reads are stable.
  useEffect(() => {
    const c = item.content as Partial<OutlineContent> | null
    if (!c || !Array.isArray(c.beats)) {
      const next: OutlineContent = {
        beats,
        actsOrder,
        collapsedActs,
        helpBannerDismissed,
      }
      void updateBinderItemAction(item.id, { content: next })
      updateBinderItem(item.id, { content: next })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit(partial: Partial<OutlineContent>) {
    const nextBeats = partial.beats ?? beats
    const nextActsOrder = partial.actsOrder ?? actsOrder
    const nextCollapsed = partial.collapsedActs ?? collapsedActs
    const nextDismissed = partial.helpBannerDismissed ?? helpBannerDismissed
    setBeats(nextBeats)
    setActsOrder(nextActsOrder)
    setCollapsedActs(nextCollapsed)
    setHelpBannerDismissed(nextDismissed)
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const content: OutlineContent = {
      beats: nextBeats,
      actsOrder: nextActsOrder,
      collapsedActs: nextCollapsed,
      helpBannerDismissed: nextDismissed,
    }
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      updateBinderItem(item.id, { content })
      const result = await updateBinderItemAction(item.id, { content })
      setSaveStatus(result.success ? 'saved' : 'unsaved')
    }, 2000)
  }

  function ensureActInOrder(act: ActKey, current: ActKey[]): ActKey[] {
    if (current.some(a => a === act)) return current
    return [...current, act]
  }

  function addBeat(act?: ActKey) {
    const resolvedAct: ActKey = act === undefined ? null : act
    const nextBeats = [
      ...beats,
      { id: createId(), title: '', description: '', status: 'idea' as const, linkedChapterId: null, act: resolvedAct },
    ]
    commit({
      beats: nextBeats,
      actsOrder: ensureActInOrder(resolvedAct, actsOrder),
    })
  }

  function patchBeat(id: string, patch: Partial<Beat>) {
    commit({ beats: beats.map(b => b.id === id ? { ...b, ...patch } : b) })
  }
  function deleteBeat(id: string) {
    commit({ beats: beats.filter(b => b.id !== id) })
  }
  function cycleStatus(id: string) {
    const b = beats.find(x => x.id === id)
    if (!b) return
    patchBeat(id, { status: nextStatus(b.status) })
  }

  function renameAct(oldName: string, raw: string) {
    const newName = raw.trim()
    if (!newName || newName === oldName) return
    commit({
      beats: beats.map(b => b.act === oldName ? { ...b, act: newName } : b),
      actsOrder: actsOrder.map(a => a === oldName ? newName : a),
      collapsedActs: collapsedActs.map(a => a === oldName ? newName : a),
    })
  }

  function toggleActCollapsed(act: ActKey) {
    const next = collapsedActs.some(a => a === act)
      ? collapsedActs.filter(a => a !== act)
      : [...collapsedActs, act]
    commit({ collapsedActs: next })
  }

  function addNewAct() {
    // Default name; user edits inline. Pick "Act N" where N is the next
    // integer not already in actsOrder.
    let n = 1
    const existing = new Set(actsOrder.filter((a): a is string => typeof a === 'string'))
    while (existing.has(`Act ${n}`)) n++
    const name = `Act ${n}`
    commit({ actsOrder: ensureActInOrder(name, actsOrder) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // ── ACT REORDER ── (both ids look like "__act__:<name>")
    if (activeId.startsWith('__act__:') && overId.startsWith('__act__:')) {
      const a = parseActId(activeId)
      const b = parseActId(overId)
      const from = actsOrder.findIndex(x => x === a)
      const to = actsOrder.findIndex(x => x === b)
      if (from < 0 || to < 0) return
      commit({ actsOrder: arrayMove(actsOrder, from, to) })
      return
    }

    // ── BEAT DROPPED ON ACT HEADER ── ("__acthead__:<name>")
    if (overId.startsWith('__acthead__:')) {
      const targetAct = parseActHead(overId)
      moveBeatToAct(activeId, targetAct, 0)
      return
    }

    // ── BEAT DROPPED ON EMPTY DROP ZONE ── ("__empty__:<name>")
    if (overId.startsWith('__empty__:')) {
      const targetAct = parseEmptyId(overId)
      moveBeatToAct(activeId, targetAct, 0)
      return
    }

    // ── BEAT REORDER (or beat-onto-beat cross-act move) ──
    const from = beats.findIndex(b => b.id === activeId)
    const to = beats.findIndex(b => b.id === overId)
    if (from < 0 || to < 0) return
    const targetAct = beats[to]!.act ?? null
    let next = arrayMove(beats, from, to)
    if ((next[to]!.act ?? null) !== targetAct) {
      next = next.map((b, i) => i === to ? { ...b, act: targetAct } : b)
    }
    commit({ beats: next })
  }

  function parseActId(id: string): ActKey {
    const raw = id.slice('__act__:'.length)
    return raw === '__noact__' ? null : raw
  }
  function parseActHead(id: string): ActKey {
    const raw = id.slice('__acthead__:'.length)
    return raw === '__noact__' ? null : raw
  }
  function parseEmptyId(id: string): ActKey {
    const raw = id.slice('__empty__:'.length)
    return raw === '__noact__' ? null : raw
  }

  function moveBeatToAct(beatId: string, targetAct: ActKey, _position: number) {
    const beat = beats.find(b => b.id === beatId)
    if (!beat) return
    const others = beats.filter(b => b.id !== beatId)
    // Insert at the FIRST position among beats already in targetAct (i.e.,
    // top of that act's bucket within the flat array).
    const firstIdxInTarget = others.findIndex(b => (b.act ?? null) === targetAct)
    const insertAt = firstIdxInTarget >= 0 ? firstIdxInTarget : others.length
    const moved = { ...beat, act: targetAct }
    const next = [...others.slice(0, insertAt), moved, ...others.slice(insertAt)]
    commit({
      beats: next,
      actsOrder: ensureActInOrder(targetAct, actsOrder),
    })
  }

  function isChapterAvailable(chapterId: string | null | undefined): boolean {
    if (!chapterId) return false
    return binderItems.some(b => b.type === 'chapter' && b.chapterId === chapterId)
  }
  function chapterTitleFor(chapterId: string | null | undefined): string | null {
    if (!chapterId) return null
    const bi = binderItems.find(b => b.type === 'chapter' && b.chapterId === chapterId)
    return bi?.title ?? null
  }
  function jumpToChapter(chapterId: string) {
    const binderItem = binderItems.find(b => b.type === 'chapter' && b.chapterId === chapterId)
    if (binderItem) setActiveItemId(binderItem.id)
  }

  // Render data
  const groups = useMemo(() => groupBeatsByAct(beats, actsOrder), [beats, actsOrder])
  const actIds = groups.map(g => `__act__:${g.act ?? '__noact__'}`)

  // Global beat index map for display numbering
  const beatStartIndexByAct = useMemo(() => {
    const map = new Map<ActKey, number>()
    let i = 1
    for (const g of groups) {
      map.set(g.act, i)
      i += g.beats.length
    }
    return map
  }, [groups])

  return (
    <main
      data-slot="outline-pane"
      key={item.id}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <style>{`
        /* ── DARK MODE (default) ── */
        [data-slot="outline-pane"] {
          --outline-canvas:      var(--canvas-dark-200);
          --outline-act-cap-bg:  var(--canvas-dark-300);
          --outline-drawer-bg:   var(--canvas-dark-100);
          --outline-rule:        oklch(1 0 0 / 0.06);
          --outline-rule-soft:   oklch(1 0 0 / 0.04);
          --outline-ink-strong:  var(--canvas-dark-ink-strong);
          --outline-ink:         var(--canvas-dark-ink);
          --outline-ink-muted:   oklch(from var(--canvas-dark-ink) l c h / 0.7);
          --outline-strip-bg:    var(--canvas-dark-100);
          --outline-strip-ink:   var(--canvas-dark-ink-strong);
          --outline-strip-ink-muted: oklch(from var(--canvas-dark-ink) l c h / 0.7);
        }
        /* ── LIGHT MODE (cream paper) ── */
        [data-editor-theme="light"] [data-slot="outline-pane"] {
          --outline-canvas:      var(--paper-200);
          --outline-act-cap-bg:  var(--paper-200);
          --outline-drawer-bg:   var(--paper-50);
          --outline-rule:        var(--paper-300);
          --outline-rule-soft:   oklch(from var(--paper-300) l c h / 0.6);
          --outline-ink-strong:  oklch(0.180 0.022 50);
          --outline-ink:         oklch(0.265 0.020 55);
          --outline-ink-muted:   oklch(0.520 0.022 60);
          /* Restore paper-* ink tokens to native values — defends against
             dark-mode remap leaks elsewhere in the cascade. */
          --paper-ink-strong:    oklch(0.180 0.022 50);
          --paper-ink:           oklch(0.265 0.020 55);
          --paper-ink-muted:     oklch(0.520 0.022 60);
          --paper-100:           oklch(0.965 0.018 85);
          /* Strip stays dark in both themes (matches Notes pattern). */
          --outline-strip-bg:    var(--canvas-dark-100);
          --outline-strip-ink:   var(--canvas-dark-ink-strong);
          --outline-strip-ink-muted: oklch(from var(--canvas-dark-ink) l c h / 0.7);
        }
      `}</style>

      {/* HEADER STRIP — dark in both themes */}
      <header
        data-slot="outline-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          background: 'var(--outline-strip-bg)',
          borderBottom: '1px solid oklch(1 0 0 / 0.06)',
          boxShadow: 'inset 0 1px 2px oklch(0 0 0 / 0.18)',
          color: 'var(--outline-strip-ink)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: 2,
            background: 'oklch(0.68 0.10 200)',
          }}
        />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--outline-strip-ink-muted)',
        }}>
          Outline
        </span>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: 'var(--outline-strip-ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </span>
        <span style={{
          fontSize: 11, color: 'var(--outline-strip-ink-muted)',
        }}>
          · {beats.length} beat{beats.length === 1 ? '' : 's'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => addBeat()}
          title="Add a beat"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            minHeight: 32, padding: '6px 12px',
            borderRadius: 8,
            background: 'var(--color-brand)',
            color: 'oklch(0.18 0.02 60)',
            border: 0, cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add beat
        </button>
        <button
          type="button"
          onClick={() => setHelpPanelOpen(true)}
          aria-label="Open outline help"
          title="How outlines work"
          style={{
            width: 32, height: 32,
            display: 'grid', placeItems: 'center',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--outline-strip-ink-muted)',
            border: '1px solid oklch(1 0 0 / 0.08)',
            cursor: 'pointer',
          }}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <SaveStatusBadge status={saveStatus} />
      </header>

      {/* SCROLLABLE BODY */}
      <div
        data-slot="outline-pane-body"
        className="flex-1 overflow-y-auto"
        style={{
          background: 'var(--outline-canvas)',
          color: 'var(--outline-ink)',
        }}
      >
        <div className="mx-auto px-8 py-6" style={{ maxWidth: 760 }}>
          <OutlineHelpBanner
            beatCount={beats.length}
            dismissed={helpBannerDismissed}
            onDismiss={() => commit({ helpBannerDismissed: true })}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={actIds} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {groups.map(group => (
                  <OutlineActGroup
                    key={group.act ?? '__noact__'}
                    actKey={group.act}
                    beats={group.beats}
                    startIndex={beatStartIndexByAct.get(group.act) ?? 1}
                    collapsed={collapsedActs.some(a => a === group.act)}
                    onToggleCollapsed={() => toggleActCollapsed(group.act)}
                    onRenameAct={renameAct}
                    onAddBeat={() => addBeat(group.act)}
                    onPatchBeat={patchBeat}
                    onDeleteBeat={deleteBeat}
                    onCycleStatus={cycleStatus}
                    onOpenLinkPopover={id => setLinkingBeatId(id)}
                    onUnlink={id => patchBeat(id, { linkedChapterId: null })}
                    onJumpToChapter={jumpToChapter}
                    chapterAvailable={isChapterAvailable}
                    chapterTitle={chapterTitleFor}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <datalist id="outline-act-suggestions">
            {distinctActs(beats).map(a => <option key={a} value={a} />)}
          </datalist>

          {/* Footer actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => addBeat()}
              style={footerBtnStyle}
            >
              <Plus className="w-4 h-4" />
              Add a beat
            </button>
            <button
              type="button"
              onClick={addNewAct}
              style={footerBtnStyle}
            >
              <Plus className="w-4 h-4" />
              New Act
            </button>
          </div>
        </div>
      </div>

      {linkingBeatId && (
        <ChapterLinkPopover
          onPick={chapterId => {
            patchBeat(linkingBeatId, { linkedChapterId: chapterId })
          }}
          onClose={() => setLinkingBeatId(null)}
        />
      )}

      <OutlineHelpPanel
        open={helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        onShowBannerAgain={() => commit({ helpBannerDismissed: false })}
      />
    </main>
  )
}

const footerBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--outline-ink-muted)',
  border: '1.5px dashed var(--outline-rule-soft)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontStyle: 'italic',
  fontFamily: 'var(--font-display, inherit)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 44,
}

// Derive actsOrder from beats when content has none (first-load of a doc
// that pre-dates this redesign). Ungrouped (null) goes last to match the
// "No Act is just another bucket" model.
function deriveActsOrder(beats: Beat[]): ActKey[] {
  const seen = new Set<ActKey>()
  const order: ActKey[] = []
  for (const b of beats) {
    const key = ((b.act ?? '').trim() || null) as ActKey
    if (seen.has(key)) continue
    seen.add(key)
    if (key !== null) order.push(key)
  }
  if (beats.some(b => !(b.act ?? '').trim())) order.push(null)
  return order
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx"
git commit -m "feat(outline): orchestrator rewrite with collapsible drawers + full DnD"
```

---

## Task 8: End-to-end browser verification

**Files:** none

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (from `C:\Code\personal\beehive-studio`)
Expected: server up on the studio's usual port.

- [ ] **Step 2: Open an Outline document and verify dark mode**

Navigate to a book and open (or create) an Outline binder item.

Expected dark mode visuals:
- Dark canvas background, white-ish text everywhere.
- Header strip is darker than the body, with light-text label "OUTLINE · {title} · N beats".
- `[+ Add beat]` brand-yellow pill on the right, then a `?` icon button, then save status.
- Help banner visible at top (since 0 beats < 3) with `[×]` dismiss button.
- Empty state has a single act group with a dashed "Drop a beat here" zone inside.

- [ ] **Step 3: Toggle light mode (editor theme switcher)**

Expected light mode visuals:
- Cream paper canvas, **dark text everywhere** — title in the strip, banner text, act header names, beat input placeholders, footer button text.
- Header strip **stays dark** with light text (same as Notes pattern).
- Act cap background is a touch darker than the drawer; drawer is the lightest paper tone.
- No "invisible text" anywhere. Specifically verify:
  - Help banner copy is readable
  - "Drop a beat here" copy is readable in the empty zone
  - Act name input shows dark text (not white-on-cream)

- [ ] **Step 4: Add 3 beats, verify banner auto-hides**

Click `+ Add beat` three times. Banner should hide automatically once beat count hits 3.

- [ ] **Step 5: Verify all three drag operations**

- Drag a beat by its `⋮⋮` handle to reorder within the same act.
- Drag a beat into another act's header — should land at the top of that act.
- Create a second act (`+ New Act`), then drag an act's `⋮⋮` to swap its position with another act.
- Drag a beat into an empty act's drop zone.

Each operation should show a brand-tinted highlight on the active drop target.

- [ ] **Step 6: Verify collapse persistence**

Click an act's chevron to collapse. Refresh the page. The act should still be collapsed (state was persisted to `collapsedActs`).

- [ ] **Step 7: Verify help panel**

Click `?` in the header. Modal opens, focus lands on "Got it". Esc closes. Click "Show banner again" — modal closes and banner reappears (if beat count < 3).

- [ ] **Step 8: Verify keyboard a11y on drag**

Tab to a beat's drag handle. Press Space to pick up. Arrow keys move. Space drops. Esc cancels.

- [ ] **Step 9: Commit any fixes**

If any of steps 2-8 surface bugs, fix them inline and commit:

```bash
git add -A
git commit -m "fix(outline): <specific issue>"
```

---

## Self-Review

**Spec coverage check (every spec section maps to a task):**
- Mechanic + data model → Task 1
- Layout & visual chrome → Task 7 (token bridge, header strip, footer buttons) + Task 5 (act group rendering)
- Theming + contrast guarantee → Task 7 (all three rules: no hardcoded colors, light-mode paper-ink reset, strip scoped override)
- DnD operations (beat-within, beat-cross-act, beat-to-empty, act-reorder) → Task 7 (`handleDragEnd` dispatches by id prefix) + Task 5 (per-act SortableContext + act dropp targets) + Task 2 (empty drop zone)
- Help banner → Task 3
- Empty drop zone → Task 2
- Hover tooltips → Task 6 (every icon button has `title` + `aria-label`) + Task 5 (act-cap buttons)
- Help panel → Task 4
- Keyboard a11y → Task 7 (`KeyboardSensor` + `sortableKeyboardCoordinates`) + Task 5/6 (real `<button>` drag handles)
- File structure → matches spec exactly
- "No Act" parity (draggable, accepts drops, treated like a regular act) → Task 7 + Task 5 (no special-case in DnD code; only label/non-editable in cap)
- Browser verification → Task 8

**Placeholder scan:** no TBDs. Every code block is complete. The only `TODO`-style note is `_position` parameter in `moveBeatToAct` (currently always inserts at top of target act, per spec which says "appends beat to top of act"). That matches the spec exactly — not a placeholder, an intentional simplification.

**Type consistency:** `ActKey = string | null` is exported from `outline-board.tsx` (Task 1) and consumed by `OutlineActGroup` (Task 5) and `OutlineEmptyDropZone` (Task 2 — uses `string | null` literal which is identical). `Beat` type is identical to existing definition. `OutlineContent` extension is additive. `OutlineBeatRow` props match the existing shape exactly (Task 6 doesn't change the signature).

**One issue caught + fixed:** `OutlineActGroup` `dropToHeader.setNodeRef` is attached to the `<header>` element AND `sortable.setNodeRef` is attached to the wrapping `<section>`. dnd-kit allows multiple droppables; this is the intended layered structure (header drop = "drop a beat here", section sortable = "reorder acts").

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-outline-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
