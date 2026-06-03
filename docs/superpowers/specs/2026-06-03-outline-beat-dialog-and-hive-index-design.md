# Outline beat dialog + hive outline index — design

**Date:** 2026-06-03
**Status:** Approved (Chris)
**Scope:** Studio editor outline UI (beat creation/edit flow) + hive-side outline browsing.

---

## Summary

Replace the click-to-cycle status model on outline beats with a popup dialog that owns title, description, user-chosen color, and a single label badge. Colors become user-defined semantic categories (e.g. "purple = magic system"), not draft status. Eight curated colors + eight fixed labels. Existing beats with the legacy `status` field migrate to a derived color at read time.

On the hive side, the `/hive/[hiveId]/outline` page flips from "stacked render of every outline" to a forum-style index list (search + sort), with a new `/hive/[hiveId]/outline/[outlineId]` detail route that hosts the existing beat-sheet surface for one outline.

Studio binder navigation stays as the index on the studio side — no new routes there.

---

## Decisions locked

1. **Labels:** single-select per beat. Fixed list of 8: Character, Scene, Plot point, Subplot, World building, Character arc, Conflict, Note. Plus a "None" option (null label).
2. **Colors:** curated 8-swatch palette (yellow, orange, pink, purple, blue, mint, lime, slate) plus an explicit "× = no color" option (null color). No free-form / custom colors in v1.
3. **Legacy beats:** existing `status` field maps to a color at read time inside `readContent()` (idea→yellow, drafting→orange, done→lime). Status is dropped on the next save. No DB migration.
4. **Scope:** beat-level changes (dialog + color + label) ship to BOTH the studio editor outline and the hive-side outline surface. Index page ships HIVE-ONLY. Studio binder remains the studio-side index.
5. **Edit flow:** the dialog handles both create and edit. Inline-edit-title on the beat row is removed. Clicking the title (or the color dot) opens the dialog. Linked-chapter popover stays separate on the row.
6. **Hive index layout:** forum-style table (mirrors the Discussions reskin from `c44c58d`). Column-header strip + `divide-y <ul>` rows. Clicking a row drills into the detail page.
7. **Detail page hosting:** new dynamic route `/hive/[hiveId]/outline/[outlineId]`. The existing `<HiveOutlineSurface>` is lifted into it as a single-outline renderer.

---

## Data model

### Beat type (extended)

`Beat` in `app/[locale]/(app)/studio/[bookId]/_components/outline/outline-board.tsx`:

```ts
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
  color?: BeatColor | null     // NEW — null = no color
  label?: BeatLabel | null     // NEW — null = no label
  linkedChapterId?: string | null
  act?: string | null

  /** @deprecated read-only legacy; mapped to `color` by readContent() */
  status?: 'idea' | 'drafting' | 'done'
}
```

- `color` is optional + nullable. `null` = explicit "no color" (hollow dashed dot). `undefined` is treated identically to `null` in render.
- `label` follows the same pattern.
- `status` stays on the type for legacy reads but new writes never set it.

### Legacy migration

Extend `readContent()` in `outline-board.tsx`. For every beat in `beats`:

| `status` value (legacy) | `color` after migration |
|---|---|
| `'idea'` | `'yellow'` |
| `'drafting'` | `'orange'` |
| `'done'` | `'lime'` |
| `undefined` (already migrated, or new beat) | unchanged |

Migration rule: if `beat.color === undefined && beat.status !== undefined`, set `color` from the table and `delete beat.status`. Idempotent — re-running on already-migrated content is a no-op.

Migration runs at read time (every load). The next save persists the migrated shape so old `status` fields fall off the JSON over time. No DB migration script needed (`binder_items.content` is jsonb).

### Tokens

