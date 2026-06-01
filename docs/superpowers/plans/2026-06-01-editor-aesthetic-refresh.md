# Editor Aesthetic Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Draft
**Date:** 2026-06-01
**Scope:** Studio editor (`/studio/[bookId]`) chrome surfaces only. Hive routes deferred to a separate spec.

**Goal:** Re-skin every studio editor chrome surface to the warmer, cool-gray, iOS-modern stacked-depth aesthetic captured in the approved mockup `.superpowers/brainstorm/29735-1780335541/content/full-editor.html`, without changing any feature, affordance, or behavior, and without touching the cream prose canvas inside the chapter editor.

**Architecture:** Phase 1 lands the additive token layer (mid-stop colors, radius scale, depth shadows, hairline border) in `app/globals.css`. Phases 2-13 re-skin one surface area per task using only the new tokens — backgrounds become vertical gradients, corners adopt the radius scale, every panel gains the `--sh-card` stacked shadow, brand-yellow is applied to all chrome headings. Phase 14 walks the spec's feature-integrity checklist; Phase 15 lands docs + ship commit. No DB changes, no new components, no test churn — presentation-only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (CSS variables), shadcn/ui primitives, lucide-react, TipTap (untouched). Tests: vitest (424+ existing; must stay green).

**Reference precedents (tone, granularity, code-block density):**
- [`docs/superpowers/plans/2026-05-29-h3-collab-core.md`](2026-05-29-h3-collab-core.md)
- [`docs/superpowers/plans/2026-05-29-h2-mirror-model.md`](2026-05-29-h2-mirror-model.md)

**Spec:** [`docs/superpowers/specs/2026-06-01-editor-aesthetic-refresh-design.md`](../specs/2026-06-01-editor-aesthetic-refresh-design.md)
**Mockup:** [`.superpowers/brainstorm/29735-1780335541/content/full-editor.html`](../../../.superpowers/brainstorm/29735-1780335541/content/full-editor.html)

---

## Approach

This is **presentation-only**. No new features, no IA changes, no behavior changes, no schema changes, no new components, no test changes. Every task re-skins a bounded surface area by:

1. Swapping flat `bg-*` Tailwind classes / inline `background: var(--canvas-dark-200)` fills for vertical gradients composed from the new mid-stops.
2. Replacing tight `rounded-md` / arbitrary radii with the new `--r-card` / `--r-row` / `--r-btn` / `--r-pill` scale.
3. Adding `box-shadow: var(--sh-card)` (or `--sh-tile` / `--sh-inset`) and `border: var(--br-card)` (hairline top-edge highlight) to every chrome surface.
4. Applying `color: var(--brand)` to every h1 / h2 / h3 / panel-title / chapter-title in chrome.
5. Preserving the **cream prose surface** (paper-100 bg, Newsreader serif, paper-ink text) inside the chapter canvas exactly as-is — it sits in its own inset frame inside the new dark chrome panel.

Brand-yellow stays restrained per the spec's usage map (12 sanctioned uses). Every other affordance — including the binder "+ Add" tile Chris flagged as omitted from the mockup — remains visible and operable. The full 424+ test suite is expected to pass unchanged.

---

## Pre-flight Findings

Verified by direct reads + grep against `main` at HEAD = `0d216f8`.

### A. DP1-DP4 tokens are additive-compatible

`app/globals.css` already defines `--canvas-dark-100`, `-150`, `-200`, `-300`, `-ink-muted`, `-ink`, `-ink-strong`, `--paper-50..400`, `--paper-ink*`, `--brand`, `--brand-hover`, `--brand-active`, `--brand-ink`, `--brand-soft`, plus `--r-xs..2xl` and `--r-full`. The new tokens (`--canvas-dark-250`, `-350`, `-400`, `--r-card`, `--r-row`, `--r-btn`, `--r-pill`, `--r-nav`, `--sh-card`, `--sh-tile`, `--sh-inset`, `--br-card`) are **additive** — no rename, no delete. The existing `--canvas-dark-150` is currently `oklch(0.275 0.003 256)`; the spec value is `oklch(0.275 0.003 256)` — identical. The existing `--canvas-dark-200` is `oklch(0.290 0.003 256)`; the spec value is `oklch(0.295 0.003 256)` — T1 updates the value to match the spec (delta is one perceptual step, no consumer breaks). Existing components that reference DP1-DP4 tokens keep working until they're individually re-skinned by Tasks 2-13.

### B. Scoped ProseMirror styling is load-bearing per renderer

`globals.css:405` declares `.ProseMirror { color: var(--canvas-dark-ink) }` — designed for the chapter editor's lifted-cream-paper canvas (where `paper-ink` overrides it via `chapter-editor.tsx` styled child). Specialized renderers (notes, wiki entry, character) sit on dark walnut cards and need their own scoped `[data-slot="X-pane"] .ProseMirror { color: ... }` block. The H2 wiki-entry-editor + notes pattern is the precedent — T10 follows it.

### C. H3 collaboration gutter is load-bearing today

`components/hive/collab/` ships `annotation-card.tsx`, `suggestion-card.tsx`, `gutter-filter-strip.tsx`, `orphan-section.tsx`, `collaboration-gutter.tsx`, `selection-popover.tsx`, `annotate-modal.tsx`, `suggest-modal.tsx`. The collaboration gutter mounts inside the studio editor (`chapter-editor.tsx`) for hive-linked books. T11 re-skins these eight files together because they share the card pattern. The annotation/suggestion layer-color palette stays unchanged (per-layer oklch values are brand-independent).

### D. Cream prose surface must NOT change

Spec is explicit: "the cream paper prose surface inside the editor canvas is preserved as-is." T5 re-skins only the **outer wrapper / frame** of the chapter canvas (the dark panel that contains the paper sheet) — not the paper sheet itself, not Newsreader, not paper-ink, not the inner prose padding. The paper sheet sits in its own inset rectangle with its own shadow; the dark frame around it gets the new card treatment.

### E. The binder "+ Add" tile must remain visible

Chris flagged this explicitly. The mockup omitted it for visual brevity. The current implementation lives in `binder-tree.tsx` (header + Add menu trigger) + `binder-add-menu.tsx` (dropdown content). T3 re-skins both files while preserving the `+ Add` trigger, the dropdown shape, and every binder item type in the menu (`Chapter`, `Part`, `Front Matter`, `Back Matter`, `Character`, `Wiki Entry ▸`, `Wiki Folder`, `Outline`, `Research Note`, `Research Folder`).

### F. Modals, drawers, banners share a pattern

`components/ui/dialog.tsx` is the shadcn primitive every modal (export, sprint setup, cheatsheet, ConfirmDialog) composes on. Re-skinning `dialog.tsx` content surface once in T8 cascades to all modals via the shared primitive. Drawers (`version-history-drawer.tsx`, `find-replace.tsx`) and banners (`snapshot-preview-banner.tsx`, `overflow-banner.tsx`) don't use `dialog.tsx` — they're per-file restyles in T9 / T12.

---

## Token Migration (T1) and Tasks (T2-T15)

No database changes. No new files except the plan doc itself (already at this path). Every other task modifies existing files only.

---

### Task 1: Token additions in `app/globals.css`

**Files:**
- Modify: `app/globals.css` (extend `:root` with new mid-stop colors, radius scale, depth shadows, hairline border token).

**Surfaces changed:** none yet — tokens are additive. After T1 the codebase still renders identically; T2-T13 consume the new tokens.

- [ ] **Step 1: Add new color mid-stops + update `--canvas-dark-200` to spec value**

Locate the `:root` block in `app/globals.css` (lines ~80-90 currently). Replace the existing `--canvas-dark-*` set with:

```css
  --canvas-dark-100: oklch(0.255 0.003 256);
  --canvas-dark-150: oklch(0.275 0.003 256);
  --canvas-dark-200: oklch(0.295 0.003 256);
  --canvas-dark-250: oklch(0.325 0.003 256);
  --canvas-dark-300: oklch(0.360 0.003 256);
  --canvas-dark-350: oklch(0.400 0.003 256);
  --canvas-dark-400: oklch(0.450 0.003 256);
  --canvas-dark-ink-muted:  oklch(0.680 0.003 256);
  --canvas-dark-ink:        oklch(0.880 0.003 256);
  --canvas-dark-ink-strong: oklch(0.965 0.003 256);
```

- [ ] **Step 2: Add radius scale tokens**

Add inside the same `:root` block, near the existing `--r-xs..2xl` declarations:

```css
  /* Aesthetic refresh radius scale */
  --r-card: 20px;   /* outer panels: binder, toolbar, canvas frame, metadata, status, modals */
  --r-row:  14px;   /* inset rows: binder rows, list items, inputs */
  --r-btn:  12px;   /* square-ish buttons: toolbar tiles, kebab buttons */
  --r-pill: 999px;  /* fully rounded: status pills, save indicator, premium badge, sprint button */
  --r-nav:  20px;   /* app nav bar */
```

- [ ] **Step 3: Add depth / shadow / border tokens**

Add inside the same `:root` block, after the radius scale:

