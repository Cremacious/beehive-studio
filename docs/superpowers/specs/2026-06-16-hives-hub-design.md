# Hives Hub Density Pass — Design Spec

**Date:** 2026-06-16
**Surface:** `/[locale]/hives`
**Goal:** Apply the personal-hub pattern (already proven on `/sparks` and `/friends`) to `/hives`. Empty pages need to feel inhabited; sparse buckets need contextual nudges; pagination needs to match `/discover`. NO schema changes.

---

## Problem

The current `/hives` page is the pre-hub `cm-wrap.w-5xl` chrome — header + headerSlot + a single grid of hive cards. With 1 hive, the page reads ~10% used. No source segmentation (Yours vs Member is implicit in the role pill, not navigable). No way to discover open hives from the page; users must round-trip to `/discover?tab=hives`.

## Solution — direct mirror of `/sparks` (Option A from the locked mockup)

2-col layout (main + 300px right rail), iOS segmented tab strip on top, sortable grid below, ghost cards filling sparse buckets, numbered-circle pagination matching `/discover?tab=books`.

### Tabs (4 buckets, no Following for v1)

| Tab | Bucket definition |
|---|---|
| **All** | Union of Yours + Member + Open, deduped (you can only appear in one slot per hive — own takes precedence over member, member takes precedence over open). |
| **Yours** | `viewerRole = OWNER` from `getUserHivesView()`. |
| **Member** | `viewerRole IN ('MODERATOR', 'CONTRIBUTOR', 'BETA_READER')` from `getUserHivesView()`. |
| **Open** | `visibility = PUBLIC AND discoverable = true` AND viewer is not already a member (filter via `getDiscoverableHivesAction()` minus your hive ids). |

**Tab counts** shown as `Label · N` per pill. Brand-yellow active pill, no count on a hypothetical future "Find" tab (none in v1).

**Deferred:** "Following hives" tab (hives where someone you follow is a member). Needs a follow-graph join — out of scope for v1.

### Sort options

`Most active · Newest · A→Z · Member count`. Default = `Most active` (matches the current ORDER BY in `getUserHivesView`). Sort applies to real hives only; ghosts always render last.

### Grid

`repeat(auto-fill, minmax(300px, 1fr))` with `gap: 16px`. At the 1680px page max with 300px rail + 32px gap, the main column fits roughly 4 cards per row at desktop, 3 at xl, fewer below. Cards use `alignItems: stretch` so real + ghost cards share row height (same fix as /sparks density pass).

### Hive card (rich)

Each card carries: 44×44 book/standalone thumb (book cover if linked, gradient placeholder otherwise) · hive name (Comfortaa bold) · linked-book eyebrow ("around `{Book Title}`" in mono uppercase, or "standalone hive" for shadow-book hives) · top-right role pill (`OWNER` brand-yellow / `MOD` blue / `MEMBER` purple / `OPEN` muted) · member-avatar stack (overlapping circles, max 4 visible + "+N" overflow) · weekly word-goal mini-progress (label + thin brand-yellow track-fill, ONLY when an active word goal exists; hidden otherwise so card heights normalize) · activity pulse + relative-time on the bottom-left ("Active 8h ago" with green dot) · member count on the bottom-right. Card click → existing `/hive/[hiveId]` dashboard.

Total height ≈ 220px when a word-goal renders, ≈ 180px without. Set `min-height: 220px` on the card to lock both shapes against ghost cards.

### Ghost cards (sparse-bucket density)

Same dashed-border + corner-label-pill chrome as `/sparks`. Six variants:

| Variant | Trigger | CTA target |
|---|---|---|
| **create-hive** | always (when grid has < 6) | `/hives` opens `<NewHiveButton>` flow (Chris already has this modal) |
| **join-open** | always (when grid has < 6) | `/discover/hive/[id]` of the trending open hive (lazy-fetched, top-1 from `getTrendingHivesForRailAction`) |
| **invite-collaborators** | when `ownCount > 0` AND viewer has any solo-owner hive (memberCount = 1) | `/hive/[hiveId]/members` of the smallest hive |
| **set-word-goal** | when `ownCount > 0` AND no active word goal exists | `/hive/[hiveId]/word-goals/new` of any owned hive |
| **try-standalone** | always (lowest priority) | `/hives/new?type=standalone` |
| **set-buzz-up** | when `memberCount of any hive > 1` AND no recent buzz post (>7d) | `/hive/[hiveId]/buzz/new` |

