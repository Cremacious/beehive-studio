# Editor Aesthetic Refresh — Design

**Status:** Approved (Chris, 2026-06-01)
**Date:** 2026-06-01
**Scope:** Studio editor (`/studio/[bookId]`) chrome only. No structural changes, no feature changes, no information-architecture changes. Pure visual re-skin.
**Successor scope (separate spec):** Hive pages + all subpages (will be brainstormed after editor ships).

---

## Context

The current studio UI ships the DP1-DP4 design-port pass: cool-walnut tokens, restrained brand-yellow, paper-warm covers, Newsreader prose. Functional and consistent, but Chris reports it reads as **sterile** — too many straight edges, near-black surfaces, no felt depth, "all the colors look flat."

The brief: warmer cool-gray chrome, more rounded, more iOS-modern, more layered depth, brand-yellow used for headings + accents (not just for active states), pure-black avoided. The cream paper prose surface inside the editor canvas is **preserved as-is** — the dark chrome is what changes.

Chris will hand this spec to Claude Design to generate mockups, then mechanically import them. The job of this spec is to give the design system enough constraints to produce consistent results across every chrome surface.

## Goals

- Every studio chrome surface (app nav, binder, toolbar, status bar, metadata panel, modals, overlays, drawers) re-skinned with the new color/depth/rounding system.
- Cream paper prose surface (inside the chapter canvas) **unchanged** — same Newsreader serif, same paper-100 background, same paper-ink text.
- All existing features visible and operable. Zero feature removal, zero affordance hiding, zero behavioral change.
- The design system is captured in `app/globals.css` as CSS custom properties so it survives future iterations without re-editing every component.

## Non-goals

- No structural / layout changes — binder stays on the left, metadata on the right, status bar at the bottom. Toolbar stays at top.
- No new features.
- No light-mode variant — the app stays dark-only per existing constraint.
- No changes to the cream prose surface (font, color, padding, line-height).
- No changes to ad-hoc decorative effects elsewhere (auth-glow, hero-glow, paper-grit utilities). Those are out of scope.
- No changes to Hive routes in this spec (separate brainstorm).

---

## Design System

### Color tokens (oklch, cool-gray neutral chrome)

Already present in `globals.css` as `--canvas-dark-*`. **Extend the scale with two new mid-stops** (--canvas-dark-150, --canvas-dark-250, --canvas-dark-350, --canvas-dark-400) so the gradient-and-layer system has enough range:

```css
--canvas-dark-100:        oklch(0.255 0.003 256);  /* base backdrop */
--canvas-dark-150:        oklch(0.275 0.003 256);  /* NEW — backdrop gradient pair */
--canvas-dark-200:        oklch(0.295 0.003 256);  /* panel bottom */
--canvas-dark-250:        oklch(0.325 0.003 256);  /* NEW — panel top / row hover */
--canvas-dark-300:        oklch(0.360 0.003 256);  /* tile bottom */
--canvas-dark-350:        oklch(0.400 0.003 256);  /* NEW — tile top / button hover */
--canvas-dark-400:        oklch(0.450 0.003 256);  /* NEW — button hover top */

--canvas-dark-ink-muted:  oklch(0.680 0.003 256);  /* secondary text */
--canvas-dark-ink:        oklch(0.880 0.003 256);  /* body text */
--canvas-dark-ink-strong: oklch(0.965 0.003 256);  /* emphasized text */
```

Brand-yellow stays at the existing token (`--brand`). Brand-ink also stays (text on brand backgrounds).

**Pure black is BANNED** from chrome surfaces. The darkest legitimate surface is `--canvas-dark-100`. Shadows use `oklch(0 0 0 / α)` with α ≤ 0.35 — never a solid black.

Paper tokens (for the prose canvas only) stay unchanged.

### Radius scale

```css
--r-card:    20px;   /* outer panels: binder, toolbar, canvas, metadata, status, modals */
--r-row:     14px;   /* inset rows: binder rows, list items, inputs */
--r-btn:     12px;   /* square-ish buttons (toolbar tiles, kebab buttons) */
--r-pill:    999px;  /* fully rounded: status pills, save indicator, premium badge, sprint button */
--r-nav:     20px;   /* app nav bar */
```

Old `--radius` value (~6-8px) is retired for chrome. Inputs **inside** the prose editor (e.g. find/replace) use `--r-row`.

### Elevation / depth system

Every chrome surface gets **stacked iOS-style depth** — vertical gradient + inner top highlight + multi-layer shadow.

```css
/* Outer panels (cards): binder, toolbar, canvas frame, metadata, status, modals, drawers */
--sh-card:
  0 1px 0 oklch(1 0 0 / 0.06) inset,   /* inner top highlight */
  0 8px 24px oklch(0 0 0 / 0.35),      /* main drop */
  0 2px 4px oklch(0 0 0 / 0.25);       /* close drop */

/* Inset tiles: toolbar buttons, status pills, kebab buttons */
--sh-tile:
  0 1px 0 oklch(1 0 0 / 0.08) inset,   /* sharper inner highlight */
  0 1px 2px oklch(0 0 0 / 0.3);        /* small drop */

/* Recessed elements: text inputs, search fields, progress-bar tracks */
--sh-inset:
  inset 0 1px 2px oklch(0 0 0 / 0.2);  /* pressed-in feel */

/* Hairline border that catches light at the top edge of every card */
--br-card: 0.5px solid oklch(1 0 0 / 0.04);
```