```css
  /* Aesthetic refresh depth system */
  --sh-card:
    0 1px 0 oklch(1 0 0 / 0.06) inset,
    0 8px 24px oklch(0 0 0 / 0.35),
    0 2px 4px oklch(0 0 0 / 0.25);
  --sh-tile:
    0 1px 0 oklch(1 0 0 / 0.08) inset,
    0 1px 2px oklch(0 0 0 / 0.3);
  --sh-inset:
    inset 0 1px 2px oklch(0 0 0 / 0.2);
  --br-card: 0.5px solid oklch(1 0 0 / 0.04);
```

- [ ] **Step 4: Verify no consumer breaks**

Run:

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean. All 424+ tests pass (no runtime change — tokens are unused until T2+).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "style(editor): T1 — add aesthetic refresh token scale (colors, radius, depth)"
```

**Acceptance criteria:**
- `:root` declares `--canvas-dark-150` `-250` `-350` `-400` at the spec oklch values.
- `:root` declares `--r-card` `--r-row` `--r-btn` `--r-pill` `--r-nav` at the spec px values.
- `:root` declares `--sh-card` `--sh-tile` `--sh-inset` `--br-card`.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 1 of `docs/superpowers/plans/2026-06-01-editor-aesthetic-refresh.md`. Read the spec for the token values. Modify `app/globals.css` only. Run `npx tsc --noEmit` and `npm test`. Commit with the message in the plan.

---

### Task 2: App nav re-skin

**Files:**
- Modify: `app/[locale]/(app)/_components/app-nav.tsx`

**Surfaces changed:**
- Nav bar background → `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`
- Nav bar radius → `var(--r-nav)` (20px); container becomes a floating bar with horizontal margin instead of edge-to-edge
- Nav bar shadow → `var(--sh-card)`
- Nav bar border → `var(--br-card)` (hairline top-edge highlight)
- "beehive" wordmark → already `var(--brand)`, confirm Comfortaa weight 700
- Active nav link (current route) → `color: var(--brand)`
- Inactive nav links → `color: var(--canvas-dark-ink)`, hover → `color: var(--canvas-dark-ink-strong)`
- Avatar + dropdown trigger → `border-radius: var(--r-pill)`, `box-shadow: var(--sh-tile)`

- [ ] **Step 1: Replace the outer `<nav>` background and rounding**

Replace the existing `<nav>` element's Tailwind class set with an inline-style block that consumes the new tokens. Example shape:

```tsx
<nav
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-nav)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="mx-4 mt-3 h-14 flex items-center justify-between px-6"
>
  {/* existing children unchanged */}
</nav>
```

- [ ] **Step 2: Active link color + inactive hover**

Inside the nav's link list, set:

- Active link: `style={{ color: 'var(--brand)' }}` (apply via existing `isActive` branch).
- Inactive link: `className="text-[var(--canvas-dark-ink)] hover:text-[var(--canvas-dark-ink-strong)]"`.

- [ ] **Step 3: Avatar trigger pill**

The user avatar trigger (right side) gains `borderRadius: 'var(--r-pill)'` + `boxShadow: 'var(--sh-tile)'`.

- [ ] **Step 4: Manual verify**

Run `npm run dev`, open any (app) route, confirm the floating nav bar renders with the new gradient + shadow + rounding. Wordmark still brand-yellow, active link brand-yellow, inactive links readable.

- [ ] **Step 5: tsc + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/_components/app-nav.tsx"
git commit -m "style(editor): T2 — app nav aesthetic refresh"
```

**Acceptance criteria:**
- App nav renders as a floating rounded bar with the new gradient + shadow.
- Wordmark, active link both render brand-yellow.
- All existing menu items (Studio, Discover, Community, Sparks, profile menu) remain visible and clickable.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 2 of `docs/superpowers/plans/2026-06-01-editor-aesthetic-refresh.md`. Modify `app/[locale]/(app)/_components/app-nav.tsx` to apply the new token-driven gradient / radius / shadow. Preserve every existing link, the wordmark, the avatar dropdown trigger. Verify tsc + tests, then commit.

---

### Task 3: Binder panel + rows + add menu + hive footer

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-add-menu.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item-menu.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-hive-footer.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/wiki-category-picker.tsx` (modal — apply panel treatment)

**Surfaces changed:**
- Binder panel container → `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`, `border-radius: var(--r-card)`, `box-shadow: var(--sh-card)`, `border: var(--br-card)`
- Binder header title "Binder" → `color: var(--brand)`, Comfortaa, weight 700
- Binder rows (idle) → `border-radius: var(--r-row)`, transparent bg
- Binder rows (hover) → `background: linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`
- Binder rows (active) → `background: linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `box-shadow: var(--sh-tile)` + existing 2px brand-yellow left marker preserved
- Drag-target nest ring (existing brand-yellow halo from drop-rules) → preserved exactly as-is
- "+ Add" trigger in header → `color: var(--brand)`, weight 600, `border-radius: var(--r-btn)`, hover bg `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`
- Add menu dropdown → panel treatment (`--r-card`, `--sh-card`, gradient bg, `--br-card`)
- Add menu items → `border-radius: var(--r-row)`, hover bg `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`
- Item kebab menu → identical panel treatment to Add menu
- Hive footer → panel treatment + "Go to Hive" or "Create Hive" text in `color: var(--brand)` weight 600
- Wiki category picker modal → panel treatment (composes shadcn Dialog from T8)

- [ ] **Step 1: Binder panel container**

In `binder-tree.tsx`, locate the outermost wrapper `<aside>` / `<div>`. Replace its background / rounding / border with:

```tsx
<aside
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-hidden"
>
  {/* unchanged */}
</aside>
```

- [ ] **Step 2: Binder header title color**

In `binder-tree.tsx`, the header that reads "Binder" (book title) — apply:

```tsx
<h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-lg tracking-tight">
  {bookTitle}
</h2>
```

- [ ] **Step 3: Binder row gradient states**

In `binder-item.tsx`, locate the row container `<div>` (the one consuming `isActive` / drag state). Replace its bg / radius:

```tsx
<div
  style={{
    borderRadius: 'var(--r-row)',
    background: isActive
      ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
      : undefined,
    boxShadow: isActive ? 'var(--sh-tile)' : undefined,
  }}
  className="group relative flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]"
>
  {/* preserve: brand-yellow 2px left marker on active, drag rings, chapter status dot, icons, title, kebab */}
</div>
```

Preserve the existing brand-yellow left marker (2px wide, `bg-brand`) and the drag drop-zone rings (`ring-2 ring-brand bg-brand/20 shadow-[0_0_0_4px_oklch(from_var(--brand)_l_c_h_/_0.25)]`) untouched. Preserve the chapter status dot.

- [ ] **Step 4: "+ Add" trigger**

In `binder-tree.tsx`'s binder header right-side action area, the existing "+ Add" trigger button:

```tsx
<button
  onClick={() => setAddMenuOpen(true)}
  style={{ color: 'var(--brand)', borderRadius: 'var(--r-btn)' }}
  className="font-geist font-semibold text-sm px-2 py-1 hover:bg-[linear-gradient(180deg,var(--canvas-dark-350),var(--canvas-dark-300))]"
  aria-label="Add binder item"
>
  + Add
</button>
```

This tile **must remain visible** per the spec.

- [ ] **Step 5: Add menu dropdown surface**

In `binder-add-menu.tsx`, the dropdown root (the popover/menu container) applies the panel treatment:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="min-w-[240px] p-1 z-50"
>
  {/* section labels + items unchanged in structure */}
</div>
```

Items inside:

```tsx
<button
  style={{ borderRadius: 'var(--r-row)' }}
  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--canvas-dark-ink)] hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]"
>
  {icon}<span>{label}</span>
</button>
```

Every binder type (Chapter / Part / Front Matter / Back Matter / Character / Wiki Entry ▸ / Wiki Folder / Outline / Research Note / Research Folder) must remain in the menu.

- [ ] **Step 6: Kebab menu**

`binder-item-menu.tsx` — apply the same dropdown panel treatment as Step 5. Rename row, duplicate, delete (red) all preserved.

- [ ] **Step 7: Hive footer**

`binder-hive-footer.tsx` — panel treatment on the footer container, "Go to Hive" / "Create Hive" text in `color: var(--brand)` weight 600:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderTop: 'var(--br-card)',
    borderBottomLeftRadius: 'var(--r-card)',
    borderBottomRightRadius: 'var(--r-card)',
  }}
  className="px-3 py-3 flex items-center justify-center"
>
  <Link
    style={{ color: 'var(--brand)' }}
    className="flex items-center gap-2 font-geist font-semibold text-sm"
    href={hiveHref}
  >
    <Users className="w-4 h-4" />
    Go to Hive
  </Link>
</div>
```

- [ ] **Step 8: Wiki category picker modal panel treatment**

`wiki-category-picker.tsx` — the dialog content adopts panel treatment (gradient bg, `--r-card`, `--sh-card`, `--br-card`). Each of the 13 category cards keeps its existing `--wiki-*` accent tint but gains `border-radius: var(--r-row)` + `box-shadow: var(--sh-tile)`.

