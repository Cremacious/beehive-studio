# DP4 Overlays / Modes / Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the transient surfaces (modes, drawers, overlays, modals, confirmations, empty states) to match Claude Design's `overlays-modes` mockup. After DP4, the entire studio matches the new design system.

**Architecture:** Two new shared components (`ConfirmDialog`, `EmptyState`) + restyle of 8 existing surfaces. Foundation-up execution order so later tasks can use the new shared components immediately. Heavy reuse of patterns established in DP1-DP3: `tbtnClass()`, paper-context contrast rules, theme-aware CSS-variable bridge.

**Tech Stack:** Tailwind v4, React 19, lucide-react, shadcn/ui `Dialog` primitive (for ConfirmDialog), TipTap v3 (no changes), @dnd-kit (corkboard reorder, unchanged).

**Spec:** [`docs/superpowers/specs/2026-05-26-dp4-overlays-modes-modals-design.md`](../specs/2026-05-26-dp4-overlays-modes-modals-design.md)

**Visual reference:** [`designs/claude/overlays-modes/Overlays Modes.html`](../../../designs/claude/overlays-modes/Overlays%20Modes.html), [`designs/claude/overlays-modes/styles.css`](../../../designs/claude/overlays-modes/styles.css)

---

## File Structure

**Create:**
- `components/ui/confirm-dialog.tsx`
- `app/[locale]/(app)/studio/[bookId]/_components/empty-state.tsx`

**Modify:**
- Task 1: `binder/binder-item-menu.tsx` (refactor inline confirm → ConfirmDialog) + grep for other ad-hoc confirms
- Task 2: `editor/chapter-editor.tsx`, `metadata/metadata-panel.tsx`, `editor/version-history-drawer.tsx`, possibly `editor/writing-analysis.tsx` (refactor empties → EmptyState)
- Task 3: `editor/keyboard-cheatsheet.tsx`, `export-modal.tsx`, `editor/sprint-controls.tsx` (setup popover)
- Task 4: `editor/find-replace.tsx`, `editor/version-history-drawer.tsx` (drawer chrome), `editor/preview-banner.tsx`, `editor/writing-analysis.tsx`
- Task 5: `corkboard-view.tsx`, `editor/sprint-controls.tsx` (finished animation), `app/globals.css` (sprintFinished keyframes)
- Task 6: `AGENTS.md`

**No DB changes. No new dependencies. No new server actions.** Tests stay at 119 — no new unit tests.

---

## Task 1: ConfirmDialog component + refactor

**Files:**
- Create: `components/ui/confirm-dialog.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx`
- Possibly modify: other studio files with ad-hoc confirms (grep first)

- [ ] **Step 1: Confirm shadcn primitives available**

Check if `components/ui/alert-dialog.tsx` exists (shadcn AlertDialog primitive). If yes, prefer that — it's built for this use case with focus trap + Escape + click-outside.

If not, check `components/ui/dialog.tsx` (Dialog primitive — likely exists, used by other modals). Build ConfirmDialog on top of Dialog.

```bash
ls components/ui/ | grep -i dialog
```

- [ ] **Step 2: Build ConfirmDialog component**

```tsx
// components/ui/confirm-dialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'destructive'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: Variant
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
}: Props) {
  const [pending, setPending] = useState(false)
  const finalConfirmLabel = confirmLabel ?? (variant === 'destructive' ? 'Delete' : 'Confirm')

  async function handleConfirm() {
    if (pending) return
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-display)' }}>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className={cn(
              variant === 'destructive'
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-brand text-brand-ink hover:bg-brand-hover',
            )}
          >
            {pending ? 'Working…' : finalConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Adapt to whatever Dialog API exists. If `DialogDescription` doesn't take ReactNode children well, replace with a plain `<p>` in the body.

If `Button` component doesn't exist, render `<button>` with the same classNames. Confirm during Step 1.

- [ ] **Step 3: Refactor `binder-item-menu.tsx`**

Read `binder-item-menu.tsx`. Find the `setConfirmingDelete(true)` pattern + the inline confirm UI it renders. Replace:

Before:
```tsx
const [confirmingDelete, setConfirmingDelete] = useState(false)
// ... <MenuItem destructive onClick={() => setConfirmingDelete(true)}>Delete</MenuItem>
// ... {confirmingDelete && <inline confirm UI>}
```

After:
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const [confirmingDelete, setConfirmingDelete] = useState(false)
// ... <MenuItem destructive onClick={() => setConfirmingDelete(true)}>Delete</MenuItem>
<ConfirmDialog
  open={confirmingDelete}
  onOpenChange={setConfirmingDelete}
  variant="destructive"
  title="Delete item?"
  description={`This will permanently delete "${item.title}" and any nested items. This cannot be undone.`}
  confirmLabel="Delete"
  onConfirm={handleDelete}
/>
```

