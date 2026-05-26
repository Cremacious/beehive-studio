# DP4 — Overlays / Modes / Modals Design Spec

> **Date:** 2026-05-26
> **Sub-project:** Design Port 4 of 4 — the final design port.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Port the transient surfaces (modes, drawers, overlays, modals, confirmation dialogs, empty states) to match Claude Design's `overlays-modes` mockup. After DP4, the entire studio UI matches the new design system. The four-sub-project design-port pass is complete.

Also introduces two new shared studio components:
- `ConfirmDialog` — standardized destructive-action confirmation pattern.
- `EmptyState` — studio-scoped empty-state component.

## 2. Context

DP1-DP3 already shipped. Tokens, fonts, persistent chrome, and specialized editor surfaces all match the design system. DP4 catches the remaining transient surfaces.

Locked decisions from the brainstorm:
- **ConfirmDialog:** unified component, refactor existing patterns to use it.
- **EmptyState:** shared component scoped to studio surfaces only (Community / Hive empties are out of scope).
- **Writing analysis:** port in place — restyle, don't rebuild.
- **Export modal:** port in place — restyle, don't rebuild.
- **Corkboard:** paper-card index-card treatment with alternating ±1° rotation and subtle desk-surface background. No literal textures.
- **Execution order:** foundation-up (ConfirmDialog → EmptyState → modals → overlays/drawers → modes/sprint-finished → close).
- **Sprint finished:** subtle pulse-glow animation on the existing pill (not full confetti).

## 3. Non-goals

- Refactoring Community or Hive empty states (out of DP scope).
- Rebuilding Writing Analysis or Export from scratch.
- New behavior in Find & Replace, Writing Analysis, Export.
- DB migrations.
- Performance / a11y audit beyond what's already in place.
- Pixel-perfect on all surfaces — only the Corkboard is pixel-perfect (brand-defining); everything else is structural fidelity.

## 4. Architecture

### 4.1 Surfaces and execution order

| # | Surface | Files affected |
|---|---------|---------------|
| Task 1 | ConfirmDialog component + refactor | new `components/ui/confirm-dialog.tsx`; modify `binder/binder-item-menu.tsx` + any other ad-hoc confirms |
| Task 2 | EmptyState component + studio empties | new `studio/[bookId]/_components/empty-state.tsx`; modify `editor/chapter-editor.tsx`, `metadata/metadata-panel.tsx`, `editor/version-history-drawer.tsx`, possibly `editor/writing-analysis.tsx` |
| Task 3 | Modals (cheatsheet + export + sprint-setup) | modify `editor/keyboard-cheatsheet.tsx`, `export-modal.tsx`, `editor/sprint-controls.tsx` (setup popover only) |
| Task 4 | Overlays + drawers | modify `editor/find-replace.tsx`, `editor/version-history-drawer.tsx`, `editor/preview-banner.tsx`, `editor/writing-analysis.tsx` |
| Task 5 | Modes + sprint celebration | modify `corkboard-view.tsx`, `editor/sprint-controls.tsx` (finished state only) |
| Task 6 | Manual verify + AGENTS.md + push | modify `AGENTS.md` |

### 4.2 Task 1 — ConfirmDialog

**New component:** `components/ui/confirm-dialog.tsx`.

API:
```tsx
type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string                          // e.g. "Delete chapter?"
  description?: string                   // e.g. "This permanently deletes Chapter 12..."
  confirmLabel?: string                  // default "Delete" for destructive; "Confirm" otherwise
  cancelLabel?: string                   // default "Cancel"
  variant?: 'default' | 'destructive'    // destructive uses --error tint
  onConfirm: () => void | Promise<void>
}
```

Uses shadcn `Dialog` primitive (`components/ui/dialog.tsx` — confirm present). If shadcn `AlertDialog` is installed, prefer that; else use `Dialog` with manual button row.

Visual treatment per mockup:
- Centered modal, dim backdrop.
- Card width ~480px.
- Header: title (Comfortaa display).
- Body: description (paper-ink or chrome-ink based on theme — but ConfirmDialog renders on the page-level chrome, not in editor, so use shadcn semantic tokens which auto-bridge).
- Footer: Cancel (secondary) · Confirm (primary, destructive variant uses `bg-error text-error-foreground` or equivalent).

**Refactor candidates:**
- `binder/binder-item-menu.tsx` — currently uses inline `setConfirmingDelete(true)` state. Replace with ConfirmDialog mount.
- Grep for any other destructive `onClick` flows in studio components.

### 4.3 Task 2 — EmptyState

**New component:** `app/[locale]/(app)/studio/[bookId]/_components/empty-state.tsx`.

API:
```tsx
type EmptyStateProps = {
  icon?: React.ReactNode                  // optional lucide icon at top
  title: string
  body?: string | React.ReactNode
  cta?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }
  secondaryCta?: { label: string; onClick: () => void }
  className?: string                      // for layout overrides
}
```