8 new CSS variables in `app/globals.css`, with light-mode overrides scoped inside `[data-editor-theme="light"] [data-slot="outline-pane"]` (matching the existing outline token block at lines 372–399 of `outline-board.tsx`'s inline `<style>` and the global `:root`):

```css
:root {
  --beat-yellow: <dark-mode value>;
  --beat-orange: <dark-mode value>;
  --beat-pink:   <dark-mode value>;
  --beat-purple: <dark-mode value>;
  --beat-blue:   <dark-mode value>;
  --beat-mint:   <dark-mode value>;
  --beat-lime:   <dark-mode value>;
  --beat-slate:  <dark-mode value>;
}
[data-editor-theme="light"] [data-slot="outline-pane"] {
  --beat-yellow: <warmer/darker value for cream paper>;
  /* etc. */
}
```

Specific oklch values chosen during implementation. Constraint: each swatch must be legible against both `--canvas-dark-200` (dark walnut) and `--paper-200` (cream) without falling below WCAG AA against the chrome around it.

---

## Beat dialog component

New file: `app/[locale]/(app)/studio/[bookId]/_components/outline/beat-dialog.tsx`. Shared between studio and hive surfaces.

### Props

```ts
type BeatDialogProps = {
  open: boolean
  mode: 'create' | 'edit'
  initial: Partial<Beat>             // {} for create; full beat (without id) for edit
  defaultAct?: string | null         // pre-fill act on per-act "+ Add"
  onSave: (patch: Partial<Beat>) => void
  onDelete?: () => void              // only when mode === 'edit'
  onOpenChange: (open: boolean) => void
  readOnly?: boolean                 // hive BETA_READER path
}
```

The dialog never mutates global state directly. The caller (studio or hive surface) owns the `commit()` debounce wiring and merges the patch into local `beats`.

### Behavior

- Built on the existing shadcn `<Dialog>` primitive — chrome inherited (no new styling).
- Auto-focus title input on open. If `mode === 'edit'`, full-select the title.
- **Enter inside the title input** = save (matches "click → type → Enter" muscle memory).
- **Esc** = cancel (shadcn `Dialog` default).
- Save calls `onSave({ title, description, color, label })` then closes via `onOpenChange(false)`.
- Cancel discards changes and closes.
- Delete button only renders in `mode === 'edit'` AND `!readOnly`. Click opens shared `<ConfirmDialog>` ("Delete this beat? This cannot be undone."). Confirm calls `onDelete()` then closes.
- **Read-only mode** (BETA_READER on hive side): all inputs disabled (greyed but values visible), footer collapses to a single `Close` button.

### Field layout (vertical stack)

1. Title — single-line input. Auto-focus on open, brand-yellow 3px focus ring.
2. Description — 3-row textarea, resize: vertical. Placeholder: "Optional details about this beat…".
3. Color — row of 8 round swatches (28×28, brand-yellow `0 0 0 2px` outline on selected) plus an "×" hollow ring (28×28, dashed border) representing "no color." `aria-pressed` for each option.
4. Label — wrap of 8 pill chips (single-select) plus a dashed "None" pill. Selected pill = brand-yellow background, brand-ink text. Unselected = transparent + chrome-border. `aria-pressed` per pill.
5. Footer — left: `Delete beat` (destructive text button, edit mode only). Right: `Cancel` (ghost) + `Save beat` (brand pill).

Linked-chapter assignment stays on the beat row outside the dialog (different mental model — exploratory pick vs identity-defining).

---

## Beat row changes

Files: `outline-card.tsx` (the `OutlineBeatRow` component), plus minor wiring in `outline-board.tsx` and `outline-act-group.tsx`.

### Color dot

- Renders `background: var(--beat-{color})` when `beat.color` is set.
- Renders a hollow dashed ring (`border: 1px dashed var(--outline-rule)`, transparent background) when `color === null` or `undefined`.
- **Click is no longer a status cycler.** Click opens the beat dialog in edit mode (same as clicking the title). Dot is passive visual.
- `title` attribute on hover: the color name (e.g. `"Purple"`). Helps users build a personal code.

### Label badge

- New presentational component: `<BeatLabelBadge label={beat.label} />` in `outline-card.tsx` (or its own file if shared with hive).
- Renders a pill: 11px text, ink-strong color, chrome-border background, between the title and the right-side meta column.
- Hidden when `beat.label === null` or `undefined`.
- Same render in studio + hive (shared component, no theme branches).
- **Non-interactive.** Renders as a `<span>`, not a `<button>`. No click handler. Edits go through the dialog (click dot or title).

### Title interaction

- Inline contenteditable is removed.
- Title renders as a `<button>` (visually unchanged — still a heading) whose click opens the beat dialog in edit mode.
- Same accessibility: `aria-label="Edit beat: {title}"`.

### Description preview

- Stays as today: line-clamp-2, muted ink, below the title row.

### Linked-chapter affordance

- Untouched. Still its own click target (the existing chapter-link popover).

### Delete affordance

- Removed from the row hover-actions. Delete now lives inside the dialog footer.

### Drag

- Untouched. Drag handle stays; sortable behavior unchanged.

### Tab order on the row

dot → title → linked-chapter → drag handle. (Label badge is non-interactive and skipped.)

---

## Hive outline index page

### Routes

```
/hive/[hiveId]/outline                  ← NEW index list
/hive/[hiveId]/outline/[outlineId]      ← NEW detail (one outline)
```

### Files

- `app/[locale]/(app)/hive/[hiveId]/outline/page.tsx` — becomes the index. Server component; calls `getHiveOutlineView(hiveId)` (already returns `outlines: HiveOutlineEntry[]`) and renders `<OutlineIndex>`.
- `app/[locale]/(app)/hive/[hiveId]/outline/_components/outline-index.tsx` — NEW client component. Search input, sort dropdown, forum-style table.
- `app/[locale]/(app)/hive/[hiveId]/outline/[outlineId]/page.tsx` — NEW dynamic route. Server component, asserts `outline.bookId === hive.bookId`, calls new `getHiveOutlineByIdAction`, renders `<HiveOutlineSurface entry={...} chapters={...} viewerRole={...} hiveId={hiveId} locale={locale} />`.
- `app/[locale]/(app)/hive/[hiveId]/outline/_components/hive-outline-surface.tsx` — **simplifies.** Removes the wrapper that maps over `outlines: HiveOutlineEntry[]`. Reverts to a single-outline renderer (closer to the shape from before commit `b925bb0`).

### Index layout

- Wrapper: `max-w-5xl px-6 py-8` (matches Discussions).
- Header: Comfortaa brand-yellow `Outlines` h1 + mono subtitle `{N} outlines in this hive`.
- Search input: filters outline title (case-insensitive substring). Debounced 200ms.
- Sort dropdown:
  - **Recent** (default) — `lastEditedAt DESC`, falls back to `updatedAt DESC`.
  - **A → Z** — `title ASC`.
  - **Most beats** — beat count (derived from `outline.content.beats.length`) DESC.
- Unified panel (panel-gradient chrome, `--r-card`, `--sh-card`, `--br-card`).
- Column-header strip: `Outline | Beats | Last edit` styled as tile-gradient over `--canvas-dark-300` border-bottom.
- Rows: `divide-y <ul>` with 3-col grid `[1fr 90px 130px]`. Whole row is a `<Link>` to `/hive/[hiveId]/outline/[outlineId]`.
  - Left: title (Comfortaa semibold) + a color-dot strip of up to 6 deduplicated unique `--beat-*` colors used in the outline, in first-appearance order (the order beats appear in `content.beats`). Beats without color contribute nothing to the strip. If the outline has zero beats or only uncolored beats, the strip is omitted.
  - Middle: big bold beat count + `beats` mono caption.
  - Right: `relTime(lastEditedAt)` mono.
- Empty state when zero outlines: panel-chrome card with italic muted "No outlines yet — the author can create one in the studio."
- BETA_READER and CONTRIBUTOR+ see the same index. Permission gates live on the detail page (mutations).

### Detail page

- Asserts hive membership via `requireHiveMember(hiveId, userId)`.
- Calls new server action `getHiveOutlineByIdAction(hiveId, outlineId)`:
  - Asserts the binder item exists and `binderItem.type === 'outline'`.
  - Asserts `binderItem.bookId === hive.bookId` (cross-hive escape guard, same precedent as T13 chapter view).
  - Returns `{ entry: HiveOutlineEntry, chapters: ChapterRef[], viewerRole: HiveRole }`.
- Renders `<HiveOutlineSurface entry={...} {...rest} />` using the simplified single-outline shape.
- Includes a `← Back to outlines` link to the index route.

### Studio side

Untouched. The binder remains the studio-side index. No new studio routes.

---

## Persistence

- All beat mutations flow through `updateBinderItemAction(outlineId, { content: OutlineContent })` as today.
- The 2s debounce + state-isolation pattern from commit `2e8311b` (`OutlineBoard` detects `item.id` flips and re-seeds local state) is preserved unchanged. The dialog calls `onSave(patch)`, the surface merges into `beats`, `commit()` debounces.
- Save-on-doc-switch: the existing pattern (let the pending timer fire with its captured `item.id`) still works.

---

## Edge cases

1. **Legacy beat with `status` and no `color`** — `readContent()` migration runs (table above). Next save drops `status` from JSON. Idempotent.
2. **Beat with no color AND no label** — renders a hollow dashed dot + no badge. Looks intentional.
3. **Save-after-delete race** — same posture as today: deleting a beat overwrites pending debounced content.
4. **Hive BETA_READER** — dialog opens in `readOnly` mode (inputs disabled, footer collapses to `Close`). Beat row's title button still opens the dialog so beta readers can read the full description.
5. **Detail-page deep link to a deleted outline** — `getHiveOutlineByIdAction` returns `OUTLINE_NOT_FOUND` → page calls `notFound()`.
6. **Cross-hive escape** — detail route asserts `binderItem.bookId === hive.bookId` before serving.
7. **Drag / drag-between-acts** — untouched. Dialog only owns content; positioning stays on the row.
8. **"+ Add a beat" at various scopes** — top-level button opens dialog with `defaultAct: null`; per-act header button opens with `defaultAct: actName`. The dialog doesn't expose act selection — act is decided by the caller's context.

---

## Out of scope (deferred — not implementing)

- Free-form / custom beat colors. v1 is the curated 8-swatch palette only.
- Multi-select labels. v1 is single-select. Upgrade path (`label: BeatLabel | null` → `labels: BeatLabel[]`) is trivial later.
- Cross-outline beat search ("find every beat tagged Conflict across all outlines"). Index search is by outline title only.
- Label / color filter chips on the index page. v1 is search + sort only.
- Studio binder index page. The binder IS the index.
- Beat reordering inside the dialog. Reorder stays on the row drag.
- Renaming / extending the label list. Fixed list of 8.
- Custom user-defined labels.

---

## Test posture

- **Unit:** `readContent()` migration — 4 test cases for the status→color mappings plus a no-status case + an already-migrated idempotency case. File: `lib/outline/__tests__/read-content.test.ts` (or co-located with `outline-board.tsx` per existing pattern).
- **Surface-shape:** `getHiveOutlineByIdAction` — auth gate, cross-hive escape, NOT_FOUND. Pattern matches `lib/actions/__tests__/reading-actions.test.ts`.
- **Presentational components** (dialog, beat row, index): covered by manual smoke per AGENTS.md preference. No new behavior tests.
- tsc must stay clean across the run.

---

## Carry-forward smoke checklist for Chris (post-implementation)

1. Open a book with legacy beats (any `status` set). Confirm dots render with derived colors (idea→yellow, drafting→orange, done→lime). Save once (autosave). Reload — JSON no longer has `status`.
2. Create a new beat via "+ Add a beat" at the top of the outline. Dialog opens, title focused. Type title, pick purple, pick "Scene", Save. Beat appears with purple dot + Scene badge.
3. Per-act "+ Add a beat" prefills the act (verify by saving and checking the beat lands in that act's group).
4. Click an existing beat title. Dialog opens in edit mode with all fields populated. Change color + label, Save. Row updates without page refresh.
5. Click delete inside the dialog. Confirm dialog appears. Confirm. Beat disappears.
6. BETA_READER on hive side: dialog opens with all inputs disabled, only "Close" button visible.
7. Hive `/hive/[hiveId]/outline`: confirm forum-style index with search + sort. Click a row → drill into detail page → confirm the existing beat-sheet surface renders.
8. Hive detail page deep link to a deleted outline ID: confirm 404.
9. Hive detail page asserts cross-hive escape (try editing the URL with another hive's outlineId): confirm 404 or NOT_FOUND error.
10. Light mode + dark mode: all 8 swatches legible against the act header band AND the page canvas.
