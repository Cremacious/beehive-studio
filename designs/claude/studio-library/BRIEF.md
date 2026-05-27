# Claude Design Brief — /studio Library Page

Design a visually rich, on-brand landing page for the authenticated user's book library at `/studio` in **Beehive Studio** — a solo writer's book-writing SaaS ("Get buzzed about writing!"). This is the page users land on after sign-in. It needs to feel like a real, completed product — not a CRUD grid.

The page already shipped as v1 (functional, but flat and dull). I want a richer visual treatment that translates cleanly back into Tailwind v4 + the existing token system. **Pixel fidelity over novelty** — keep the structure, lift the surface.

---

## Brand & Design System (use these — do not invent new tokens)

These tokens are already wired in `app/globals.css` and the rest of the app is built on them. Use them.

**Chrome (cool neutral, hue 256°)** — page chrome, surfaces, borders:
- `--chrome-950: oklch(0.165 0.003 256)` (deepest)
- `--chrome-900` … `--chrome-100` (12-stop scale)
- Page bg ≈ `#1E1E1E` / cards ≈ `#252525`

**Paper (warm cream)** — book covers ONLY on this page, plus editor body elsewhere:
- `--paper-50` (lightest cream) → `--paper-300` (warmest)
- `--paper-ink`, `--paper-ink-strong`, `--paper-ink-muted` for text on cream

**Brand yellow** `--brand: #FFC300` — RESTRAINED. Currently sanctioned to 5 uses across the whole app:
1. Primary CTA (New Book / Resume writing)
2. Active filter chip / active state
3. Hover accent on book title (subtle)
4. Premium badge
5. Active toolbar button (editor only)

**Status tints** for chapter/book status:
- `--status-idea`, `--status-outline`, `--status-first-draft`, `--status-revised`, `--status-final` (used via relative-color `oklch(from … l c h / alpha)`)

**Type colors** for binder item types (chapter, character, outline, FM/BM, notes, research):
- `--type-chapter`, `--type-character`, `--type-outline`, `--type-fmbm`, `--type-notes`, `--type-research`

**Fonts:**
- Headings / numbers / brand: **Comfortaa** (`var(--font-display)`)
- Long prose (book content): **Newsreader** (`var(--font-prose)`)
- UI body: **Geist** (default)

---

## Current Structure (v1 shipped, keep this skeleton)

```
┌──────────────────────────────────────────────────┐
│  Library                        [+ New Book]      │  ← top bar
├──────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──┐ ┌──┐ ┌──┐         │
│  │ CONTINUE WRITING     │  │  │ │  │ │  │         │  ← hero + 3 stat tiles
│  │ The Hollow King      │  │12│ │1.2│ │ 0│         │
│  │ 12,402 words · 8 ch  │  │bk│ │k w│ │ ch│         │
│  │ [ Resume writing → ] │  │pg│ │wk │ │pub│         │
│  └──────────────────────┘  └──┘ └──┘ └──┘         │
├──────────────────────────────────────────────────┤
│  [🔍 Search…       ]  [Sort: Recent ▾]            │  ← controls
│  ( All 4 ) ( Drafting 3 ) ( Revised 1 )           │  ← filter chips
├──────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │book│ │book│ │book│ │book│ │book│               │  ← responsive grid
│  │    │ │    │ │    │ │    │ │    │               │     (2-5 cols)
│  │titl│ │titl│ │titl│ │titl│ │titl│
│  │12kw│ │ 4kw│ │24kw│ │ 0kw│ │ 8kw│
│  └────┘ └────┘ └────┘ └────┘ └────┘
└──────────────────────────────────────────────────┘
```

**Empty state** (zero books): rounded-card icon + "Your stories start here" + dual CTAs (Start writing / Explore books).

---

## What's Wrong With v1

