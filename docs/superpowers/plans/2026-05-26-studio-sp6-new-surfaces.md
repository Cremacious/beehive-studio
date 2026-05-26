# Studio SP6 — New Surfaces (Snapshot UI + a11y) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing chapter-snapshots backend via a right-side drawer + preview-confirm-restore flow; add aria-labels to all icon-only editor buttons; add a `?` keyboard cheatsheet modal.

**Architecture:** Snapshot UI is composed of three new components (drawer, preview banner, optional small flash hook reuse) coordinated by new provider state (`historyOpen`, `previewSnapshotId`). The drawer mounts in the same right-side slot as `MetadataPanel`; only one is visible at a time. Preview mode gates `updateChapterContent` to prevent autosave from clobbering the live draft. a11y is a `ToolbarButton`-wrapper enhancement + a sweep of remaining buttons + a `KeyboardCheatsheet` modal mounted in `chapter-editor.tsx`.

**Tech Stack:** Next.js 16, React 19, TypeScript, TipTap v3, lucide-react, Tailwind v4, existing `chapterSnapshots` schema + `getChapterSnapshotsAction` / `restoreSnapshotAction`.

**Spec:** [`docs/superpowers/specs/2026-05-26-studio-sp6-new-surfaces-design.md`](../specs/2026-05-26-studio-sp6-new-surfaces-design.md)

---

## File Structure

**Create:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx` — right-side drawer; lists snapshots OR shows upsell; calls `getChapterSnapshotsAction` on mount.
- `app/[locale]/(app)/studio/[bookId]/_components/editor/preview-banner.tsx` — top-of-editor banner with Restore + Back-to-current.
- `app/[locale]/(app)/studio/[bookId]/_components/editor/keyboard-cheatsheet.tsx` — `?` modal + key listener.

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` — new state: `historyOpen`, `toggleHistory`, `previewSnapshotId`, `previewSnapshotContent`, `enterPreview`, `exitPreview`. Gate `updateChapterContent` while previewing. Clear preview on `setActiveItemId`.
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — add History button in VIEW zone; extend `ToolbarButton` to pass `aria-label`; explicit `aria-label`s on the four non-wrapper buttons.
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — render `<PreviewBanner>` when previewing; render `<KeyboardCheatsheet>` once; honor `previewSnapshotId` in the activeChapter→editor effect; set `editor.setEditable` based on preview state.
- `app/[locale]/(app)/studio/[bookId]/page.tsx` (or whichever file mounts `MetadataPanel`) — swap MetadataPanel for VersionHistoryDrawer when `historyOpen`.
- `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx` — return null when `historyOpen`.
- `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` — light-mode CSS for `[data-slot="version-history-drawer"]` and `[data-slot="preview-banner"]`.
- `app/[locale]/(app)/studio/[bookId]/_components/binder/*` (sweep) — add aria-labels to remaining icon-only buttons.

**No DB changes** — snapshot schema and server actions already exist.

**No new unit tests** — all UI integration; manual verification per task.

---

## Task 1: Provider state for history drawer + preview mode

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx`

- [ ] **Step 1: Read the file**

Confirm the current shape of `BookEditorContext` and where `updateChapterContent` is defined. Identify the cleanest place to add: state declarations, callbacks, the effect that resets state on `setActiveItemId` change.

- [ ] **Step 2: Add state declarations**

Inside the provider component, alongside existing `useState` calls (focusMode, corkboardMode, editorTheme, etc.), add:

```tsx
const [historyOpen, setHistoryOpen] = useState(false)
const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null)
const [previewSnapshotContent, setPreviewSnapshotContent] = useState<unknown>(null)
const [previewSnapshotCreatedAt, setPreviewSnapshotCreatedAt] = useState<Date | null>(null)
```

- [ ] **Step 3: Add callbacks**

```tsx
const toggleHistory = useCallback(() => {
  setHistoryOpen(o => !o)
}, [])

