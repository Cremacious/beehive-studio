# DP2 Studio Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the persistent studio chrome to match Claude Design's `designs/claude/studio-shell/Studio Shell.html` mockup. Six atomic tasks executed in order: status bar (with SprintControls extraction) → binder + menus + Hive footer → metadata panel → toolbar → editor body → audit + toasts + close-out.

**Architecture:** Tokens already in place from DP1. Each task is a visual + light-structural port of one surface. The sprint timer relocates from a floating overlay into the bottom status bar's right cluster (resolves a live overlap bug). All other changes are visual treatments — no DB, no server actions, no new dependencies.

**Tech Stack:** Tailwind v4 (`@theme` with oklch tokens from DP1), React 19, TipTap v3, lucide-react. shadcn/ui patterns.

**Spec:** [`docs/superpowers/specs/2026-05-26-dp2-studio-shell-design.md`](../specs/2026-05-26-dp2-studio-shell-design.md)

**Source of truth (visual reference):** [`designs/claude/studio-shell/Studio Shell.html`](../../../designs/claude/studio-shell/Studio%20Shell.html), [`designs/claude/studio-shell/styles.css`](../../../designs/claude/studio-shell/styles.css)

---

## File Structure

**New:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-hive-footer.tsx`

**Modified:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (removes SprintTimer mount; updates prose body className for Newsreader)
- `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` (extend light-mode CSS as needed)
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/error-toasts.tsx`

**Deleted:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-timer.tsx`

**No DB changes. No new dependencies. No new server actions. No new types.**

**No new tests required** — all UI integration; manual side-by-side verification per task.

---

## Task 1: SprintControls extraction + status bar restructure

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` (extend light-mode CSS for new structure)
- Delete: `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-timer.tsx`

- [ ] **Step 1: Read the existing files**

Read in this order to understand the current architecture:
1. `editor/sprint-timer.tsx` — full file. Note the props, state, timer-tick logic, popover behavior, finish-celebration logic.
2. `editor/editor-status-bar.tsx` — note the existing left-side cluster (save indicator + word count + word goal). Note `data-slot="editor-status-bar"` and the inline-edit state for word goal.
3. `editor/chapter-editor.tsx` — find where `<SprintTimer …/>` is mounted. Note the current `currentWordCount` value being passed.
4. `corkboard-or-editor.tsx` — find the `<style>` template literal. Note existing `[data-slot="editor-status-bar"]` rules; understand the light-mode pattern.

Also read Claude Design's mockup sections for the sprint controls:
5. Open `designs/claude/studio-shell/styles.css` and grep for `sprint` to find the relevant selectors.
6. Skim `designs/claude/studio-shell/Studio Shell.html` for the rendered states (idle / running / paused / finished).

- [ ] **Step 2: Create SprintControls**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Timer, Pause, Play, Square } from 'lucide-react'

type SprintState =
  | { type: 'idle' }
  | { type: 'setup' }
  | { type: 'running'; startedAt: number; durationMs: number; startWordCount: number; remainingMs: number }
  | { type: 'paused'; remainingMs: number; durationMs: number; startWordCount: number }
  | { type: 'finished'; wordsWritten: number }

type Props = { currentWordCount: number }

