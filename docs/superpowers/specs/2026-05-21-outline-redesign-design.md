# Outline Document Redesign

**Date:** 2026-05-21
**Status:** Draft
**Surface:** `app/[locale]/(app)/studio/[bookId]/_components/outline/`

## Problem

The current Outline document UI has three concrete problems:

1. **Light mode is broken in the same way Notes was** — text disappears against the cream paper because the `--paper-ink-*` tokens leak from dark-mode CSS remappings. Hardcoded colors elsewhere compound the issue.
2. **Drag-and-drop is half-built.** Beats can be reordered within the flat list, but the act metadata only updates when a beat is dropped on another beat that happens to be in a different act — you cannot drag a beat into an empty act, and acts themselves cannot be reordered.
3. **No guidance for first-time users.** Empty state is a single "+ Add your first beat" button with no explanation of what beats vs acts mean, what drag-and-drop does, or how chapter linking works.

## Goal

Make the Outline a polished, iOS-inspired planning surface with reliable light/dark contrast, complete drag-and-drop (beats anywhere, acts anywhere), and visible guidance that fades once the user is comfortable.

## Mechanic (canonical)

- A document is a list of **beats** (scenes / moments).
- Beats are grouped into **acts** (Setup, Confrontation, Resolution — or anything the user names).
- Beats can also be act-less, in which case they live under "No Act" (kept per user direction).
- Beats can be dragged: within an act, between acts, into empty acts, into/out of "No Act".
- Acts can be dragged to reorder.
- Each beat has a status (`idea` / `drafting` / `done`) toggled by clicking a colored dot, and an optional linked chapter.
- Acts can be collapsed individually; the collapse state persists per-document.

## Layout

Vertical stack inside the outline pane:

1. **Header strip** — dark in both themes (matches Notes pattern). Contains: type dot · "OUTLINE" label · document title · beat count · `+ Add beat` · `?` Help · save status.
2. **Help banner** (dismissible, shows while beat count < 3 and not yet dismissed).
3. **Act groups** rendered in `actsOrder` order, with "No Act" as a regular group.
4. **Footer actions** — `+ New Act` and `+ Add a beat` dashed buttons.

Each **act group** is the iOS-Settings-table collapsible-drawer style:

- **Cap (header)** — tinted rounded top (`--outline-act-cap-bg`), 10px radius on top corners. Contains: act drag handle `⋮⋮` · disclosure chevron `▼`/`▶` · act name (inline editable) · beat count · `+ Add beat`.
- **Drawer (body)** — connected white-ish panel (`--outline-drawer-bg`), bottom corners rounded, hairline `--outline-rule` border. Contains beat rows separated by hairlines.
- When collapsed, only the cap renders (radius full 10px all corners).
- When the act has 0 beats and is expanded, the drawer shows the **empty drop zone** instead of a beat list.

## Theming — token bridge

All theming flows through local CSS variables on `[data-slot="outline-pane"]`:

| Token | Dark (default) | Light (`[data-editor-theme="light"]`) |
|---|---|---|
| `--outline-canvas` | `var(--canvas-dark-200)` | `var(--paper-200)` |
| `--outline-act-cap-bg` | `var(--canvas-dark-300)` | `var(--paper-200)` |
| `--outline-drawer-bg` | `var(--canvas-dark-100)` | `var(--paper-50)` |
| `--outline-rule` | `oklch(1 0 0 / 0.06)` | `var(--paper-300)` |
| `--outline-rule-soft` | `oklch(1 0 0 / 0.04)` | `oklch(from var(--paper-300) l c h / 0.6)` |
| `--outline-ink-strong` | `var(--canvas-dark-ink-strong)` | `oklch(0.180 0.022 50)` |
| `--outline-ink` | `var(--canvas-dark-ink)` | `oklch(0.265 0.020 55)` |
| `--outline-ink-muted` | `oklch(from var(--canvas-dark-ink) l c h / 0.7)` | `oklch(0.520 0.022 60)` |
| `--outline-strip-bg` | `var(--canvas-dark-100)` | `var(--canvas-dark-100)` (stays dark) |
| `--outline-strip-ink` | `var(--canvas-dark-ink-strong)` | `var(--canvas-dark-ink-strong)` |