const enterPreview = useCallback((snapshot: {
  id: string
  content: unknown
  createdAt: Date
}) => {
  setPreviewSnapshotId(snapshot.id)
  setPreviewSnapshotContent(snapshot.content)
  setPreviewSnapshotCreatedAt(snapshot.createdAt)
}, [])

const exitPreview = useCallback(() => {
  setPreviewSnapshotId(null)
  setPreviewSnapshotContent(null)
  setPreviewSnapshotCreatedAt(null)
}, [])
```

- [ ] **Step 4: Gate updateChapterContent while previewing**

Find the existing `updateChapterContent` function. At the very top of its body, add:

```tsx
// While a snapshot is being previewed, ignore all content updates —
// TipTap's onUpdate still fires from programmatic setContent calls,
// and we must not let snapshot content overwrite the live draft.
if (previewSnapshotId !== null) return
```

If `updateChapterContent` is wrapped in `useCallback`, add `previewSnapshotId` to its dependency array.

- [ ] **Step 5: Clear preview on active item change**

Find the existing effect or callback that runs on `setActiveItemId` change. Add an inline call to clear preview state — easiest path: extend the existing `setActiveItemId` callback to also call `exitPreview`. If `setActiveItemId` is a raw `useState` setter, wrap it:

```tsx
const setActiveItemId = useCallback((id: string | null) => {
  setPreviewSnapshotId(null)
  setPreviewSnapshotContent(null)
  setPreviewSnapshotCreatedAt(null)
  _setActiveItemId(id)  // rename the existing setState setter
}, [])
```

(Choose whichever shape matches the existing code — the goal is: switching items exits preview.)

- [ ] **Step 6: Expose on context**

Add the new fields to the context value object returned by the provider and to the `BookEditorContextValue` (or equivalent) type. Names to add:
- `historyOpen: boolean`
- `toggleHistory: () => void`
- `previewSnapshotId: string | null`
- `previewSnapshotContent: unknown`
- `previewSnapshotCreatedAt: Date | null`
- `enterPreview: (snapshot: { id: string; content: unknown; createdAt: Date }) => void`
- `exitPreview: () => void`

- [ ] **Step 7: Type check + commit**

```bash
npx tsc --noEmit
```

Expected: clean.

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx"
git commit -m "feat(studio): provider state for history drawer + snapshot preview mode (SP6 Task 1)

Adds historyOpen + previewSnapshot* state and enter/exit callbacks to
the editor provider. updateChapterContent now short-circuits while a
preview is active — TipTap's onUpdate fires on programmatic setContent,
so without the gate snapshot content could overwrite the live draft.
Switching binder items auto-exits preview.

No UI uses these yet — Tasks 2-4 wire the drawer + banner."
```

---

## Task 2: VersionHistoryDrawer component (list + upsell)

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx`

- [ ] **Step 1: Confirm the snapshot action shape**

Read `lib/actions/snapshot.actions.ts` to confirm the signatures of `getChapterSnapshotsAction` and `restoreSnapshotAction`. Note:
- The exact parameter name (`chapterId` vs `bookId`).
- Whether `getChapterSnapshotsAction` takes a `limit` parameter; if not, slice client-side to 50.
- The exact shape of each returned snapshot (id, content, createdAt, wordCount?).
- The error string for non-premium — should be `PREMIUM_REQUIRED:snapshots`.

- [ ] **Step 2: Create the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useBookEditor } from '../book-editor-provider'
import { getChapterSnapshotsAction } from '@/lib/actions/snapshot.actions'

type Snapshot = {
  id: string
  content: unknown
  wordCount: number
  createdAt: Date
}

function formatSnapshotDate(d: Date): string {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yest.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today ${time}`
  if (isYesterday) return `Yesterday ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`
}