const DEFAULT_DURATIONS = [15, 25, 50] // minutes

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SprintControls({ currentWordCount }: Props) {
  const [state, setState] = useState<SprintState>({ type: 'idle' })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.type !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    intervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.type !== 'running') return prev
        const elapsed = Date.now() - prev.startedAt
        const remaining = prev.durationMs - elapsed
        if (remaining <= 0) {
          return { type: 'finished', wordsWritten: currentWordCount - prev.startWordCount }
        }
        return { ...prev, remainingMs: remaining }
      })
    }, 250)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.type, currentWordCount])

  function start(minutes: number) {
    const durationMs = minutes * 60_000
    setState({
      type: 'running',
      startedAt: Date.now(),
      durationMs,
      startWordCount: currentWordCount,
      remainingMs: durationMs,
    })
  }

  function pause() {
    if (state.type !== 'running') return
    setState({
      type: 'paused',
      remainingMs: state.remainingMs,
      durationMs: state.durationMs,
      startWordCount: state.startWordCount,
    })
  }

  function resume() {
    if (state.type !== 'paused') return
    setState({
      type: 'running',
      startedAt: Date.now() - (state.durationMs - state.remainingMs),
      durationMs: state.durationMs,
      startWordCount: state.startWordCount,
      remainingMs: state.remainingMs,
    })
  }

  function stop() {
    setState({ type: 'idle' })
  }

  function dismissFinished() {
    setState({ type: 'idle' })
  }

  if (state.type === 'idle') {
    return (
      <button
        onClick={() => setState({ type: 'setup' })}
        aria-label="Start writing sprint"
        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded text-foreground/70 hover:text-foreground hover:bg-surface-elevated transition-colors"
      >
        <Timer size={12} />
        <span>Start sprint</span>
      </button>
    )
  }

  if (state.type === 'setup') {
    return (
      <div className="relative inline-flex items-center gap-1">
        <span className="text-xs text-foreground/60 mr-1">Sprint:</span>
        {DEFAULT_DURATIONS.map(m => (
          <button
            key={m}
            onClick={() => start(m)}
            className="text-xs px-2 py-1 rounded border border-border text-foreground/80 hover:bg-surface-elevated transition-colors"
          >
            {m}m
          </button>
        ))}
        <button
          onClick={() => setState({ type: 'idle' })}
          aria-label="Cancel sprint setup"
          className="text-xs px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (state.type === 'running' || state.type === 'paused') {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-foreground/80">
          <Timer size={12} className="text-brand" />
          {formatTime(state.remainingMs)}
        </span>
        {state.type === 'running' ? (
          <button onClick={pause} aria-label="Pause sprint" className="text-foreground/60 hover:text-foreground transition-colors">
            <Pause size={12} />
          </button>
        ) : (
          <button onClick={resume} aria-label="Resume sprint" className="text-foreground/60 hover:text-foreground transition-colors">
            <Play size={12} />
          </button>
        )}
        <button onClick={stop} aria-label="Stop sprint" className="text-foreground/60 hover:text-foreground transition-colors">
          <Square size={12} />
        </button>
      </div>
    )
  }

  // finished
  return (
    <button
      onClick={dismissFinished}
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-brand/15 text-brand border border-brand/30 hover:bg-brand/25 transition-colors"
      title="Click to dismiss"
    >
      <Timer size={12} />
      <span>Sprint complete · +{state.wordsWritten} words</span>
    </button>
  )
}
```

Adapt button styling to match the Claude Design mockup's sprint controls if those styles differ from the lucide-based approach above. The state machine + visual variants are the load-bearing logic.

- [ ] **Step 3: Restructure EditorStatusBar**

Read the existing `editor-status-bar.tsx` first. Then:

- Wrap the existing left-cluster content (save indicator + word count + word goal) in `<div className="flex items-center gap-3">` and label it `data-slot="status-left"`.
- Add a right cluster with `<SprintControls currentWordCount={…} />` labeled `data-slot="status-right"`.
- Use flex `justify-between` on the outer container so the clusters sit at left and right edges.

The Status bar's outer container retains `data-slot="editor-status-bar"` (for the light-mode CSS targeting). Word count is already known via `editor.storage.characterCount.words()` in the existing component; the same value is passed to `<SprintControls>`.

- [ ] **Step 4: Remove SprintTimer from chapter-editor.tsx**

Find the `<SprintTimer currentWordCount={…} />` render. Delete it. The status bar handles sprints now.

Also delete the `import { SprintTimer } from './sprint-timer'` at the top of the file.

- [ ] **Step 5: Delete sprint-timer.tsx**

```bash
git rm "app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-timer.tsx"
```

- [ ] **Step 6: Extend corkboard-or-editor.tsx light-mode CSS**

Find the existing `[data-editor-theme="light"] [data-slot="editor-status-bar"]` rules in the `<style>` template literal. Add rules covering the new sprint controls if needed:

```css
[data-editor-theme="light"] [data-slot="editor-status-bar"] [data-slot="status-right"] button {
  color: var(--paper-ink-muted);
}
[data-editor-theme="light"] [data-slot="editor-status-bar"] [data-slot="status-right"] button:hover {
  color: var(--paper-ink-strong);
}
```

If the existing button rules in the `<style>` tag are already broad (`[data-slot="editor-status-bar"] button`), the new sprint buttons inherit automatically — no new rules needed. Confirm by inspection.

- [ ] **Step 7: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Boot dev. Open a chapter.
2. Bottom status bar — save indicator + word count + word goal on left; "Start sprint" button on right.
3. Click "Start sprint" → duration buttons (15 / 25 / 50 / Cancel) appear in-place.
4. Click "15m" → countdown starts, pause/stop buttons appear.
5. Click pause → timer freezes, play button replaces pause.
6. Click play → resumes.
7. Click stop → back to idle.
8. Verify: the floating SprintTimer overlay that previously clipped the word-goal button is GONE. Word goal is fully clickable in the bottom-left.
9. Toggle light mode → sprint controls flip to paper ink colors readably.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/" "app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx"
git commit -m "feat(studio): SprintControls in status bar; floating overlay removed (DP2 Task 1)

Refactors sprint timer from a floating overlay (which clipped the
word-goal button) into the bottom status bar's right cluster.

New SprintControls component owns state (idle/setup/running/paused/
finished), timer ticks, duration picker, and finish celebration.
EditorStatusBar composes it on the right; save+wordcount+goal
remain on the left.

sprint-timer.tsx deleted; chapter-editor.tsx no longer mounts the
overlay. Light-mode CSS extended for new structure.

Resolves: floating sprint timer overlapping word-goal button."
```