Preserve `handleDelete` (the existing destructive flow) — pass it as `onConfirm`.

Remove the inline confirm UI block (the one that lived inside the dropdown). Verify the dropdown closes naturally when the dialog opens.

- [ ] **Step 4: Grep + refactor other ad-hoc confirms**

```bash
grep -rn "window.confirm\|setConfirming\|isConfirming\|confirm(" "app/[locale]/(app)/studio" 2>&1 | head
```

For each match outside `binder-item-menu.tsx`, evaluate:
- Is it a destructive confirm flow? → refactor to ConfirmDialog.
- Is it a native `window.confirm()` call? → wrap with ConfirmDialog state instead.
- Is it unrelated (e.g., a "confirm" label on a non-modal flow)? → leave alone.

Document each refactor in the commit message.

- [ ] **Step 5: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Open binder.
2. Click ⋯ on a chapter → menu opens.
3. Click Delete → ConfirmDialog appears (centered, dim backdrop).
4. Click Cancel → dialog closes, chapter NOT deleted.
5. Click Delete again → confirm → chapter is deleted.
6. Verify dropdown menu also closed properly (no stray UI).
7. Press Esc with dialog open → dialog closes.

- [ ] **Step 6: Commit**

```bash
git add components/ui/confirm-dialog.tsx "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx"
git commit -m "feat(ui): unified ConfirmDialog + refactor binder-item delete (DP4 Task 1)

New shared component at components/ui/confirm-dialog.tsx — built on
shadcn Dialog primitive. Standardizes destructive-action confirmations:
title + description + Cancel + Confirm (with destructive variant for
red-tinted confirm button).

Refactored binder-item-menu.tsx — replaced inline setConfirmingDelete
state machine with ConfirmDialog mount. Same delete flow, cleaner code,
standard a11y (focus trap + Esc + click-outside via Dialog primitive).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: EmptyState component + refactor studio empties

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/empty-state.tsx`
- Modify: `editor/chapter-editor.tsx`, `metadata/metadata-panel.tsx`, `editor/version-history-drawer.tsx`, possibly `editor/writing-analysis.tsx`

- [ ] **Step 1: Build EmptyState component**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/empty-state.tsx
'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CtaProps = { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }

type Props = {
  icon?: ReactNode                    // optional lucide icon
  title: string
  body?: string | ReactNode
  cta?: CtaProps
  secondaryCta?: { label: string; onClick: () => void }
  className?: string
  /** Set when the empty state lives on editor canvas (not chrome). Applies
   *  theme-aware ink colors that flip with the editor light/dark toggle. */
  onEditorCanvas?: boolean
}

