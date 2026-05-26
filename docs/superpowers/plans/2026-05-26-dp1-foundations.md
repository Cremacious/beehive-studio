# DP1 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Claude Design's tokens.css + Newsreader font + light-mode CSS references into the live codebase. After DP1, every existing component inherits the new walnut chrome automatically via the shadcn semantic-token bridge.

**Architecture:** Two files modified (`app/globals.css`, `app/layout.tsx`) plus one component file with embedded raw-hex values (`corkboard-or-editor.tsx`). The bridge maps shadcn semantic tokens (`--card`, `--background`, etc.) to new oklch primitives so the entire app updates without component edits.

**Tech Stack:** Tailwind v4 (`@theme inline`), Next.js 16 + `next/font/google`, CSS oklch color space, modern browsers (Chrome 111+, Firefox 113+, Safari 15.4+).

**Spec:** [`docs/superpowers/specs/2026-05-26-dp1-foundations-design.md`](../specs/2026-05-26-dp1-foundations-design.md)

**Source of truth:** [`designs/claude/studio-shell/tokens.css`](../../../designs/claude/studio-shell/tokens.css) — copy primitives verbatim.

---

## File Structure

**Modify:**
- `app/globals.css` — full rewrite of `:root`; extend `@theme inline { ... }`; update existing `@utility` blocks.
- `app/layout.tsx` — add Newsreader font; wire variable into `<html>`.
- `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` — update React-injected `<style>` tag's hardcoded hex values to reference new `--paper-*` tokens.

**No DB changes. No new dependencies. No component-tree changes.**

---

## Task 1: Add Newsreader font

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read the current layout to confirm font wiring pattern**

Read `app/layout.tsx`. Confirm:
- How Geist + Comfortaa are imported (likely `next/font/google` with `variable: '--font-geist-sans'`, `variable: '--font-comfortaa'`).
- How the variables are wired into the `<html>` className.

The new font should follow the same pattern exactly.

- [ ] **Step 2: Add the Newsreader import**

At the top of `app/layout.tsx`, alongside the existing font imports:

```tsx
import { Newsreader } from 'next/font/google'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})
```

- [ ] **Step 3: Wire the variable into `<html>`**

Find the `<html>` element in the JSX. Add `newsreader.variable` to its className alongside the existing font variables. Example (adapt to whatever the existing code looks like):

```tsx
<html lang={locale} className={`dark ${geistSans.variable} ${comfortaa.variable} ${newsreader.variable}`}>
```

The exact joining pattern matches whatever the file already does — don't change the existing style.

- [ ] **Step 4: Type check + dev smoke**

```bash
npx tsc --noEmit
```

Expected: clean.

Boot the dev server briefly to confirm no font-loading errors:

```bash
npm run dev
```

Wait for "Ready in N s", then stop. If any compilation errors mention next/font, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(design): add Newsreader font via next/font (DP1 Task 1)

Loads Newsreader as a CSS variable (--font-newsreader) alongside the
existing Geist and Comfortaa fonts. Not referenced by any component
yet — DP2 will wire it as the prose face for the editor body.