export function VersionHistoryDrawer() {
  const { activeChapter, toggleHistory, enterPreview } = useBookEditor()
  const params = useParams<{ locale: string }>()
  const locale = params.locale
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activeChapter) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void getChapterSnapshotsAction(activeChapter.id).then(result => {
      if (cancelled) return
      if (result.success) {
        // Slice client-side to 50 — newest first
        const sorted = [...result.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setSnapshots(sorted.slice(0, 50) as Snapshot[])
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [activeChapter?.id])

  const isFreeTier = error?.startsWith('PREMIUM_REQUIRED')

  return (
    <aside
      data-slot="version-history-drawer"
      className="w-60 flex-shrink-0 flex flex-col bg-card border-l border-border overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-foreground/70" />
          <h2 className="text-sm font-medium text-foreground">Version history</h2>
        </div>
        <button
          onClick={toggleHistory}
          aria-label="Close version history"
          className="text-foreground/60 hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-3 text-xs text-muted-foreground">Loading…</p>
        )}

        {!loading && isFreeTier && (
          <div className="p-4 flex flex-col gap-3">
            <div className="rounded-md border border-brand/30 bg-brand/5 p-3 flex flex-col gap-2">
              <span className="rounded-sm bg-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand border border-brand/30 self-start">
                Premium
              </span>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Version history lets you restore any version of your chapter going back through your edits.
              </p>
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center justify-center rounded-md bg-brand hover:bg-brand-hover px-3 py-1.5 text-xs font-semibold text-background transition-colors"
              >
                Upgrade →
              </Link>
            </div>
          </div>
        )}

        {!loading && !isFreeTier && error && (
          <p className="px-4 py-3 text-xs text-destructive">Couldn't load history: {error}</p>
        )}

        {!loading && snapshots && snapshots.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            No snapshots yet — keep writing and your chapters will be saved here automatically every minute.
          </p>
        )}

        {!loading && snapshots && snapshots.length > 0 && (
          <ul className="flex flex-col">
            {snapshots.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => enterPreview({ id: s.id, content: s.content, createdAt: new Date(s.createdAt) })}
                  className="w-full text-left px-4 py-2 hover:bg-surface-elevated transition-colors border-b border-border/40"
                >
                  <div className="text-xs text-foreground">{formatSnapshotDate(new Date(s.createdAt))}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.wordCount.toLocaleString()} words</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
```

If Step 1 revealed that `getChapterSnapshotsAction` returns different field names than assumed (e.g., `chapter_id` vs `chapterId`, no `wordCount`), adjust the `Snapshot` type and the row renderer accordingly. The drawer must show date + word count if available; if word count isn't on the snapshot, fall back to just date.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx"
git commit -m "feat(studio): VersionHistoryDrawer component (SP6 Task 2)

Right-side drawer that calls getChapterSnapshotsAction on mount.
Premium users see a list of up to 50 snapshots (newest first) with
date + word count per row; clicking a row enters preview mode via
the provider. Free users see an upsell card linking to /pricing.
Empty list shows a friendly first-time message.

Date formatting: 'Today HH:MM', 'Yesterday HH:MM', or 'May 24 · HH:MM'.

Not mounted in any layout yet — Task 4 wires it into the studio page."
```

---

## Task 3: PreviewBanner component

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/preview-banner.tsx`

- [ ] **Step 1: Read snapshot action**

Confirm the signature of `restoreSnapshotAction(snapshotId)` — what it returns on success (likely `{ success: true; data: { content, wordCount, ... } }` or similar). Note how the existing code refetches a chapter after a content change.

- [ ] **Step 2: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { History } from 'lucide-react'
import { useBookEditor } from '../book-editor-provider'
import { restoreSnapshotAction } from '@/lib/actions/snapshot.actions'

function formatBannerDate(d: Date): string {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `today ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

export function PreviewBanner() {
  const {
    previewSnapshotId,
    previewSnapshotCreatedAt,
    exitPreview,
    activeChapter,
    pushFlash,
    refreshActiveChapter,
  } = useBookEditor()
  const [restoring, setRestoring] = useState(false)

  if (!previewSnapshotId || !previewSnapshotCreatedAt || !activeChapter) return null

  async function handleRestore() {
    if (restoring || !previewSnapshotId) return
    setRestoring(true)
    const result = await restoreSnapshotAction(previewSnapshotId)
    setRestoring(false)
    if (result.success) {
      exitPreview()
      // Refresh the active chapter so the editor reloads from the new live content.
      if (typeof refreshActiveChapter === 'function') {
        await refreshActiveChapter()
      }
      pushFlash(`Restored to ${formatBannerDate(previewSnapshotCreatedAt!)}`)
    } else if (result.error?.startsWith('PREMIUM_REQUIRED')) {
      pushFlash('Premium required to restore')
    } else {
      pushFlash(`Restore failed: ${result.error}`)
    }
  }

  return (
    <div
      data-slot="preview-banner"
      className="flex items-center justify-between gap-3 px-4 py-2 border-b border-brand/40 bg-brand/10 text-xs"
    >
      <div className="flex items-center gap-2 text-foreground">
        <History size={14} className="text-brand" />
        <span>Previewing version from <strong>{formatBannerDate(previewSnapshotCreatedAt)}</strong> · read-only</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="rounded px-2.5 py-1 text-xs font-semibold bg-brand hover:bg-brand-hover text-background transition-colors disabled:opacity-50"
        >
          {restoring ? 'Restoring…' : 'Restore this version'}
        </button>
        <button
          onClick={exitPreview}
          disabled={restoring}
          className="rounded px-2.5 py-1 text-xs text-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
        >
          Back to current
        </button>
      </div>
    </div>
  )
}
```

If `useBookEditor` doesn't already expose a `refreshActiveChapter` callback, two options:
- Add one in this same task by extending the provider (return the fetch function from the existing chapter-loading effect via a ref or callback).
- Use a simpler approach: after restore, call `exitPreview()` and rely on the next interaction (or a quick `setActiveItemId(activeItemId)` reset) to refetch.

Choose whichever matches the existing provider patterns. The acceptance criterion is: after Restore, the live editor content reflects the snapshot.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/preview-banner.tsx"
git commit -m "feat(studio): PreviewBanner component (SP6 Task 3)

Banner that mounts at the top of the editor pane while a snapshot
is being previewed. Reads previewSnapshot* from the provider; renders
'Previewing version from {date} · read-only' with two buttons:
'Restore this version' (calls restoreSnapshotAction, refreshes chapter,
exits preview) and 'Back to current' (exitPreview, no DB write).

Falls back to a flash message on premium-required or generic restore
failure. Not mounted in chapter-editor yet — Task 4 wires it."
```

---

## Task 4: Wire drawer + banner + History button + page swap

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/page.tsx` (or wherever `<MetadataPanel>` is mounted)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx`

- [ ] **Step 1: Add History button to toolbar**

In `editor-toolbar.tsx`:

a. Add the import:
```tsx
import { Clock } from 'lucide-react'
```
(Or `History` — pick whichever lucide name reads better. `History` is the more semantic choice.)

b. Destructure `historyOpen` and `toggleHistory` from `useBookEditor`:
```tsx
const { focusMode, toggleFocusMode, editorTheme, toggleEditorTheme, historyOpen, toggleHistory } = useBookEditor()
```

c. In the VIEW zone (right side), add the History button right after the Find button and before the theme toggle:
```tsx
<ToolbarButton onClick={toggleHistory} isActive={historyOpen} title="Version history">
  <Clock size={14} />
</ToolbarButton>
```

- [ ] **Step 2: Mount PreviewBanner in chapter-editor**

In `chapter-editor.tsx`:

a. Add the import:
```tsx
import { PreviewBanner } from './preview-banner'
```

b. In the chapter-render path's `<main>` block, render `<PreviewBanner />` directly after `<EditorToolbar>` (so the banner appears between the toolbar and the editor body):
```tsx
{editor && (
  <EditorToolbar ... />
)}
<PreviewBanner />
{findOpen && editor && <FindReplace ... />}
```

c. Make the editor honor preview state. Find the existing effect that calls `editor.commands.setContent(...)` when `activeChapter` arrives. Add a second effect (or extend the existing one) that runs when `previewSnapshotId` changes:

```tsx
const { previewSnapshotId, previewSnapshotContent } = useBookEditor()

useEffect(() => {
  if (!editor || editor.isDestroyed) return
  if (previewSnapshotId && previewSnapshotContent !== null) {
    editor.commands.setContent(
      previewSnapshotContent as Parameters<typeof editor.commands.setContent>[0],
      { emitUpdate: false },
    )
    editor.setEditable(false)
  } else if (activeChapter) {
    // Exited preview — restore live content
    editor.commands.setContent(
      activeChapter.content as Parameters<typeof editor.commands.setContent>[0],
      { emitUpdate: false },
    )
    editor.setEditable(true)
  }
}, [previewSnapshotId, previewSnapshotContent, activeChapter, editor])
```

(Guard with `editor.isDestroyed` per the saved feedback on TipTap × React 19 strict mode.)

- [ ] **Step 3: Hide MetadataPanel when historyOpen**

In `metadata-panel.tsx`'s `MetadataPanel` export, find the existing guards (focusMode, corkboardMode). Extend:
```tsx
const { activeItem, activeItemId, focusMode, corkboardMode, bookId, historyOpen } = useBookEditor()
// ...
if (focusMode || corkboardMode || historyOpen) return null
```

- [ ] **Step 4: Mount VersionHistoryDrawer in the page layout**

Find the file that renders `<MetadataPanel />` (likely `studio/[bookId]/page.tsx` or a layout component inside `_components/`). Add a sibling render for `<VersionHistoryDrawer />`:

```tsx
import { VersionHistoryDrawer } from './_components/editor/version-history-drawer'
// ...

// In the layout JSX:
{historyOpen ? <VersionHistoryDrawer /> : <MetadataPanel />}
```

If the layout doesn't have access to `historyOpen` directly (e.g., it's a server component), wrap the right-side slot in a small client component that reads from `useBookEditor` and switches. Pattern:

```tsx
// _components/right-panel-slot.tsx
'use client'
import { useBookEditor } from './book-editor-provider'
import { MetadataPanel } from './metadata/metadata-panel'
import { VersionHistoryDrawer } from './editor/version-history-drawer'

export function RightPanelSlot() {
  const { historyOpen } = useBookEditor()
  return historyOpen ? <VersionHistoryDrawer /> : <MetadataPanel />
}
```

Then replace `<MetadataPanel />` in the page with `<RightPanelSlot />`. Create this file if it doesn't exist.

Note: with this swap, the `historyOpen` guard inside `MetadataPanel` (Step 3) becomes redundant but keep it — it's a defense-in-depth no-op.

- [ ] **Step 5: Add light-mode CSS**

In `corkboard-or-editor.tsx`, inside the existing `<style>` tag (the one that has `[data-editor-theme="light"]` rules), add:

```css
[data-editor-theme="light"] [data-slot="version-history-drawer"] {
  background-color: #f4f4ee;
  border-left-color: #e0e0d8;
  color: #1a1a1a;
}
[data-editor-theme="light"] [data-slot="version-history-drawer"] button {
  color: rgba(26, 26, 26, 0.7);
}
[data-editor-theme="light"] [data-slot="version-history-drawer"] button:hover {
  color: #1a1a1a;
  background-color: #e8e8e0;
}
[data-editor-theme="light"] [data-slot="preview-banner"] {
  background-color: rgba(255, 195, 0, 0.12);
  border-bottom-color: rgba(255, 195, 0, 0.4);
  color: #1a1a1a;
}
```

- [ ] **Step 6: Verify type + tests + manual smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke (premium user — if test account isn't readily available, can be deferred to Task 7 final verification):
1. Click History in toolbar → drawer opens, list renders, MetadataPanel gone.
2. Click a snapshot → banner appears, editor content swaps to snapshot, typing is blocked.
3. Click "Back to current" → banner clears, editor restores live content, typing works.
4. Click "Restore this version" on a snapshot → flash "Restored to {date}", editor shows snapshot content as new live draft.
5. Switch to another binder item while previewing → preview clears.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/"
git commit -m "feat(studio): wire VersionHistoryDrawer + PreviewBanner + History button (SP6 Task 4)

Adds the History button to the editor toolbar's VIEW zone (between
Find and the theme toggle). Clicking it toggles historyOpen.

A new RightPanelSlot component switches between MetadataPanel and
VersionHistoryDrawer based on historyOpen. MetadataPanel keeps a
defense-in-depth guard.

PreviewBanner mounts in chapter-editor between the toolbar and the
editor body; the editor effect now swaps content between previewing
(snapshot) and live (activeChapter), and toggles editable accordingly.

Light-mode CSS added for the drawer and the banner in the existing
<style> tag."
```

---

## Task 5: aria-labels sweep

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/*` (sweep)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/find-replace.tsx` (verify)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx` (verify)

- [ ] **Step 1: Extend ToolbarButton wrapper**

In `editor-toolbar.tsx`, find the `ToolbarButton` component. Add `aria-label={title}` to the underlying `<button>`:

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
        'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
        isActive && 'bg-brand/20 text-brand',
      )}
    >
      {children}
    </button>
  )
  // ...
}
```

This single change adds accessible names to all ~18 buttons that use the wrapper (Bold, Italic, Strike, H1-3, lists, quote, hr, undo/redo, U/H/Link, three aligns, Find, plus the new History button).

- [ ] **Step 2: Add explicit aria-labels to the four non-wrapper buttons**

In the same file, find the four buttons that DON'T use `ToolbarButton`:

a. The Sun/Moon theme toggle. Add `aria-label`:
```tsx
<button
  onClick={toggleEditorTheme}
  aria-label={editorTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  className="..."
>
```

b. The Export button:
```tsx
<button
  onMouseDown={e => e.preventDefault()}
  onClick={() => setShowExport(true)}
  aria-label="Export book"
  className="..."
>
```

c. The Writing analysis button:
```tsx
<button
  onMouseDown={e => e.preventDefault()}
  onClick={onToggleAnalysis}
  aria-label="Writing analysis"
  className={cn(...)}
>
```

d. The Focus mode button:
```tsx
<button
  onMouseDown={e => e.preventDefault()}
  onClick={toggleFocusMode}
  aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
  className={cn(...)}
>
```

- [ ] **Step 3: Sweep binder + status bar + find-replace**

For each file in `_components/binder/` and `_components/editor/find-replace.tsx`, `_components/editor/editor-status-bar.tsx`:

Read the file and find every `<button>` element. Check:
- If the button's children are ONLY a lucide icon (no visible text), it needs `aria-label`.
- If the button has visible text children, it's already accessible — skip.

Add `aria-label="<describe the action>"` to each icon-only button found. Examples likely to come up:
- Binder item `⋯` menu trigger → `aria-label="More options"`
- Binder "+ Add" button → likely has visible text "Add", but verify
- Find-replace close → `aria-label="Close find"`
- Find-replace previous/next → `aria-label="Previous match"` / `aria-label="Next match"`
- Status bar "edit" / "Set word goal" buttons → already have text

Do not add aria-labels to buttons that have visible text — it's redundant noise.

- [ ] **Step 4: Verify with devtools**

`npm run dev`, open the studio editor in Chrome, open devtools → Elements → Accessibility tab. Click 3 sample toolbar buttons (Bold, History, Focus). Each should display its accessible name. Spot-check 1 binder button.

- [ ] **Step 5: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/"
git commit -m "feat(studio): aria-labels on icon-only editor buttons (SP6 Task 5)

Extends ToolbarButton to forward 'title' as 'aria-label' on the
underlying <button>, covering ~18 toolbar buttons in one change.
Adds explicit aria-labels to the four ad-hoc toolbar buttons
(theme, export, analysis, focus) and to the icon-only buttons in
the binder + find-replace. Buttons with visible text are unchanged.

Screen readers now announce action names instead of just 'button'."
```

---

## Task 6: Keyboard cheatsheet (`?` modal)

**Files:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/keyboard-cheatsheet.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type Shortcut = { keys: string; action: string }

function getMod(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
}

export function KeyboardCheatsheet() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mod = getMod()

  const shortcuts: Shortcut[] = [
    { keys: `${mod}+S`,         action: 'Save' },
    { keys: `${mod}+F`,         action: 'Find & replace' },
    { keys: `${mod}+B`,         action: 'Bold' },
    { keys: `${mod}+I`,         action: 'Italic' },
    { keys: `${mod}+U`,         action: 'Underline' },
    { keys: `${mod}+Z`,         action: 'Undo' },
    { keys: `${mod}+Shift+Z`,   action: 'Redo' },
    { keys: 'Esc',              action: 'Close panels' },
    { keys: '?',                action: 'This help' },
  ]

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Always allow Esc to close
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }

      // `?` toggle — only when focus is in editor or on body
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const active = document.activeElement
        const tag = active?.tagName?.toLowerCase()
        const inEditable =
          tag === 'input' ||
          tag === 'textarea' ||
          (active as HTMLElement | null)?.isContentEditable === true
        if (inEditable) return
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // Defer one tick so the opening click doesn't immediately close
    const t = setTimeout(() => window.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheatsheet-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70"
    >
      <div
        ref={containerRef}
        className="w-[480px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 id="cheatsheet-title" className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="text-foreground/60 hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="p-5 flex flex-col gap-2">
          {shortcuts.map(s => (
            <li key={s.keys} className="flex items-center justify-between text-xs">
              <span className="text-foreground/80">{s.action}</span>
              <kbd className="rounded border border-border bg-surface-elevated px-2 py-0.5 text-foreground/90 font-mono">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount in chapter-editor**

In `chapter-editor.tsx`:

a. Add the import:
```tsx
import { KeyboardCheatsheet } from './keyboard-cheatsheet'
```

b. Render `<KeyboardCheatsheet />` once at the top level of the chapter-render path (inside the same `<main>` block, anywhere — it portals to fixed positioning). Easiest spot: just before the closing `</main>`:

```tsx
<KeyboardCheatsheet />
</main>
```

(If chapter-editor has multiple early-return paths, place `<KeyboardCheatsheet />` only in the chapter-render path. The non-chapter paths don't need a cheatsheet.)

- [ ] **Step 3: Type check + manual smoke**

```bash
npx tsc --noEmit
```

Manual:
1. Open studio editor. Press `?` → modal opens, 9 shortcuts listed.
2. Press Esc → closes.
3. Press `?` again → opens.
4. Click outside the modal → closes.
5. Focus the metadata-panel notes textarea, type `?` → modal does NOT open; `?` appears in the textarea.
6. On macOS the keys show `⌘`; on Windows/Linux they show `Ctrl`.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/"
git commit -m "feat(studio): keyboard cheatsheet modal (? to open) (SP6 Task 6)

New modal mounted in chapter-editor. Pressing ? outside any input
opens a centered card listing nine shortcuts (Save / Find / Bold /
Italic / Underline / Undo / Redo / Esc / ?). Esc, click-outside, or
? again all close it.

Modifier key auto-detects: ⌘ on Mac, Ctrl elsewhere. Focus guard
prevents ? from triggering while typing in inputs/textareas or
contenteditable surfaces."
```

---

## Task 7: Final verification + AGENTS.md update + push

- [ ] **Step 1: Full manual checklist (from spec §Testing)**

1. Open a chapter as a premium user → History button visible in toolbar (VIEW zone, Clock icon).
2. Click History → MetadataPanel hides, drawer renders, list of snapshots appears (or empty-state).
3. Click a snapshot row → editor content swaps, banner appears at top of editor, typing is blocked.
4. Click "Back to current" → banner clears, live content restored, typing works. No DB write occurred (verify by reloading the page — content matches what was there before preview).
5. Click "Restore this version" on a snapshot → backend succeeds, flash "Restored to {date}", drawer closeable.
6. Switch binder items while previewing → preview clears, new item loads cleanly.
7. (If a free-tier test account is available) Open as free user → History button visible; clicking opens drawer with upsell linking to /pricing; no snapshot list.
8. Devtools Accessibility → 3 toolbar buttons announce action names.
9. Press `?` on editor → cheatsheet opens. Esc closes. `?` again opens. Click-outside closes.
10. Press `?` in metadata notes textarea → does not open.
11. Light-mode toggle → drawer + banner flip to light theme cleanly.
12. `npx tsc --noEmit` clean.
13. `npm test` clean (test count unchanged at 119).

If any check fails: fix before Step 2. For check 7, free-tier simulation is OK (temporarily stub `getUserPremiumStatus` or test by inspecting the conditional render — note in commit message if it was code-inspected rather than runtime-tested).

- [ ] **Step 2: Update AGENTS.md Resume Here**

Replace the Resume Here block to mark SP6 complete:

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** Editor audit COMPLETE — ready for Claude Design pass
> **Active branch:** `main` (pushed to origin/main)
> **Last commit:** <git log -1 --format=%s>
>
> 1. ~~SP1 Stability~~ DONE.
> 2. ~~SP2 Binder UX~~ DONE.
> 3. ~~SP3 Specialized Editors~~ DONE.
> 4. ~~SP4 Toolbar + modes~~ DONE.
> 5. ~~SP5 Metadata + persistence~~ DONE.
> 6. ~~**SP6 New surfaces**~~ **DONE** (<today>) — Snapshot UI (right-side drawer, preview-then-confirm restore, premium-gated with upsell); aria-labels on all icon-only editor buttons; `?` keyboard cheatsheet modal. Mobile/tablet responsive deferred — Claude Design pass will repaint the studio.
>
> All six audit sub-projects complete. **Next: Claude Design visual pass**, then Phase 8 (Stripe monetization).
>
> **Next concrete step when resuming:** kick off the Claude Design pass — provide them the current studio screenshots + brand tokens; they redesign visually, we mechanically import the result.
```

Also: add the SP6 patterns ("snapshot-preview pattern" — provider gates save while previewSnapshotId is set; right-panel slot pattern — RightPanelSlot client component switches between MetadataPanel and VersionHistoryDrawer) under "Key Patterns" if they warrant carry-forward.

- [ ] **Step 3: Commit AGENTS.md + push**

```bash
git add AGENTS.md
git commit -m "docs: close SP6 New Surfaces — audit complete, Claude Design next"
git push origin main
```

---

## Definition of Done

- History button in editor toolbar VIEW zone.
- Version-history drawer: shows up to 50 snapshots for premium users; shows upsell for free users; empty-state message for new chapters.
- Snapshot preview mode: read-only banner with Restore + Back-to-current. Autosave gated while preview is active.
- aria-labels on all icon-only buttons in editor + binder + find-replace.
- `?` cheatsheet modal listing 9 shortcuts, platform-aware modifier keys, focus-guarded.
- All 13 manual checklist items pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- AGENTS.md reflects audit complete, points at Claude Design pass.
- ~6 atomic commits on `main`, pushed to origin.