Cap math (same as /sparks density pass): **5 ghosts max OR until total reaches 6, whichever first.** So:
- 0 real → 5 ghosts (5 total)
- 1 real → 5 ghosts (6 total)
- 2 real → 4 ghosts (6 total)
- 6+ real → 0 ghosts

Per-tab priority arrays (first three slots are dynamic by viewer state, rest fill from the global pool):
- **All / Yours:** create-hive → invite-collaborators (if applicable) → set-word-goal (if applicable) → join-open → try-standalone → set-buzz-up
- **Member:** join-open → create-hive → try-standalone → set-buzz-up → invite-collaborators → set-word-goal
- **Open:** create-hive → try-standalone → join-open (extra) → invite-collaborators → set-word-goal → set-buzz-up

**Dismissal:** localStorage key `'hives-hub:dismissed-ghosts'`, same shape as /sparks. Same `useDismissedGhosts` hook adapted (or a generic version — see follow-up).

### Right rail (300px sticky)

Three panels, stacked top-to-bottom:

1. **Your hive stats** — 2×2 grid:
   - `Owned` (brand-yellow value) — count of OWNER hives
   - `Member of` — count of non-OWNER hives
   - `Weekly goal` — average % across all active WEEKLY-type word goals you participate in (or 0% if none)
   - `Active goals` — count of active word goals across all your hives
2. **Trending hives** — top 3 from `getTrendingHivesForRailAction({ limit: 3 })`. Ranked by `hive_activity` event count in the last 7d, scoped to PUBLIC + discoverable hives. Each row: 28×28 book/standalone thumb · hive name (truncated) · mono meta `N MEMBERS · M CHAPTERS` or `OPEN · X SLOTS`. Click → `/discover/hive/[id]`.
3. **Active in your network** — DEFERRED to follow-up. Same reason as Following tab — needs follow-graph join. Hidden panel for v1.

Rail collapses below xl viewport (1280px) via `hidden xl:flex` — main column takes full width on smaller screens.

### Pagination

`<HivesHubPagination>` component, byte-for-byte identical chrome to `<SparksHubPagination>` (which itself mirrors `<NumberedPagination>` from `/discover?tab=books`). 32×32 brand-yellow active dot, Prev/Next with ChevronLeft/Right, ellipsis when window has gaps. URL contract: `/${locale}/hives?tab=X&sort=Y&page=N`, drops defaults.

**PAGE_SIZE = 9** matching /sparks (clean 3×3 at desktop given the 300px rail).

### Page chrome

- Outer container: `max-width: 1680px` + `px-6 pt-7 pb-6` matching /sparks and /studio.
- Header: H1 `Hives` + subtitle "Your collaborative writing groups, plus open hives across the platform." + `+ New Hive` brand-yellow CTA on the right (reuses existing `<NewHiveButton>` flow, which opens `<CreateHiveModal>`).
- Tab strip + sort dropdown share one flex row, sort on the right (matches the /sparks polish).
- Guests redirect to `/${locale}/sign-in?next=/${locale}/hives` (hive hub is by definition personal). Currently no guest gate on the page — add one.

---

## New server actions

`lib/actions/hives-hub.actions.ts` — new file housing two actions:

### `getCommunityHivesAction({ tab, sort, page })`

Composes from existing actions (no new SQL):
1. `viewerHives = await getUserHivesView()` (returns hives the viewer is a member of, with `viewerRole`)
2. `openHives = await getDiscoverableHivesAction()` (returns public + discoverable hives) — then filter out viewer's own ids
3. Bucket per tab (`Yours` / `Member` / `Open` / `All`-with-precedence)
4. Sort by chosen key (most-active uses `lastActiveAt`, newest by `createdAt`, a-z by `name`, member count by `memberCount`)
5. Slice to `(page - 1) * PAGE_SIZE` → `+ PAGE_SIZE`
6. Compute `bucketCounts: { all, yours, member, open }` for tab pills
7. Returns `{ hives, totalCount, bucketCounts }`

**Page size = 9 (PAGE_SIZE constant).** Bucket caps: `ALL_TAB_BUCKET_CAP = PAGE_SIZE * 6 = 54` and `SINGLE_BUCKET_CAP = PAGE_SIZE * 14 = 126` for proportional shape with /sparks.

The shape returned per row is a discriminated `CommunityHiveRow = UserHiveView & { source: 'yours' | 'member' | 'open' }`. The `source` tag is what the card uses to pick the role pill.

