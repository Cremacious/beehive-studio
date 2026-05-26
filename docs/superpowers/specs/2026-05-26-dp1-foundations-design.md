# DP1 — Foundations Design Spec

> **Date:** 2026-05-26
> **Sub-project:** Design Port 1 of 4. The first port of Claude Design's deliverables into the codebase.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Land the new design tokens, fonts, and base styles so subsequent sub-projects (DP2-DP4) can lean on a stable token vocabulary. After DP1, the existing app should render *identically or better* — no surface is intentionally redesigned yet; the foundation is in place. The visible-change-from-DP1 is limited to a chrome shift (warm walnut tones replacing cold near-black) inherited automatically by every component using shadcn semantic tokens.

## 2. Context

Claude Design delivered three bundles to `designs/claude/` (Prompts 1-3 from the design pass). The foundational artifact is `designs/claude/studio-shell/tokens.css` — a comprehensive oklch token system Claude Design designated as "the source of truth for Prompts 2 + 3." DP1 ports it into the live codebase so DP2-DP4 can implement against real tokens, not mockup-only CSS variables.

Locked decisions (from brainstorm):
- 4 sub-projects total: DP1 Foundations · DP2 Studio Shell · DP3 Specialized · DP4 Overlays
- Visual fidelity: pixel-perfect on editor body / binder / toolbar (DP2's domain); structural elsewhere
- Migration: yolo-replace, no feature flag
- Bonus pages (Landing / Sign In / Sign Up) deferred

## 3. Non-goals

- Component-level redesign. DP1 changes zero component files (except where they hardcode color hex values that the foundation can absorb).
- Auditing brand-yellow restraint. Claude Design specified brand yellow appears in 5 places (active row, unsaved dot, +Add, premium, active toolbar btn). Auditing existing usage is DP2's concern.
- Hand-implementing the mockup HTML. The mockups are reference material; component implementation happens in DP2-DP4.
- New Tailwind utilities for every primitive. DP1 only adds utilities for shadcn semantic tokens (which the existing app uses) — primitives are referenced via `var(--paper-ink)` style escapes in DP2+ where needed.
- Light-mode-as-default. The existing per-editor Sun/Moon toggle stays; default editor mode remains dark. DP1 just makes the new paper tokens available so the light path looks right.

## 4. Architecture

### 4.1 Files modified

- `app/globals.css` — substantial extension. The existing ~200-line file becomes ~350 lines. Import order preserved (`@import "tailwindcss"`, `@import "tw-animate-css"`, `@custom-variant dark`, then `@theme inline { ... }`, then `:root { ... }`, then `html`/`body`/`@utility` blocks).
- `app/layout.tsx` — add Newsreader font from `next/font/google`, expose as `--font-newsreader` CSS variable. Wire into `<html>` className alongside existing Geist + Comfortaa.
- `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` — update the React-injected `<style>` tag's hardcoded hex values to reference new `--paper-*` tokens. This file already uses inline styles + a `<style>` tag for light-mode-editor CSS (an SP4 workaround); DP1 modernizes those references.

### 4.2 Files NOT modified

- `designs/claude/**` — Claude Design output stays untouched. Source of truth + reference material for DP2-DP4.
- All component files. DP1 deliberately does not touch component code — the shadcn semantic-token bridge means existing components inherit new chrome automatically.
- `package.json` — no new dependencies. Newsreader loads via Next.js's built-in `next/font/google` (already in use for Geist + Comfortaa). oklch needs no polyfill; modern browsers support it natively.

## 5. Token plan

### 5.1 New oklch primitives — added to `:root`

```css
:root {
  /* Chrome (the dark walnut "desk" the paper sits on) */
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

  /* Paper (light editor canvas — cream, warm, sub-saturation) */
  --paper-50:  oklch(0.985 0.012 88);
  --paper-100: oklch(0.965 0.018 85);
  --paper-200: oklch(0.935 0.022 82);
  --paper-300: oklch(0.880 0.020 80);
  --paper-400: oklch(0.760 0.022 78);
  --paper-ink-muted:  oklch(0.520 0.022 60);
  --paper-ink:        oklch(0.265 0.020 55);
  --paper-ink-strong: oklch(0.180 0.022 50);

  /* Dark editor canvas (warm coffee — NOT slate) */
  --canvas-dark-100: oklch(0.255 0.018 55);
  --canvas-dark-200: oklch(0.290 0.018 55);
  --canvas-dark-300: oklch(0.350 0.018 55);
  --canvas-dark-ink-muted:  oklch(0.680 0.014 65);
  --canvas-dark-ink:        oklch(0.880 0.012 80);
  --canvas-dark-ink-strong: oklch(0.965 0.010 85);

  /* Brand & accent */
  --brand:        #FFC300;
  --brand-hover:  #FFD040;
  --brand-active: #E0AC01;
  --brand-soft:   oklch(0.85 0.18 90 / 0.18);
  --brand-ink:    oklch(0.20 0.05 75);

  /* Chapter status (5) — harmonised at C≈0.07, L≈0.72 */
  --status-idea:        oklch(0.74 0.045 245);
  --status-outline:     oklch(0.74 0.070 295);
  --status-first-draft: oklch(0.80 0.140 88);
  --status-revised:     oklch(0.74 0.080 155);
  --status-final:       oklch(0.68 0.130 35);

  /* Binder item types (6) */
  --type-chapter:      var(--brand);
  --type-front-matter: oklch(0.74 0.065 290);
  --type-back-matter:  oklch(0.70 0.075 330);
  --type-outline:      oklch(0.74 0.080 205);
  --type-research:     oklch(0.74 0.080 155);
  --type-character:    oklch(0.72 0.110 35);

  /* Validation */
  --success: oklch(0.72 0.130 152);
  --warning: oklch(0.80 0.140 80);
  --error:   oklch(0.66 0.180 25);

  /* Type families */
  --font-display: var(--font-comfortaa), system-ui, sans-serif;
  --font-ui:      var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-prose:   var(--font-newsreader), 'Source Serif 4', Georgia, serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  /* Type scale */
  --t-2xs: 11px;
  --t-xs:  12px;
  --t-sm:  13px;
  --t-md:  14px;
  --t-lg:  16px;
  --t-xl:  18px;
  --t-2xl: 22px;
  /* ...continue per tokens.css */
}
```

The full token list lives in `designs/claude/studio-shell/tokens.css` — the implementation plan will instruct copying verbatim with adjustments to the font-family declarations to use the `--font-*` CSS variables next/font wires up.

### 5.2 Shadcn semantic-token bridge (critical)

The existing app heavily uses `bg-card`, `text-foreground`, `border-border`, etc. The bridge maps these to the new chrome primitives so every component automatically inherits the warm walnut without code changes:

```css
:root {
  /* ...primitives above... */

  /* Shadcn bridge — semantic tokens map to new primitives */
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

  /* Existing custom tokens — map to new chrome */
  --color-surface:          var(--chrome-850);
  --color-surface-elevated: var(--chrome-800);
  --color-surface-inset:    var(--chrome-900);
  --color-brand:            var(--brand);
  --color-brand-hover:      var(--brand-hover);
  --color-brand-active:     var(--brand-active);
}
```

The `@theme inline { ... }` block continues exposing these as Tailwind utilities (`--color-background: var(--background)`, etc.).

### 5.3 Font wiring (Newsreader)

In `app/layout.tsx`:

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

Add `newsreader.variable` to the `<html>` className alongside existing fonts.

In `globals.css`:
```css
--font-prose: var(--font-newsreader), 'Source Serif 4', Georgia, serif;
```

### 5.4 Utility block updates

Existing `@utility` blocks (scrollbar-custom, paper-stack, etc.) currently hardcode hex values. DP1 rewrites them to reference new tokens:

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

The `paper-stack-hover` variant — confirm during implementation which existing hover behaviors to preserve verbatim vs which to update.

### 5.5 Light-mode editor CSS (SP4 workaround update)

The React-injected `<style>` tag in `corkboard-or-editor.tsx` has hardcoded values like `#fcfcfa`, `#f4f4ee`, `#1a1a1a`, `#d0d0c8`, `#e0e0d8`. DP1 updates these to reference new tokens:

```ts
// inside corkboard-or-editor.tsx <style> tag
[data-editor-theme="light"] [data-slot="editor-toolbar"] {
  background-color: var(--paper-200);   // was #f4f4ee
  border-bottom-color: var(--paper-300); // was #e0e0d8
}
// ...and so on for the ~12 rules in that tag
```

This is one of the few component files DP1 touches because the SP4 workaround uses raw hex inside JSX strings.

## 6. Migration safety

- The bridge means existing components don't break. `bg-card text-foreground` continues to compile; just produces walnut output.
- Any component that hardcoded a raw hex value (`bg-[#141414]`, etc.) will NOT automatically adopt the new chrome. DP2-DP4 audit + replace these as they touch each surface. DP1 doesn't sweep — too noisy a diff.
- The light-mode-editor CSS update in `corkboard-or-editor.tsx` is the only mandatory component-level change in DP1. It exists because the workaround embeds raw values inside a JSX string template — there's no way to "automatically inherit" without editing it.

## 7. Testing (manual)

1. `npm run dev` boots clean. No CSS errors in console.
2. `npx tsc --noEmit` clean.
3. `npm test` clean (119 tests).
4. Studio editor at `/studio/[bookId]` renders. Visual: chrome warms from cold near-black to walnut. No layout break. All buttons/panels/text readable.
5. Light editor mode toggle still works. Editor body flips cream (paper) instead of old `#fcfcfa`.
6. Community page renders with new walnut chrome. No broken contrast.
7. Sign-in / sign-up pages render with new walnut chrome.
8. Landing page renders with new walnut chrome.
9. Brand yellow still appears in the same places it did before.
10. Newsreader font loads — confirm via devtools Network panel that `newsreader-*.woff2` requests succeed.
11. Scrollbar custom utility still functional on long lists.
12. Premium badges, status indicators, save/unsaved states still render with reasonable colors.

## 8. Definition of done

- Full new oklch primitive set present in `app/globals.css` `:root` block.
- Shadcn semantic tokens bridged to new primitives.
- Existing custom tokens (`--color-surface`, `--color-brand`, etc.) bridged to new primitives.
- `@theme inline { ... }` block preserved + extended where needed.
- Newsreader font loaded via `next/font/google`, wired into `<html>` className, referenced via `--font-prose` token.
- Existing `@utility` blocks (scrollbar-custom, paper-stack, paper-stack-hover, mainFont, scrollbar-hide) reference new tokens instead of hardcoded hex.
- `corkboard-or-editor.tsx` light-mode `<style>` tag references new `--paper-*` tokens.
- All 12 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean.
- 1-2 atomic commits on main.

## 9. Risks (carried from brainstorm)

1. **Shadcn-bridge mismatch.** Mapping `--card`, `--background`, etc. to new chrome values may visually surface bugs the old palette hid (e.g., a `bg-card` button against a `bg-background` page now has more or less contrast). **Mitigation:** after DP1 lands, walk studio + community + auth + landing pages in dev, screenshot any visibly broken contrast for DP2's audit.

2. **oklch browser support.** Chrome 111+, Firefox 113+, Safari 15.4+. Older browsers fall back to no color — fail-loud, not silent corruption. Not a concern for the target audience.

3. **Newsreader load FOUC.** First page load before the font arrives shows the system serif. `next/font` with `display: 'swap'` is the standard; brief swap is acceptable.

4. **Existing utilities (paper-stack, scrollbar-custom).** These hardcode hex values. DP1 updates them. Risk: a util might be visually load-bearing for a surface and the new value renders subtly different. **Mitigation:** smoke-test scrollbars + paper-stack on book grid after the swap.

5. **Light editor mode CSS.** Many hardcoded light-mode hex values in `corkboard-or-editor.tsx`. Missing one means light mode looks half-walnut, half-old. **Mitigation:** explicit walk-through of every rule in that `<style>` tag during the port.

6. **Bridge token names.** Some new tokens (`--paper-ink`, `--paper-ink-strong`) don't have shadcn equivalents. Components that need them use them directly via `text-[var(--paper-ink-strong)]` or via new Tailwind utilities added by DP2-DP4 as needed. DP1 makes them available; DP2+ consume them.

## 10. Next sub-projects (informational)

After DP1 lands:
- **DP2 Studio Shell** — port binder, toolbar, editor body, status bar, metadata panel, hive integration. Pixel-perfect target. This is the largest sub-project.
- **DP3 Specialized Editor Surfaces** — FM/BM WYSIWYG previews, Outline (Claude Design proposed alternative layouts), Notes, Character profile. Structural fidelity.
- **DP4 Overlays / Modes / Modals** — corkboard, focus, history, find/replace, writing analysis, cheatsheet, export, confirmation dialogs, empty states. Structural fidelity.

Each gets its own brainstorm → spec → plan → execute cycle.