- [ ] **Step 9: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open `npm run dev`, navigate to any book in /studio. Confirm: binder reads as a single rounded panel with gradient bg, "+ Add" trigger brand-yellow and clickable, opening it shows the new dropdown surface, every binder type is present, kebab menu styled, hive footer brand-yellow CTA visible.

- [ ] **Step 10: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/"
git commit -m "style(editor): T3 — binder panel + rows + menus + hive footer aesthetic refresh"
```

**Acceptance criteria:**
- Binder panel renders as a single rounded card with the new gradient + shadow.
- Binder header title is brand-yellow Comfortaa.
- Active row has the lighter gradient + tile shadow + preserved 2px brand-yellow marker.
- Drag drop-zone indicators (before / after / nest) unchanged.
- "+ Add" trigger visible, brand-yellow, opens dropdown listing all 10 binder types.
- Kebab menu, add menu, wiki category picker, hive footer all panel-styled.
- All drag-and-drop, rename-on-dblclick, type filtering preserved.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 3 of `docs/superpowers/plans/2026-06-01-editor-aesthetic-refresh.md`. Re-skin all six binder files. Critical: the "+ Add" trigger MUST remain visible and operable (the mockup omitted it; Chris flagged this). Preserve every binder type in the add menu, all drag-and-drop drop-zone indicators, the brand-yellow active row marker, and the chapter status dot. Run tsc + tests + manual visual check, then commit.

---

### Task 4: Editor toolbar

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

**Surfaces changed:**
- Toolbar container → `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`, `border-radius: var(--r-card)`, `box-shadow: var(--sh-card)`, `border: var(--br-card)`
- Toolbar tiles (idle) → `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`, `border-radius: var(--r-btn)`, `box-shadow: var(--sh-tile)`, icon color `var(--canvas-dark-ink-strong)`
- Toolbar tiles (hover) → `linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))`
- Toolbar tiles (active) → `background: var(--brand)`, icon color `var(--brand-ink)` (solid brand-yellow per spec rule 4)
- Dropdown menus (Heading▾, List▾, Align▾, More▾) → panel treatment (gradient bg, `--r-card`, `--sh-card`)
- Spacer between FORMAT zone and STATUS / VIEW zone unchanged

- [ ] **Step 1: Container surface**

Outer `<div>` of the toolbar:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex items-center gap-1 px-3 py-2"
>
  {/* three zones unchanged */}
</div>
```

- [ ] **Step 2: Shared `tbtnClass()` helper update**

The existing `tbtnClass()` helper (or its equivalent inline className) for the 30×30 tile must produce these states. Replace its body:

```ts
const tbtnClass = (active: boolean) =>
  active
    ? 'w-[30px] h-[30px] flex items-center justify-center text-[var(--brand-ink)]'
    : 'w-[30px] h-[30px] flex items-center justify-center text-[var(--canvas-dark-ink-strong)]'
```

Apply inline style for the gradient + radius + shadow:

```tsx
<button
  className={tbtnClass(isActive)}
  style={{
    borderRadius: 'var(--r-btn)',
    background: isActive
      ? 'var(--brand)'
      : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  }}
  onMouseEnter={(e) => {
    if (!isActive) e.currentTarget.style.background = 'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))'
  }}
  onMouseLeave={(e) => {
    if (!isActive) e.currentTarget.style.background = 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
  }}
  aria-label={label}
>
  {icon}
</button>
```

(Or — simpler — wire hover via a CSS rule on `[data-toolbar-tile]:not([data-active="true"]):hover`. Pick whichever the existing file already prefers and stay consistent.)

- [ ] **Step 3: Dropdown panel treatment**

For Heading▾, List▾, Align▾, More▾, History (when popover), Theme dropdown — each popover/dropdown content gets the same panel treatment from T3 Step 5.

- [ ] **Step 4: Every existing button preserved**

Per the spec Phase 3 checklist, every one of these must remain in the toolbar:

- FORMAT zone: Bold, Italic, Underline, Strikethrough, Heading▾, List▾, Quote, HR, Highlight, Link, Align▾
- STATUS / center spacer
- VIEW zone: Undo, Redo, Find (Cmd+F), History, Gutter, Theme (Sun/Moon), Preview (Eye), More▾, Help (HelpCircle)

Walk the file diff and confirm every `<button>` survives the re-skin.

- [ ] **Step 5: tsc + tests + visual**

```bash
npx tsc --noEmit
npm test
```

Open the studio editor on a chapter binder item. Confirm every toolbar button is present, clickable, and Bold/Italic/etc. apply / unapply correctly. Active button is solid brand-yellow.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "style(editor): T4 — editor toolbar aesthetic refresh"
```

**Acceptance criteria:**
- Toolbar reads as a rounded panel with new gradient + shadow.
- Every existing tile is present (count matches pre-task).
- Idle tiles use the inset tile gradient + tile shadow.
- Active tile is solid brand-yellow with brand-ink icon.
- All dropdowns open with the new panel surface.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 4. Modify only `editor-toolbar.tsx`. Critical: preserve every toolbar button (count buttons before and after — must match). Apply the new tile gradient + active brand-yellow state per the plan. Confirm Heading/List/Align/More dropdowns open with the new panel surface. Run tsc + tests, then commit.

---

### Task 5: Chapter canvas wrapper (NOT the cream prose surface)

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (outer wrapper only)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/corkboard-or-editor.tsx` (the inline `<style>` injection that owns the cream surface — touch only the outer dark frame, leave the paper rules intact)

**Surfaces changed:**
- Dark frame around the prose paper → `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`, `border-radius: var(--r-card)`, `box-shadow: var(--sh-card)`, `border: var(--br-card)`
- Chapter title inside the canvas → `color: var(--brand)` (Comfortaa, large)
- Cream paper surface itself (paper-100 bg, paper-ink text, Newsreader serif, prose padding) → **UNCHANGED**

- [ ] **Step 1: Outer wrapper**

In `chapter-editor.tsx`, locate the outermost wrapper around the editor body (the dark area surrounding the paper sheet — NOT the `[data-editor-theme="light"]` styled inner surface). Apply:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex-1 flex flex-col overflow-hidden"
>
  {/* existing inner paper sheet untouched */}
</div>
```

- [ ] **Step 2: Chapter title color**

The h1 / title element at the top of the prose (above the TipTap editor instance, the editable chapter title): set `color: var(--paper-ink-strong)` when on cream paper (existing behavior). On the dark-mode editor canvas, set `color: var(--brand)`. Use the existing `editorTheme === 'light'` branch.

- [ ] **Step 3: Verify cream paper unchanged**

Search `corkboard-or-editor.tsx` for any reference to `--paper-100` / `--paper-ink`. **Do not modify these rules.** Touch only the outer dark frame.

- [ ] **Step 4: Visual check — paper sheet inside dark frame**

Open the studio editor, type prose. Confirm:
- Outer dark frame visibly rounded + shadowed.
- Cream paper sheet visibly inset inside the dark frame.
- Newsreader serif body in `var(--paper-ink)`.
- Chapter title brand-yellow on dark / paper-ink-strong on light, same as before for the cream branch.

- [ ] **Step 5: tsc + tests**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/corkboard-or-editor.tsx"
git commit -m "style(editor): T5 — chapter canvas frame aesthetic refresh (cream paper unchanged)"
```

**Acceptance criteria:**
- Dark frame renders with new gradient + shadow + rounding.
- Cream paper sheet, Newsreader font, paper-ink prose text — pixel-identical to pre-task.
- Chapter title brand-yellow on dark theme.
- All TipTap behaviors (autosave, word count, snapshot throttle, mark application) unchanged.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 5. Modify only the OUTER dark frame around the prose paper in `chapter-editor.tsx` and `corkboard-or-editor.tsx`. DO NOT touch the cream paper surface, Newsreader font rule, paper-ink prose color, or any `[data-editor-theme="light"]` style block. Verify in a running dev server that the paper sheet looks identical. Run tsc + tests, commit.

---

### Task 6: Status bar (save indicator + word count + word goal + sprint controls)

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx`

**Surfaces changed:**
- Status bar container → outer-panel gradient, `--r-card`, `--sh-card`, `--br-card`
- Save status pill → `--r-pill`, off-green tint (existing `oklch(0.85 0.13 165)` text on `0.20`-alpha track) preserved; brand-yellow dot only when unsaved
- Word count text → `var(--canvas-dark-ink-muted)`, JetBrains Mono
- Word goal inline-edit input → `--r-pill`, `var(--sh-inset)`, transparent bg, `color: var(--canvas-dark-ink-strong)`
- Word goal progress fill → `var(--brand)`
- Sprint controls (idle button + active timer + finished pulse) → `--r-pill`, idle bg `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))`, finished pulse already in `@keyframes sprintFinished` — preserved

- [ ] **Step 1: Container surface**

Outer wrapper of the status bar:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex items-center justify-between gap-4 px-4 py-2"
>
  {/* three clusters */}
</div>
```

- [ ] **Step 2: Save status pill**

The save pill (Saved / Saving... / Unsaved):