display: 'swap' so the page renders immediately with the system serif
fallback while Newsreader streams in."
```

---

## Task 2: Port tokens — primitives + shadcn bridge + @theme

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Read current globals.css end-to-end**

Read the entire file (it's ~200 lines). Note:
- The order of top-level blocks: imports, `@custom-variant dark`, `@theme inline { ... }`, `:root { ... }`, `html { ... }`, `body { ... }`, `@utility` blocks.
- Which shadcn semantic tokens are referenced in `@theme` (background, foreground, card, etc.).
- Which custom tokens already exist (`--color-surface`, `--color-surface-elevated`, `--color-brand`, etc.).
- The existing `@utility` blocks and their hardcoded hex values.

The Task 2 rewrite extends `:root` with new oklch primitives and adapts the existing semantic-token bridge. It does NOT delete existing top-level structure.

- [ ] **Step 2: Read tokens.css source of truth**

Read `designs/claude/studio-shell/tokens.css` end-to-end. The full token list is the spec — copy values verbatim. Note any non-color tokens (spacing, radii, shadows, type scale) that aren't already in `globals.css`.

- [ ] **Step 3: Write the new `:root` block**

Replace the existing `:root { ... }` block in `app/globals.css` with this expanded version. Preserve `--radius` if it exists; add `--radius-*` from tokens.css if absent.

```css
:root {
  /* ── Chrome (the dark walnut "desk" the paper sits on) ──────────── */
  --chrome-950: oklch(0.165 0.010 60);
  --chrome-900: oklch(0.205 0.012 58);
  --chrome-850: oklch(0.230 0.013 57);
  --chrome-800: oklch(0.255 0.013 56);
  --chrome-750: oklch(0.290 0.014 55);
  --chrome-700: oklch(0.340 0.012 55);
  --chrome-600: oklch(0.410 0.010 55);
  --chrome-500: oklch(0.520 0.010 55);
  --chrome-400: oklch(0.640 0.012 60);
  --chrome-300: oklch(0.760 0.014 65);
  --chrome-200: oklch(0.880 0.012 75);
  --chrome-100: oklch(0.950 0.010 80);

  /* ── Paper (light editor canvas — cream, warm) ─────────────────── */
  --paper-50:  oklch(0.985 0.012 88);
  --paper-100: oklch(0.965 0.018 85);
  --paper-200: oklch(0.935 0.022 82);
  --paper-300: oklch(0.880 0.020 80);
  --paper-400: oklch(0.760 0.022 78);
  --paper-ink-muted:  oklch(0.520 0.022 60);
  --paper-ink:        oklch(0.265 0.020 55);
  --paper-ink-strong: oklch(0.180 0.022 50);

  /* ── Dark editor canvas (warm coffee — NOT slate) ──────────────── */
  --canvas-dark-100: oklch(0.255 0.018 55);
  --canvas-dark-200: oklch(0.290 0.018 55);
  --canvas-dark-300: oklch(0.350 0.018 55);
  --canvas-dark-ink-muted:  oklch(0.680 0.014 65);
  --canvas-dark-ink:        oklch(0.880 0.012 80);
  --canvas-dark-ink-strong: oklch(0.965 0.010 85);

  /* ── Brand & accent ────────────────────────────────────────────── */
  --brand:        #FFC300;
  --brand-hover:  #FFD040;
  --brand-active: #E0AC01;
  --brand-soft:   oklch(0.85 0.18 90 / 0.18);
  --brand-ink:    oklch(0.20 0.05 75);

  /* ── Chapter status (5) ────────────────────────────────────────── */
  --status-idea:        oklch(0.74 0.045 245);
  --status-outline:     oklch(0.74 0.070 295);
  --status-first-draft: oklch(0.80 0.140 88);
  --status-revised:     oklch(0.74 0.080 155);
  --status-final:       oklch(0.68 0.130 35);

  /* ── Binder item types (6) ─────────────────────────────────────── */
  --type-chapter:      var(--brand);
  --type-front-matter: oklch(0.74 0.065 290);
  --type-back-matter:  oklch(0.70 0.075 330);
  --type-outline:      oklch(0.74 0.080 205);
  --type-research:     oklch(0.74 0.080 155);
  --type-character:    oklch(0.72 0.110 35);

  /* ── Validation ────────────────────────────────────────────────── */
  --success: oklch(0.72 0.130 152);
  --warning: oklch(0.80 0.140 80);
  --error:   oklch(0.66 0.180 25);

  /* ── Type families (next/font wires the --font-* vars in layout.tsx) */
  --font-display: var(--font-comfortaa), system-ui, sans-serif;
  --font-ui:      var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-prose:   var(--font-newsreader), 'Source Serif 4', Georgia, serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  /* ── Type scale ────────────────────────────────────────────────── */
  --t-2xs: 11px;
  --t-xs:  12px;
  --t-sm:  13px;
  --t-md:  14px;
  --t-lg:  16px;
  --t-xl:  18px;
  --t-2xl: 22px;

  /* ── Radius (preserved from existing + extended) ───────────────── */
  --radius: 0.625rem;

  /* ── Shadcn bridge — semantic tokens map to new chrome ─────────── */
  --background:           var(--chrome-950);
  --foreground:           var(--chrome-200);
  --card:                 var(--chrome-900);
  --card-foreground:      var(--chrome-200);
  --popover:              var(--chrome-800);
  --popover-foreground:   var(--chrome-200);
  --primary:              var(--brand);
  --primary-foreground:   var(--brand-ink);
  --secondary:            var(--chrome-800);
  --secondary-foreground: var(--chrome-200);
  --muted:                var(--chrome-800);
  --muted-foreground:     var(--chrome-400);
  --accent:               var(--chrome-800);
  --accent-foreground:    var(--chrome-200);
  --destructive:          var(--error);
  --border:               var(--chrome-700);
  --input:                var(--chrome-800);
  --ring:                 var(--chrome-500);
}
```

**Carry forward any tokens.css primitives not listed above.** If tokens.css contains additional spacing scales, shadow scales, or other variables (per spec §5.1), append them inside `:root` in their own section.

- [ ] **Step 4: Update `@theme inline { ... }`**

Locate the existing `@theme inline { ... }` block. It currently exposes Tailwind utilities for the shadcn tokens (`--color-background: var(--background)`, etc.). Update the brand/surface entries to reference the new primitives (the variables now bridge to new values, but the `@theme` mapping itself doesn't need to change for shadcn entries since they consume `var(--background)` etc. which now bridge to chrome).

For the existing brand + surface entries, update them to consume the new variables:

```css
@theme inline {
  /* ...existing shadcn entries (background, foreground, card, etc.) — unchanged */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  /* etc — all the way down through --color-ring */

  /* Brand + custom surface — references new primitives */
  --color-brand:        var(--brand);
  --color-brand-hover:  var(--brand-hover);
  --color-brand-active: var(--brand-active);
  --color-surface:          var(--chrome-850);
  --color-surface-elevated: var(--chrome-800);
  --color-surface-inset:    var(--chrome-900);

  /* Radii preserved */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
}
```

- [ ] **Step 5: Update `body` background**

The current `body { background-color: #141414; ... }` hardcodes the old chrome-950 value. Update:

```css
body {
  background-color: var(--background);  /* now bridges to --chrome-950 (warm walnut) */
  color: var(--foreground);             /* bridges to --chrome-200 */
  font-family: var(--font-ui);
}
```

The `color: white` line in the existing file changes to `color: var(--foreground)`. The font-family changes from `var(--font-geist-sans)` to `var(--font-ui)` (which resolves to Geist via the bridge).

- [ ] **Step 6: Update `@utility` blocks**

Find each existing `@utility` block. Replace hardcoded hex with token references:

```css
@utility scrollbar-custom {
  scrollbar-width: thin;
  scrollbar-color: var(--brand) transparent;
  &::-webkit-scrollbar { width: 8px; height: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background-color: var(--brand); border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background-color: var(--brand-hover); }
}

@utility paper-stack {
  border: 1px solid var(--chrome-700);
  border-bottom-color: var(--chrome-950);
  box-shadow:
    0 1px 0 oklch(1 0 0 / 0.04) inset,
    0 3px 0 oklch(0 0 0 / 0.32);
}
```

For `paper-stack-hover` (if it exists in the current file), preserve the hover behavior but reference tokens for any color values. If the existing `paper-stack-hover` references `rgba(255,195,0,0.35)` for the brand-yellow tint on hover, update to `oklch(from var(--brand) l c h / 0.35)` — or keep the rgba form referencing var(--brand) is harder; the simplest port keeps the rgba(255,195,0,0.35) literal since it's the same yellow.

For `mainFont` and `scrollbar-hide`, preserve as-is — they don't have color values to update.

- [ ] **Step 7: Type check + dev smoke**

```bash
npx tsc --noEmit
```

Expected: clean.

```bash
npm run dev
```

Open http://localhost:3000. Expect: the studio + community + sign-in pages all render. Visual change: chrome has shifted from cold near-black to warm walnut. No layout breaks. No console errors. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): port Claude Design tokens — chrome/paper/canvas (DP1 Task 2)

Adds the full oklch primitive set from Claude Design's tokens.css:
- Chrome scale (12 stops) — the dark walnut chrome
- Paper scale (5 stops + 3 inks) — cream writing surface
- Dark canvas scale — warm coffee, not slate
- Brand + accent (preserved + extended)
- 5 chapter status colors
- 6 binder item type colors
- Success / warning / error
- Type scale + font families

Shadcn semantic tokens (--card, --background, etc.) bridge to new
chrome primitives so the entire existing app inherits warm walnut
without component edits.

Existing @utility blocks (scrollbar-custom, paper-stack) updated to
reference new tokens instead of hardcoded hex."
```

---

## Task 3: Update light-mode editor CSS in corkboard-or-editor.tsx

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx`

- [ ] **Step 1: Read the file**

Read the full file. The relevant section is the inline `<style>` tag inside the React component (the SP4 light-mode workaround). It contains rules like:

```css
[data-editor-theme="light"] [data-slot="editor-toolbar"] {
  background-color: #f4f4ee;
  border-bottom-color: #e0e0d8;
}
```

Identify every hardcoded hex value in that `<style>` tag.

- [ ] **Step 2: Replace hex with token references**

Inside the `<style>` tag, replace hardcoded hex with `var(--paper-*)` and `var(--chrome-*)` references per this mapping:

| Old hex          | New token                                                            |
|------------------|----------------------------------------------------------------------|
| `#fcfcfa`        | `var(--paper-50)` or `var(--paper-100)` — pick by context (lighter for inputs, paper-100 for surfaces) |
| `#f4f4ee`        | `var(--paper-200)` (toolbar / status bar bg)                          |
| `#e0e0d8`        | `var(--paper-300)` (border-bottom under toolbar)                      |
| `#d0d0c8`        | `var(--paper-300)` or `var(--paper-400)` — pick by context (borders)  |
| `#e8e8e0`        | `var(--paper-200)` (hover bg)                                         |
| `#1a1a1a`        | `var(--paper-ink-strong)` (strong text on paper)                      |
| `rgba(26,26,26,0.7)` | `oklch(from var(--paper-ink) l c h / 0.7)` or simply `var(--paper-ink-muted)` |
| `rgba(26,26,26,0.3)` | `var(--paper-ink-muted)` faded, or `oklch(from var(--paper-ink) l c h / 0.3)` |
| `#0a0a0a`        | `var(--paper-ink-strong)` (headings on paper)                         |
| `#333`           | `var(--paper-ink)` (blockquote color)                                 |

Apply these replacements rule by rule. The file's structure (rules, selectors) stays identical — only the values change.

The inline-style `style={{ backgroundColor: '#fcfcfa', color: '#1a1a1a' }}` near the wrapper div also gets updated to use CSS variables:

```tsx
style={isLight ? { backgroundColor: 'var(--paper-100)', color: 'var(--paper-ink-strong)' } : undefined}
```

Note: React inline-style strings accept `var()` references. This is fine.

- [ ] **Step 3: Dev smoke — light mode**

```bash
npm run dev
```

Open a chapter in the studio editor. Toggle the editor theme to light mode (Sun icon). Expect:
- Editor body: cream paper background instead of `#fcfcfa`.
- Toolbar: paper-200 background, paper-300 border-bottom.
- Status bar: same paper-200 treatment.
- ProseMirror text colors render on paper background.
- All buttons/icons in light mode are still readable.

Toggle back to dark mode. Expect editor body returns to the dark canvas.

If anything is invisible, broken, or wrong-color, fix it before committing.

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
```

Expected: clean.

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx"
git commit -m "feat(design): update light-mode editor CSS to reference new paper tokens (DP1 Task 3)

The SP4 light-mode workaround in corkboard-or-editor.tsx embeds raw
hex values inside a React-injected <style> tag. DP1's tokens-only
approach can't reach those automatically. This task replaces every
hardcoded hex (#fcfcfa, #f4f4ee, #e0e0d8, #1a1a1a, etc.) with the
matching new --paper-* or --paper-ink-* token reference.

The wrapper div's inline style also flips to CSS variables so light
mode now uses var(--paper-100) for bg and var(--paper-ink-strong)
for text instead of hardcoded values.

After this commit, light editor mode renders true cream paper instead
of the older sub-warm cream-adjacent palette."
```

---

## Task 4: Manual verification + AGENTS.md + push

- [ ] **Step 1: Run automated checks**

```bash
npx tsc --noEmit
npm test
```

Both must be clean. Tests should still be 119.

- [ ] **Step 2: Manual checklist (spec §7)**

Boot dev server. Walk through:

1. `npm run dev` boots clean. No CSS errors in console.
2. Studio editor at `/studio/[bookId]` renders. Chrome warms from cold near-black to walnut.
3. Light editor mode toggle works. Editor body flips cream paper.
4. Community page renders with new walnut chrome.
5. Sign-in / sign-up pages render with new walnut chrome.
6. Landing page renders with new walnut chrome.
7. Brand yellow still in the same places (toolbar active, save-unsaved indicator, premium badges, primary CTAs).
8. Newsreader loads — confirm via devtools Network panel that `newsreader-*.woff2` requests succeed when visiting any page.
9. Scrollbar custom utility still functional on long lists (book grid scroll, binder scroll).
10. Premium badges, status indicators, save/unsaved states render with reasonable colors.

If a check fails, fix before Step 3.

- [ ] **Step 3: Update AGENTS.md**

Read `AGENTS.md`. Find the "📍 Resume Here" block:
- Bump Last updated to 2026-05-26.
- Current focus → "DP1 Foundations complete; DP2 Studio Shell next."
- Last commit → use `git log -1 --format=%s` to fill the actual most recent.
- Next concrete step → "invoke /brainstorming for DP2 Studio Shell — port binder, toolbar, editor body, status bar, metadata panel to match Claude Design mockups."

Add a "Key Patterns" line under the existing ones inside Resume Here:

> **DP1 design-port pattern:** Claude Design tokens.css ported into `app/globals.css` `:root` as oklch primitives. Shadcn semantic tokens (--card, --background, etc.) bridge to new chrome scale so existing components inherit walnut automatically. The SP4 light-mode workaround in `corkboard-or-editor.tsx` references --paper-* tokens directly. Source of truth for future updates: `designs/claude/studio-shell/tokens.css`.

Add a "What Has Been Built" subsection after the latest entry:

```markdown
### Phase 7.6 — DP1 Foundations ✅ COMPLETE
First of four design-port sub-projects (DP1 → DP4). Ported Claude Design's tokens.css into `app/globals.css` as oklch primitives (chrome/paper/canvas scales, brand, status, type, validation). Shadcn semantic tokens bridge to new chrome — entire app inherits warm walnut without component edits. Newsreader font loaded via next/font. Existing @utility blocks (scrollbar-custom, paper-stack) reference new tokens. SP4 light-mode editor CSS references --paper-* tokens directly.

- Files modified: `app/globals.css`, `app/layout.tsx`, `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx`.
- No DB changes. No new dependencies. No component-tree changes.
- 119/119 tests, tsc clean.
```

(Adjust the phase numbering — Phase 7.5 was Community feed; pick the next sensible label. If "DP1" feels cleaner standalone, use that.)

- [ ] **Step 4: Commit AGENTS.md + push**

```bash
git add AGENTS.md
git commit -m "docs: close DP1 Foundations — Claude Design tokens ported

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- New oklch primitives present in `app/globals.css` `:root`.
- Shadcn semantic tokens bridge to new chrome primitives.
- Existing custom tokens (--color-surface, --color-brand, etc.) bridge to new primitives.
- `@theme inline { ... }` block preserved + extended.
- Newsreader font loaded via `next/font/google`, wired into `<html>` className, referenced via `--font-prose`.
- Existing `@utility` blocks reference new tokens instead of hardcoded hex.
- `corkboard-or-editor.tsx` light-mode `<style>` tag references new `--paper-*` tokens.
- All 10 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- AGENTS.md updated; pushed to origin/main.
- 4 atomic commits (Task 1, Task 2, Task 3, AGENTS.md).