- **Flat as a spreadsheet.** Same-shape cards, same-shape stat tiles, same-shape hero. No visual rhythm.
- **No texture.** Pure flat chrome backgrounds. Nothing reads as "warm bookshelf."
- **Hero doesn't feel hero.** It's just a sideways card.
- **Stat tiles are plain rectangles** with a number and a label. Functional but dead.
- **Book cards are featureless** when at rest — cover + title + word count, that's it. (Hover overlay reveals more, which is fine — but the at-rest state needs more personality.)
- **No bookshelf metaphor.** The app's whole pitch is "your stories, organized." The page should feel like a shelf.

---

## What I Want

Design a `/studio` library page that:

1. **Feels like a writer's bookshelf** — paper, warmth, texture in the right places (NOT everywhere — chrome stays cool gray; paper-warm is concentrated on covers + hero accents).

2. **Hero treatment for Continue Writing.** Make it noticeably bigger and richer than a card. Show progress (% of word goal? sparkline of last 7 days? chapter dots?). Give it visual weight — this is the single most-clicked action on the page.

3. **Stat tiles with personality.** Don't just stack numbers. Each tile could carry a tiny visualization (sparkline, ring, glyph) that earns its space. Three tiles total: **Books in progress / Words this week / Chapters published**.

4. **Book cards with at-rest character.** Cover dominates (paper-warm placeholder for no-cover books — existing pattern). Add subtle depth (paper edge shadow? slight tilt? stacked-card hint?). Title + word count below. Hover still reveals the status pill / genre / last edited / chapter count overlay.

5. **Restrained brand yellow.** Don't lacquer the page in yellow. One yellow CTA in the top bar, one on the hero. Filter chips can use yellow for the active state. That's it.

6. **Consider light-bookshelf-on-dark-room composition.** Cards have paper warmth; chrome around them stays cool dark gray. The contrast IS the design.

7. **Empty state** can be more evocative than v1's icon-in-a-box. An empty bookshelf? A single floating book inviting creation? Surprise me — but keep it brand-aligned and CTA-forward.

---

## Constraints

- Single-page design — desktop is the primary viewport (1440 wide), but show how it stacks on narrow (≤640).
- No new fonts. No new colors outside the documented tokens (you can use the existing scales freely, including stops not currently used).
- All chrome must stay cool/neutral (hue 256°). No warm tans/browns in chrome surfaces — paper warmth ONLY lives on book covers + hero accents.
- Avoid icon spam. Lucide icons exist (BookMarked, BookOpen, Clock, Plus, Search) — use sparingly.
- Output: HTML + inline `<style>` block (matches your past Beehive Studio designs — `studio-shell`, `specialized-surfaces`, `overlays-modes`). Reference tokens by their existing names in comments so we can map straight back to `globals.css`.

---

## Deliverables

1. **`library.html`** — populated state (4–6 books, hero + stats + controls + chips + grid).
2. **`library-empty.html`** — empty state.
3. **Optional:** `library-narrow.html` for stacked mobile view if it differs meaningfully.

Each file: complete HTML with inline `<style>` block, all tokens declared in a `:root` block at the top (copy from `globals.css` — already in this repo at `app/globals.css` if you want to read it). Self-contained — I should be able to open it in a browser and see the design.

---

## References (already in this repo)

- `designs/claude/studio-shell/` — the editor chrome design that shipped as DP2. Same token system. Same Comfortaa+Newsreader+Geist setup.
- `designs/claude/specialized-surfaces/` — DP3 design pass (Outline, Notes, Character, FM/BM). Shows the paper-on-chrome pattern.
- `app/globals.css` — full source of truth for tokens.
- `app/[locale]/(app)/studio/page.tsx` + `_components/` — v1 implementation. Read this to see exactly what already exists (BookCard, ContinueWritingHero, StudioStats, BookGrid, StudioEmptyState).

---

## Vibe Words

Bookshelf. Writer's desk by night. Warm paper, cool room. Productive but inviting. A little serif elegance. Not "social media feed." Not "Notion." Not "Google Drive." More like "the back wall of a small bookstore at dusk."