---

## Task 2: Binder + ⋯ menu + + Add menu + Hive footer

**Files:**
- Modify: `binder/binder-tree.tsx`
- Modify: `binder/binder-item.tsx`
- Modify: `binder/binder-item-menu.tsx`
- Modify: `binder/binder-add-menu.tsx`
- Create: `binder/binder-hive-footer.tsx`

- [ ] **Step 1: Read mockup binder section**

Open `designs/claude/studio-shell/Studio Shell.html` and `designs/claude/studio-shell/styles.css`. Grep both for `binder` to find the binder-related markup + CSS. Note:

- Item-row paddings, font weights, hover treatment.
- Active row indicator visual (left edge marker? background tint?).
- Item-type icon tint colors (should map to `--type-chapter`, `--type-front-matter`, etc.).
- ⋯ menu popover styling.
- + Add menu popover styling (per-type rows with tinted icons).
- Hive footer button placement, visual treatment.

Also read the existing files: `binder/binder-tree.tsx`, `binder/binder-item.tsx`, `binder/binder-item-menu.tsx`, `binder/binder-add-menu.tsx`.

- [ ] **Step 2: Update binder-tree.tsx**

Wrapper styling: w-60 (or new width if mockup specifies), bg matches mockup. Header section with book title (existing) + corkboard toggle button (existing).

Mount `<BinderHiveFooter />` at the bottom of the binder tree, beneath the existing `+ Add` menu trigger.

The DnD container (existing `@dnd-kit` config) stays unchanged.

- [ ] **Step 3: Update binder-item.tsx**

Apply per-mockup styling to each row. Key states:

```tsx
// Default
className={cn(
  'flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors',
  'text-foreground/80 hover:bg-surface-elevated',
  isActive && 'bg-brand/15 text-brand',
  isRenaming && 'bg-surface-elevated',
)}
```

The item-type icon should tint per type. Map type → token:
- `chapter` → `var(--type-chapter)` (yellow — this is the workhorse)
- `front_matter` → `var(--type-front-matter)` (plum)
- `back_matter` → `var(--type-back-matter)` (rose)
- `outline` → `var(--type-outline)` (teal)
- `research_note` → `var(--type-research)` (sage)
- `character` → `var(--type-character)` (terracotta)

