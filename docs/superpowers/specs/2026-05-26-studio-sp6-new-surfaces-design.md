# SP6 — New Surfaces (Snapshot UI + a11y)

**Sub-project:** SP6 of the editor audit (the final audit sub-project).
**Date:** 2026-05-26
**Status:** Design — awaiting plan.

---

## Goal

Fill two known gaps in the studio editor before the Claude Design visual pass:

1. **Snapshot UI** — surface the already-built chapter snapshot backend so premium users can view and restore previous versions, and free users discover the feature exists.
2. **Accessibility** — give icon-only buttons accessible names and add a keyboard cheatsheet so shortcuts are discoverable.

Responsive (mobile/tablet) is **deferred** — Claude Design will repaint the studio shortly and any responsive work done now is likely to be discarded.

## Non-Goals

- Mobile / tablet responsive layout (deferred to post-Claude-Design).
- Snapshot retention policy / DB cleanup (defer until evidence of pressure).
- Snapshot diff visualization (just preview + restore for now).
- Focus-visible style audit (Claude Design owns visual styling).
- New keyboard shortcuts. The cheatsheet only documents existing ones.

---

## Part 1: Snapshot UI

### Background

- `chapterSnapshots` table + `getChapterSnapshotsAction` + `restoreSnapshotAction` already exist (Phase 2).
- Snapshots are auto-created on `saveChapterAction` with a 60s throttle. Both server actions are premium-gated and return `PREMIUM_REQUIRED:snapshots` for free users.
- **No UI exists today.** Premium users have no way to see or restore snapshots.

### UX

**Entry point.** A "History" button (lucide `Clock` or `History` icon) in the editor toolbar's VIEW zone, between Find and the theme toggle. Visible to all users. Toggling it sets `historyOpen` in the editor provider.

**Drawer.** When `historyOpen` is true, the right-side `MetadataPanel` is hidden and a `VersionHistoryDrawer` renders in the same slot. Same width (w-60), same `bg-card border-l border-border` shell so the layout doesn't shift.

**Drawer — premium user.**
- Header: "Version history" title + close (`×`) button.
- List of up to 50 snapshots from `getChapterSnapshotsAction({ chapterId, limit: 50 })`, newest first.
- Each row renders as `<button>`:
  - Line 1: relative date — "Today 2:14 PM", "Yesterday 11:30 AM", or "May 24 · 9:00 AM" (using `date-fns` `formatRelative` or a small custom formatter).
  - Line 2: word count — "1,240 words" (muted).
- Click a row → **enters preview mode** (see below).
- Empty list: "No snapshots yet — keep writing and your chapters will be saved here automatically every minute."

**Drawer — free user.**
- Same header.
- Body: an upsell card with the brand-yellow accent — "Version history is a Premium feature. Restore any version of your chapter going back through your edits. [Upgrade →]" linking to `/[locale]/pricing` (or wherever the existing upgrade page lives).
- No snapshot list at all — we don't taunt with data they can't access.

**Preview mode.**

Triggered by clicking a snapshot row. Three things happen:
1. Provider sets `previewSnapshotId = snapshotId`.
2. Editor calls `editor.commands.setContent(snapshot.content)` and `editor.setEditable(false)`.
3. A banner mounts at the top of the editor pane: `Previewing version from {date} · [Restore this version] · [Back to current]`.

**Safety: pausing the save loop.** While `previewSnapshotId` is non-null, `updateChapterContent` (and any flow that fires `saveChapterAction`) must short-circuit. The provider gates it. Reason: even though `setEditable(false)` blocks typing, TipTap's `onUpdate` still fires from `setContent` and other programmatic mutations — without the gate, the snapshot content could overwrite the live draft.

**Exit paths.**
- Click "Back to current" → provider clears `previewSnapshotId`, editor reloads from `activeChapter.content` via `setContent`, `setEditable(true)`. No DB writes.
- Click "Restore this version" → call `restoreSnapshotAction(snapshotId)`. On success: provider refetches the chapter, exits preview mode, shows a flash "Restored to {date}".
- Switching to a different binder item: provider clears `previewSnapshotId` automatically on `setActiveItemId` (resets to current).
- Closing the drawer: closes the drawer but does NOT exit preview mode — the banner has its own controls. Reopening the drawer keeps the preview state.

### Files

**New:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx` — the drawer component (header, list/upsell, row click handler).
- `app/[locale]/(app)/studio/[bookId]/_components/editor/preview-banner.tsx` — the "Previewing version from… [Restore] [Back to current]" banner. Mounted by `chapter-editor.tsx` when `previewSnapshotId` is set.

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx`
  - Add `historyOpen: boolean`, `toggleHistory()`, `previewSnapshotId: string | null`, `setPreviewSnapshot(id, content)`, `exitPreview()`.
  - Gate `updateChapterContent` on `previewSnapshotId === null`.
  - Clear `previewSnapshotId` on `setActiveItemId` change.
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
  - Add "History" button in VIEW zone (Clock icon, between Find and theme toggle).
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
  - Render `<PreviewBanner>` when `previewSnapshotId` is set.
  - When `historyOpen`, the right-side panel slot must show `<VersionHistoryDrawer>` instead of `<MetadataPanel>` — easiest approach: a sibling component decides which to mount. (See `studio/[bookId]/page.tsx` for the actual slot location — adjust accordingly.)
- `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`
  - Add `if (historyOpen) return null` near the top alongside the existing focus-mode + corkboard-mode guards.
- `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx`
  - Add light-mode rules for `[data-slot="version-history-drawer"]` and `[data-slot="preview-banner"]` in the existing `<style>` tag.

### Premium handling