Visual treatment per mockup:
- Centered vertically + horizontally in its container.
- Soft warm tone, no aggressive borders.
- Icon (if provided) in a tinted circle.
- Title in Comfortaa, mid-size.
- Body in muted ink (theme-aware via paper-ink-muted / canvas-dark-ink-muted).
- Primary CTA in brand-yellow + brand-ink (one of the 5 sanctioned yellow uses).

**Theme-aware ink:** since studio empties appear on editor canvas (which flips dark/light per editor theme), use the local-variable bridge pattern established in DP3:

```css
[data-slot="empty-state"] {
  --es-ink: var(--canvas-dark-ink);
  --es-ink-muted: var(--canvas-dark-ink-muted);
}
[data-editor-theme="light"] [data-slot="empty-state"] {
  --es-ink: var(--paper-ink-strong);
  --es-ink-muted: var(--paper-ink);
}
```

Some empties appear on chrome-only surfaces (not editor canvas) — for those, use shadcn `text-foreground` / `text-muted-foreground` directly. Confirm during impl per usage site.

**Refactor candidates:**
- `editor/chapter-editor.tsx` → `EmptyStartChapter` function. Two variants: empty book + has-chapters-none-selected. Both use EmptyState with different content.
- `metadata/metadata-panel.tsx` → `EmptyPlaceholder` ("Select a chapter to see details.") — minimal usage; just title.
- `editor/version-history-drawer.tsx` → "No snapshots yet…" empty.
- `editor/writing-analysis.tsx` → empty state for too-short prose ("Write at least N words for analysis.") if exists.

### 4.4 Task 3 — Modals (cheatsheet + export + sprint setup)

#### 4.4a Keyboard cheatsheet

`editor/keyboard-cheatsheet.tsx`. Restyle to match mockup:
- Modal card with paper-card surface.
- Title "Keyboard shortcuts" (Comfortaa).
- Two-column rows: action label (left) + `<kbd>` keys (right).
- `<kbd>` styling: paper-key feel — small inset, soft shadow, slight 3D. Use existing brand tokens for color.

Existing shortcut list preserved (9 entries). Trigger preserved (Ctrl+/ or Help button in toolbar).

#### 4.4b Export modal

`export-modal.tsx`. Restyle:
- Card width ~640px.
- Format picker: 3-5 options (PDF / EPUB / DOCX / Markdown / Plain text) as visual buttons with icons + one-line description.
- Preset picker: cards per preset showing name + description (thumbnail placeholder if mockup specifies).
- Options toggles: include front matter / back matter / TOC / page numbers (whichever the current modal already has).
- Footer: Cancel · Export (primary, brand-yellow).

Functional flow preserved.

#### 4.4c Sprint setup popover

`editor/sprint-controls.tsx` — only the `setup` state (duration picker). Apply mockup-spec styling:
- Inline popover row with 3-4 duration pills.
- Match the `tbtnClass()` pattern from DP2 toolbar for consistent button visuals.
- Cancel button labeled or × icon per mockup.

### 4.5 Task 4 — Overlays + drawers

#### 4.5a Find & Replace overlay

`editor/find-replace.tsx`. Restyle:
- Horizontal strip between toolbar and prose body.
- Search input + match count (e.g., "3 of 12") + Prev / Next icon-buttons + match-case toggle + Replace toggle + Close × button.
- When Replace is toggled: a second row with Replace input + Replace + Replace all buttons.
- Highlighted matches in prose body (current match more prominent via brand-yellow tint).
- Theme-aware: works on both light and dark editor canvas.

#### 4.5b Version history drawer

`editor/version-history-drawer.tsx`. Restyle:
- Right-panel-slot replacement (already wired). Width matches metadata panel.
- Header: Clock/History icon + "Version history" + × close button.
- Snapshot rows: each as a paper-card row with date (relative) + word count.
- Currently-previewed row: brand-yellow accent.
- Empty state: use new EmptyState component.
- Free-tier upsell card: brand-yellow accent + Upgrade CTA.

#### 4.5c Snapshot preview banner

`editor/preview-banner.tsx`. Restyle:
- Thin horizontal banner with brand-yellow accent.
- Content: History icon + "Previewing version from {date} · read-only" + "Restore this version" (primary) + "Back to current" (secondary).
- Theme-aware: brand-yellow tint works on both modes.

#### 4.5d Writing analysis panel

`editor/writing-analysis.tsx`. Restyle:
- Slide-in panel from right (existing behavior).
- Header: "Writing analysis" + close ×.
- Section cards: readability / sentence-length / pacing / adverb count / etc. — each as a paper-card section.
- Charts: simple, hand-drawn-feel (avoid Bloomberg-terminal aesthetic).
- Empty state via EmptyState component if prose is too short.

### 4.6 Task 5 — Modes + sprint celebration

#### 4.6a Corkboard view