Apply as inline style — `style={{ color: 'var(--type-chapter)' }}` etc. Do NOT use the Tailwind arbitrary-value syntax `text-[var(--type-chapter)]` because Tailwind v4 scans the docs folder and would generate CSS for any placeholder examples written here. Inline `style={}` is safer for token-driven colors.

Preserve existing functionality: rename trigger, drag handle, chevron for collapse/expand, ⋯ menu trigger on hover, link to chapter on click.

- [ ] **Step 4: Update binder-item-menu.tsx**

Popover styling matches the mockup — typically paper-card background (`bg-popover`), border (`border-border`), rounded corners. Action items styled as full-width buttons. Destructive Delete row visually marked (red-ish via `--error`).

```tsx
<DropdownMenuItem
  onClick={…}
  className="text-error focus:text-error focus:bg-error/10"
>
  <Trash2 size={12} />
  Delete
</DropdownMenuItem>
```

The `text-error` utility requires `--color-error: var(--error)` in `@theme inline`. Confirm during implementation; if not present, either add it OR use `text-[var(--error)]` inline-style escape.

- [ ] **Step 5: Update binder-add-menu.tsx**

The popover lists 6 item-type options. Each row shows the tinted icon + name. Apply same item-type token mapping as Step 3.

```tsx
{ type: 'chapter',        icon: BookOpen,   label: 'Chapter',        tint: 'var(--type-chapter)' },
{ type: 'front_matter',   icon: FileText,   label: 'Front Matter',   tint: 'var(--type-front-matter)' },
{ type: 'back_matter',    icon: FileText,   label: 'Back Matter',    tint: 'var(--type-back-matter)' },
{ type: 'outline',        icon: Layout,     label: 'Outline',        tint: 'var(--type-outline)' },
{ type: 'research_note',  icon: NotebookText, label: 'Research Note', tint: 'var(--type-research)' },
{ type: 'character',      icon: User,       label: 'Character',      tint: 'var(--type-character)' },
```

Confirm the existing lucide imports in the file; use those icons. If the existing code uses different lucide icons per type, KEEP those.