Backgrounds for these surfaces use **vertical gradients** (lighter at top), not flat fills:

| Surface tier | Gradient |
|---|---|
| App backdrop | `linear-gradient(180deg, --canvas-dark-150, --canvas-dark-100)` |
| Outer panels | `linear-gradient(180deg, --canvas-dark-250, --canvas-dark-200)` |
| Inset tiles / buttons | `linear-gradient(180deg, --canvas-dark-350, --canvas-dark-300)` |
| Active hover (buttons) | `linear-gradient(180deg, --canvas-dark-400, --canvas-dark-350)` |
| Active selection row | `linear-gradient(180deg, --canvas-dark-350, --canvas-dark-300)` + `--sh-tile` |

### Typography

**No font changes.** Keep the existing stack:
- **Comfortaa** (Google) — display / headings (h1, h2, h3, brand logo, panel titles, chapter titles).
- **Newsreader** (Google) — prose body inside the canvas only.
- **Geist** — chrome UI body text.
- **JetBrains Mono** — labels, metadata, status text (anything monospace).

**Color application** (this is the new rule):
- Headings (h1/h2/h3, panel titles, chapter title in the canvas, binder title) → `var(--brand)` text.
- Body text in chrome → `var(--canvas-dark-ink)` (white-ish).
- Muted / secondary text → `var(--canvas-dark-ink-muted)`.
- Emphasized text → `var(--canvas-dark-ink-strong)`.
- Prose body (Newsreader, inside cream canvas) → `var(--paper-ink)` — unchanged.

Heading weights: 600-700 (Comfortaa naturally renders bold). Brand-yellow on dark chrome must pass 4.5:1 contrast — current `--brand` token does.

### Brand-yellow usage map

Restrained, semantic. Use brand-yellow ONLY in these places:

1. **Headings** (all h1/h2/h3 across chrome — new rule per Chris).
2. **App logo** ("beehive" wordmark in the top nav).
3. **Active nav link** in app nav.
4. **Active toolbar button** (solid yellow background, brand-ink text).
5. **Active status-pill** in metadata.
6. **Premium badge**.
7. **Word-goal target / progress fill** in status bar + metadata.
8. **Progress fill** in word-goals page progress bars.
9. **+ Add Binder Item button text** (the "+" tile in the binder header — keep it).
10. **Go to Hive footer button text** in the binder footer.
11. **Save / 'unsaved changes' subtle indicator** (the dot — not the whole pill).
12. **Layer / mark accent colors** (annotations: GRAMMAR/PLOT/etc. via existing per-layer oklch values).

Save-status pill uses an off-green tint (`oklch(0.85 0.13 165)` text on `0.20`-alpha track) — already in T3 styling. Not brand-yellow.

Anything else (cards, hover states, dividers, borders, neutral text) — **no brand-yellow**.

### Animation / motion

- Card hover: subtle `transform: translateY(-1px)` + lighter gradient stop, 150ms ease-out.
- Button hover: gradient bumps up one tier (e.g. `c-300/c-250` → `c-350/c-300`).
- Selection / active states: instant (no transition — feels snappy).
- Focus mode toggle: existing 200ms slide preserved.
- No new animations introduced.

### Iconography

Keep **lucide-react** icons everywhere. No size change (16-18px standard). Color: `var(--canvas-dark-ink-muted)` by default; `var(--brand)` when the parent row is active; `var(--canvas-dark-ink-strong)` for emphasized standalone icons (e.g. toolbar tiles).

### Modal / overlay surfaces

Modals (export, sprint setup, keyboard cheatsheet, ConfirmDialog, all H3/H4 modals) get the same panel treatment:
- Background: outer-panel gradient (`--canvas-dark-250 → --canvas-dark-200`).
- Radius: `--r-card` (20px).
- Border: `--br-card` (hairline top-edge highlight).
- Shadow: `--sh-card`.
- Backdrop overlay: `oklch(0 0 0 / 0.5)` (existing).

Drawers (version history, gutter, find/replace strip) inherit the panel treatment.

Banners (snapshot preview, overflow banner) use a brand-yellow tinted gradient: `linear-gradient(180deg, brand/15, brand/8)` + `--sh-tile` + `--br-card`.

### Empty-state styling

Existing `<EmptyState>` component gets the panel treatment (gradient bg, soft shadow, 20px radius). Icon stays muted. The empty-state inside the cream canvas (e.g. "no chapters yet") flips to a paper-aware variant — that's already wired via `onEditorCanvas` prop.

---

## Implementation Strategy

### Phase 1 — tokens

