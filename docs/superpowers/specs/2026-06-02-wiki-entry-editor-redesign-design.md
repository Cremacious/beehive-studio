# Wiki Entry Editor Redesign — Design Spec

**Date:** 2026-06-02
**Scope:** Visual + structural overhaul of the wiki entry document surface in the studio editor + the mirrored hive wiki entry surface. Presentation-only — no data shape changes, no server-action changes, no schema changes.

## Why

Three prior iterations of the wiki entry editor (cream-paper two-card stack → tile-gradient header card over recessed body → transparent hero over recessed body card with focus ring) all left Chris with the same complaint: the layout still reads like the old cream stack and it's not obvious where to click to start writing. Reframing was needed, not another tweak.

Brainstorm direction approved: **iOS Settings detail page** mental model. Centered transparent hero (title + category + tags, no card chrome), then a single explicitly *labeled* body card with a visible border + clear recess — the "BODY" label and the bordered recess together are the unmistakable disambiguator.

Reference mockup pinned at `.superpowers/brainstorm/36065-1780411345/content/both-themes.html`.

## The Design

### Structure (identical in both themes)

```
┌───────────────────────────── pane ──────────────────────────────┐
│  Wiki ▸ Character                              ● Saved          │ ← top bar (breadcrumb + save badge)
│                                                                  │
│                                                                  │
│                       Untitled entry                             │ ← TITLE (centered, transparent, 32px Comfortaa)
│                                                                  │
│                  [◐ Character]    [+ tag]                        │ ← CATEGORY PILL + TAGS row
│                                                                  │
│   BODY                              Markdown shortcuts work     │ ← labeled "BODY" row (small mono uppercase)
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Start writing — describe what makes this entry matter…    │ │ ← BODY CARD (recessed + bordered + min-height)
│  │                                                            │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Dark mode (default)

- **Pane:** standard panel gradient `--canvas-dark-250 → -200`, `--r-card`, `--sh-card`, `--br-card`.
- **Top bar:** `Wiki ▸ {category}` breadcrumb left (10px mono uppercase, `--canvas-dark-ink-muted`); `SaveStatusBadge` right.
- **Hero (transparent, sits on pane):**
  - Title is a `contenteditable` block centered, 32px Comfortaa, `letter-spacing: -0.02em`, `--canvas-dark-ink-strong`. Has its own subtle hover treatment (transparent background → faint `oklch(1 0 0 / 0.02)` bg + `oklch(1 0 0 / 0.06)` border on hover) so the user knows it's editable. When empty, shows italic muted "Untitled entry" placeholder in `--canvas-dark-ink-faint` (a new ink tone — see "New tokens" below).
  - Below the title: a centered row with the category pill (using `--wiki-{CATEGORY}` accent color, existing pattern) and the `TagChipStrip` component.
- **Body label row (small mono uppercase, `--canvas-dark-ink-muted`):**
  - Left: `Body`.
  - Right: `Markdown shortcuts work` (read-only mode: `Read-only`).
- **Body card (the unmistakable text area):**
  - Background `--canvas-dark-100` (the deepest legitimate dark surface).
  - **Hairline border** `1px solid oklch(1 0 0 / 0.10)` — this is the key visual change vs prior iterations.
  - Inset shadow `--sh-inset`.
  - Border radius 16px.
  - Padding `28px 32px`.
  - `min-height: 320px` so it's always a tall click target.
  - `cursor: text` on the whole card; clicking anywhere calls `editor.commands.focus()` (guarded against `isDestroyed`).
  - **Brand-yellow focus ring** when the editor has focus: layered `box-shadow: var(--sh-inset), 0 0 0 2px oklch(from var(--brand) l c h / 0.55)`. Driven by `data-body-focused` on the pane (TipTap `onFocus` / `onBlur`).
- **ProseMirror body text:**
  - Color `--canvas-dark-ink-strong` (bright white).
  - 15px / line-height 1.7.
  - H2 in Comfortaa 19px bold, `-0.01em` letter-spacing, `--canvas-dark-ink-strong`.
  - Strong: `--canvas-dark-ink-strong` weight 600.
  - Blockquote: `--canvas-dark-ink-muted` text, brand-yellow 3px left border at 55% opacity.
- **Placeholder text (the empty-state disambiguator):**
  - Italic, color `--canvas-dark-ink-faint` (visibly *lighter / more washed-out* than typed body text).
  - Copy: `Start writing — describe what makes this entry matter…`
  - Wired via `@tiptap/extension-placeholder` (already a dependency).

### Light mode (cream paper)

Identical structure, swapped tokens:

- **Pane:** `--paper-300` (cream).
- **Hero text:** `--paper-ink-strong` (dark brown ink — sharp on cream).
- **Hero hover treatment:** subtle warm `oklch(0 0 0 / 0.025)` background + `oklch(0 0 0 / 0.08)` border.
- **Body label:** `--paper-ink` (the muted-paper equivalent).
- **Body card:**
  - Background `--paper-50` (slightly *lighter* than the surrounding `--paper-300` canvas — the inverse of dark mode where it's *darker* than the canvas, but the same "different shade so users see this is a field" principle).
  - Border `1px solid oklch(0 0 0 / 0.10)` (warm-paper hairline).
  - Soft paper inset shadow: `inset 0 1px 0 oklch(0 0 0 / 0.04), 0 1px 0 var(--paper-200)`.
  - Focus ring: same brand-yellow `0 0 0 2px oklch(from var(--brand) l c h / 0.5)`.
- **Body text:** `--paper-ink-strong` (dark on cream).
- **Placeholder:** italic, `--paper-ink-muted` (the faint paper tone — visibly lighter than typed text).
- **Pane override** stays `!important` (existing pattern) so the dark gradient from inline-style doesn't bleed through in light mode.

### Theming bridge

Reuse the existing `[data-editor-theme="light"]` cascade pattern. All theme-dependent colors flow through a small set of local CSS variables (`--wiki-ink`, `--wiki-ink-strong`, `--wiki-ink-muted`, `--wiki-ink-faint`, `--wiki-body-bg`, `--wiki-body-border`, `--wiki-body-shadow`, `--wiki-ring`) declared on `[data-slot="wiki-entry-pane"]` for dark and overridden on `[data-editor-theme="light"] [data-slot="wiki-entry-pane"]` for cream.

### New tokens

- **`--canvas-dark-ink-faint`** — a new ink tone lighter than `--canvas-dark-ink-muted`, for the empty-state placeholder text. Value: `oklch(0.50 0.005 256)`. Add to `:root` in `app/globals.css`.
- No other new tokens. Borders use inline `oklch(1 0 0 / 0.10)` / `oklch(0 0 0 / 0.10)` literals — these are field-edge hairlines that don't merit a new top-level token until a second consumer arises.

### Hive mirror

`app/[locale]/(app)/hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx` is a clone-not-extract of the studio editor (per H2 pattern in AGENTS.md). Mirror the same redesign with two hive-specific additions:

1. **Top bar gains a `← Back to wiki` button** on the left (replaces the breadcrumb in the studio version) so it stays clickable.
2. **`Last edited by @{username} · 5m ago` line** sits in the top bar's right cluster, before the save badge. Existing functionality, preserved visually using `--canvas-dark-ink-muted` / `--paper-ink-muted`.

Everything else — hero, body label, body card, placeholder, focus ring, theme tokens — is identical to the studio.

## Affordances preserved (no behavior change)

- Title `contenteditable` + `commitTitle` on blur (studio: optimistic provider update; hive: `updateBinderItemAction` + `router.refresh` on return).
- `TagChipStrip` with category accent color.
- 800ms debounced auto-save via `updateBinderItemAction`.
- `SaveStatusBadge` save indicator.
- Read-only mode (BETA_READER): TipTap non-editable, no save badge, footer "Read-only — your role is Beta Reader" message rendered as a small recessed pill at the bottom.
- Same `data-slot="wiki-entry-pane"` hook so any caller relying on it keeps working.
- Same TipTap extensions (StarterKit limited to heading level 2 + `@tiptap/extension-placeholder`).

## Out of scope

- Light-mode toolbar chrome (unchanged).
- Wiki folder renderer / character profile renderer / outline editor / notes editor — all separate surfaces, each handled by their own design pass.
- Public reader serialization of wiki entries (uses `lib/export/tiptap-to-html.ts`, not this component).

## Risk + verification

- Pure presentational rewrite. No imports gained or lost beyond optionally adding `@tiptap/extension-placeholder` (already in `package.json`).
- `tsc --noEmit` must stay clean.
- 424/424 vitest suite stays green (no DB / action / pure-helper touched).
- Manual smoke (Chris): create a new wiki entry from the binder Add menu → confirm centered title + chips above a clearly bordered body card with italic placeholder visible → click anywhere in the body card → confirm the brand-yellow focus ring appears + typing places bright-white text. Toggle editor theme light → confirm cream-paper variant. Open the same entry in a hive (`/hive/[hiveId]/wiki` → click entry) → confirm hive variant matches.