export function EmptyState({
  icon, title, body, cta, secondaryCta, className, onEditorCanvas = false,
}: Props) {
  return (
    <div
      data-slot="empty-state"
      className={cn('flex-1 flex items-center justify-center p-8', className)}
    >
      {onEditorCanvas && (
        <style>{`
          [data-slot="empty-state"] {
            --es-ink:       var(--canvas-dark-ink);
            --es-ink-strong:var(--canvas-dark-ink-strong);
            --es-ink-muted: var(--canvas-dark-ink-muted);
          }
          [data-editor-theme="light"] [data-slot="empty-state"] {
            --es-ink:       var(--paper-ink-strong);
            --es-ink-strong:var(--paper-ink-strong);
            --es-ink-muted: var(--paper-ink);
          }
        `}</style>
      )}
      <div className="text-center max-w-sm flex flex-col items-center gap-3">
        {icon && (
          <div
            className="w-12 h-12 rounded-full inline-flex items-center justify-center"
            style={{
              background: 'oklch(from var(--color-brand) l c h / 0.12)',
              color: 'var(--color-brand)',
            }}
          >
            {icon}
          </div>
        )}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: onEditorCanvas ? 'var(--es-ink-strong)' : 'var(--foreground)',
          }}
        >
          {title}
        </h2>
        {body && (
          <p
            className="text-sm leading-relaxed"
            style={{
              color: onEditorCanvas ? 'var(--es-ink-muted)' : 'var(--muted-foreground)',
            }}
          >
            {body}
          </p>
        )}
        {(cta || secondaryCta) && (
          <div className="flex items-center gap-2 mt-2">
            {cta && (
              <button
                onClick={cta.onClick}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors',
                  (cta.variant ?? 'primary') === 'primary'
                    ? 'bg-brand text-brand-ink hover:bg-brand-hover'
                    : 'border border-border text-foreground hover:bg-surface-elevated',
                )}
              >
                {cta.label}
              </button>
            )}
            {secondaryCta && (
              <button
                onClick={secondaryCta.onClick}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {secondaryCta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Refactor `EmptyStartChapter` in `editor/chapter-editor.tsx`**

The existing function has two variants: empty book + has-chapters-none-selected. Replace each with EmptyState.

```tsx
import { EmptyState } from '../empty-state'
import { BookOpen } from 'lucide-react'

// Empty book:
return (
  <EmptyState
    icon={<BookOpen size={20} />}
    title="Start your first chapter"
    body="Your binder is empty. Create a chapter — you can rename it anytime."
    cta={{
      label: creating ? 'Creating…' : '+ Start your first chapter',
      onClick: createFirstChapter,
    }}
    onEditorCanvas
  />
)

// Has chapters, none selected:
return (
  <EmptyState
    title="Select a chapter to write"
    body={
      <>Pick a chapter from the binder on the left, or click{' '}
      <span className="text-brand font-semibold">+ Add</span> to create a new one.</>
    }
    onEditorCanvas
  />
)
```

Confirm the `createFirstChapter` callback wiring stays intact. Remove the now-unused local JSX from the function body.

- [ ] **Step 3: Refactor `EmptyPlaceholder` in `metadata/metadata-panel.tsx`**

The existing `EmptyPlaceholder` is a one-line "Select a chapter to see details." Replace:

```tsx
import { EmptyState } from '../empty-state'

function EmptyPlaceholder() {
  return <EmptyState title="No chapter selected" body="Select a chapter to see details." />
}
```

(Or keep the function inline if cleaner — confirm during impl.) The metadata panel is chrome-only (not editor canvas), so `onEditorCanvas` is false.

- [ ] **Step 4: Refactor "No snapshots yet" in `editor/version-history-drawer.tsx`**

Find the empty state in the drawer (the "No snapshots yet" message). Replace with EmptyState. Drawer is chrome-only.

```tsx
<EmptyState
  title="No snapshots yet"
  body="Keep writing and your chapters will be saved here automatically every minute."
/>
```

(Plus an icon if mockup specifies — maybe `Clock` from lucide.)

- [ ] **Step 5: Refactor any writing-analysis empty**

Read `editor/writing-analysis.tsx`. If there's a "write at least N words" empty state, replace with EmptyState. If not, skip this step.

- [ ] **Step 6: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Open empty book → "Start your first chapter" via new EmptyState.
2. Open chapter → all good.
3. Click a non-chapter item → metadata panel shows "Select a chapter" empty.
4. Open version history on a fresh chapter → empty state via new EmptyState.
5. Toggle light/dark editor mode → editor-canvas empties flip ink colors correctly.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/"
git commit -m "feat(studio): shared EmptyState component + refactor (DP4 Task 2)

New studio-scoped EmptyState component at studio/[bookId]/_components/
empty-state.tsx. Standardized layout: icon + title + body + primary
CTA + optional secondary CTA. Theme-aware via onEditorCanvas prop —
applies --es-ink-* tokens that flip dark/light per editor theme.

Refactored 3-4 studio empties to use it:
- editor/chapter-editor.tsx: EmptyStartChapter (2 variants)
- metadata/metadata-panel.tsx: EmptyPlaceholder
- editor/version-history-drawer.tsx: 'No snapshots yet'
- editor/writing-analysis.tsx: [if applicable]

Community / Hive empties stay untouched — out of DP scope."
```

---

## Task 3: Modals (cheatsheet + export + sprint setup)

**Files:**
- Modify: `editor/keyboard-cheatsheet.tsx`
- Modify: `export-modal.tsx`
- Modify: `editor/sprint-controls.tsx` (setup state visual only)

- [ ] **Step 1: Read mockup modal styles**

Grep `designs/claude/overlays-modes/styles.css` for `modal`, `cheatsheet`, `export`, `kbd`, `dialog`. Find the relevant CSS for paper-key `<kbd>` styling, modal card chrome, format-picker buttons, preset cards.

- [ ] **Step 2: Restyle Cheatsheet modal**

`editor/keyboard-cheatsheet.tsx`. Apply mockup-spec:
- Modal card width ~480px (already in spec).
- Title: Comfortaa "Keyboard shortcuts".
- Two-column rows: action label (left) + `<kbd>` keys (right).
- `<kbd>` paper-key styling:

```tsx
<kbd
  className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 rounded font-mono text-[11px] font-semibold"
  style={{
    background: 'var(--chrome-800)',
    color: 'var(--chrome-100)',
    border: '1px solid var(--chrome-700)',
    boxShadow: '0 1px 0 var(--chrome-700), inset 0 1px 0 rgba(255,255,255,0.08)',
  }}
>
  {key}
</kbd>
```

Preserve the 9 shortcuts + trigger (Ctrl+/ or Help button).

- [ ] **Step 3: Restyle Export modal**

`export-modal.tsx`. Apply mockup-spec:
- Card width ~640px.
- Format picker: visual buttons with icons (lucide: FileText for PDF, BookOpen for EPUB, FileType for DOCX, Hash for Markdown, etc.) + one-line description.
- Preset picker: cards for each preset.
- Options toggles styled per mockup.
- Footer: Cancel ghost button + Export brand-yellow primary.

Preserve existing format/preset/export functional flow.

- [ ] **Step 4: Restyle Sprint setup popover**

`editor/sprint-controls.tsx` — only the `setup` state. Apply mockup-spec to the duration picker pills + Cancel.

Use existing `tbtnClass()` pattern if convenient (likely needs a tweak for pill shape vs square button).

- [ ] **Step 5: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Press Ctrl+/ → cheatsheet modal opens; paper-key `<kbd>` visuals visible.
2. Esc closes.
3. Open Export → modal renders with format picker; pick format → preset picker; export still works.
4. Click Start Sprint → duration pills render with mockup styling.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/keyboard-cheatsheet.tsx" "app/[locale]/(app)/studio/[bookId]/_components/export-modal.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx"
git commit -m "feat(studio): restyle modals — cheatsheet + export + sprint setup (DP4 Task 3)

Cheatsheet: paper-key <kbd> visuals (raised pill with subtle shadow);
modal card chrome per mockup.

Export modal: format picker buttons with lucide icons + one-line
descriptions; preset cards; footer with ghost Cancel + brand-yellow
Export primary.

Sprint setup popover: duration pills restyled with toolbar-button
pattern."
```

---

## Task 4: Overlays + drawers

**Files:**
- Modify: `editor/find-replace.tsx`
- Modify: `editor/version-history-drawer.tsx`
- Modify: `editor/preview-banner.tsx`
- Modify: `editor/writing-analysis.tsx`

- [ ] **Step 1: Read mockup overlay styles**

Grep `designs/claude/overlays-modes/styles.css` for `find-replace`, `history`, `preview-banner`, `analysis`, `drawer`. Note paddings, button styles, list rows, banner colors.

- [ ] **Step 2: Restyle Find & Replace**

`editor/find-replace.tsx`. Apply mockup-spec:
- Horizontal strip between toolbar and prose, paper-card surface.
- Search input + match count + Prev/Next icon-buttons + match-case toggle + Replace toggle + Close ×.
- When Replace toggled: a second row with Replace input + Replace + Replace all buttons.
- Theme-aware: works on both light and dark editor canvas.
- Highlighted matches in prose body — current match uses brand-yellow tint (other matches use a muted highlight color).

- [ ] **Step 3: Restyle Version history drawer chrome**

`editor/version-history-drawer.tsx`. Apply mockup-spec:
- Drawer header: Clock icon + "Version history" + close ×.
- Snapshot list rows: paper-card per row with date (relative) + word count.
- Currently-previewed row: brand-yellow accent.
- Free-tier upsell card: brand-yellow accent + "Upgrade" CTA.
- Empty state via EmptyState (already done in Task 2; just verify integration).

- [ ] **Step 4: Restyle Snapshot preview banner**

`editor/preview-banner.tsx`. Apply mockup-spec:
- Thin horizontal banner with brand-yellow accent (subtle yellow tint background).
- Content: History/Clock icon + "Previewing version from {date} · read-only" + "Restore this version" (primary, brand-yellow) + "Back to current" (secondary, ghost).
- Theme-aware: brand-yellow tint works on both modes.

- [ ] **Step 5: Restyle Writing Analysis panel**

`editor/writing-analysis.tsx`. Apply mockup-spec:
- Slide-in panel from right (existing).
- Header: "Writing analysis" + close ×.
- Sections as paper-card surfaces:
  - Readability score (headline number + label)
  - Sentence-length distribution
  - Pacing
  - Adverb count / passive voice / filler words
  - Most-used words (if exists)
- Stat visuals: simple bars/badges (avoid Bloomberg-terminal aesthetic).
- Empty state via EmptyState (if applicable).

- [ ] **Step 6: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Open Find/Replace (Ctrl+F) → overlay matches mockup; find/replace works.
2. Open History drawer (premium) → snapshots list matches mockup.
3. Click snapshot row → preview banner appears with brand-yellow tint; restore + back-to-current work.
4. Open Writing Analysis → slide-in panel matches mockup; stats render.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/"
git commit -m "feat(studio): restyle overlays + drawers (DP4 Task 4)

Find & Replace: paper-card strip with match count + Prev/Next/case/
Replace toggles. Theme-aware works on both editor modes.

Version history drawer: paper-card snapshot rows; brand-yellow accent
for currently-previewed row; free-tier upsell card with Upgrade CTA.

Snapshot preview banner: brand-yellow thin banner with Restore + Back-
to-current buttons.

Writing analysis panel: section cards per stat; simple visual treatment
avoiding terminal aesthetic."
```

---

## Task 5: Modes + sprint celebration

**Files:**
- Modify: `corkboard-view.tsx`
- Modify: `editor/sprint-controls.tsx` (finished state only)
- Modify: `app/globals.css` (sprintFinished @keyframes)

- [ ] **Step 1: Read mockup corkboard styles**

Grep `designs/claude/overlays-modes/styles.css` for `corkboard`, `card`, `desk`. Note card sizing, paper treatment, rotation hints, desk background, header strip.

- [ ] **Step 2: Restyle corkboard view (pixel-perfect target)**

`corkboard-view.tsx`. Apply mockup-spec:

Container:
- Subtle "desk surface" background — warmer than the chrome canvas. Use `var(--chrome-850)` with a subtle warm tint OR a CSS variable per mockup.
- Header strip: "All chapters" / "Corkboard" title + chapter count + Exit Corkboard button (right side).
- Grid of cards: 2-4 columns responsive.

Per card (paper index-card visual):
- `bg-paper-100` background with paper-ink-strong text (cards are paper regardless of editor mode).
- Subtle drop shadow.
- Alternating ±1° rotation deterministic via item index:
  ```tsx
  style={{ transform: `rotate(${idx % 2 === 0 ? '1deg' : '-1deg'})` }}
  ```
- Hover: lift via `transform: translateY(-2px) rotate(0deg)` + deeper shadow.
- Active card (current chapter): brand-yellow accent indicator (left edge or corner).
- Card content:
  - Chapter number (small, top)
  - Title (Comfortaa heading)
  - Status pill (using --status-* palette)
  - Synopsis (3-line truncated, Newsreader serif)
  - Word count (small, bottom)
- Click → exits corkboard, opens that chapter.
- Drag-drop reorder (existing wiring preserved).
- Empty state: use new EmptyState component ("No chapters yet" with CTA).

- [ ] **Step 3: Focus mode polish**

Read `app/[locale]/(app)/studio/[bookId]/page.tsx` (or layout-level component). The focus-mode hide is likely a conditional render based on `focusMode` from provider.

If the hide is instant (no transition), add CSS transition for a smoother feel:

```tsx
<aside
  className={cn(
    'transition-[width,opacity] duration-200',
    focusMode ? 'w-0 opacity-0 pointer-events-none' : 'w-60 opacity-100',
  )}
>
```

Confirm during impl whether sidebars use width-collapse or conditional render. Width-collapse is smoother but DOM-heavier; conditional render is cleaner but jarring without transition.

- [ ] **Step 4: Add sprint-finished keyframes to globals.css**

In `app/globals.css`, near other @keyframes (if any) or in a new section:

```css
@keyframes sprintFinished {
  0%   { box-shadow: 0 0 0 0 oklch(from var(--brand) l c h / 0.55); }
  100% { box-shadow: 0 0 0 22px oklch(from var(--brand) l c h / 0); }
}

@utility animate-sprint-finished {
  animation: sprintFinished 1.5s ease-out 1;
}
```

(If `@utility` isn't supported for animations in your Tailwind v4 config, just use a plain class.)

- [ ] **Step 5: Apply animation to sprint finished state**

`editor/sprint-controls.tsx` — the finished state JSX. Add the animate class:

```tsx
// finished state
return (
  <button
    onClick={dismissFinished}
    className="animate-sprint-finished inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-brand/15 text-brand border border-brand/30 hover:bg-brand/25 transition-colors"
    title="Click to dismiss"
  >
    <Timer size={12} />
    <span>Sprint complete · +{state.wordsWritten} words</span>
  </button>
)
```

Animation runs once on mount (`animation-iteration-count: 1` in the keyframes).

- [ ] **Step 6: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Toggle corkboard mode → paper-card grid with alternating rotation; desk-bg visible.
2. Hover a card → lifts; rotates to 0°.
3. Click a card → opens that chapter; exits corkboard.
4. Toggle corkboard mode on empty book → EmptyState shows.
5. Toggle focus mode → sidebars hide smoothly with transition.
6. Sprint timer: set 15m → countdown. Wait or test-shortcut to finished state. Pill appears with one-time pulse-glow animation. Click dismisses.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/corkboard-view.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx" app/globals.css "app/[locale]/(app)/studio/[bookId]/"
git commit -m "feat(studio): modes + sprint celebration (DP4 Task 5)

Corkboard (pixel-perfect): paper index-card grid on desk-surface
background. Alternating deterministic ±1deg rotation, hover lifts
and corrects to 0deg. Status pills via --status-* palette. Active
card brand-yellow accent. Drag-drop preserved. Empty state via
EmptyState component.

Focus mode: smooth width/opacity transition (200ms) when sidebars
hide/show.

Sprint finished celebration: new @keyframes sprintFinished in
globals.css. One-time 1.5s pulse-glow on mount of the finished state
pill (animation-iteration-count: 1). Soft, paper-feeling, not
confetti-noisy."
```

---

## Task 6: Manual verify + AGENTS.md + push

- [ ] **Step 1: Automated checks**

```bash
npx tsc --noEmit
npm test
```

Both must be clean. Tests stay at 119.

- [ ] **Step 2: Final 14-item DP4 manual checklist** (spec §5)

Walk through every item. Most are covered by Tasks 1-5 verification; this is the final integrity pass.

1. `npm run dev` clean.
2. Delete a binder item → ConfirmDialog works.
3. Empty book → EmptyState "Start your first chapter".
4. Non-chapter active item → metadata empty via EmptyState.
5. Fresh chapter no snapshots → drawer empty via EmptyState.
6. Ctrl+/ → cheatsheet paper-key modal.
7. Export → format/preset picker.
8. Ctrl+F → find/replace overlay.
9. History drawer (premium) → snapshots list + preview + restore + back-to-current.
10. Writing analysis → slide-in stats panel.
11. Focus mode → smooth sidebar transition.
12. Corkboard → paper-card grid with alternating rotation.
13. Sprint finished → pulse-glow animation once.
14. tsc + tests clean.

If any check fails, fix before Step 3.

- [ ] **Step 3: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-26
- Current focus: "Design Port complete (DP1-DP4 shipped). Phase 8 Stripe monetization is next."
- Last commit: `git log -1 --format=%s` after AGENTS.md commit.
- Next concrete step: "invoke /brainstorming for Phase 8 Stripe monetization — pricing page, checkout flow, webhook handling, billing portal."

Add a DP4 pattern entry in Key Patterns block:

> **DP4 overlays/modes/modals pattern:** Transient surfaces (modes, drawers, overlays, modals) ported with structural fidelity. Pixel-perfect on corkboard ("brand-defining" surface — paper index-cards with alternating ±1deg rotation on desk-surface bg). Two new shared components: ConfirmDialog (built on shadcn Dialog primitive — used for destructive flows like binder delete) and EmptyState (studio-scoped, theme-aware via onEditorCanvas prop). Sprint finished gets a one-time CSS pulse-glow animation, not confetti.

Add a DP4 entry under "What Has Been Built":

```markdown
### DP4 — Design Port Overlays / Modes / Modals ✅ COMPLETE (2026-05-26)
Fourth and final design-port sub-project. Ports the remaining transient surfaces.

- **New ConfirmDialog component** (`components/ui/confirm-dialog.tsx`): unified destructive-action confirmation built on shadcn Dialog. Refactored binder-item delete to use it; standard a11y (focus trap + Esc + click-outside).
- **New EmptyState component** (`studio/[bookId]/_components/empty-state.tsx`): studio-scoped shared empty state. Theme-aware via `onEditorCanvas` prop. Used by chapter-editor's empty-book + no-chapter-selected, metadata-panel's empty placeholder, version-history-drawer's no-snapshots, [writing-analysis if applicable].
- **Modals restyled:** keyboard cheatsheet (paper-key `<kbd>` raised visuals), export modal (format + preset picker with lucide icons), sprint setup popover (duration pills).
- **Overlays + drawers restyled:** find & replace strip (paper-card, theme-aware), version history drawer chrome, snapshot preview banner (brand-yellow band), writing analysis panel (card sections).
- **Corkboard (pixel-perfect):** paper index-card grid on subtle desk-surface bg. Alternating ±1° deterministic rotation. Hover lifts and corrects to 0°. Active card brand-yellow accent. Drag-drop preserved.
- **Focus mode polish:** 200ms width/opacity transition on sidebars.
- **Sprint finished celebration:** one-time CSS `@keyframes` pulse-glow on the finished pill. Paper-feeling, not noisy.

No DB changes. No new dependencies. 119/119 tests, tsc clean.

**Design Port pass complete.** All four sub-projects (DP1-DP4) shipped. Studio UI fully matches the new design system.

**Next:** Phase 8 Stripe monetization — pricing page, subscriptions, webhooks, billing portal.
```

- [ ] **Step 4: Commit AGENTS.md + push**

```bash
git add AGENTS.md
git commit -m "docs: close DP4 — Design Port complete (all four sub-projects shipped)

After 16 sub-projects across the editor audit (SP1-6), Community
feed (Phase 7.5), and Design Port (DP1-4), the studio UI fully
matches Claude Design's new system. Tokens, fonts, shell, specialized
surfaces, overlays + modes + modals + shared components — all done.

Next: Phase 8 Stripe monetization.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 6 atomic commits (Tasks 1-5 + AGENTS.md close-out).
- All 14 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- Two new shared components in production use:
  - `components/ui/confirm-dialog.tsx` → used by binder-item-menu (and any other destructive flows found via grep).
  - `studio/[bookId]/_components/empty-state.tsx` → used by ≥3 studio empties.
- Corkboard renders pixel-perfect per mockup.
- AGENTS.md Resume Here updated; DP4 entry under "What Has Been Built"; design-port pass marked complete.
- Pushed to origin/main.