Extend `app/globals.css` `:root` with the new mid-stops (`--canvas-dark-150`, `-250`, `-350`, `-400`) + the radius and shadow custom-properties listed above. Existing tokens stay (backward compatible).

### Phase 2 — chrome refresh

Replace flat backgrounds + tight rounding + missing shadows in studio chrome surfaces. Touched files (non-exhaustive):

- App nav (`app/[locale]/(app)/_components/app-nav.tsx`).
- `(app)/studio/[bookId]/_components/book-editor-provider.tsx` (no visual changes — provider).
- `(app)/studio/[bookId]/_components/binder/*` — binder panel + rows + add menu + hive footer.
- `(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — toolbar tiles + dropdowns + active state.
- `(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — canvas wrapper (NOT the cream prose area).
- `(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx` — status pills + sprint controls + save indicator.
- `(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx` — section labels, status pills, word-goal input, progress bar.
- `(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx`.
- `(app)/studio/[bookId]/_components/editor/find-replace.tsx`.
- `(app)/studio/[bookId]/_components/editor/snapshot-preview-banner.tsx`.
- `(app)/studio/[bookId]/_components/editor/writing-analysis.tsx`.
- `(app)/studio/[bookId]/_components/empty-state.tsx`.
- `(app)/studio/[bookId]/_components/overflow-banner.tsx`.
- Specialized renderers: outline, character, notes, FM/BM, wiki-entry-editor (they all share the dark walnut card pattern).
- Modal surfaces: export-modal, keyboard cheatsheet, sprint-setup, confirm dialogs.
- The Collaboration Gutter (`components/hive/collab/*`).

### Phase 3 — feature integrity check

Verify every existing affordance still renders + is clickable + behaves identically:

- Binder: + Add menu (with all binder-item types), kebab menus, drag-and-drop, drag-into-folder, rename-on-double-click, active row marker, hive footer.
- Toolbar: every button — Bold/Italic/Underline/Strikethrough, Heading▾ dropdown, List▾ dropdown, Quote, HR, Undo, Redo, Highlight, Link, Align▾, Find (Cmd+F), History, Gutter, Theme, Preview, More▾.
- Metadata: status pills, word-goal inline edit, scene planner expand, publishing premium expand, stats.
- Status bar: save indicator, word count, word goal inline edit, sprint setup + active + finished states.
- Snapshot preview banner.
- Version history drawer.
- Cheatsheet modal.
- Find/replace strip.
- Writing analysis panel.
- Corkboard view + index cards.
- Focus mode toggle.
- Collaboration gutter (annotation + suggestion cards, filter strip, orphan section, reply input, accept/reject).
- Selection popover + Annotate/Suggest modals.
- Submission composer + review pages.
- Specialized editor surfaces (FM/BM, outline, character, notes, wiki entry).
- Empty states.

The mockup Chris saw omitted the binder "+ Add" tile for brevity. **It must remain in the refresh** along with every other current affordance.

### Phase 4 — verification

- Manual smoke: open `/studio/[bookId]` on a hive-linked book. Confirm every chrome surface renders correctly, gradients align, shadows aren't clipping, brand-yellow headings are present, body text reads white. Open every modal/overlay/drawer. Toggle Focus mode. Open the gutter. Approve a suggestion. Run the writing analysis.
- TypeScript: `npx tsc --noEmit` clean.
- Tests: all existing (424+) still pass — these are presentation-only changes, no test impact expected.

---

## Risks & Trade-offs

- **Gradient/shadow density adds GPU paint cost.** Should be fine on modern hardware but worth eyeballing the editor at 4K + 60fps scroll. If we see jank, drop the secondary shadow layer.
- **Brand-yellow on every heading is a strong palette commitment.** If Chris later wants a more neutral heading treatment, the rule is one-line CSS change (heading color → `--canvas-dark-ink-strong`).
- **Outer-panel gradient might compete with the cream prose canvas inside.** The plan separates the canvas frame from the cream paper surface — the cream paper sits in its own inset rectangle with its own shadow, visually distinct from the surrounding dark chrome.
- **DP1-DP4 tokens stay.** The new mid-stops + radius/shadow tokens are additive. Nothing is renamed or removed. Existing components that reference `--canvas-dark-100/-200/-300/-ink*` keep working until they're individually re-skinned.
- **Mockup → mechanical import workflow.** Claude Design will produce HTML using the tokens above. The import phase replaces inline styles with class references + the shared tokens; spot-check for drift.

---

## Out of Scope (Explicit)

- Hive pages and subpages (separate spec — next brainstorm).
- Light-mode chrome variant.
- New features or affordances.
- New animations beyond hover bumps.
- Changes to the cream prose surface (font, color, padding).
- Auth pages, landing page, /community feed, /discover, /settings — touched only if they share components with the studio chrome and the shared component changes.
- Iconography swap.
- Logo redesign.

---

## Acceptance

Studio editor visually matches the C-style stacked-iOS reference mockup at `.superpowers/brainstorm/29735-1780335541/content/full-editor.html`. Every current feature (binder + Add tile included) remains visible and operable. tsc clean. All 424+ tests still pass.
