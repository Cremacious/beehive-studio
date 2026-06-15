# Sparks Hub Density Pass — Design Spec

**Date:** 2026-06-15
**Surface:** `/[locale]/sparks` (the personal community hub shipped today in commits 5f93afe → dfd6e09)
**Goal:** kill the "page feels half-empty" problem when the viewer has few sparks / friends / follows. Make `/sparks` feel inhabited from day one, and give every empty bucket a path to filling itself.

---

## Problem

The Sparks Hub ships its layout cleanly — header + tab strip + sort row + grid + pagination — but on a real new account (1 spark, 0 follows, 0 friends, 0 entered) it has ~5% of the viewport filled. Tabs `Following · 0` / `Friends · 0` / `Entered · 0` each lead to an empty state, which is honest but not motivating.

Two compounding causes:
1. **No persistent UI volume.** Whether the user has 1 spark or 50, the page is purely a grid. Sparse data → sparse page.
2. **Empty buckets surface as dead ends.** Empty state explains why the bucket is empty but doesn't help the user fix it inline.

## Solution — A + C combined

**A. Right rail (300px, sticky).** The page becomes a 2-column layout: main grid + permanent right rail. The rail provides three panels that surface useful platform context regardless of the viewer's data:
- *Suggested writers* — 3-4 platform users to follow, ranked by activity + genre match
- *Trending now* — top 3 platform sparks from Discover
- *Your spark stats* — 4-tile mini-dashboard (Created / Entered / Entries received / Wins)

**C. Ghost cards in the grid.** When the active bucket has fewer than N real sparks, the action fills the remaining grid slots with **suggestion cards** that match real-card dimensions but use a distinct visual treatment (dashed border, muted background, "label-note" pill in the corner). Each ghost is a contextual nudge toward filling a real bucket.

The two work together. The rail keeps the page from ever looking empty in absolute terms; the ghost cards fix the specific "wow, Following has zero" feeling inside the grid.

Width also fixes to 1680px to match `/studio`.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┬─────────────┐
│ Sparks                                          [+ New Spark]│             │
│ Sparks from you, your circle, and prompts you've entered.    │             │
│                                                              │ Suggested   │
│ [All·1] [Yours·1] [Following·0] [Friends·0] [Entered·0]      │ writers     │
│                                                              │             │
│ 1 spark · 5 suggestions to fill the page    Sort: Recent ▾   │ ───         │
│                                                              │             │
│ ┌─────────┐ ┌─ ─ ─ ─┐ ┌─ ─ ─ ─┐ ┌─ ─ ─ ─┐                    │ Trending    │
│ │ Real    │ │ Ghost │ │ Ghost │ │ Ghost │                    │ now         │
│ │ spark   │ │ Disc. │ │ Follow│ │ Friend│                    │             │
│ └─────────┘ └─ ─ ─ ─┘ └─ ─ ─ ─┘ └─ ─ ─ ─┘                    │ ───         │
│                                                              │             │
│ ┌─ ─ ─ ─┐ ┌─ ─ ─ ─┐                                          │ Your        │
│ │ Ghost │ │ Ghost │                                          │ spark stats │
│ │ Prompt│ │ Enter │                                          │             │
│ └─ ─ ─ ─┘ └─ ─ ─ ─┘                                          │             │
└──────────────────────────────────────────────────────────────┴─────────────┘
   max-width: 1680px                                              300px sticky