The `+ Add` trigger itself uses brand yellow (it's one of the 5 sanctioned places).

- [ ] **Step 6: Create binder-hive-footer.tsx**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/binder/binder-hive-footer.tsx
'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import { CreateHiveModal } from '../create-hive-modal'
import { useBookEditor } from '../book-editor-provider'

export function BinderHiveFooter() {
  const [open, setOpen] = useState(false)
  const { bookId, bookTitle } = useBookEditor()

  return (
    <>
      <div className="px-2 pb-2">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-foreground/70 hover:text-foreground hover:bg-surface-elevated transition-colors"
        >
          <Users size={12} />
          <span>Open a Hive</span>
        </button>
      </div>
      <CreateHiveModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

If `CreateHiveModal`'s prop shape differs (e.g., it's controlled differently), adapt. The footer is a thin wrapper around the existing modal. The label text matches the mockup — confirm exact wording during implementation.

If the existing `create-hive-button.tsx` is suitable to reuse, prefer that — the new footer can compose it instead of re-implementing.

- [ ] **Step 7: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Manual smoke:
1. Open studio. Binder visually matches mockup.
2. Row states: default / hover / active / drag all render correctly.
3. Item-type icons show their tints (6 distinct colors).
4. Click ⋯ on a row → popover opens; Delete row is red-ish.
5. Click + Add → popover lists 6 types with tinted icons; clicking creates the item.
6. Hive footer button visible at bottom; clicking opens CreateHiveModal.
7. Actually drag-drop a binder item to confirm DnD didn't regress.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/"
git commit -m "feat(studio): binder + menus + Hive footer styled to Claude Design (DP2 Task 2)

Per-row aesthetic per the mockup: tinted item-type icons via
--type-* tokens (6 distinct colors), paper-card row hover treatment,
brand-yellow active row indicator, destructive Delete marked.

+ Add menu lists 6 item types with tinted icons matching the tree.
⋯ menu popover styled to mockup with destructive-action affordance.

New BinderHiveFooter mounts beneath + Add — small 'Open a Hive'
button that triggers the existing CreateHiveModal. Pixel-perfect
binder pass; all interactive states verified.

No regressions: rename, drag-drop, expand/collapse all work."
```

---

## Task 3: Right metadata panel + Publishing expander

**Files:**
- Modify: `metadata/metadata-panel.tsx`

- [ ] **Step 1: Read mockup metadata section**

Open `designs/claude/studio-shell/Studio Shell.html` and `studio-shell/styles.css`. Grep for `metadata` or scroll to the right-panel section. Note:
- Section heading style.
- Title inline-rename treatment.
- Status pill colors — should map to `--status-*` palette (Idea / Outline / First Draft / Revised / Final).
- Synopsis textarea field treatment (paper card?).
- Scene Planner expander visual.
- Notes textarea treatment.
- Publishing expander (pinned at bottom) — header with Premium badge + subtitle, then form fields when expanded.

Also read the existing `metadata-panel.tsx` (337 lines from the spec context).

- [ ] **Step 2: Update ChapterMetadata sections**

Apply visual treatments. Key changes:

**Title:** `<h2>` or `<input>` styled with `--paper-ink-strong` color when in light mode (existing pattern preserved). Inline-rename behavior unchanged.

**Status pills:** map each option's color to its `--status-*` token:

```tsx
const STATUS_OPTIONS = [
  { value: 'IDEA' as const,        label: 'Idea',        color: 'var(--status-idea)' },
  { value: 'OUTLINE' as const,     label: 'Outline',     color: 'var(--status-outline)' },
  { value: 'FIRST_DRAFT' as const, label: 'First Draft', color: 'var(--status-first-draft)' },
  { value: 'REVISED' as const,     label: 'Revised',     color: 'var(--status-revised)' },
  { value: 'FINAL' as const,       label: 'Final',       color: 'var(--status-final)' },
]
```

Each pill: muted background when inactive; tinted background using the status color at 15-20% opacity when active. Text color matches the tint when active. Use inline `style={{ ... }}` with `color: 'var(--status-X)'` patterns since Tailwind utilities don't compose with arbitrary CSS variables easily — confirm and adapt.

**Synopsis:** field treatment per mockup. Likely `bg-surface-inset` (now resolves to `--chrome-900`), border, subtle.

**Scene Planner:** expander chevron + heading + paper-card 3-field section when open. Currently uses `▾`/`▸` chars; preserve.

**Notes:** larger textarea with same paper-field treatment.

- [ ] **Step 3: Update PublishingSection**

The expander at the bottom retains:
- "Publishing details" label
- Premium badge
- "Applies to the whole book, not just this chapter" subtitle (added in SP5)

Visual treatment:
- Border-top separator (already exists).
- Header row matches mockup.
- Expanded state shows form fields stacked. Each field labelled, paper-style input.
- Premium badge styled per the new system (`var(--brand-soft)` background + `var(--brand)` border + `var(--brand-ink)` text — these tokens were added in DP1).

- [ ] **Step 4: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Manual smoke:
1. Open a chapter. Right metadata panel visually matches mockup.
2. Status pills show 5 distinct colors when their option is active.
3. Synopsis / Notes textareas paper-styled.
4. Scene Planner expander opens/closes correctly. Hidden on FM/BM.
5. Publishing expander at bottom opens; fields render; Premium badge styled.
6. Title inline-rename still works.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx"
git commit -m "feat(studio): metadata panel + Publishing expander styled (DP2 Task 3)

Status pills map to --status-* palette (5 distinct hues). Synopsis +
Notes fields styled as paper-card surfaces. Scene Planner expander
visual matches mockup. Publishing expander retains SP5 subtitle and
gains the new premium-badge treatment with --brand-soft + --brand
border + --brand-ink text.

Inline-rename, autosave, hidden-Scene-Planner-on-FM/BM all preserved."
```

---

## Task 4: Editor toolbar (26 buttons)

**Files:**
- Modify: `editor/editor-toolbar.tsx`

- [ ] **Step 1: Read mockup toolbar section**

Open `designs/claude/studio-shell/Studio Shell.html` and `studio-shell/styles.css`. Grep for `toolbar` or scroll to the toolbar section. Note:
- Toolbar height + padding.
- Three-zone layout (FORMAT, spacer, VIEW).
- Button base styling (hover, active, disabled).
- Active state color (should be brand yellow per the 5-place restraint).
- Separator visual between groups.
- Special buttons: Sun/Moon toggle, font-size `<select>`, Export label.

Read existing `editor-toolbar.tsx`. Note the `ToolbarButton` wrapper.

- [ ] **Step 2: Update ToolbarButton wrapper**

```tsx
function ToolbarButton({ onClick, disabled, isActive, title, children }: ToolbarButtonProps) {
  const button = (
    <button
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className={cn(
        'text-xs px-2 py-1 rounded transition-colors',
        'text-foreground/65 hover:text-foreground hover:bg-surface-elevated',
        isActive && 'bg-brand text-brand-ink hover:bg-brand-hover',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground/65',
      )}
    >
      {children}
    </button>
  )
  if (!title) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}
```

The active state moves from a brand-tinted backdrop (`bg-brand/20`) to a solid brand-yellow background with dark ink — this matches Claude Design's "active toolbar button" being one of the 5 sanctioned yellow uses.

- [ ] **Step 3: Update separators**

```tsx
function Separator() {
  return <span className="w-px h-4 bg-border mx-1" />
}
```

If the mockup specifies a different separator style (e.g., dotted or with different spacing), adapt. The existing structure (separators between groups) stays.

- [ ] **Step 4: Update non-wrapper buttons**

Sun/Moon, Export, Analysis, Focus, History, HelpCircle — restyle each to match the mockup. Most should adopt the same `ToolbarButton` pattern but they don't use the wrapper because they have custom click handlers (e.g., Export opens a modal).

Confirm during implementation whether these can be lifted into `ToolbarButton` (cleaner) or stay ad-hoc.

Font-size `<select>` gets styled to match the mockup — paper-card surface, subtle border.

- [ ] **Step 5: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Manual smoke (side-by-side with mockup):
1. Toolbar height + padding match.
2. Each FORMAT group spaced correctly with separators.
3. Each button's hover state lifts (paper hover bg).
4. Active buttons (e.g., Bold while in bold text) show solid brand yellow.
5. Disabled Undo/Redo dim correctly.
6. VIEW zone buttons (Find/History/Help/theme/font-size/Export/Analysis/Focus) all render with mockup styling.
7. Tooltips still work for icon-only buttons.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "feat(studio): editor toolbar styled to Claude Design (DP2 Task 4)

ToolbarButton active state moves from soft brand-tint to solid
brand-yellow + brand-ink — one of the 5 sanctioned yellow uses.
Hover treatment paper-card. Disabled buttons dim correctly.

Three-zone layout preserved (FORMAT, spacer, VIEW). All 26 buttons
restyled. Tooltips + aria-labels preserved from SP6.

Pixel-perfect toolbar pass."
```

---

## Task 5: Editor body — prose + paper mode

**Files:**
- Modify: `editor/chapter-editor.tsx`
- Possibly: `corkboard-or-editor.tsx` (additional light-mode prose rules)

- [ ] **Step 1: Read mockup editor body section**

Open `designs/claude/studio-shell/Studio Shell.html` and `studio-shell/styles.css`. Grep for `prose`, `editor-body`, `tiptap`, or similar. Note:
- Container max-width, padding, centering.
- Prose font (likely `--font-prose` → Newsreader from DP1).
- Font size + line-height for body / headings / blockquote.
- Paragraph spacing.
- Heading sizes (H1/H2/H3).
- Blockquote indent + style.
- Light mode prose colors (paper-ink for body, paper-ink-strong for headings).

Read existing `chapter-editor.tsx` — note the `<EditorContent>` className.

Also check existing prose rules in `app/globals.css` — `.prose-bh`, `.prose-chapter`, or `.tiptap.ProseMirror` selectors.

- [ ] **Step 2: Update EditorContent className**

```tsx
<EditorContent
  editor={editor}
  className="min-h-full p-8 max-w-3xl mx-auto prose-chapter focus:outline-none"
  style={{
    fontFamily: 'var(--font-prose)',
    fontSize: 'var(--editor-font-size, 16px)',
    lineHeight: 1.65,
  }}
/>
```

The `prose-chapter` class targets `globals.css` selectors that style the inner ProseMirror content. If those rules need to target `.tiptap.ProseMirror` specifically, either:
- Add `.prose-chapter .tiptap.ProseMirror` selectors in `globals.css`, OR
- Apply the class via `editor.options.editorProps.attributes.class = 'prose-chapter'` so it lands on the inner contenteditable.

Confirm which TipTap pattern the existing code uses; adapt for consistency.

- [ ] **Step 3: Verify light-mode prose**

Toggle light mode. Prose should render on cream paper with `--paper-ink` text and `--paper-ink-strong` headings. The SP4 light-mode CSS in `corkboard-or-editor.tsx` already covers prose colors; verify no additional rules needed.

If a new rule is needed (e.g., the prose-chapter class needs paper-ink-muted for muted-paragraph treatment), add to `corkboard-or-editor.tsx`'s `<style>` template literal.

- [ ] **Step 4: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Manual smoke (side-by-side with mockup):
1. Open a chapter with some prose. Body uses Newsreader, line-height roomy, paragraph spacing breathes.
2. H1/H2/H3 sizes match mockup.
3. Blockquote indented + styled.
4. Lists + horizontal rules render correctly.
5. Cursor visible. Typing works.
6. Toggle light mode → cream paper background, dark prose readable.
7. Toggle font size in toolbar → prose font scales correctly.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx" "app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx"
git commit -m "feat(studio): editor body styled to Claude Design (DP2 Task 5)

Prose body now uses Newsreader serif (--font-prose) loaded in DP1.
Container max-w-3xl centered with mockup-spec padding + line-height.
Heading sizes + paragraph spacing match mockup.

Light mode renders prose on cream paper (--paper-100) with
--paper-ink body color and --paper-ink-strong headings. Dark mode
unchanged; warm coffee canvas from DP1.

Pixel-perfect editor body pass."
```

---

## Task 6: Brand-yellow audit + error toasts + DP2 close-out

**Files:**
- Modify: `editor/error-toasts.tsx`
- Possible light edits across: toolbar/binder/status bar files (yellow audit)
- Modify: `AGENTS.md` (Resume Here + DP2 entry)

- [ ] **Step 1: Audit brand-yellow usage**

Grep DP2's surfaces for brand-yellow usage:

```bash
grep -rn 'text-brand\|bg-brand\|FFC300\|var(--brand)' "app/[locale]/(app)/studio/[bookId]/_components/binder/" "app/[locale]/(app)/studio/[bookId]/_components/editor/" "app/[locale]/(app)/studio/[bookId]/_components/metadata/" 2>&1
```

For each match, verify it falls into one of the 5 sanctioned places:
1. Active binder row indicator.
2. Unsaved-save-status indicator (the `●` dot in the status bar).
3. `+ Add` button primary CTA.
4. Premium badge (e.g., Publishing details, version history).
5. Active toolbar button background.

If a match is outside these 5 places, downgrade to neutral:
- For text emphasis → use `--foreground` or `--chrome-200`.
- For borders → use `--border` (which is `--chrome-700`).
- For backgrounds → use `--surface-elevated` (which is `--chrome-800`).
- For accent tints → use `--accent` (`--chrome-800`).

Document each change in the commit message. Common candidates for downgrade:
- Hover-emphasis text using `text-brand` → switch to `hover:text-foreground`.
- Decorative borders using `border-brand/30` → switch to `border-border`.

- [ ] **Step 2: Update error-toasts.tsx**

Read the existing file. Visual treatment per mockup:
- Info variant: chrome neutral.
- Success: `--success` accent.
- Error: `--error` accent.
- Premium-required: `--brand` accent (this IS the premium badge — sanctioned use).

Each toast: paper-card surface, icon + message, optional dismiss `×`. Stacking visual when multiple are shown.

- [ ] **Step 3: Type check + final manual checklist**

```bash
npx tsc --noEmit
npm test
```

Walk the 13-item DP2 final checklist from the spec (§5):
1. `npm run dev` clean. Studio loads.
2. Open a chapter → binder/toolbar/editor/metadata visually match mockup.
3. Binder row states: default/hover/active/renaming all correct; type icons tinted.
4. ⋯ menu + + Add menu open with mockup styling; Delete row distinct.
5. Hive footer visible; click opens modal.
6. Toolbar 26 buttons render with mockup spacing + states.
7. Sprint timer in status bar's right cluster; floating overlap GONE.
8. Status bar: save+wordcount+goal left; sprint right.
9. Light mode flips editor body to cream paper; chrome stays walnut.
10. Right metadata panel matches mockup; status pills 5 colors.
11. Brand yellow only in 5 sanctioned places.
12. `tsc` clean.
13. `npm test` clean (still 119).

- [ ] **Step 4: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-26
- Current focus: "DP2 Studio Shell complete; DP3 Specialized Editor Surfaces next."
- Last commit: `git log -1 --format=%s` after AGENTS.md commit.
- Next concrete step: "invoke /brainstorming for DP3 Specialized Editor Surfaces — port FM/BM previews, Outline, Notes, Character profile."

Add a DP2 pattern entry alongside existing patterns:
> **DP2 design-port pattern:** Studio chrome ported surface-by-surface (status bar → binder → metadata → toolbar → editor body → audit). Brand yellow restrained to 5 sanctioned uses across the touched surfaces; remaining surfaces audited in DP3/DP4. Sprint timer relocated from floating overlay into the bottom status bar's right cluster (resolves a live overlap bug).

Add a DP2 entry under "What Has Been Built":

```markdown
### DP2 — Design Port Studio Shell ✅ COMPLETE (2026-05-26)
Second of four design-port sub-projects. Ported persistent studio chrome to match Claude Design's `studio-shell` mockup.

- **Sprint timer** moved from floating overlay into bottom status bar's right cluster; new `SprintControls` component owns the state. Resolves a live overlap bug with the word-goal button.
- **Binder** rows + ⋯ menu + + Add menu styled to mockup; six item types render with distinct tints (`--type-*`); new BinderHiveFooter mounts beneath + Add as the Hive entry point.
- **Editor toolbar** 26 buttons restyled; active state is solid brand-yellow on brand-ink (one of the 5 sanctioned yellow uses).
- **Editor body** prose face is now Newsreader serif (`--font-prose` from DP1); container + spacing match mockup; light-mode paper rendering preserved.
- **Right metadata panel** status pills use `--status-*` palette (5 hues); fields styled as paper-card surfaces; Publishing expander retains SP5 "Applies to whole book" subtitle.
- **Error toasts** restyled per variant (info / success / error / premium).
- **Brand-yellow audit** restricted yellow to 5 places: active binder row, unsaved indicator, + Add, premium badge, active toolbar button.

Pixel-perfect on editor body / binder / toolbar; structural fidelity on status bar / metadata / Hive / toasts. 119/119 tests, tsc clean.

**Next:** DP3 Specialized Editor Surfaces — FM/BM previews, Outline, Notes, Character profile.
```

- [ ] **Step 5: Commit + push**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/" AGENTS.md
git commit -m "feat(studio): brand-yellow audit + error toasts + DP2 close-out (DP2 Task 6)

Restrains brand yellow to 5 sanctioned places across DP2's surfaces.
Downgrades incidental yellow uses to neutral chrome tokens.

Error toasts get variant-specific accent colors (info chrome, success
green-ish, error red-ish, premium brand).

AGENTS.md updated: DP2 marked complete; DP3 queued.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 6 atomic commits (one per task) + AGENTS.md close-out commit.
- All 13 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- Pixel-perfect verification on editor body / binder / toolbar.
- Brand yellow restrained to 5 sanctioned places across DP2's surfaces.
- AGENTS.md Resume Here updated; DP2 entry added.
- Floating SprintTimer overlap bug resolved.
- Pushed to origin/main.
