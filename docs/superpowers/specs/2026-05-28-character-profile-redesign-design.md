# Character Profile Redesign

**Date:** 2026-05-28
**Status:** Design approved, ready for plan-phase

## Problem

The character profile editor uses a CSS Grid with `gridTemplateColumns: '1fr 1fr'`. The first two sections (Appearance + Personality) sit in the same row. Because Grid aligns row siblings to the tallest item, typing a long Personality entry stretches the Appearance card to match — and vice versa. Beyond that bug, the surface feels like floating cards-on-cards: the page already has a paper-card wrapper for the editor canvas, and each section adds another card layer, producing visual noise.

## Scope

Single-file rewrite of the body region of `character-profile.tsx`. Convert the six section cards from a 2-column grid of paper cards into a single continuous "specimen sheet" with sections separated by thin horizontal rules. Preserve the identity-header card (avatar + name + meta) untouched. Preserve all logic: content shape, legacy migration, debounce, save badge, breadcrumb, theme tokens. No DB / schema / test changes.

## 1. Layout architecture

A single continuous **specimen sheet** — cream paper, single column, max-width 720px, centered on the editor canvas. Two stacked regions:

1. **Identity header** (top card, distinct) — avatar + name + meta row. Stays a discrete card-on-paper because it functions as the dossier's masthead. Same shadow + dotted-grain treatment as today.
2. **Body sheet** — one paper surface holding all six sections as a continuous flow: Appearance / Personality / Backstory / Arc / Relationships / Notes. Sections separated by thin horizontal rules (`var(--sheet-rule)`, 1px). No per-section cards, no per-section shadows.

Every section is full-width. Each section grows independently — no grid row alignment, no stretching.

## 2. Section structure (within the body sheet)

Each section is a vertical stack:

1. **Index label** — kept (`01 · Description`, `02 · Inner`, etc.). Mono, 10.5px, letter-spaced 0.20em, muted. Sits as a quiet marker at the section's top edge.
2. **Heading** — `Appearance`, `Personality`, etc. Display serif, **16px** (down from 17), paper-ink-strong.
3. **Body** — contenteditable prose. Newsreader serif, 15px, **line-height 1.7** (up from 1.65), paper-ink. Same typography as today's body otherwise. Empty state placeholder stays italic + muted.

Spacing between sections: ~32px vertical, with a `border-top: 1px solid var(--sheet-rule)` providing the divider. The first section omits the top border.

## 3. Relationships section (special handling)

Inline, no card chrome. Index label + heading like every other section, then the relationship rows render directly on the paper (each row keeps its current pill styling: avatar + name + arrow + relation chip + remove `×`). The placeholder "+ Link a character (coming soon)" dashed button sits at the bottom of the list. No outer card wrapper, no inset background — the row pills provide enough structure on their own.

## 4. Implementation notes

**File:** `app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx`

Changes inside the body region only:

- Remove the outer grid: drop `gridTemplateColumns: '1fr 1fr'` from the `[data-slot="character-sections"]` div. Replace with vertical flex stack (`flex flex-col`).
- Remove the `full` prop from `SectionCard` calls and the `full` parameter from the `SectionCard` function. Every section is full-width now.
- Remove SectionCard's per-card `background`, `boxShadow`, `borderRadius` styles. The component becomes a semantic `<section>` rendering index + heading + body with no chrome.
- Add `border-top: 1px solid var(--sheet-rule)` between sections; the first section omits it (use `:not(:first-child)` via a CSS rule in the existing `<style>` block, OR via a `data-first` attribute, OR by computing `index === 0` in the JSX).
- Same chrome removal for the Relationships section: drop its outer background / boxShadow / borderRadius.
- Apply typography refinements: SectionCard heading `fontSize: 17 → 16`. Body `lineHeight: 1.65 → 1.7`. Relationships heading `fontSize: 17 → 16` (it has its own inline JSX, not via SectionCard).
- Section gap: ~32px between sections (use `gap-8` on the flex container OR `paddingTop: 24` + `borderTop` on each `:not(:first-child)` — Chris's call on the implementer).

Things to preserve verbatim:
- `CharacterContent` type, `readContent()` legacy migration.
- `scheduleSave` debounce + `setField` helper.
- Identity-header card (avatar + name + meta).
- `MetaPill` and `MetaText` components.
- The breadcrumb head (`character-surface-head`).
- The `<style>` block defining theme-aware tokens (`--sheet-bg`, `--sheet-ink`, etc.). Keep it; new code references the same vars.
- `SaveStatusBadge`.

## 5. Testing strategy

- **No new unit tests.** This is a presentational rewrite with zero logic change.
- **tsc + npm test must remain clean** post-edit.
- **Manual verification:**
  1. Open an existing character → renders as a single column with section dividers; no row-stretch between Appearance and Personality.
  2. Type a long Personality entry → only Personality grows; Appearance height unchanged.
  3. Each section's empty state placeholder still shows.
  4. Identity header (avatar + name + meta) renders unchanged.
  5. Save status badge still flashes on edit.
  6. Relationships section: existing rows render inline (no card chrome around the list); add button still disabled with "coming soon" copy.
  7. Light editor theme: dividers visible against paper, ink contrast preserved.
  8. Dark editor theme: dividers visible against warm-coffee canvas-dark.

## 6. Out of scope

- **Avatar upload.** Still placeholder initials. Existing `TODO(avatar-upload)` comment stays.
- **Character picker for Relationships.** Still placeholder disabled button. Existing `TODO(character-picker)` comment stays.
- **Identity header card.** Unchanged.
- **Save-status badge, breadcrumb head, theme tokens.** Preserved.
- **Mobile responsive pass.** Out of scope.
