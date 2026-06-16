# Community Dashboard — Bento Redesign

**Date:** 2026-06-16
**Author:** Chris + Claude
**Status:** Locked, ready for plan
**Supersedes:** [docs/superpowers/specs/2026-06-16-community-hub-dashboard-design.md](2026-06-16-community-hub-dashboard-design.md) (T1-T4 shipped earlier today as commits b1f9dd0 / 460e331 / 60dc8a9 / 610312b; smoke + variant-D pass landed 265a1dc / a1853f3 / 322e68b. Full replacement intended.)
**Brainstorm artifacts:** `.superpowers/brainstorm/34275-1781636500/content/bento-v6.html`, `bento-v5.html`, `bento-v2.html`, `layout-variants.html`.

---

## Motivation

The `/community` page just landed as a feed-left + 5-panel-right-rail hub. Smoke surfaced that even with variant-D chrome + live-nudge empty states, the page still reads as "half-finished" — empty state too sparse, populated state anemic. The shape itself (long thin feed column with small rail panels) doesn't feel like the **activity dashboard** the page is meant to be.

Chris wants a top-to-bottom overhaul: a real writer's activity dashboard surfacing (a) what friends have been doing and (b) activity on content the user is involved in — styled to match the dark iOS-inspired design system established by the editor + hive refreshes.

After exploring three layout directions (Bento Hero Grid / Magazine Sections / Pulse Dashboard), Chris locked **Bento Hero Grid** — Apple-Fitness-style mixed-tile grid where varied tile sizes do the visual work, anchored by a hero card and a stats panel at top.

---

## Goals

1. Replace the current `/community` page with a 7-panel bento grid that reads as a curated dashboard, not a half-built feed.
2. Eliminate the "looks empty / looks anemic" failure modes in both populated AND empty states. Every tile has a defined visible shape regardless of data volume.
3. Surface viewer-relevant signals friends-first, then content-the-user-is-in, with brand-yellow restraint preserved.
4. NO DB schema changes — derive everything from existing tables.

## Non-goals

- 30D pulse window (deferred to v2; 7D ships in v1).
- Saved filter presets, per-tile drag-reorder, dashboard customization.
- Cross-entity unified activity event taxonomy. Feed sources stay as `social_activity` event store; the redesign is presentational + aggregation.
- Mobile redesign. Below `xl` (1280px) the bento collapses to single-column stack — same components, vertical order Hero → Pulse → Hives → Sparks → Lists → Friends → Clubs.

## Replaces