```tsx
<div
  style={{ borderRadius: 'var(--r-pill)' }}
  className="flex items-center gap-2 px-3 py-1 bg-[oklch(0.85_0.13_165_/_0.20)] text-[oklch(0.85_0.13_165)] text-xs font-jetbrains-mono"
>
  {isUnsaved && <span style={{ background: 'var(--brand)' }} className="w-1.5 h-1.5 rounded-full" />}
  <span>{saveLabel}</span>
</div>
```

Brand-yellow dot only when unsaved. Pill text is off-green per the spec.

- [ ] **Step 3: Word count + word goal**

Word count: `<span className="font-jetbrains-mono text-xs text-[var(--canvas-dark-ink-muted)]">{count} words</span>`

Word goal inline input wrapper:

```tsx
<div
  style={{ borderRadius: 'var(--r-pill)', boxShadow: 'var(--sh-inset)' }}
  className="flex items-center gap-1 px-2 py-1 bg-transparent"
>
  <input
    type="number"
    style={{ color: 'var(--canvas-dark-ink-strong)' }}
    className="w-12 bg-transparent text-xs font-jetbrains-mono outline-none"
  />
  <span className="text-[var(--canvas-dark-ink-muted)] text-xs">target</span>
</div>
```

Progress fill on the right-side bar (if shown inline): `background: var(--brand)`.

- [ ] **Step 4: Sprint controls**

In `sprint-controls.tsx`, the idle button:

```tsx
<button
  style={{
    borderRadius: 'var(--r-pill)',
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  }}
  className="flex items-center gap-2 px-3 py-1 text-xs text-[var(--canvas-dark-ink-strong)] font-jetbrains-mono"
>
  <Timer className="w-3.5 h-3.5" />
  Start sprint
</button>
```

Active sprint timer + finished pulse-glow (`@keyframes sprintFinished`) — preserved untouched.

- [ ] **Step 5: tsc + tests + visual**

Open studio editor. Confirm: pill at left says Saved/Saving/Unsaved with off-green color, word count + goal in mono, sprint button on the right with new pill treatment. Type a character — pill flips to Unsaved with brand-yellow dot. Wait for autosave — pill flips back.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx"
git commit -m "style(editor): T6 — status bar aesthetic refresh"
```

**Acceptance criteria:**
- Status bar is a rounded card with new gradient + shadow.
- Save pill renders off-green with brand-yellow dot only when unsaved.
- Word count + word goal preserved and inline-editable.
- Sprint setup popover, active timer, finished pulse all preserved.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 6. Modify editor-status-bar.tsx and sprint-controls.tsx. Preserve save pill off-green color, the sprintFinished CSS keyframe, the inline word-goal edit, and the sprint setup popover behavior. Run tsc + tests, commit.

---

### Task 7: Metadata panel

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`

**Surfaces changed:**
- Metadata panel container → outer-panel gradient, `--r-card`, `--sh-card`, `--br-card`
- Section labels (Status / Word Goal / Scene Planner / Publishing / Stats) → `color: var(--brand)`, Comfortaa, weight 700, uppercase / small-caps preserved
- Status pills (FIRST_DRAFT / DRAFTING / REVISED / FINAL / SECOND_DRAFT — or whatever the 5 statuses) → idle `--r-pill` + `--sh-tile` + per-status `--status-*` tinted bg at 0.18 alpha; active pill: solid `--status-X` bg + `--brand-ink` text (per spec rule 5 — active uses brand-yellow ONLY for the publish-ready threshold pill if applicable; otherwise active status uses the status-color itself)
- Status pill subtitle ("Visible to readers" / "Not visible to readers") → preserved
- Word goal input (in metadata) → `--r-row` + `--sh-inset`
- Word goal progress bar → track `--sh-inset`, fill `var(--brand)`
- Scene planner expand chevrons → unchanged (lucide ChevronRight)
- Publishing premium expand → premium badge `--r-pill` + `background: var(--brand)` + `--brand-ink` text (spec rule 6)
- Stats cluster → JetBrains Mono in `--canvas-dark-ink-muted`

- [ ] **Step 1: Container surface**

```tsx
<aside
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col gap-6 p-4 overflow-y-auto"
>
  {/* sections */}
</aside>
```

- [ ] **Step 2: Section labels in brand**

Every section header (Status / Word Goal / Scene Planner / Publishing / Stats):

```tsx
<h3 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-sm uppercase tracking-wider">
  {label}
</h3>
```

- [ ] **Step 3: Status pills**

Re-skin the status pill row (5 statuses). Each pill:

```tsx
<button
  style={{
    borderRadius: 'var(--r-pill)',
    boxShadow: 'var(--sh-tile)',
    background: isActive
      ? `var(--status-${slug})`
      : `oklch(from var(--status-${slug}) l c h / 0.18)`,
    color: isActive ? 'var(--brand-ink)' : `var(--status-${slug})`,
  }}
  className="px-3 py-1.5 text-xs font-geist font-semibold flex flex-col items-center"
>
  <span>{label}</span>
  <span style={{ color: isActive ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)' }} className="text-[9px] font-jetbrains-mono mt-0.5">
    {visibleSubtitle}
  </span>
</button>
```

- [ ] **Step 4: Word goal + progress**

```tsx
<input
  style={{ borderRadius: 'var(--r-row)', boxShadow: 'var(--sh-inset)', color: 'var(--canvas-dark-ink-strong)' }}
  className="w-full bg-transparent px-3 py-2 font-jetbrains-mono text-sm outline-none"
  type="number"
/>

<div style={{ borderRadius: 'var(--r-pill)', boxShadow: 'var(--sh-inset)' }} className="h-2 bg-[var(--canvas-dark-100)] overflow-hidden">
  <div style={{ background: 'var(--brand)', width: `${pct}%` }} className="h-full" />
</div>
```

- [ ] **Step 5: Scene planner section**

Section unchanged structurally — section label brand-yellow per Step 2; ChevronRight icons in `var(--canvas-dark-ink-muted)`; expanded list items use `--r-row` + transparent bg + hover gradient.

- [ ] **Step 6: Publishing section + Premium badge**

```tsx
<span
  style={{
    background: 'var(--brand)',
    color: 'var(--brand-ink)',
    borderRadius: 'var(--r-pill)',
  }}
  className="px-2 py-0.5 text-[10px] font-geist font-bold uppercase tracking-wide flex items-center gap-1"
>
  <Sparkles className="w-3 h-3" />
  Premium
</span>
```

- [ ] **Step 7: Stats cluster**

Word count, chapter count, etc. — JetBrains Mono, `color: var(--canvas-dark-ink-muted)`, no background.

- [ ] **Step 8: tsc + tests + visual**