```

---

## Right rail panels

All three panels render in every bucket tab. The rail is `position: sticky; top: 80px` so it stays visible during scroll.

### 1. Suggested writers
- Up to 4 rows: avatar · name · @handle · "N open sparks · {top genre}" · Follow button (brand-yellow filled for the top suggestion, ghost-bordered for the rest)
- Ranking: reuse `getSuggestedWritersAction` from `/community` (community.actions.ts) — already exists, no new server work
- "See all →" link routes to `/discover?tab=sparks` (or future writer-discovery page)
- Hidden when the viewer follows ≥ 10 writers (signal: this affordance is no longer useful)

### 2. Trending now
- Top 3 platform sparks across all of Discover's `OPEN` + `VOTING` states, ranked by entries this week
- Compact 1-line title + meta line ("⚡ OPEN · 23 entries · 3d left")
- Click → spark detail page
- Reuses existing Discover sparks data; new lightweight action `getTrendingSparksForRailAction({ limit: 3 })`
- Never hidden — even power users want to see what's hot

### 3. Your spark stats
- 4-tile dashboard in 2×2 grid:
  - **Created** — count of sparks where `userId = viewer`
  - **Entered** — count of spark entries by viewer
  - **Entries received** — sum of entries on viewer's open sparks
  - **Wins** — count of sparks where viewer's entry was the winner
- Brand-yellow on the Created tile only (matches the brand-yellow restraint rule)
- Single new action `getViewerSparkStatsAction()` returns all 4 counts

---

## Ghost cards

Each ghost card is the same dimensions as a real `<SparkCard>` (~280×200) so they slot cleanly into the `repeat(auto-fill, minmax(280px, 1fr))` grid. Distinct visual treatment so users never confuse them with real content:

- **Border:** `1.5px dashed rgba(255,255,255,0.10)` (vs real card's solid panel gradient)
- **Background:** `rgba(255,255,255,0.015)` flat (vs real card's two-stop gradient)
- **Corner label pill:** mono uppercase 9px text in `rgba(255,255,255,0.06)` background, says "Suggestion" / "From Discover" / "Prompt template"
- **Icon chip:** 36×36 rounded square with category-tinted background (blue for follow, purple for friends, green for entered, brand-yellow for prompt-template)
- **CTA:** brand-yellow inline "Action →" text link, not a button

### Ghost type catalog

Six ghost variants, picked dynamically based on the active tab and viewer state:

| Variant | Trigger | Body | CTA |
|---|---|---|---|
| **From Discover** | always when grid has < 6 real items | Trending platform spark (title + prompt teaser + entries/time-left) | `Enter →` → `/discover/spark/[id]` |
| **Follow writers** | when Following bucket has < 3 real | "Your Following tab is empty. We can suggest active writers." | `Find writers →` → `/discover?tab=sparks` |
| **Connect with friends** | when Friends bucket has < 1 real | "When friends accept your request, their sparks show up here." | `Manage friends →` → `/friends` |
| **Prompt template** | always (rotates daily per viewer) | Pre-baked prompt from the 10-item seed list below | `Use this prompt →` → `/sparks/new?prompt=<encoded>&wordLimit=<n>` |
| **Enter a Spark** | when Entered bucket has 0 real | "Sparks you enter collect here." | `Browse open Sparks →` → `/discover?tab=sparks` |
| **Create your first** | when Yours bucket has 0 real | "Got a prompt nagging at you?" | `+ New Spark` → `/sparks/new` |

### Per-tab ghost selection logic

Each tab gets up to 5 ghosts. Logic runs in the server action, AFTER fetching real sparks for the bucket:

- **All tab:** mix relevant ghosts based on which buckets are sparse. Order: From Discover · Follow writers (if Following empty) · Connect friends (if Friends empty) · Prompt template · Enter a Spark (if Entered empty)
- **Yours tab:** Prompt template × 2 (different prompts) + From Discover (if real count < 3)
- **Following tab:** Follow writers + From Discover × 2
- **Friends tab:** Connect with friends + From Discover × 2
- **Entered tab:** Enter a Spark + From Discover × 2 + Prompt template

**Cap:** 5 ghosts maximum, OR until total cards (real + ghost) reach 6 — whichever hits first. Concrete table:

| Real sparks | Ghosts shown | Total cards |
|---:|---:|---:|
| 0 | 5 | 5 |
| 1 | 5 | 6 |
| 2 | 4 | 6 |
| 3 | 3 | 6 |
| 4 | 2 | 6 |
| 5 | 1 | 6 |
| 6+ | 0 | n (page is healthy) |

### Prompt template seed list

The "Prompt template" ghost variant draws from this curated seed list. Implementation picks deterministically by `(viewerId + dayOfYear) % seedList.length` so a given viewer sees the same template all day but it rotates daily.

```
1.  "A door that only opens on Tuesdays" — 500 words
2.  "Write a 100-word story where nothing happens, and it matters" — 100 words
3.  "What if [object] could remember? Pick an everyday object. Give it 100 years of memory" — 800 words
4.  "The last letter from a sentient lighthouse" — 600 words
5.  "A 3-line poem about hunger" — 50 words
6.  "Describe a color that doesn't exist" — 300 words
7.  "Two strangers, one bench, no dialogue" — 500 words
8.  "Write a recipe for an emotion" — 200 words
9.  "Your character's morning routine, but reveal a secret on line 7" — 400 words
10. "A weather report from inside a dream" — 250 words
```

Templates encode into the CTA URL as `/sparks/new?prompt=<encoded-text>&wordLimit=<n>` so the New Spark form pre-fills both fields. Future templates land in `lib/sparks/prompt-templates.ts` as a single exported array — no DB table needed.

### Dismiss behavior

Each ghost has a small `×` in the top-right corner. Dismissing writes a localStorage entry (`sparks-hub:dismissed-ghosts: ['follow-writers', ...]`) so the same ghost doesn't reappear in this browser. Cleared on sign-out. No server persistence — this is purely a UX nicety.

---

## Acceptance criteria

1. `/en/sparks` width is 1680px (matches `/studio`).
2. Right rail renders on every bucket tab; sticky during scroll; all 3 panels populated with real data.
3. Suggested writers panel reuses `getSuggestedWritersAction` from community; no new ranking logic.
4. Trending now uses new `getTrendingSparksForRailAction({ limit: 3 })` returning a thin projection (id, title, status, entryCount, deadline).
5. Stats panel uses new `getViewerSparkStatsAction()` returning `{ created, entered, entriesReceived, wins }`.
6. Ghost cards fill the grid up to a total of 6 visible cards (real + ghost) when the bucket has < 6 real. Hidden when real ≥ 6.
7. Per-tab ghost selection matches the table above. Dismissed ghosts respect localStorage.
8. Ghost cards visually distinct: dashed border, flat background, corner label pill. Never confusable with real cards.
9. The "Suggestion" / "From Discover" / "Prompt template" label pill is mono uppercase 9px in a muted chip.
10. CTAs route to the right next surface (`/discover?tab=sparks`, `/friends`, `/sparks/new`, etc.) with locale prefix.
11. Sort dropdown only affects real sparks, not ghosts. Ghosts always render in their fixed selection order at the END of the visible cards.
12. Pagination only counts real sparks; ghosts never appear on page 2+.

---

## Out of scope

- New friend-finder surface beyond what `/friends` already provides
- Server-side persistence of dismissed ghosts (localStorage only)
- Notification-bell-style "you have 3 new suggested writers" badging
- Per-tab right rail variants (panels stay identical across tabs for v1)
- ML scoring of ghost suggestions (deterministic rules only)
- Animation/transition for ghost dismissal
- A/B test infrastructure for ghost density

---

## Risks

1. **Ghost cards confused with real sparks.** Mitigation: dashed border + flat background + corner label pill — three independent signals. Smoke-test by showing a friend a screenshot, can they identify which are real in < 3 seconds?
2. **Stats query cost.** Four counts on a hot path. Mitigation: single action with parallel `Promise.all` of 4 indexed `count()` queries; cache via `unstable_cache(..., ['viewer-spark-stats', viewerId], { revalidate: 60 })`.
3. **Prompt template feels gimmicky.** Mitigation: seed list is short (~20), curated for tone, rotates daily not per-page-load. Cut entirely if smoke feedback is bad.
4. **Right rail clutters on smaller viewports.** Mitigation: rail collapses below 1280px viewport width (drops to single column, panels stack below grid). Acceptable trade — the empty-feel problem is desktop-specific anyway.
5. **`getSuggestedWritersAction` returns 0 results for users with no signal.** Mitigation: panel hides itself when results empty; the rail still has 2 panels remaining.