- The drawer calls `getChapterSnapshotsAction` on mount when `historyOpen` becomes true.
- If the result is `{ success: false, error: 'PREMIUM_REQUIRED:snapshots' }`, render the upsell instead of the list.
- If `restoreSnapshotAction` returns the same error, show a flash "Premium required" and keep preview mode.

---

## Part 2: Accessibility

### 2a. aria-labels on icon-only buttons

**Problem.** Many editor buttons render only a lucide icon. Tooltips (`<Tooltip>`) help sighted users but expose no accessible name to screen readers — these buttons announce as just "button" or worse.

**Fix.** Every icon-only button needs an `aria-label` matching its tooltip text.

**Sweep targets.**

1. `editor/editor-toolbar.tsx`:
   - `ToolbarButton` wrapper component takes a `title` prop. Extend it to pass `aria-label={title}` on the underlying `<button>`. One change covers ~18 buttons (Bold, Italic, Strike, H1-3, lists, quote, hr, undo/redo, U/H/Link, three aligns, Find).
   - The four ad-hoc buttons that don't go through `ToolbarButton`: Sun/Moon theme toggle, Export, Analysis, Focus. Each gets an explicit `aria-label`.
   - The new History button gets `aria-label="Version history"`.
2. `binder/` subtree — sweep all `<button>` elements. The rename `⋯` menu trigger and "+ Add" button need labels; others may already have visible text.
3. `corkboard-view.tsx` — chapter cards. Likely OK (cards have text), but verify.
4. `editor/find-replace.tsx` — close button + nav buttons. Verify.

**Verification.** Open Chrome devtools → Accessibility tab on the toolbar. Each button shows its accessible name. Manual sweep, not automated test.

### 2b. `?` keyboard cheatsheet

**Trigger.** Pressing `?` (Shift+/) on the studio editor surface opens a modal listing keyboard shortcuts. Press `Esc` or `?` again to close. Click outside the modal to close.

**Scope guard.** Same pattern as the existing Cmd+F/Cmd+S handler in `chapter-editor.tsx`: only fires when focus is inside the editor container OR on `document.body`. Typing `?` in the metadata-panel notes textarea must NOT trigger.

**Modal content.** Centered modal, ~480px wide, brand-tokens (no raw hex). One section with the shortcuts. Platform-aware: show `⌘` on Mac (`navigator.platform.includes('Mac')`), `Ctrl` elsewhere.

| Keys | Action |
|------|--------|
| ⌘/Ctrl+S | Save |
| ⌘/Ctrl+F | Find & replace |
| ⌘/Ctrl+B | Bold |
| ⌘/Ctrl+I | Italic |
| ⌘/Ctrl+U | Underline |
| ⌘/Ctrl+Z | Undo |
| ⌘/Ctrl+Shift+Z | Redo |
| Esc | Close panels |
| ? | This help |

**Files:**
- New: `app/[locale]/(app)/studio/[bookId]/_components/editor/keyboard-cheatsheet.tsx` — modal + key listener.
- Modify: `editor/chapter-editor.tsx` — mount `<KeyboardCheatsheet>` once, inside the chapter-render path so it's only available when an editable chapter is open.

---

## Testing (manual checklist)

1. Open a chapter as a premium user → History button visible in toolbar.
2. Click History → MetadataPanel hides, drawer slides in, list of snapshots renders (or empty-state message).
3. Click a snapshot row → editor content swaps to snapshot, banner appears at top, editor is non-editable.
4. Click "Back to current" → banner clears, editor restores live content, becomes editable again. No DB write.
5. Click "Restore this version" → backend call succeeds, flash "Restored to {date}", drawer can be closed normally.
6. Switch to a different binder item while previewing → preview clears automatically; new item loads normally.
7. Open as a free user (or stub premium=false) → History button visible; clicking opens drawer with upsell; no snapshots shown.
8. Open browser devtools Accessibility tab → toolbar buttons announce their action names ("Bold", "Italic", etc.).
9. Press `?` while focus is on the editor → cheatsheet modal opens. Esc closes it. `?` again closes it.
10. Press `?` while typing in the metadata-panel notes textarea → nothing happens (focus guard).
11. Light-mode toggle → drawer + banner flip to light theme.
12. `npx tsc --noEmit` clean.
13. `npm test` clean (existing suite still passes; no new tests).

---

## Definition of Done

- History button in editor toolbar (VIEW zone).
- Version history drawer: lists last 50 snapshots for premium users; shows upsell for free users.
- Snapshot preview mode: read-only banner with Restore + Back to current.
- Autosave gated while preview is active.
- aria-labels on all icon-only buttons in the editor surface.
- `?` cheatsheet modal listing existing shortcuts, platform-aware modifier keys.
- All 13 manual checklist items pass.
- `npx tsc --noEmit` clean.
- `npm test` clean.
- ~5 atomic commits on `main`, pushed to origin when SP6 closes.

---

## Risks

- **TipTap `setContent` triggers `onUpdate`.** The preview-mode gate on `updateChapterContent` mitigates this, but verify in the implementation that the gate fires before any save path. Test by clicking preview, waiting past the autosave throttle, then "Back to current" — confirm the snapshot content was never written.
- **Drawer + MetadataPanel swap location.** The studio page composition is in `studio/[bookId]/page.tsx`. The slot that holds `MetadataPanel` is where the drawer needs to mount. Confirm during implementation that swapping the component cleanly (not nesting both, not leaving a layout gap).
- **Free-tier discovery.** Showing a Premium button to free users is a deliberate conversion play. If it feels naggy, we can revisit — but the audit's goal is to surface existing features, not hide them.