- `app/[locale]/(app)/community/page.tsx` — full rewrite.
- `app/[locale]/(app)/community/_components/highlights-rail.tsx` — deleted (5-panel right rail superseded).
- `app/[locale]/(app)/community/_components/activity-feed.tsx` — deleted (feed becomes the bottom-left Friends' Desks panel, see §Per-Panel Spec).
- `lib/actions/community-hub.actions.ts` + `lib/actions/community-hub.shared.ts` — rewritten in place. Aggregator widens from 5 highlight slots to 7 bento slots; projection shape changes; some sub-queries reused, some new.

---

## Layout

**Outer container:** `max-w-[1680px] mx-auto px-4 py-6` matching `/studio` precedent.

**Page header:** flex justify-between row above the grid.
- Left: `h1 "Community"` (Comfortaa bold 26px, `--brand`) + dynamic sub-line (12px, `--ink-muted`) — e.g. `"Sunday afternoon · 4 friends writing right now"`. Day-of-week + friend-online count from existing data.
- Right: 2 mono pills (`FILTER · ALL` / `↻ LIVE`). V1 pills are display-only — no filter sheet yet.

**Grid:** `display:grid; grid-template-columns:repeat(12,1fr); gap:14px;` at `xl` and up. Below `xl`, single-column stack (see §Responsive).

### Panel layout map

| # | Panel | Cols | Min-h | Empty fallback |
|---|---|---|---|---|
| 1 | Hero (Fresh from a friend) | span 8 | 172px | Today's Spark prompt with Write now CTA |
| 2 | Your Pulse (4 stat tiles) | span 4 | 172px | Same chrome, zeros/dashes + helper hints |
| 3 | Hives (3 rows) | span 4 | 264px | 3 live-nudge rows (Browse / Create / Visit) |
| 4 | Sparks (3 rows) | span 4 | 264px | 3 live-nudge rows (Enter today's prompt / Create / Vote) |
| 5 | Lists (3 rows) | span 4 | 264px | 3 live-nudge rows (Trending / Create / Browse) |
| 6 | Friends' Desks (chronological) | span 7 | 320px | Centered hero with Find writers + Invite a friend |
| 7 | Clubs (you're in) | span 5 | 320px | 3 join-nudge rows + Create |

Brand-yellow restraint: panel-header mono labels, `All N →` panel-see-all links, hero `★ FRESH FROM A FRIEND` mono label, hero primary CTA, pulse stat numbers, mid-tile row CTAs (REVIEW pill), `Load older` chrome stays muted, friend handles stay ink-strong (not brand).

---

## Per-Panel Spec

### Panel 1 — Hero (Fresh from a friend) · 172px · cols 1-8

**Locked layout (bento-v6.html):**

- Outer panel: standard `--panel` chrome (linear-gradient + top highlight + `--sh-card`). 16px 20px padding.
- Single horizontal flex row: cover left (`104×148`, `align-self:center`), body right (`flex:1`, `display:flex; flex-direction:column; justify-content:center; gap:7px`).
- Body content stack (vertically centered in card):
  1. **Label row** (`display:flex; justify-content:space-between`):
     - Left: mono label, brand-yellow, 10px, uppercase tracking-wider — text varies by hero kind (see §Hero kinds).
     - Right: meta inline — `"2h ago · ♥ 24 · 💬 6"` at **12px Courier mono in mid-ink** (`--ink`), tracking-wider, font-weight 600. NOT muted-gray. Reads as peer of the label across from it.
  2. **Headline h1** — 18px Comfortaa bold, ink-strong, line-height 1.28. Single line ideally; wraps to 2 if long.
  3. **Quote** — `italic Georgia serif`, 12.5px, line-height 1.5, `--ink-muted`. `display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden`. Pulled from the chapter content's first non-empty paragraph (existing helper).
  4. **CTA row** — 8px gap. Primary brand-yellow pill (`Read chapter →`, navigates to the chapter route). Secondary muted pill (`Open book`, navigates to the book overview).

**Hero kinds (priority resolver):**

```
1. NEW_CHAPTER_FROM_FOLLOWED      — followed writer (not viewer) published a chapter in last 24h → "★ FRESH FROM A FRIEND"
2. FRIEND_SPARK_WIN               — followed writer won a spark in last 24h                       → "★ A FRIEND JUST WON"
3. FRIEND_NEW_BOOK                — followed writer published a book in last 7d                   → "★ A FRIEND HAS A NEW BOOK"
4. FRIEND_JOINED_HIVE_WITH_VIEWER — followed writer joined a hive viewer is in                    → "★ A NEW WRITER IN YOUR HIVE"
5. TODAYS_SPARK                   — today's featured spark prompt                                  → "★ TODAY'S SPARK" (empty fallback)
6. FEATURED_DISCOVERABLE_BOOK     — featured fresh book                                            → "★ FRESH FROM THE COMMUNITY"
```

**Secondary CTA per kind:**
- kind 1: `Open book` → `/books/<bookId>`
- kind 2: `See entry` → `/sparks/<sparkId>/entry/<entryId>`
- kind 3: `Open book` → `/books/<bookId>`
- kind 4: `Visit hive` → `/hive/<hiveId>`
- kind 5: `See prompt` → `/sparks/<sparkId>`
- kind 6: `Open book` → `/books/<bookId>`

Kind 5 (Today's Spark) is also the **empty-state fallback** — replaces the friend cover with a brand-yellow `✨` glyph chip (140×140 rounded), headline becomes the spark prompt, body becomes prompt metadata (word limit + entries count + deadline). CTAs: `Write now →` (primary, routes to `/sparks/new?prompt=<id>`) + `See prompt` (secondary, routes to `/sparks/<id>`).

---

### Panel 2 — Your Pulse · 172px · cols 9-12

**Locked layout (bento-v5.html stat tiles):**

- Outer panel: standard `--panel` chrome, 12px 14px padding.
- Head row (8px margin-bottom): mono label `YOUR PULSE` (brand-yellow) + right-side window selector pills. **v1: `7D` pill only, no toggle.** (30D deferred.)
- 2×2 grid of stat tiles, 8px gap, `flex:1`.

**Stat tile internal layout** (3-row CSS grid with 2 columns):
```
grid-template-columns: 1fr auto;
grid-template-rows: auto 1fr auto;
grid-template-areas:
  "label spark"
  "num   spark"
  "num   delta";
```
- `label`: 10px Courier mono uppercase, `--ink-muted`, tracking-wider, line-height 1, align-self:start.
- `spark`: 64×28 SVG polyline at brand-yellow, stroke-width 1.8, NO opacity dim. align-self:center, justify-self:end.
- `num`: 30px Comfortaa bold, brand-yellow, line-height 1, align-self:center.
- `delta`: 11px Courier mono bold, `--green` (`#4ade80`), text-align:right, align-self:end.
- `sub` (alternative to delta for stats without a meaningful delta): 10px Courier mono, `--ink-dim`.

**Tile background:** `linear-gradient(180deg, var(--canvas-350), var(--canvas-300))`, `--r-row` 11px, `--sh-tile`, 10px 12px padding.

**4 tiles (left-right, top-bottom):**

| Tile | Label | Num | Delta/sub | Source |
|---|---|---|---|---|
| 1 | WORDS | k-formatted last-7d sum | `↑ N%` vs prior 7d | `binder_items.last_edited_by = viewer` joined `chapters.word_count` 7d diff |
| 2 | FOLLOWERS | `+N` last 7d gain | `↑ N today` | `follows.followee_id = viewer` created_at filter |
| 3 | READS · CH N | reads of viewer's latest published chapter | `Nh since` (time since publish) | `chapter_reads` count where chapter is viewer's latest published |
| 4 | LIKES + COMMENTS | sum last 7d | `↑ N today` | `book_likes` + `book_comments` on viewer's books 7d |

**Empty state** (brand-new account, no signals):
- Stat 1: num `—` ink-dim; sub: `"Start a book to begin tracking"` (ink-dim, 10px Courier mono).
- Stat 2: num `0` ink-dim; sub: `"Publish a chapter to start"`.
- Stat 3: num `—` ink-dim; sub: `"No published chapter yet"`.
- Stat 4: num `0` ink-dim; sub: `"Share work to receive feedback"`.

Sparkline omitted when num is `—`; rendered with 7 zero points when num is `0`.

**Sparkline data:** 7-element `number[]` per stat returned from `getViewerPulseStats(viewerId)`, each element = daily count for the past 7 days (chronological, oldest first). Client renders as SVG `polyline` with auto-scaling viewBox.

---

### Panel 3-5 — Mid-tiles (Hives / Sparks / Lists) · 264px · cols 1-4, 5-8, 9-12

**Locked layout (bento-v2.html):**

- Outer panel: standard chrome.
- Panel-head (16px 18px 10px padding): mono label brand-yellow (e.g. `🐝 HIVES · 3 ACTIVE`) + right-side `panel-see-all` link `All N →` brand-yellow Courier mono routing to deep destination.
- Panel-body (0 12px padding, `flex:1`, gap:6px): exactly **3 rows** — uniform 52px-tall row tiles, never more, never fewer.
- Panel-foot (8px 18px 14px padding): empty by default — reserved for future "Load more" without changing height.

**Row tile shape** (`row-tile` class):
- `linear-gradient(180deg, var(--canvas-350), var(--canvas-300))`, 12px radius, `--sh-tile`, 10px 12px padding.
- `display:flex; gap:10px; align-items:center; min-height:52px;`.
- Leading slot (28×28): avatar OR icon-chip OR mini cover-stack (Lists tile uses `book-cover-mini 28×40` × 3 with rotation -3°/0°/+3°).
- Body slot (`flex:1; min-width:0`): two-line cell — `.t1` (12px Comfortaa font-weight 600, ink-strong, line-height 1.3) + `.t2` (10px Courier mono uppercase tracking-wider, ink-muted, line-height 1.3, margin-top 2px).
- Trailing slot: optional pill (REVIEW / 6H / YOURS / VOTE / 3 NEW) using existing pill tokens.

**Per-panel content priorities:**

**3. Hives** — pulled from existing `getHiveActivityFeedAction`-style query, filtered to viewer's hives in last 48h. Priority: submission awaiting viewer review > friend left annotations > word goal hit > new member joined. `All N →` routes to `/hives`.

**4. Sparks** — viewer-relevant first. Priority: viewer's spark with new entries > spark ending in <12h that viewer's friends entered > today's featured spark > voting open. `All N →` routes to `/sparks`.

**5. Lists** — trending lists in viewer's network. Priority: list a friend follows that gained >5 followers this week > viewer's own list with new followers > themed list matching viewer's reading. Each row's leading slot is a 3-mini-cover stack. `All N →` routes to `/reading-lists`.

**Empty fallback per panel:** keep the same 3-row shape, fill with 3 live-nudge rows. Each nudge row:
- `background: linear-gradient(180deg, rgba(255,195,0,0.06), rgba(255,195,0,0.02))`
- `border: 1px solid rgba(255,195,0,0.15)`
- Icon-chip in brand-yellow tint (`rgba(255,195,0,0.12)` bg, brand-yellow icon) at 28-32px.
- `.t1` + `.t2` per regular row.
- Trailing slot: brand-yellow pill button (Browse / Create / Visit / Enter / Vote / Join) with `padding:5px 10px`, 10px Courier mono uppercase, font-weight 700, routing to the appropriate deep destination.

**Empty nudge content (locked):**
- **Hives empty:** (1) "N open hives looking for writers" → Browse → `/discover?tab=hives`; (2) "Start your own Hive" → Create → `/studio` (with createHive query); (3) "{TrendingHiveName} is recruiting" → Visit → `/hive/<id>`.
- **Sparks empty:** (1) "Today's prompt: {prompt}" → Enter → `/sparks/<id>`; (2) "Run your own Spark" → Create → `/sparks/new`; (3) "{VotingSparkName} voting now" → Vote → `/sparks/<id>`.
- **Lists empty:** (1) "{TrendingListName}" + 3-cover stack → row click to `/reading-lists/<id>`; (2) "Build your first list" → Create → `/reading-lists/new`; (3) "N lists tuned to your taste" → Browse → `/discover?tab=lists`.

---

### Panel 6 — Friends' Desks · 320px · cols 1-7

The **chronological river** — the one panel that supports inline pagination, since it's the closest thing in the dashboard to a feed.

- Panel-head: mono label `FRIENDS' DESKS · CHRONOLOGICAL` brand-yellow + `Full feed →` panel-see-all link routing to **new route `/community/feed`** (see §New routes).
- Panel-body: 4 row tiles by default — uniform 52-60px tall, vertically stacked, 6px gap. Each row shows: avatar (28px) + body (`.t1` ink-strong + serif italic `.t2` ink-muted) + trailing pill (e.g. `📝 WRITING`, `● ONLINE`).
- Panel-foot: full-width tile-styled "Load older activity" button. Click loads next page via cursor pagination, appends rows below. Panel grows in height as more rows load (one of the few panels that does — no hard cap on this one).

**Row content:** rich text built from `social_activity` events the way `<ActivityEventRow>` already does, but with the new panel chrome. Reuse existing event-row builder verbatim — the content stays, only the wrapper changes.

**Empty fallback** (no friends followed):
- Centered hero (no rows): 48×48 brand-yellow bee chip + ink-strong "Your friends' writing lives here." + italic-serif sub "Follow other writers and you'll see their chapters, sparks, and progress fill in below — chronologically." + 2 CTAs (`Find writers` brand pill / `Invite a friend` muted pill).

---

### Panel 7 — Clubs · 320px · cols 8-12

3 club-row tiles. Each row tile:
- Leading: `book-cover-sm 48×70` of the club's current book (or gradient placeholder + first-initial when no current book — existing pattern).
- Body: `.t1` club name (Comfortaa bold 13px ink-strong) + `.t2` italic-serif ink-muted (e.g. "Reading Salt & Iron · Ch 4 · 3 new posts").
- Trailing pill: brand-yellow (`VOTE`), soft-blue (`3 NEW`), or absent.

`All N →` panel-see-all routes to `/clubs`.

**Empty fallback:** 3 join-nudge rows + 1 Create-your-own-club nudge. Each uses the same nudge chrome as the mid-tiles. Routes: Join → `/clubs/<id>` join flow; Create → `/clubs/new` (existing).

---

## Empty states (summary)

| Panel | Trigger | Shape |
|---|---|---|
| Hero | No friend signal | Today's Spark fallback (kind 5) |
| Pulse | Always renders | Stats show `—`/`0` + helper hints |
| Hives | No viewer hives | 3 live-nudge rows |
| Sparks | No viewer spark activity | 3 live-nudge rows |
| Lists | No viewer list activity | 3 live-nudge rows |
| Friends' Desks | No friends OR no activity | Centered Find writers hero |
| Clubs | Viewer in no clubs | 3 join-nudge + 1 Create nudge |

**No panel ever vanishes.** Every panel keeps the same shape regardless of data. This is the load-bearing fix for the "looks empty / looks anemic" failure mode.

---

## Pagination model

**"Preview tile, deep destination."**

- Mid-tiles (Hives / Sparks / Lists) hard-cap at 3 rows, never paginate inline. `All N →` panel-see-all link routes to the existing deep surface for the full list.
- Clubs panel same model — 3 rows, `All N →` to `/clubs`.
- Hero is single-item — no pagination.
- Pulse is fixed at 4 stat tiles — no pagination.
- **Friends' Desks is the only inline-paginating panel.** `Load older activity` appends rows via cursor; panel height grows. `Full feed →` deep-links to new `/community/feed` route for a focused chronological view.

---

## New routes

1. **`/[locale]/community/feed`** — new route. Full-page chronological feed (same content as the Friends' Desks panel, no other panels). Server component, parallel-fetches `getCommunityFeedAction({limit: 30})`, renders `<ActivityFeedFull>` client component with cursor pagination. Uses existing `social_activity` event row component. Minimal page chrome: `← Back to dashboard` link + `Friends' Desks` h1 + the feed list. This route is the one piece of the redesign that ships as a separate small surface so the dashboard's Friends panel can stay focused.

---

## Server-action shape

### `getCommunityDashboardAction(): Promise<CommunityDashboardData>`

Single aggregator. Wrapped in React `cache()`. Each slot wrapped in the load-bearing `safe()` helper from T1 so one slow/failing sub-query doesn't take the page down.

```ts
// lib/actions/community-dashboard.shared.ts
export type CommunityDashboardData = {
  hero: HeroSignal | null;          // null = empty fallback rendered client-side
  pulse: PulseStats;                // never null — zeros on empty
  hives: HivesPanelData;
  sparks: SparksPanelData;
  lists: ListsPanelData;
  friends: FriendsDeskData;         // includes first page of feed + nextCursor
  clubs: ClubsPanelData;
  fallbacks: DashboardFallbacks;    // pre-fetched data for any empty panel's live nudges
};

export type HeroSignal = {
  kind: 'NEW_CHAPTER_FROM_FOLLOWED' | 'FRIEND_SPARK_WIN' | 'FRIEND_NEW_BOOK'
      | 'FRIEND_JOINED_HIVE_WITH_VIEWER' | 'TODAYS_SPARK' | 'FEATURED_DISCOVERABLE_BOOK';
  label: string;                    // "★ FRESH FROM A FRIEND" etc.
  metaInline: string;               // "2h ago · ♥ 24 · 💬 6"
  headline: string;
  quote: string | null;
  coverUrl: string | null;          // null when kind = TODAYS_SPARK (glyph fallback)
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string } | null;
};

export type PulseStats = {
  words: PulseStat;
  followers: PulseStat;
  reads: PulseStat & { chapterNumber: number | null };  // null when no published chapter
  engagement: PulseStat;             // likes + comments
};
export type PulseStat = {
  value: number;                     // -1 = "—" placeholder
  delta: string;                     // "↑ 12%" or "↑ 3 today" or "2h since"
  deltaTone: 'green' | 'dim';
  sparkline: number[];               // 7 elements, oldest first
  hint: string | null;               // helper text for empty-state stat
};

export type PanelRow = {
  id: string;                        // stable key for React
  leading:
    | { kind: 'avatar'; avatarUrl: string | null; fallbackInitial: string }
    | { kind: 'icon'; glyph: string; tone: 'brand' | 'green' | 'blue' | 'purple' }
    | { kind: 'cover-stack'; covers: { coverUrl: string | null; title: string }[] }  // up to 3
    | { kind: 'cover'; coverUrl: string | null; fallbackInitial: string };
  t1: string;                        // may contain `**bold**` markers parsed client-side
  t2: string;
  trailingPill: { label: string; tone: 'brand' | 'mono' | 'green' | 'blue' | 'purple' } | null;
  href: string;                      // row click target
};

export type HivesPanelData  = { label: string; seeAllHref: string; rows: PanelRow[]; }; // rows.length <= 3
export type SparksPanelData = { label: string; seeAllHref: string; rows: PanelRow[]; };
export type ListsPanelData  = { label: string; seeAllHref: string; rows: PanelRow[]; };
export type ClubsPanelData  = { label: string; seeAllHref: string; rows: PanelRow[]; };
export type FriendsDeskData = { label: string; seeAllHref: string; rows: PanelRow[]; nextCursor: string | null; };

export type DashboardFallbacks = {
  todaysSpark: { id: string; prompt: string; wordLimit: number; entriesCount: number; deadlineLabel: string } | null;
  trendingHive: { id: string; name: string; memberCount: number } | null;
  votingSpark: { id: string; title: string; entriesCount: number } | null;
  trendingList: { id: string; title: string; coverRefs: string[] } | null;
  topClubs:    { id: string; name: string; bookTitle: string | null; coverUrl: string | null; memberCount: number }[];  // up to 3
};
```

**Sub-queries inside `getCommunityDashboardAction`:**

| Sub-query | New / Reused | Notes |
|---|---|---|
| `resolveHeroSignal(viewerId)` | NEW | Priority ladder; first non-null wins; null only if literally nothing |
| `getViewerPulseStats(viewerId)` | NEW | 4 stats × {value, delta, sparkline[7]} via 4 parallel COUNT + windowed aggregates |
| `getHivesPanelRows(viewerId)` | reuses existing hive activity query, projected to PanelRow |
| `getSparksPanelRows(viewerId)` | reuses sparks rail data, projected |
| `getListsPanelRows(viewerId)` | reuses list rail data + cover preview helper |
| `getFriendsDeskRows(viewerId)` | reuses `getCommunityFeedAction({limit:4})` shape |
| `getClubsPanelRows(viewerId)` | reuses existing club rows query |
| `loadDashboardFallbacks(viewerId)` | NEW | Fetches all 5 fallback datasets in parallel; cheap (each indexed) |

Total parallel sub-queries: ~13 (close to T1's 21). All small + indexed.

### `getCommunityFeedFullAction({ cursor, limit }): Promise<{ rows: PanelRow[]; nextCursor: string | null }>`

For the new `/community/feed` route. Reuses existing feed projection; returns PanelRow shape.

---

## Schema

**No DB schema changes.** Every signal derives from existing tables:

- Pulse · words: `binder_items.last_edited_by = viewer` joined `chapters.word_count`, windowed 7d.
- Pulse · followers: `follows.followee_id = viewer` created_at filter.
- Pulse · reads: `chapter_reads` count on viewer's latest published chapter (resolved via `chapters.book_id = books.id AND books.user_id = viewer AND chapters.status IN ('REVISED','FINAL')` ordered by `chapters.published_at DESC LIMIT 1`).
- Pulse · likes + comments: `book_likes` + `book_comments` on viewer's books, 7d.
- Hero signals: existing `social_activity` event store filtered to followed authors.
- Friends' Desks: existing `getCommunityFeedAction` data source.

Sparklines computed via `date_trunc('day', ...) ... GROUP BY day` over the 7-day window, padded to 7 elements (zero-fill missing days).

---

## Responsive behavior

- **≥ 1280px (`xl`):** 12-col bento grid as specified.
- **< 1280px:** single-column stack — same components, vertical order Hero → Pulse → Hives → Sparks → Lists → Friends → Clubs. Each panel stretches to full width with `grid-column: 1 / -1`. Panel min-heights preserved.
- **Mobile redesign out of scope for v1** — current single-column collapse is acceptable but not optimized.

---

## Risks / known follow-ups

1. **Pulse sparkline computation** may add measurable latency at scale (4 stats × daily aggregate over 7d). All sub-queries are wrapped in `safe()` so a slow sparkline degrades gracefully (renders without spark). If routine latency exceeds 200ms, denormalize daily counters into a `viewer_daily_stats` table — deferred follow-up.
2. **Hero priority ladder** picks 1 signal per request. No tie-breaking surface. Acceptable for v1; revisit if Chris sees the same hero repeatedly.
3. **`Pulse · reads · Ch N`** requires viewer to have a published chapter; otherwise stat 3 shows `—` with hint copy. Pulse panel always renders (4 tiles), the third tile just degrades.
4. **30D window deferred.** Stat-tile head pill row currently shows `7D` only. v2 adds `30D` toggle + state via search-params.
5. **`/community/feed` is a new route.** Adds one server component + one client component (`<ActivityFeedFull>`). Minimal surface — link from the Friends' Desks panel-see-all only; not in any nav.
6. **Replacing T1-T4 work shipped earlier today (2026-06-16)** — 4 commits land in the trash relative to this redesign. Acknowledged trade. Files git-rm'd in the implementation: `community-hub.actions.ts`, `community-hub.shared.ts`, `highlights-rail.tsx`, `activity-feed.tsx`. New shape: `community-dashboard.actions.ts`, `community-dashboard.shared.ts`, `community-dashboard-grid.tsx` (orchestrator), per-panel components per §Components.
7. **`getCommunityFeedAction`** stays untouched — Friends' Desks panel uses its first page, and the new `/community/feed` route uses it for pagination.

---

## Components (new + deleted)

**New:**
- `app/[locale]/(app)/community/_components/community-dashboard-grid.tsx` — orchestrator, takes `CommunityDashboardData` and dispatches to 7 panel components.
- `app/[locale]/(app)/community/_components/hero-panel.tsx` — handles all 6 hero kinds + Today's Spark fallback.
- `app/[locale]/(app)/community/_components/pulse-panel.tsx` — 4-tile 2×2 grid with sparklines.
- `app/[locale]/(app)/community/_components/mid-tile-panel.tsx` — shared component used by Hives / Sparks / Lists / Clubs (props: label, seeAllHref, rows, emptyNudges).
- `app/[locale]/(app)/community/_components/friends-desk-panel.tsx` — Friends' Desks with inline Load older.
- `app/[locale]/(app)/community/_components/sparkline.tsx` — pure SVG polyline component, takes `number[]` and renders.
- `app/[locale]/(app)/community/feed/page.tsx` — new `/community/feed` route.
- `app/[locale]/(app)/community/feed/_components/activity-feed-full.tsx` — paginating client component.

**Deleted:**
- `app/[locale]/(app)/community/_components/highlights-rail.tsx`
- `app/[locale]/(app)/community/_components/activity-feed.tsx` (old version — replaced by panel-internal)
- `lib/actions/community-hub.actions.ts` (renamed → `community-dashboard.actions.ts`, rewritten)
- `lib/actions/community-hub.shared.ts` (renamed → `community-dashboard.shared.ts`, rewritten)

**Reused unchanged:**
- `lib/actions/community.actions.ts:getCommunityFeedAction` (powers Friends' Desks + `/community/feed`).
- `<ActivityEventRow>` (used inside Friends' Desks panel rows — wrapped, not rewritten).
- shadcn primitives, brand tokens, all chrome scales.

---

## Acceptance criteria

1. `/community` renders the 7-panel bento grid at `xl+` widths.
2. Hero panel renders the correct kind based on viewer signal priority; falls back to Today's Spark when no friend signal exists.
3. Pulse panel always renders 4 stat tiles. Brand-new account sees zeros/dashes + helper hints; data-rich account sees real numbers + sparklines.
4. Each mid-tile shows exactly 3 rows regardless of underlying data volume; `All N →` link routes to the deep destination.
5. Friends' Desks shows ~4 rows on first paint + Load older button; clicking Load older appends; `Full feed →` routes to `/community/feed`.
6. Empty state on a brand-new account: every panel renders its defined fallback shape — no panel vanishes, no panel collapses to "Coming soon" filler.
7. `/community/feed` renders the full chronological feed with cursor pagination.
8. Brand-yellow restraint preserved: panel labels, see-all links, primary CTAs, pulse stat numbers, hero label, mid-tile row CTAs — nowhere else.
9. Below `xl`, layout collapses to single-column stack in documented order; no horizontal scroll.
10. tsc clean. 883/883 (or higher) tests pass — surface-shape tests added for the new aggregator + helpers, all reused-action tests stay green.

---

## Open questions

None blocking. All decisions locked in brainstorm. 30D window + dashboard customization explicitly out-of-scope for v1.