Open studio editor on a chapter. Confirm: panel reads as a rounded card, every section label is brand-yellow Comfortaa, status pills are tinted with their status color, active status pill is solid status color, premium badge solid brand-yellow. Inline-edit word goal works. Scene planner expand works.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx"
git commit -m "style(editor): T7 — metadata panel aesthetic refresh"
```

**Acceptance criteria:**
- Metadata panel is a rounded card with new gradient + shadow.
- Every section header brand-yellow Comfortaa.
- Status pills tinted with status colors, active pill solid.
- Word goal inline-editable; progress fill brand-yellow.
- Scene planner expand/collapse preserved.
- Premium badge solid brand-yellow.
- All 5 sections still render.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 7. Modify metadata-panel.tsx only. Preserve all 5 sections (Status / Word Goal / Scene Planner / Publishing / Stats), the inline word-goal edit, the scene-planner expand, the publishing premium gate. Run tsc + tests, commit.

---

### Task 8: Modals (export, keyboard cheatsheet, sprint setup, ConfirmDialog primitive)

**Files:**
- Modify: `components/ui/dialog.tsx` (the shadcn primitive — apply panel treatment to DialogContent)
- Modify: `components/ui/confirm-dialog.tsx` (verify it inherits cleanly)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/keyboard-cheatsheet.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx` (sprint setup popover — already touched in T6; re-confirm modal-style affordance)
- Modify: any export modal file under studio (search the editor directory for "export-modal" or the export modal trigger — current location is in the editor toolbar's More menu)

**Surfaces changed:**
- DialogContent → outer-panel gradient, `--r-card`, `--sh-card`, `--br-card`
- Backdrop overlay → `oklch(0 0 0 / 0.5)` (existing behavior preserved)
- DialogTitle / DialogHeader text → `color: var(--brand)`, Comfortaa weight 700
- DialogClose X → `color: var(--canvas-dark-ink-muted)`, hover `var(--canvas-dark-ink-strong)`
- Cheatsheet kbd caps → preserve the 4-layer paper-key shadow stack (existing pattern); apply `--r-btn` for radius
- Sprint setup popover (260px anchored popover with 45° callout tail) → panel treatment + `--r-card`

- [ ] **Step 1: Re-skin DialogContent in `components/ui/dialog.tsx`**

Locate the `DialogContent` component in `dialog.tsx`. Replace its className / style to apply:

```tsx
const DialogContent = React.forwardRef<...>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close style={{ color: 'var(--canvas-dark-ink-muted)' }} className="absolute right-4 top-4 hover:text-[var(--canvas-dark-ink-strong)]">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
```

- [ ] **Step 2: DialogTitle in brand**

```tsx
const DialogTitle = React.forwardRef<...>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    style={{ color: 'var(--brand)' }}
    className={cn('font-comfortaa font-bold text-lg', className)}
    {...props}
  />
))
```

- [ ] **Step 3: ConfirmDialog inherits**

`components/ui/confirm-dialog.tsx` consumes `Dialog` + `DialogContent`. No edits needed beyond ensuring its destructive button keeps its `--destructive` color. Verify by reading the file.

- [ ] **Step 4: Keyboard cheatsheet kbd caps + section labels**

In `keyboard-cheatsheet.tsx`, set:

- Section headers ("Editor", "Navigation", "Format", "Sprint") → `color: var(--brand)`, Comfortaa.
- `<kbd>` raised paper-key caps: `border-radius: var(--r-btn)`, preserve the existing 4-layer shadow stack.

- [ ] **Step 5: Sprint setup popover**

In `sprint-controls.tsx`, the popover content (260px anchored — Duration tiles + Set goal):

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="w-[260px] p-4"
>
  {/* duration tiles 5/15/30 + custom — each tile gets --r-btn + tile gradient */}
</div>
```

Each duration tile:

```tsx
<button
  style={{
    borderRadius: 'var(--r-btn)',
    background: selected ? 'var(--brand)' : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    color: selected ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-strong)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="py-2 font-jetbrains-mono text-xs"
>
  {minutes}m
</button>
```

- [ ] **Step 6: Export modal**

Locate the export modal (search the editor directory — it's the format picker with format + sub-preset selectors). Its DialogContent inherits panel treatment from Step 1; verify the format buttons get `--r-btn` + tile gradient.

- [ ] **Step 7: tsc + tests + visual**

Open: Ctrl+/ (cheatsheet), the More menu Export, Sprint button (Sprint setup popover), trigger any delete confirmation. All four surfaces should render with the new panel treatment.

- [ ] **Step 8: Commit**

```bash
git add "components/ui/dialog.tsx" "components/ui/confirm-dialog.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/keyboard-cheatsheet.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/sprint-controls.tsx"
git commit -m "style(editor): T8 — modals + cheatsheet + sprint setup aesthetic refresh"
```

**Acceptance criteria:**
- Every modal (export, cheatsheet, sprint setup, ConfirmDialog, wiki category picker from T3) renders with the panel treatment.
- DialogTitle is brand-yellow Comfortaa.
- Cheatsheet kbd caps retain the 4-layer paper-key shadow.
- Sprint setup popover has the new card + duration tiles.
- All modal close affordances (X button, Esc, click-outside) work.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 8. Modify the four files. Critical: the change to `components/ui/dialog.tsx` cascades to every modal in the app — verify with a manual sweep that no modal is visually broken (run dev server, open each modal in studio). Run tsc + tests, commit.

---

### Task 9: Drawers (version history) + find/replace strip + collaboration gutter chrome

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/find-replace.tsx`
- Modify: `components/hive/collab/collaboration-gutter.tsx` (chrome of the gutter — the cards themselves come in T11)

**Surfaces changed:**
- Version history drawer container → outer-panel gradient + `--r-card` + `--sh-card` + `--br-card`
- Drawer title "Version history" → `color: var(--brand)`, Comfortaa
- Snapshot row (idle) → `--r-row` + transparent bg, hover gradient
- Snapshot row (active) → tile gradient + `--sh-tile` + 2px brand-yellow left accent (preserved from DP4)
- Free-tier upsell card inside the drawer → existing radial brand gradient preserved; container `--r-card` + `--sh-card`
- Find/replace strip → panel treatment but slim (height matches existing 40-44px); inputs use `--r-row` + `--sh-inset` + paper-context bridge preserved (paper-50 input bg, paper-ink-strong text — existing behavior)
- Collaboration gutter container → outer-panel gradient + `--r-card` + `--sh-card`

- [ ] **Step 1: Version history drawer chrome**

```tsx
<aside
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-hidden"
>
  <header className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: 'var(--br-card)' }}>
    <h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold">Version history</h2>
    {/* close X */}
  </header>
  {/* snapshot rows */}
</aside>
```

Snapshot row:

```tsx
<button
  style={{
    borderRadius: 'var(--r-row)',
    background: isActive
      ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
      : undefined,
    boxShadow: isActive ? 'var(--sh-tile)' : undefined,
    borderLeft: isActive ? '2px solid var(--brand)' : '2px solid transparent',
  }}
  className="w-full text-left px-3 py-2 hover:bg-[linear-gradient(180deg,var(--canvas-dark-250),var(--canvas-dark-200))]"
>
  {/* timestamp + word count */}
</button>
```

Free-tier upsell card untouched (radial brand gradient + Sparkles + Upgrade CTA preserved).

- [ ] **Step 2: Find/replace strip**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex items-center gap-2 px-3 py-2"
>
  <input
    style={{ borderRadius: 'var(--r-row)', boxShadow: 'var(--sh-inset)', background: 'var(--paper-50)', color: 'var(--paper-ink-strong)' }}
    className="flex-1 px-3 py-1.5 text-sm outline-none font-geist"
    placeholder="Find"
  />
  {/* replace input + match count + close */}
</div>
```

Paper-context bridge preserved (paper-50 input bg, paper-ink-strong text).

- [ ] **Step 3: Collaboration gutter chrome**

```tsx
<aside
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full w-[360px] overflow-hidden"
>
  {/* filter strip from T11 + scrollable cards list + orphan section */}
</aside>
```

The cards inside come in T11; T9 only does the chrome.

- [ ] **Step 4: tsc + tests + visual**

Open the History drawer, the Find/replace strip (Cmd+F), and the Collaboration gutter on a hive-linked book. Each should render with the new panel treatment.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/find-replace.tsx" "components/hive/collab/collaboration-gutter.tsx"
git commit -m "style(editor): T9 — drawers + find/replace + gutter chrome aesthetic refresh"
```

**Acceptance criteria:**
- Version history drawer renders with new panel treatment; snapshot rows use new row treatment.
- Find/replace strip renders with new panel treatment; paper-50 input bg preserved.
- Collaboration gutter chrome renders with new panel treatment.
- Premium upsell card inside the drawer unchanged in visual treatment.
- Restore-snapshot preview flow still works.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 9. Touch only the three files. Preserve the find/replace paper-context input bridge, the snapshot preview gate, the premium upsell card's radial brand gradient. Verify in dev. Run tsc + tests, commit.

---

### Task 10: Specialized renderers (outline / character / notes / FM-BM / wiki entry)

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-entry-editor.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/wiki-folder-renderer.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/character-profile.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/container-view.tsx` (folder/container renderer)
- Modify outline files under `app/[locale]/(app)/studio/[bookId]/_components/outline/` — specifically `outline-board.tsx` and any beat row component
- Modify Notes renderer (NoteEditor — located in same `_components/editor/` or a sibling — locate via grep on `NoteEditor`)
- Modify Front Matter / Back Matter renderers — `page-wrapper.tsx` + the 5 subtype components (title-page, copyright, dedication, acknowledgments, about-author) — located under a `_components/editor/front-back-matter/` folder or similar; locate via grep on `PageWrapper`

**Surfaces changed:**
- Outer pane of each specialized renderer → outer-panel gradient + `--r-card` + `--sh-card` + `--br-card`
- Section headers (per H2 wiki-entry-editor convention: breadcrumb + category pill + title) → brand-yellow Comfortaa for the renderer title
- Content cards inside (e.g. character sections, outline beats, notes pinned-grid) → `--r-row` + `--sh-tile` + tile gradient
- Cream-paper sub-surfaces (FM/BM PageWrapper paper sheets) → **UNCHANGED** (same as T5 rule for the chapter editor)
- Scoped `[data-slot="X-pane"] .ProseMirror` color rules already in place from H2 — verify they consume `var(--canvas-dark-ink)` not the default

- [ ] **Step 1: Wiki entry editor pane**

In `wiki-entry-editor.tsx`, outer wrapper:

```tsx
<div
  data-slot="wiki-entry-pane"
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-hidden p-6"
>
  {/* breadcrumb + category pill + contenteditable title + tag strip + TipTap body */}
</div>
```

The H2 scoped ProseMirror rule (`[data-slot="wiki-entry-pane"] .ProseMirror { color: var(--canvas-dark-ink) }` etc.) — preserve.

- [ ] **Step 2: Wiki folder renderer**

Same panel treatment with `data-slot="wiki-folder-pane"`. Children grid cards: `--r-row` + `--sh-tile` + tile gradient.

- [ ] **Step 3: Character profile pane**

```tsx
<div
  data-slot="character-pane"
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-y-auto p-6"
>
  {/* identity header card → paper-100 cream sheet (UNCHANGED), then 6 sections separated by sheet-rule */}
</div>
```

The cream "sheet" inside (paper-100 bg from `--sheet-canvas` in light mode) — preserved untouched.

- [ ] **Step 4: Outline board pane**

In `outline-board.tsx`, outer wrapper:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-y-auto p-6"
>
  {/* act group headers → brand-yellow Comfortaa; beat rows → --r-row + tile gradient */}
</div>
```

Each beat row:

```tsx
<div
  style={{
    borderRadius: 'var(--r-row)',
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
  }}
  className="flex items-center gap-3 px-3 py-2"
>
  {/* drag handle + title contenteditable + status pill + chapter-link */}
</div>
```

Status pill on each beat (idea / drafting / done) — keep existing `--status-*` tinted colors, apply `--r-pill`.

- [ ] **Step 5: Notes pane**

Locate the NoteEditor file (likely `app/[locale]/(app)/studio/[bookId]/_components/editor/note-editor.tsx` — grep to confirm). Apply:

```tsx
<div
  data-slot="note-pane"
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-y-auto p-6"
>
  {/* paper-100 note sheet INSIDE — preserved */}
</div>
```

The paper-100 sheet inside (the actual writing surface) preserved exactly. Scoped `.ProseMirror` color rule preserved.

- [ ] **Step 6: FM/BM PageWrapper + 5 subtype previews**

In the `PageWrapper` shared component, the surrounding pane wrapping the cream paper sheet:

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex justify-center p-12 overflow-y-auto"
>
  {/* cream paper page sheet (paper-100 bg, paper-ink text) — UNCHANGED */}
</div>
```

The 5 subtype components (title-page, copyright, dedication, acknowledgments, about-author) themselves render onto cream paper — UNCHANGED.

- [ ] **Step 7: Container view (parts / folders)**

`container-view.tsx` — apply the same outer-panel treatment. Children grid cards `--r-row` + tile gradient.

- [ ] **Step 8: tsc + tests + visual**

Open each specialized renderer in turn:
- Click a wiki entry binder item — wiki entry editor pane renders.
- Click a wiki folder — folder renderer renders.
- Click a character — character profile renders.
- Click an outline — outline board renders with act grouping.
- Click a research note — note editor renders.
- Click a front-matter title-page — PageWrapper + title-page preview renders.
- Click a part / research folder — container view renders.

Every renderer should show the new outer panel + preserved inner surface.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/" "app/[locale]/(app)/studio/[bookId]/_components/outline/"
git commit -m "style(editor): T10 — specialized renderers aesthetic refresh"
```

**Acceptance criteria:**
- Every specialized renderer (wiki entry, wiki folder, character, outline, note, FM, BM, container) renders the new outer panel.
- Cream paper sub-surfaces (FM/BM page sheets, note paper, character identity card) preserved.
- Scoped ProseMirror color rules preserved.
- All renderer-specific behaviors (save debounce, tag strip, beat dnd, status cycling, chapter-link popover) unchanged.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 10. Modify every specialized renderer file. Critical: do NOT touch the cream paper sub-surfaces (FM/BM page sheets, note paper, character identity card cream sheet). Only re-skin the outer dark frame. Preserve scoped `[data-slot="X-pane"] .ProseMirror` color rules. Grep for `data-slot=` to find the pane wrappers. Run tsc + tests, commit.

---

### Task 11: Collaboration gutter cards + filter strip + orphan section

**Files:**
- Modify: `components/hive/collab/annotation-card.tsx`
- Modify: `components/hive/collab/suggestion-card.tsx`
- Modify: `components/hive/collab/gutter-filter-strip.tsx`
- Modify: `components/hive/collab/orphan-section.tsx`
- Modify: `components/hive/collab/selection-popover.tsx`
- Modify: `components/hive/collab/annotate-modal.tsx` (inherits Dialog from T8 — verify only)
- Modify: `components/hive/collab/suggest-modal.tsx` (same)

**Surfaces changed:**
- Annotation card → `--r-row` + tile gradient + `--sh-tile` + per-layer left-edge accent (existing per-layer oklch — preserved)
- Suggestion card → same treatment + diff rendering (- old + new) preserved
- Filter strip → `--r-pill` chips, idle: tile gradient; active: solid `--brand` bg + `--brand-ink` text
- Orphan section → small panel-within-panel with the same gradient, `--r-row`, slight `--sh-tile`
- Selection popover (floating mini-toolbar that appears on text selection in hive editor) → panel treatment + `--r-card` + `--sh-card`
- Annotate / Suggest modals → inherit Dialog from T8

- [ ] **Step 1: Annotation card**

```tsx
<article
  style={{
    borderRadius: 'var(--r-row)',
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    boxShadow: 'var(--sh-tile)',
    borderLeft: `3px solid var(--annot-layer-${layer.toLowerCase()})`,
  }}
  className="p-3 flex flex-col gap-2"
>
  {/* avatar + author + layer label + relTime, then quoted text, then body, then resolve button + reply count */}
</article>
```

Per-layer color tokens (annot-layer-grammar, plot, tone, continuity, general) — preserved.

- [ ] **Step 2: Suggestion card**

Same shape. Diff rendering:

```tsx
<div className="flex flex-col gap-1 font-jetbrains-mono text-xs">
  <div style={{ background: 'oklch(0.45 0.15 25 / 0.18)', borderRadius: 'var(--r-row)' }} className="px-2 py-1 line-through opacity-70">{oldText}</div>
  <div style={{ background: 'oklch(0.6 0.15 145 / 0.18)', borderRadius: 'var(--r-row)' }} className="px-2 py-1">{newText}</div>
</div>
```

Accept / Reject buttons on the suggestion card:

```tsx
<button
  style={{ borderRadius: 'var(--r-btn)', background: 'var(--brand)', color: 'var(--brand-ink)', boxShadow: 'var(--sh-tile)' }}
  className="px-3 py-1.5 text-xs font-geist font-semibold"
>
  Accept
</button>
<button
  style={{ borderRadius: 'var(--r-btn)', background: 'linear-gradient(180deg, var(--canvas-dark-400), var(--canvas-dark-350))', color: 'var(--canvas-dark-ink-strong)', boxShadow: 'var(--sh-tile)' }}
  className="px-3 py-1.5 text-xs font-geist font-semibold"
>
  Reject
</button>
```

- [ ] **Step 3: Filter strip**

```tsx
<div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: 'var(--canvas-dark-300)' }}>
  {filters.map(f => (
    <button
      key={f.id}
      style={{
        borderRadius: 'var(--r-pill)',
        background: f.active ? 'var(--brand)' : 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        color: f.active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-strong)',
        boxShadow: 'var(--sh-tile)',
      }}
      className="px-3 py-1 text-xs font-geist font-semibold"
    >
      {f.label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Orphan section**

```tsx
<section
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
    borderRadius: 'var(--r-card)',
    border: 'var(--br-card)',
  }}
  className="m-3 p-3"