`corkboard-view.tsx`. Pixel-perfect treatment:
- Subtle "desk surface" background (a slightly different warm tone than the editor canvas — chrome-900 or chrome-850 with a hint of warmth, per mockup).
- Chapter cards as paper rectangles, slight drop shadow, deterministic alternating rotation (even index `+1deg`, odd index `-1deg` via CSS `nth-child` or inline style based on item index).
- Card content: title (Comfortaa heading) + status pill + synopsis (truncated) + word count + chapter number.
- Hover: slight lift (transform: translateY/scale) + deeper shadow + rotation correction toward 0deg for a "picking it up" feel.
- Active card: brand-yellow accent indicator.
- Click → exit corkboard, open chapter.
- Drag-drop reorder preserved.
- Empty state via EmptyState component ("No chapters yet" with CTA).

#### 4.6b Focus mode

Largely a layout shift handled by existing `focusMode` flag. Visual polish:
- Smooth transition when sidebars hide/show (CSS transition on width or display).
- Editor max-width may expand slightly when sidebars are hidden (optional).

No new files; just edits to existing components that consume `focusMode`.

#### 4.6c Sprint finished animation

`editor/sprint-controls.tsx` — only the `finished` state. Add:
- CSS `@keyframes` for a one-time pulse-glow on the pill: 1.5s, ease-out, brand-yellow glow expanding and fading.
- `animation-iteration-count: 1` so it runs once on mount, not on every re-render.

Pattern:
```tsx
<button
  onClick={dismissFinished}
  className="... animate-sprint-finished"
  /* CSS animation defined inline or in globals.css */
>
```

Or define `@keyframes sprintFinished` in `globals.css`:
```css
@keyframes sprintFinished {
  0%   { box-shadow: 0 0 0 0 oklch(from var(--brand) l c h / 0.6); }
  100% { box-shadow: 0 0 0 20px oklch(from var(--brand) l c h / 0); }
}
.animate-sprint-finished {
  animation: sprintFinished 1.5s ease-out 1;
}
```

### 4.7 Task 6 — Close-out

- Manual verify the 14-item DP4 checklist (§5).
- Update `AGENTS.md` Resume Here.
- Add DP4 entry under "What Has Been Built".
- Mark the entire 4-sub-project design-port pass as complete; next focus is Phase 8 Stripe monetization.
- Commit AGENTS.md, push to origin/main.

## 5. Testing (manual checklist after Task 6)

1. `npm run dev` clean. Studio loads.
2. Delete a binder item via ⋯ menu → ConfirmDialog appears; cancel works; confirm deletes.
3. Empty book (no chapters) → "Start your first chapter" via new EmptyState with CTA.
4. Active item is non-chapter → metadata panel's EmptyPlaceholder via new EmptyState.
5. New chapter with no snapshots → version history drawer empty state via new EmptyState.
6. Press Ctrl+/ → cheatsheet modal renders with paper-key `<kbd>` visuals; Esc closes.
7. Open Export → format + preset picker matches mockup; export flow still works.
8. Open Find & Replace (Ctrl+F) → overlay matches mockup; find/replace functionally works.
9. Open History drawer (premium) → snapshot list matches mockup; click a row → preview banner appears; restore + back-to-current work.
10. Open Writing Analysis → slide-in panel matches mockup; stats render correctly.
11. Toggle focus mode → sidebars hide smoothly; chrome remains coherent.
12. Toggle corkboard mode → paper-card grid with alternating rotation; click card → opens; drag reorders.
13. Sprint timer finished state shows pulse-glow animation once on mount; click dismisses.
14. `npx tsc --noEmit` clean. `npm test` clean (still 119).

## 6. Risks (carried from brainstorm)

1. ConfirmDialog placement (`components/ui/` vs studio-scoped) — start in `components/ui/`, refactor later if needed.
2. EmptyState prop flexibility — design for the four use cases (chapter-editor variants, metadata-panel, version-history) up front.
3. Light-mode editor flip on overlays — apply `[data-editor-theme="light"]` CSS variable bridge per surface.
4. Cheatsheet `<kbd>` paper-key visuals — careful CSS, not load-bearing.
5. Corkboard alternating rotation looking like a bug — deterministic ±1° max, even/odd pattern.
6. Sprint pulse-glow re-firing on every render — gate on `animation-iteration-count: 1` + mount-only via component key.
7. Focus management in ConfirmDialog — use shadcn `Dialog` primitive (already provides focus trap).

## 7. Definition of Done

- 6 atomic commits (Tasks 1-5 + AGENTS.md close-out).
- All 14 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean.
- Two new shared components shipped (ConfirmDialog, EmptyState) and each used by at least one existing surface.
- Corkboard pixel-perfect; other surfaces structural fidelity.
- AGENTS.md Resume Here updated; DP4 entry under "What Has Been Built"; design-port pass marked complete.
- Pushed to origin/main.

## 8. Out-of-scope reminders

After DP4 ships, the entire studio UI matches the new design system. Remaining design work outside the four-sub-project pass:
- App-level top nav bar (Chris designs separately).
- Bonus pages: Landing, Sign In, Sign Up (deferred).
- Book creation wizard (deferred to its own future pass).
- Community / Hive surfaces (out of editor-redesign scope).

After DP4: Phase 8 Stripe monetization is the next focus.