### Contrast guarantee — three non-negotiable rules

1. **No hardcoded text colors** anywhere in the redesigned files. Every text element reads `var(--outline-ink-*)` or `var(--outline-strip-ink)`.
2. **The light-mode block explicitly resets `--paper-ink-*` to literal oklch values** (not `var()` references), to prevent the dark-mode block's remap from leaking. Same fix pattern used in `note-editor.tsx`.
3. **The header strip uses Notes' scoped-override pattern** — strip bg stays dark in both themes; the strip's children read `--outline-strip-ink` (light canvas color) regardless of outer theme.

### iOS-feel rules

- 12px radius on drawers, 10px on caps, 6px on beat rows
- Hairlines are 1px exactly (no 1.5px except dashed empty zones)
- Inset shadow `inset 0 1px 2px oklch(0 0 0 / 0.18)` under the header strip
- `0 1px 0 var(--paper-200)` soft shadow under each act drawer in light mode; `inset 0 1px 0 oklch(1 0 0 / 0.04)` in dark mode
- Disclosure chevron rotates `▶ → ▼` with 150ms `transform` transition (respects `prefers-reduced-motion`)

## Drag-and-drop

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable` (already present). Nested contexts: outer `SortableContext` for act order, inner `SortableContext` per act for beats.

| Operation | Draggable | Drop targets | Persistence |
|---|---|---|---|
| Reorder beats within act | beat row (handle or body) | sibling beat rows | `beats[]` reordered |
| Move beat across acts | beat row | foreign beat row · empty drop zone · act header cap | beat's `act` field updated; `beats[]` rearranged |
| Reorder acts | act handle `⋮⋮` only (not whole cap) | sibling act caps | `actsOrder[]` rewritten |

**Drop targets per act:** (a) act header cap → appends beat to top of act; (b) between beat rows → inserts at position; (c) empty drop zone → adds as first beat.

**Visual feedback:** dragged element lifts with `0 6px 14px oklch(0 0 0 / 0.25)` shadow; insertion line uses `--color-brand` 2px; act receiving a beat shows a 2px brand-tinted ring around the drawer; empty drop zone pulses brand-tinted bg on `dragOver`.

**Collision strategy:** `closestCenter` for both contexts.

**Keyboard a11y:** add `KeyboardSensor` alongside `PointerSensor`. Drag handles are real `<button>` elements with `aria-describedby` announcing position. Space picks up · arrows move · Space drops · Esc cancels.

**"No Act" parity:** treated as a regular act-group for DnD (draggable, accepts drops). Only difference: name is non-editable.

## Help system

### 1. Sticky banner (`outline-help-banner.tsx`)

- Shows when `helpBannerDismissed === false` AND `beats.length < 3`.
- Content: *"ℹ️ Outline basics — Beats are scenes. Acts group beats. Drag the ⋮⋮ handle to reorder beats or move them between acts. Click ? in the header for more."* with a `[×]` dismiss button.
- Dismiss → sets `helpBannerDismissed: true`, persists.
- Auto-hides without dismissing at beat count ≥ 3; reappears if user later drops below 3 and hasn't dismissed.
- Resurrectable via the "Show banner again" link in the help panel.
- Styling: brand-tinted 3px left border, `--outline-act-cap-bg` background, quiet pill density.

### 2. Empty-act drop zone (`outline-empty-drop-zone.tsx`)

- Renders inside any act with 0 beats (including "No Act" and freshly created acts).
- 48px min-height, centered text *"⋯ Drop a beat here, or click + Add ⋯"* in `--outline-ink-muted`.
- 1.5px dashed `--outline-rule-soft` border.
- On `dragOver`: border becomes solid 1.5px brand-tinted; bg pulses to `oklch(from var(--color-brand) l c h / 0.08)`; text strengthens to `--outline-ink`.

### 3. Hover tooltips

Native `title=""` on every icon-only button. Always-on (no fading).

| Icon | Tooltip |
|---|---|
| Beat `⋮⋮` | "Drag to reorder · drag into another act to move" |
| Act `⋮⋮` | "Drag to reorder acts" |
| Status `●` | "Status: {current} · click to cycle" |
| `🔗` linked | "Linked to {chapter title} · click to jump" |
| `🔗+` unlinked | "Link this beat to a chapter" |
| Chevron `▼`/`▶` | "Collapse this act" / "Expand this act" |
| `×` beat row | "Delete beat" |
| `+ Add beat` (cap) | "Add a beat to {act name}" |

### 4. Help panel (`outline-help-panel.tsx`)

`?` button in header strip opens a centered modal. Clicks outside or Esc dismiss. Single page, no scrolling. Contents:

```
What's an outline?
A workspace for sketching the shape of your story before you write it.