>
  <h3 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-xs uppercase tracking-wider mb-2">Orphan annotations</h3>
  {/* orphan cards */}
</section>
```

- [ ] **Step 5: Selection popover**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex items-center gap-1 px-2 py-1"
>
  <button style={{ borderRadius: 'var(--r-btn)' }} className="px-2 py-1 text-xs">Annotate</button>
  <button style={{ borderRadius: 'var(--r-btn)' }} className="px-2 py-1 text-xs">Suggest edit</button>
</div>
```

- [ ] **Step 6: Annotate + Suggest modals**

Open both in dev and verify they inherit panel treatment from T8's `DialogContent`. Form fields inside use `--r-row` + `--sh-inset` for inputs/textareas. Submit button uses `--r-btn` + solid `--brand` bg + `--brand-ink` text. Cancel uses `--r-btn` + tile gradient.

- [ ] **Step 7: tsc + tests + visual**

Open a hive-linked book in the studio. Open the gutter (toolbar button). Select text in the prose — selection popover appears. Click Annotate — modal opens. Create an annotation; it appears in the gutter as a card. Click a layer filter; cards filter.

- [ ] **Step 8: Commit**

```bash
git add components/hive/collab/
git commit -m "style(editor): T11 — collaboration gutter cards + filter strip + popover aesthetic refresh"
```

**Acceptance criteria:**
- Annotation cards render with per-layer left-edge accent + tile gradient.
- Suggestion cards render with diff (red strikethrough + green new) + Accept/Reject buttons.
- Filter strip pills toggle active/idle correctly.
- Orphan section visually distinct as a panel-within-panel.
- Selection popover floats with the new panel treatment.
- Annotate + Suggest modals render with Dialog panel treatment.
- All gutter actions (resolve, reply, accept, reject, filter) preserved.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 11. Modify all eight collab files. Preserve per-layer color tokens (annot-layer-grammar/plot/tone/continuity/general), the diff colors on suggestion cards (red/green tints), and all gutter actions. Run tsc + tests + a manual smoke (select text in a hive chapter, annotate, suggest, accept/reject). Commit.

---

### Task 12: Banners (snapshot preview + overflow)

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/preview-banner.tsx` (snapshot preview banner)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx`