### `getViewerHiveStatsAction()`

Returns `{ owned, memberOf, weeklyGoalPct, activeGoals }`:
- `owned` — `COUNT(*) FROM hive_members WHERE user_id = $viewer AND role = 'OWNER'`
- `memberOf` — `COUNT(*) FROM hive_members WHERE user_id = $viewer AND role != 'OWNER'`
- `weeklyGoalPct` — `AVG(progress)` across active WEEKLY hive_word_goals where viewer is a member; null/0 if none
- `activeGoals` — `COUNT(*) FROM hive_word_goals WHERE is_active = true AND hive_id IN (viewer's hives)`

### `getTrendingHivesForRailAction({ limit })`

Top hives by recent activity (last 7d), public + discoverable:
- `SELECT h.id, h.name, h.book_id, b.title, b.cover_url, COUNT(ha.id) AS activity_7d, mc.member_count FROM hives h LEFT JOIN hive_activity ha ON ha.hive_id = h.id AND ha.created_at >= NOW() - INTERVAL '7 days' LEFT JOIN books b ON b.id = h.book_id LEFT JOIN (SELECT hive_id, COUNT(*) AS member_count FROM hive_members GROUP BY hive_id) mc ON mc.hive_id = h.id WHERE h.visibility = 'PUBLIC' AND h.discoverable = true GROUP BY h.id, b.title, b.cover_url, mc.member_count ORDER BY activity_7d DESC LIMIT $1`
- Returns `{ id, name, bookTitle, bookCoverUrl, memberCount, activity7d }[]`

---

## Acceptance criteria

1. `/en/hives` width = 1680px max-width, matches `/sparks` and `/studio`.
2. Right rail (300px) sticky on the right at xl viewports; collapses below 1280px.
3. Tab strip shows 4 pills (All / Yours / Member / Open) with bucket counts; brand-yellow active pill; iOS segmented style.
4. Sort dropdown sits on the right of the tab strip row. 4 options: Most active / Newest / A→Z / Member count.
5. Grid uses `repeat(auto-fill, minmax(300px, 1fr))` + `alignItems: stretch`. Cards + ghosts share row height.
6. Hive card carries role pill, book thumb, name, eyebrow, member avatars, optional word-goal mini-progress, activity pulse + relative-time, member count. Click → `/hive/[hiveId]`.
7. Ghost cards fill to total 6 (real + ghost) with 5 max. Each ghost has dashed border + corner label pill + lucide X dismiss button. localStorage dismissal persists across reloads.
8. Per-tab ghost priority array picks the right nudges per spec table.
9. Right rail panels: Your hive stats (4 tiles, Owned brand-yellow) → Trending hives (top 3) → Active in your network HIDDEN for v1.
10. Pagination matches `/discover?tab=books` chrome byte-for-byte. URL contract `/hives?tab=&sort=&page=`; defaults drop.
11. PAGE_SIZE = 9.
12. Guests redirect to `/sign-in?next=/hives`.

---

## Out of scope (deferred)

- Following hives tab + corresponding rail panel (needs follow-graph join).
- Generic `useDismissedGhosts(key)` hook extraction — clone the /sparks one with a new localStorage key for v1.
- Server-side caching of trending hives (could use `unstable_cache` later).
- Activity-feed-first variant (Option B) — explicitly rejected.
- Hive card embedded activity row (Option C) — explicitly rejected.
- Search input in the hub (no search affordance for v1; /discover serves that role).

---

## Risks

1. **Member-avatar fetch cost.** Rendering a member-avatar stack per card means N×4 user lookups per page. Mitigation: extend `getUserHivesView` to project `memberPreviews: { userId, avatarUrl }[]` via a LATERAL JOIN (cap at 4). Cost: 1 modest SQL change.
2. **`weeklyGoalPct` query complexity.** `AVG(progress)` across active WEEKLY goals needs a sum-per-goal subquery. Mitigation: ship without the panel if it bites; the spec marks panel #1 as optional polish.
3. **Standalone hive thumb design.** Hives without a linked book (`STANDALONE_HIVE_SHADOW` book status) have no real cover. Mitigation: gradient placeholder with hive name initial (mirror /studio's hive-card fallback pattern).
4. **`/discover/hive/[id]` route may not exist.** The ghost CTAs reference it. Mitigation: verify in plan task 1; fall back to `/discover?tab=hives` if missing.