Concepts
• Beat — a single scene or moment ("Hero meets mentor")
• Act — a group of beats (Setup, Confrontation, Resolution)
• Linked chapter — jump from a beat to the chapter you're drafting it in

Drag and drop
• Drag a beat's ⋮⋮ to reorder within an act
• Drag a beat into another act's header (or its drop zone) to move it
• Drag an act's ⋮⋮ to reorder whole acts

Status
Click a beat's colored dot to cycle: idea → drafting → done

[Show banner again]   [Got it]
```

Modal styling: matches Notes editor body card — `var(--outline-drawer-bg)`, `var(--r-card)` radius, `var(--sh-card)` shadow. All text uses ink tokens.

## File structure

```
app/[locale]/(app)/studio/[bookId]/_components/outline/
  outline-board.tsx              # orchestrator: state, persistence, DnD context
  outline-help-banner.tsx        # NEW — sticky dismissible "how this works" banner
  outline-help-panel.tsx         # NEW — the ? quick-reference modal
  outline-act-group.tsx          # NEW — collapsible act drawer; header cap + body
  outline-empty-drop-zone.tsx    # NEW — "Drop a beat here" dashed zone
  outline-card.tsx               # EXISTING — single beat row, lightly restyled
  chapter-link-popover.tsx       # EXISTING — unchanged
```

`outline-board.tsx` becomes pure orchestration + the rendering loop over act groups. `outline-card.tsx` only changes its styling (use ink tokens; tighter row chrome to fit the iOS-table aesthetic). All new files are client components.

## Data model

Extend `OutlineContent` (all new fields optional — existing documents read correctly):

```ts
type OutlineContent = {
  beats: Beat[]
  actsOrder?: Array<string | null>  // act names in render order; null = "No Act" (matches Beat.act type)
  collapsedActs?: Array<string | null> // matches actsOrder
  helpBannerDismissed?: boolean
}
```

**Backward compatibility.** Legacy documents without `actsOrder` derive the order from beat-insertion order (current `groupBeatsByAct` behavior). First user interaction that touches act order writes the explicit array.

**"No Act" representation.** Stored as `null` everywhere — matches the existing `Beat.act: string | null` shape with no migration. UI displays "No Act" but the data layer carries `null`.

## Accessibility

- Header strip: `role="status"` for save badge announcements.
- Help banner: `role="region"` + `aria-label="Outline help"`.
- Act group: `<section>` with `<h2>` heading; chevron button has `aria-expanded`.
- Drag handles: real `<button>` elements; `aria-describedby` with live drag position from dnd-kit's announcements.
- Modal: focus trap, focus returns to `?` button on close, Esc closes.
- All status conveyed by color is paired with a text label (not color-only).
- All interactive targets ≥ 44×44px (drag handles get hit-area padding even when icon is small).
- `prefers-reduced-motion` respected on chevron rotation and any pulse/shimmer animations.

## V1 scope (this spec)

Included:
- Layout C (collapsible iOS-table act drawers) with header strip, help banner, all four help surfaces
- Full DnD (beats anywhere, acts anywhere, "No Act" parity)
- Token-based theming with contrast guarantee
- Data-model additions (`actsOrder`, `collapsedActs`, `helpBannerDismissed`) with legacy fallback
- Keyboard a11y on drag handles
- Tooltips on all icon-only controls

Out of scope (later):
- Drag-multiple-beats selection
- Cross-document beat library / templates
- Save-the-Cat / Hero's Journey scaffolding templates
- Beat color tagging
- Per-beat word count rollups

## Open questions

None — all clarifying questions resolved during brainstorming.