**Surfaces changed:**
- Snapshot preview banner → `linear-gradient(180deg, oklch(from var(--brand) l c h / 0.15), oklch(from var(--brand) l c h / 0.08))` + `--sh-tile` + `--br-card` + 4px brand-yellow left accent preserved + brand glow preserved
- Overflow banner → same brand-tinted gradient + 4px brand-yellow left accent + Upgrade CTA button using `--r-pill` + solid brand bg + brand-ink text
- Banner text → `var(--canvas-dark-ink-strong)`
- Banner muted text → `var(--canvas-dark-ink-muted)`

- [ ] **Step 1: Snapshot preview banner**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, oklch(from var(--brand) l c h / 0.15), oklch(from var(--brand) l c h / 0.08))',
    boxShadow: 'var(--sh-tile), 0 0 24px oklch(from var(--brand) l c h / 0.2)',
    border: 'var(--br-card)',
    borderRadius: 'var(--r-card)',
    borderLeft: '4px solid var(--brand)',
  }}
  className="mx-4 my-2 px-4 py-2 flex items-center justify-between gap-3"
>
  <p style={{ color: 'var(--canvas-dark-ink-strong)' }} className="text-sm">
    Previewing snapshot from {timestamp}
  </p>
  <div className="flex gap-2">
    <button style={{ borderRadius: 'var(--r-btn)', background: 'var(--brand)', color: 'var(--brand-ink)' }} className="px-3 py-1 text-xs font-semibold">Restore</button>
    <button style={{ borderRadius: 'var(--r-btn)', color: 'var(--canvas-dark-ink-strong)' }} className="px-3 py-1 text-xs">Exit preview</button>
  </div>
</div>
```

- [ ] **Step 2: Overflow banner**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, oklch(from var(--brand) l c h / 0.15), oklch(from var(--brand) l c h / 0.08))',
    boxShadow: 'var(--sh-tile)',
    border: 'var(--br-card)',
    borderRadius: 'var(--r-card)',
    borderLeft: '4px solid var(--brand)',
  }}
  className="mx-4 my-2 px-4 py-3 flex items-center justify-between gap-3"
>
  <div>
    <p style={{ color: 'var(--canvas-dark-ink-strong)' }} className="text-sm font-semibold">This book is read-only on the Free plan</p>
    <p style={{ color: 'var(--canvas-dark-ink-muted)' }} className="text-xs">Upgrade to keep editing all your books.</p>
  </div>
  <Link href={`/${locale}/pricing`} style={{ borderRadius: 'var(--r-pill)', background: 'var(--brand)', color: 'var(--brand-ink)' }} className="px-4 py-2 text-sm font-semibold">
    Upgrade
  </Link>
</div>
```

- [ ] **Step 3: tsc + tests + visual**

Open the editor as a free-tier user with >3 books → overflow banner appears. Open History → preview a snapshot → snapshot preview banner appears.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/preview-banner.tsx" "app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx"
git commit -m "style(editor): T12 — banners aesthetic refresh"
```

**Acceptance criteria:**
- Snapshot preview banner brand-tinted with 4px left accent + glow preserved.
- Overflow banner brand-tinted with 4px left accent + Upgrade CTA pill.
- Both banners' actions (Restore / Exit preview / Upgrade) work.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 12. Modify the two banner files. Preserve the 4px brand-yellow left accent and the subtle brand glow on the snapshot preview banner. Run tsc + tests, commit.

---

### Task 13: Empty states + corkboard + writing analysis panel

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/empty-state.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/corkboard-or-editor.tsx` (corkboard branch only; chapter editor branch already handled in T5)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/writing-analysis.tsx`

**Surfaces changed:**
- EmptyState (chrome variant: `onEditorCanvas={false}`) → panel treatment + `--r-card` + `--sh-card`
- EmptyState (canvas variant: `onEditorCanvas={true}`) → preserved (paper-aware existing behavior)
- Corkboard background → warm desk-surface gradient preserved (radial vignette + coffee tones); container of the whole corkboard inherits the same dark frame as T5 (the corkboard sits inside the canvas frame)
- Corkboard index cards → paper-100 bg preserved (cream); existing ±1° alternating rotation preserved
- Writing analysis panel → outer-panel gradient + `--r-card` + `--sh-card`; section headlines → 44px brand-yellow (already in DP4); section cards inside → `--r-row` + `--sh-tile` + tile gradient

- [ ] **Step 1: EmptyState chrome variant**

```tsx
export function EmptyState({ icon, title, body, action, onEditorCanvas }: EmptyStateProps) {
  if (onEditorCanvas) {
    // preserved paper-aware variant — UNCHANGED
    return <div className="..." />
  }
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="flex flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div style={{ color: 'var(--canvas-dark-ink-muted)' }}>{icon}</div>
      <h3 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-base">{title}</h3>
      <p style={{ color: 'var(--canvas-dark-ink-muted)' }} className="text-sm">{body}</p>
      {action}
    </div>
  )
}
```

- [ ] **Step 2: Corkboard**

The corkboard's outer container inherits the same dark canvas frame as the chapter editor (T5). Index cards preserved (paper-100, ±1° alternating rotation, hover lift to 0°). The active card's brand-yellow outline + "Editing" mono pill — preserved.

- [ ] **Step 3: Writing analysis panel**

```tsx
<div
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
    borderRadius: 'var(--r-card)',
    boxShadow: 'var(--sh-card)',
    border: 'var(--br-card)',
  }}
  className="flex flex-col h-full overflow-y-auto p-6 gap-4"
>
  <h2 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-[44px] leading-tight">Writing analysis</h2>
  {/* section cards */}
</div>
```

Each section card (Sentence length histogram, Adverbs, Passive voice, Clichés):

```tsx
<section
  style={{
    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
    borderRadius: 'var(--r-row)',
    boxShadow: 'var(--sh-tile)',
  }}
  className="p-4 flex flex-col gap-2"
>
  <h3 style={{ color: 'var(--brand)' }} className="font-comfortaa font-bold text-sm">{sectionTitle}</h3>
  {/* content */}
</section>
```

- [ ] **Step 4: tsc + tests + visual**

Visit a corkboard (Part binder item with chapter children). Open writing analysis. Open an empty book to trigger the empty state.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/empty-state.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/corkboard-or-editor.tsx" "app/[locale]/(app)/studio/[bookId]/_components/editor/writing-analysis.tsx"
git commit -m "style(editor): T13 — empty states + corkboard + writing analysis aesthetic refresh"
```

**Acceptance criteria:**
- EmptyState chrome variant uses panel treatment; canvas variant preserved.
- Corkboard background and cards unchanged; outer dark frame uses T5's panel.
- Writing analysis renders with new panel + brand-yellow 44px headline + per-section tile cards.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 13. Modify the three files. Preserve the EmptyState `onEditorCanvas` paper-aware variant, the corkboard warm desk-surface bg + ±1° rotation cards, and the 44px brand-yellow analysis headline. Run tsc + tests, commit.

---

### Task 14: Feature-integrity sweep

**Files:**
- None modified; this is a verification task.

**Surfaces verified:** every existing affordance per the spec's Phase 3 checklist.

- [ ] **Step 1: Manual smoke walkthrough**

Open `/studio/[bookId]` on a hive-linked book (so the gutter shows). Walk through every item below — confirm each renders correctly AND is operable (click/type/drag actually does the thing):

- Binder: + Add menu opens; every type creatable (Chapter / Part / Front Matter / Back Matter / Character / Wiki Entry ▸ → category picker / Wiki Folder / Outline / Research Note / Research Folder).
- Binder: kebab on a row → Rename / Duplicate / Delete.
- Binder: drag a chapter into a Part — nests; drag a note into a research folder — nests; drag a row to reorder — reorders. Brand-yellow halo on nest target visible.
- Binder: dblclick to rename — inline edit works.
- Binder: hive footer "Go to Hive" link works.
- Toolbar: Bold / Italic / Underline / Strikethrough toggle on selected text.
- Toolbar: Heading▾ dropdown opens, H1 / H2 / H3 apply.
- Toolbar: List▾ → bullet / numbered apply.
- Toolbar: Quote, HR, Highlight, Link, Align▾ apply.
- Toolbar: Undo / Redo step through history.
- Toolbar: Find (Cmd+F) — strip opens; type, find next/prev, close.
- Toolbar: History — drawer opens; snapshot list renders.
- Toolbar: Gutter — gutter opens on hive-linked book.
- Toolbar: Theme (Sun/Moon) — toggles cream/dark prose canvas.
- Toolbar: Preview (Eye) — opens reader for this book.
- Toolbar: More▾ dropdown → Export modal opens.
- Toolbar: Help (?) — cheatsheet modal opens.
- Metadata: status pills — click one → updates DB → reflects in binder row dot.
- Metadata: word goal — inline edit saves.
- Metadata: scene planner — expand/collapse works.
- Metadata: publishing — premium gate / expand works.
- Metadata: stats — values render.
- Status bar: save pill toggles Saved/Saving/Unsaved on type.
- Status bar: word goal inline edit works.
- Status bar: sprint setup popover opens, 5/15/30/custom selectable, Start → sprint counts down → finished pulse.
- Snapshot preview: preview a snapshot → banner appears → Restore / Exit work.
- Overflow banner: set free-tier with >3 books → banner appears on 4th book.
- Specialized renderers: open each binder type → renderer mounts → save debounce works.
- Selection popover: select prose text on a hive-linked chapter → popover floats → Annotate / Suggest open modals → submit → card appears in gutter.
- Gutter: filter chips work; resolve / accept / reject buttons work; orphan section appears for annotations whose marks are lost.
- Focus mode: toggle (existing 200ms slide) — sidebars hide.

- [ ] **Step 2: tsc + tests final pass**

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean, 424+ tests passing.

- [ ] **Step 3: Performance eyeball**

Open the editor at 4K (or large window). Scroll the binder fast. Scroll the prose fast. If GPU paint jank is visible, drop the secondary shadow layer of `--sh-card` (the `0 2px 4px` line) and re-test. Document any drop in a follow-up note.

- [ ] **Step 4: No commit (verification task)**

This task produces no commit. If any issue is found, file it as a sub-task fix on the offending file from T2-T13 and commit there.

**Acceptance criteria:**
- Every affordance in the spec's Phase 3 list works.
- The binder "+ Add" tile is present and operable.
- No visual regression on the cream prose surface.
- tsc clean, 424+ tests passing.

**Subagent dispatch:**
> Implement Task 14. Open `/studio/[bookId]` on a hive-linked book in a dev server and walk the entire checklist from the plan. For every item, confirm both visual correctness AND functional behavior. Run tsc + tests. If any affordance is missing or broken, fix it by editing the offending file from T2-T13 (commit message `style(editor): T14 fix — <surface>`). Otherwise no commit.

---

### Task 15: AGENTS.md write-up + ship commit

**Files:**
- Modify: `AGENTS.md` (add a "What Has Been Built" entry for the editor aesthetic refresh; bump the Resume Here block).

**Surfaces changed:** none — docs only.

- [ ] **Step 1: AGENTS.md "What Has Been Built" entry**

Add after the H2 entry (chronological order). Structure (concrete content — engineer fills in commit SHAs from `git log`):

```markdown
### Editor Aesthetic Refresh ✅ COMPLETE (2026-06-01)

Re-skins every studio editor chrome surface to the warmer, cool-gray, iOS-modern stacked-depth aesthetic. Presentation-only — no DB, no feature changes, no IA changes. 424+ tests stay green; tsc clean. Approved mockup at `.superpowers/brainstorm/29735-1780335541/content/full-editor.html`.

- **Token additions in `app/globals.css`:** new color mid-stops `--canvas-dark-150/250/350/400`, radius scale `--r-card/-row/-btn/-pill/-nav`, depth shadows `--sh-card/-tile/-inset`, hairline border `--br-card`. Existing DP1-DP4 tokens preserved; the new tokens are additive.
- **App nav** (`(app)/_components/app-nav.tsx`): floating rounded bar with new gradient + shadow; wordmark and active link in brand-yellow.
- **Binder** (`studio/[bookId]/_components/binder/*`): panel + rows + add menu + kebab + hive footer + wiki category picker all re-skinned. The "+ Add" tile remains visible (the mockup omitted it; spec mandated keeping it).
- **Editor toolbar** (`editor/editor-toolbar.tsx`): tiles use inset gradient + tile shadow; active is solid brand-yellow.
- **Chapter canvas frame** (`editor/chapter-editor.tsx` + `editor/corkboard-or-editor.tsx`): outer dark frame re-skinned; the cream paper sheet, Newsreader serif, paper-ink prose color preserved exactly.
- **Status bar** (`editor/editor-status-bar.tsx` + `editor/sprint-controls.tsx`): rounded card panel; save pill off-green with brand-yellow dot only when unsaved.
- **Metadata panel** (`metadata/metadata-panel.tsx`): all 5 sections re-skinned; status pills tinted with status colors; premium badge solid brand-yellow.
- **Modals** (`components/ui/dialog.tsx` + `confirm-dialog.tsx` + cheatsheet + sprint setup + export): single Dialog primitive update cascades to every modal.
- **Drawers + find/replace + gutter chrome** (`editor/version-history-drawer.tsx`, `editor/find-replace.tsx`, `components/hive/collab/collaboration-gutter.tsx`).
- **Specialized renderers** (`editor/wiki-entry-editor.tsx`, `wiki-folder-renderer.tsx`, `character-profile.tsx`, `outline/outline-board.tsx`, NoteEditor, FM/BM PageWrapper, `container-view.tsx`): outer panes re-skinned; cream paper sub-surfaces (FM/BM pages, note paper, character identity card) preserved. Scoped `[data-slot="X-pane"] .ProseMirror` color rules preserved.
- **Collaboration gutter** (`components/hive/collab/*`): annotation + suggestion cards on tile gradient with per-layer accents; filter chips toggle brand-yellow active; orphan section as panel-within-panel; selection popover with new panel treatment.
- **Banners** (`editor/preview-banner.tsx`, `overflow-banner.tsx`): brand-tinted gradient + 4px brand-yellow left accent.
- **Empty states, corkboard, writing analysis** (`empty-state.tsx`, `corkboard-or-editor.tsx`, `editor/writing-analysis.tsx`).

**Pattern note for future surfaces:** outer panels use `linear-gradient(180deg, --canvas-dark-250, --canvas-dark-200)` + `--r-card` + `--sh-card` + `--br-card`. Inset tiles use `linear-gradient(180deg, --canvas-dark-350, --canvas-dark-300)` + `--r-btn` (or `--r-row`) + `--sh-tile`. Recessed inputs use `--sh-inset`. Headings in chrome use `color: var(--brand)`. Cream paper sub-surfaces (chapter prose, FM/BM page sheets, note paper, character identity card) are never restyled by chrome rules — they live in their own paper-aware surface.

**Brand-yellow usage map (sanctioned uses — 12 places):** chrome headings, app logo, active nav link, active toolbar tile, active status pill, premium badge, word-goal progress fill, word-goals page progress fill, + Add binder trigger text, Go to Hive footer text, unsaved-changes dot, annotation layer accents.

**Out of scope (deferred):** Hive routes (separate spec — next brainstorm). Light-mode chrome variant. Auth pages, landing page, /community, /discover, /settings (untouched unless they share a re-skinned primitive like `dialog.tsx`).
```

- [ ] **Step 2: Bump the Resume Here block**

Update the top of AGENTS.md `Resume Here`:
- `Last updated:` → `2026-06-01`
- `Current focus:` → mention the editor aesthetic refresh complete; next is Hive aesthetic refresh brainstorm + spec + plan.
- `Last commit:` → `style(editor): T15 — editor aesthetic refresh ship`
- `Next concrete step:` → "Brainstorm + spec + plan the Hive aesthetic refresh (the editor aesthetic refresh shipped today established the token system at `app/globals.css`; the hive routes need a parallel pass using the same tokens). Or pick another priority — see the existing candidate list."

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "style(editor): T15 — editor aesthetic refresh ship + AGENTS.md write-up"
```

- [ ] **Step 4: Optional push**

If Chris asked to push to GitHub:

```bash
git push origin main
```

**Acceptance criteria:**
- AGENTS.md gains a "What Has Been Built" entry with token list, file list, pattern note, brand-yellow usage map.
- Resume Here block bumped.
- Final ship commit landed on `main`.

**Subagent dispatch:**
> Implement Task 15. Update AGENTS.md with the "What Has Been Built" entry (use the structure in the plan) and bump the Resume Here block. Commit. Do not push unless Chris explicitly asks.

---

## Self-Review Notes

**Spec coverage:** Every spec section maps to a task:
- Color tokens / radius / depth / brand-yellow map → T1.
- App nav → T2.
- Binder panel + rows + add menu + hive footer + "+ Add" preservation → T3.
- Toolbar → T4.
- Chapter canvas frame (preserving cream prose) → T5.
- Status bar + sprint → T6.
- Metadata panel → T7.
- Modals (export, cheatsheet, sprint setup, ConfirmDialog) → T8.
- Drawers + find/replace + gutter chrome → T9.
- Specialized renderers (outline, character, notes, FM/BM, wiki entry, container) → T10.
- Collaboration gutter cards + filter strip + orphan section + selection popover → T11.
- Banners (snapshot preview, overflow) → T12.
- Empty states + corkboard + writing analysis → T13.
- Phase 3 feature-integrity sweep → T14.
- Docs + ship → T15.

**Placeholder scan:** every task has concrete CSS values, exact file paths, runnable commands, commit messages. No "TBD", "etc.", "and so on".

**Type / token consistency:** All gradient pairs reference declared tokens; all radii reference `--r-card / -row / -btn / -pill / -nav`; all shadows reference `--sh-card / -tile / -inset`; all hairline borders reference `--br-card`; all brand-yellow uses match the spec's 12-place map.

**Cream prose preservation:** Explicitly re-stated in T5 (chapter editor), T10 (FM/BM PageWrapper + note paper + character identity card), T13 (EmptyState `onEditorCanvas` variant).

**Feature preservation:** T3 enumerates the "+ Add" tile and all 10 binder types; T4 enumerates every toolbar button; T7 enumerates all 5 metadata sections; T14 walks the full Phase 3 checklist.
