# Sparks Hub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the community Sparks Hub at `/[locale]/sparks` per the locked spec at [docs/superpowers/specs/2026-06-15-sparks-hub-design.md](../specs/2026-06-15-sparks-hub-design.md) ([3a361a9](https://github.com/Cremacious/beehive-studio/commit/3a361a9)).

**Architecture:** New action file `lib/actions/sparks-hub.actions.ts` houses the canonical `getCommunitySparksAction` (4 buckets + precedence-resolved `All`). Page becomes a thin server-component shell that auth-gates + dispatches to a new tab-strip/sort/grid/pagination tree. `<SparkCard>` gains an optional `sourceTag` prop. Friendship bidirectional resolution uses an OR-based subquery against `requesterId`/`recipientId`. NO schema changes.

**Reference precedent:**
- Hot Books plan ([885dab9](https://github.com/Cremacious/beehive-studio/commit/885dab9)) for the `<DiscoveryModeToggle>` segmented-control pattern that the new tab strip mirrors.
- Discover redesign url-state shape ([9ce1c10](https://github.com/Cremacious/beehive-studio/commit/9ce1c10)) for `parseRadio` + `buildUrl` reuse.
- Spark redesign card ([cf4a72e](https://github.com/Cremacious/beehive-studio/commit/cf4a72e)) for the canonical `<SparkCard>` we're extending.

**Resolved deferred decisions (from spec Resume Here):**
1. **Friendship bidirectional resolution** → single UNION-style subquery: `SELECT recipientId AS counterPartyId WHERE requesterId = V AND status = 'ACCEPTED' UNION SELECT requesterId WHERE recipientId = V AND status = 'ACCEPTED'`. Wrap in an inner subquery and use `IN`. Inspect existing `/friends` page query for any prior art before finalizing.
2. **`All`-tab dedup** → in JS post-fetch. SQL-side CASE expression is cleaner but rules out per-row source resolution. Fetch one bucketed query per bucket (yours/following/friends/entered) capped at PAGE_SIZE × 4, dedupe by `spark.id`, assign source via precedence (yours > friend > following > entered), then slice the final page.
3. **Legacy `getSparksAction` cleanup** → leave in place. It's still referenced by the existing `/sparks` page until W4 swaps. After W4 ships, search for callers — if zero, mark as a follow-up deletion task in AGENTS.md (not in this plan's scope).

**Pattern carry-forward:**
- Page-state truth lives in URL params via shared `parseRadio` + `parseIntParam` (no new helpers).
- Card chrome unchanged across surfaces — only the `sourceTag` slot differs between Hub and Discover.
- Empty-state container reuses the centered max-w-md card pattern from `/studio` library (no new component shape needed).

---

## File structure

**New:**
- `lib/actions/sparks-hub.actions.ts` (houses `getCommunitySparksAction`)
- `lib/actions/__tests__/sparks-hub-actions.test.ts`
- `app/[locale]/(public)/sparks/_components/sparks-tab-strip.tsx`
- `app/[locale]/(public)/sparks/_components/sparks-sort-dropdown.tsx`
- `app/[locale]/(public)/sparks/_components/sparks-empty-state.tsx`

**Modified:**
- `app/[locale]/(public)/sparks/page.tsx` (full rewrite — auth gate + shell)
- `app/[locale]/(public)/discover/_components/spark-card.tsx` (adds `sourceTag` prop)
- `AGENTS.md` (bookkeeping at ship)

**Untouched:**
- `<NumberedPagination>` — shared, reused as-is.
- `<SortHeader>` + `<ActiveFilterChips>` from `/discover` — reused as-is or via the new `<SparksSortDropdown>` if more spark-specific.
- Spark detail page, submission, voting, comments flows.
- `/discover?tab=sparks` and the rest of Discover.
- Legacy `getSparksAction` (kept for now; deletion is a follow-up if no consumers remain after W4).

---

## Wave 1 — `getCommunitySparksAction` + tests

### Task 1.1: Build the canonical action

**Files:** `lib/actions/sparks-hub.actions.ts`, `lib/actions/__tests__/sparks-hub-actions.test.ts`

- [ ] Create `lib/actions/sparks-hub.actions.ts`:
   ```ts
   'use server'

   import { db } from '@/db'
   import { sparks, sparkEntries } from '@/db/schema/social'
   import { follows, friendships } from '@/db/schema/social'
   import { and, eq, inArray, or, sql, desc, asc } from 'drizzle-orm'
   import type { ActionResult } from './book.actions'
   import { canViewSpark } from '@/lib/sparks/predicates'

   export type CommunitySparkSource = 'yours' | 'following' | 'friend' | 'entered'

   export type CommunitySparkRow = SparkCard & {
     source: CommunitySparkSource
   }

   const PAGE_SIZE = 12

   export async function getCommunitySparksAction(args: {
     viewerId: string
     tab?: 'all' | 'yours' | 'following' | 'friends' | 'entered'
     sort?: 'recent' | 'ending' | 'entries' | 'status'
     page?: number
   }): Promise<
     ActionResult<{
       sparks: CommunitySparkRow[]
       totalCount: number
       bucketCounts: {
         yours: number
         following: number
         friends: number
         entered: number
         all: number
       }
     }>
   >
   ```
- [ ] **Inside the action**, for each bucket, build a subquery that returns spark ids:
   - **Yours:** `db.select({ id: sparks.id }).from(sparks).where(eq(sparks.creatorId, viewerId))`
   - **Following:** `db.select({ id: sparks.id }).from(sparks).where(and(inArray(sparks.creatorId, followedSubquery), ne(sparks.creatorId, viewerId)))` where `followedSubquery = db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId))`
   - **Friends:** counterparty subquery via the bidirectional `friendships` row. Inline the union:
     ```ts
     const friendSubquery = sql<string>`(
       SELECT recipient_id FROM friendships WHERE requester_id = ${viewerId} AND status = 'ACCEPTED'
       UNION
       SELECT requester_id FROM friendships WHERE recipient_id = ${viewerId} AND status = 'ACCEPTED'
     )`
     // then: inArray(sparks.creatorId, friendSubquery)
     ```
   - **Entered:** `db.select({ id: sparkEntries.sparkId }).from(sparkEntries).where(eq(sparkEntries.userId, viewerId))`
- [ ] **Bucket count query** — for each bucket build a `count()` aggregate against the same WHERE. Run all 4 in `Promise.all`. The `all` bucket count is the deduped union of all four bucket ids (cheapest: run a separate COUNT over a UNION of the four id sets, OR sum and subtract overlaps — JS dedup of ids is simplest, given counts are small).
- [ ] **Tab dispatch:** based on `args.tab`, select the right bucket subquery as the main candidate source. For `tab = 'all'`, run all 4 bucket fetches (each capped at PAGE_SIZE × 4 = 48 rows for safety) and union-dedup by id in JS.
- [ ] **Source assignment (All-tab only):** post-fetch, walk each spark and assign:
   ```ts
   const yoursSet = new Set(yoursRows.map((r) => r.id))
   const friendSet = new Set(friendRows.map((r) => r.id))
   const followingSet = new Set(followingRows.map((r) => r.id))
   // Entered isn't a precedence bucket — it's the lowest tier
   function resolveSource(sparkId: string): CommunitySparkSource {
     if (yoursSet.has(sparkId)) return 'yours'
     if (friendSet.has(sparkId)) return 'friend'
     if (followingSet.has(sparkId)) return 'following'
     return 'entered'
   }
   ```
- [ ] **Sort:** apply the chosen sort to the deduped result array in JS:
   - `recent`: `createdAt` DESC
   - `ending`: OPEN (by `deadline` ASC) → VOTING (by `votingEndsAt` ASC) → CLOSED (by `createdAt` DESC). Status tier first, time within.
   - `entries`: `entryCount` DESC
   - `status`: OPEN → VOTING → CLOSED tiered, `createdAt` DESC within.
- [ ] **Visibility filter:** apply `canViewSpark` per row via `Promise.all`. Discard rows that fail.
- [ ] **Project to `SparkCard` shape:** reuse `projectToSparkCards` from `discover-sparks.actions.ts` if exported. If not exported, either export it or copy the projection inline. Spec calls for `SparkCard & { source }` so the projection's full shape must be produced before adding `source`.
- [ ] **Page slice:** after sort + filter, slice `[offset, offset + PAGE_SIZE]` where `offset = (page - 1) * PAGE_SIZE`.
- [ ] **Bucket counts** in the return shape come from the per-bucket COUNT queries above; they're VIEWER-VISIBLE counts post-`canViewSpark` if we filter pre-count, OR raw counts if we don't. Spec §13 accepts that raw counts may slightly overstate. Cheaper to use raw counts.
- [ ] Create surface-shape tests at `lib/actions/__tests__/sparks-hub-actions.test.ts` mirroring `discover-actions.test.ts` (proxy db mock). Tests:
   1. `getCommunitySparksAction` is exported.
   2. Returns `{ success: true, data: { sparks, totalCount, bucketCounts } }` shape.
   3. Accepts each tab value.
   4. Accepts each sort value.
   5. Accepts page param.
- [ ] Run `npx vitest run lib/actions/__tests__/sparks-hub-actions.test.ts` — pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Run `npm test` — full suite green.
- [ ] Commit `feat(sparks/hub): getCommunitySparksAction — 4-bucket query with precedence-resolved source tag.`

---

## Wave 2 — `<SparkCard>` gains source tag

### Task 2.1: Add `sourceTag` prop

**File:** `app/[locale]/(public)/discover/_components/spark-card.tsx`

- [ ] Read the current `<SparkCard>` (commit `cf4a72e`).
- [ ] Add a `sourceTag` prop to the `Props` type:
   ```ts
   import type { CommunitySparkSource } from '@/lib/actions/sparks-hub.actions'

   type Props = {
     spark: SparkCardData
     locale: string
     size?: 'sm' | 'md'
     sourceTag?: CommunitySparkSource | null
   }
   ```
- [ ] Add a `SOURCE_TAG_STYLE` constant near the top of the file:
   ```ts
   const SOURCE_TAG_STYLE: Record<CommunitySparkSource, { bg: string; color: string; label: string }> = {
     yours: {
       bg: 'oklch(from var(--brand) l c h / 0.15)',
       color: 'var(--brand)',
       label: 'YOURS',
     },
     following: {
       bg: 'oklch(0.6 0.15 240 / 0.15)',
       color: 'oklch(0.7 0.15 240)',
       label: 'FOLLOWING',
     },
     friend: {
       bg: 'oklch(0.55 0.18 310 / 0.15)',
       color: 'oklch(0.7 0.18 310)',
       label: 'FRIEND',
     },
     entered: {
       bg: 'oklch(0.6 0.15 150 / 0.15)',
       color: 'oklch(0.7 0.15 150)',
       label: 'ENTERED',
     },
   }
   ```
- [ ] In the JSX header row where the genre label currently renders on the right, conditionally render the source tag instead when `sourceTag` is set. When `sourceTag === null` or `undefined`, fall back to the existing genre rendering:
   ```tsx
   {sourceTag ? (
     <span
       className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-full"
       style={{
         background: SOURCE_TAG_STYLE[sourceTag].bg,
         color: SOURCE_TAG_STYLE[sourceTag].color,
         fontFamily: 'var(--font-mono)',
       }}
     >
       {SOURCE_TAG_STYLE[sourceTag].label}
     </span>
   ) : spark.genre ? (
     <span /* existing genre label */>{spark.genre}</span>
   ) : null}
   ```
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Run `npm test` — full suite green (existing card consumers don't pass `sourceTag` so behavior is unchanged for them).
- [ ] Commit `feat(discover/sparks): SparkCard gains optional sourceTag prop.`

---

## Wave 3 — Tab strip + sort + empty state components

### Task 3.1: `<SparksTabStrip>`

**File:** `app/[locale]/(public)/sparks/_components/sparks-tab-strip.tsx`

- [ ] Build the iOS segmented control. Pattern lifted from `<DiscoveryModeToggle>` (commit `bf56f95`) — server component, brand-yellow active pill, transparent inactive labels with hover, all-explicit URLs (no default-mode dropping per the Hot Books fix).
   ```tsx
   import Link from 'next/link'
   import { buildUrl } from '@/lib/discover/url-state'

   export type SparksTab = 'all' | 'yours' | 'following' | 'friends' | 'entered'

   type Props = {
     locale: string
     current: SparksTab
     counts: { all: number; yours: number; following: number; friends: number; entered: number }
   }

   const TABS: Array<{ id: SparksTab; label: string }> = [
     { id: 'all', label: 'All' },
     { id: 'yours', label: 'Yours' },
     { id: 'following', label: 'Following' },
     { id: 'friends', label: 'Friends' },
     { id: 'entered', label: 'Entered' },
   ]

   export function SparksTabStrip({ locale, current, counts }: Props) {
     // Build href per tab — preserve sort if set; reset page on switch.
     // All-tab can drop the param OR keep it explicitly — for consistency
     // with the Hot Books fix (commit fa66b0c), always set explicitly so
     // ?tab=... is honored regardless of resolver default.
     const hrefFor = (tab: SparksTab): string => {
       // Tab strip ignores ?sort= and ?page= during construction — caller
       // passes the current sp via the parent <SparksHubShell>. Implement
       // here by accepting a `baseParams` prop OR by reading current params
       // at the call site; plan-time, accept `baseParams` for symmetry with
       // <DiscoveryModeToggle>.
       // ...
     }
     return ( /* segmented control JSX */ )
   }
   ```
- [ ] Match the dark iOS styling exactly: outer `rounded-xl p-1` container with `background: rgba(255,255,255,0.04)`, active pill brand-yellow with `aria-current="page"`, inactive pill bare text + hover tint.
- [ ] Each tab label includes the count suffix: `Yours · 3`, etc.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks/hub): SparksTabStrip iOS segmented control.`

### Task 3.2: `<SparksSortDropdown>`

**File:** `app/[locale]/(public)/sparks/_components/sparks-sort-dropdown.tsx`

- [ ] Build a client component thin wrapper around the existing `<FilterDropdown>` from `/discover/_components/filter-dropdown.tsx` if it works for this use case. If not, build inline:
   ```tsx
   'use client'
   import { useFilterNav } from '@/app/[locale]/(public)/discover/_components/use-filter-nav'

   const SORT_OPTIONS = [
     { value: 'recent', label: 'Recent' },
     { value: 'ending', label: 'Ending soon' },
     { value: 'entries', label: 'Most entries' },
     { value: 'status', label: 'Status' },
   ] as const

   type Props = { current: 'recent' | 'ending' | 'entries' | 'status' }

   export function SparksSortDropdown({ current }: Props) {
     // Use the useFilterNav hook from discover/_components to route ?sort=
     // changes; preserve ?tab= and drop ?page= on sort switch.
   }
   ```
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks/hub): SparksSortDropdown.`

### Task 3.3: `<SparksEmptyState>`

**File:** `app/[locale]/(public)/sparks/_components/sparks-empty-state.tsx`

- [ ] Pure presentational. Takes `{ tab: SparksTab; locale: string }`. Renders the 5 distinct empty-state copy + CTA combos per spec §5:
   ```tsx
   type Props = { tab: SparksTab; locale: string }

   const EMPTY_STATES: Record<SparksTab, { eyebrow: string; title: string; body: string; primaryCta: { href: string; label: string }; secondaryCta?: { href: string; label: string } }> = {
     all: { eyebrow: 'ALL · 0 SPARKS', title: 'No sparks yet.', body: 'Start one of your own, or follow some writers on Discover.', primaryCta: { href: '/sparks/new', label: '+ New Spark' }, secondaryCta: { href: '/discover?tab=sparks', label: 'Browse Discover →' } },
     yours: { eyebrow: 'YOURS · 0 SPARKS', title: "You haven't written a Spark yet.", body: 'Got a prompt nagging at you?', primaryCta: { href: '/sparks/new', label: '+ New Spark' } },
     following: { eyebrow: 'FOLLOWING · 0 SPARKS', title: 'No active sparks from the writers you follow yet.', body: 'Try Discover to find more authors.', primaryCta: { href: '/discover?tab=sparks', label: 'Browse Discover →' } },
     friends: { eyebrow: 'FRIENDS · 0 SPARKS', title: 'No active sparks from friends.', body: '', primaryCta: { href: '/friends', label: 'Find friends →' } },
     entered: { eyebrow: 'ENTERED · 0 SPARKS', title: "You haven't entered any Sparks yet.", body: 'Browse Discover for one that catches you.', primaryCta: { href: '/discover?tab=sparks', label: 'Browse Discover →' } },
   }
   ```
- [ ] Render in a centered `max-w-md` card matching the `/studio` library empty-state pattern. Comfortaa h3 title, body paragraph, CTA row.
- [ ] Locale-prefix the CTA hrefs at render time.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(sparks/hub): SparksEmptyState per-tab copy.`

---

## Wave 4 — Page rewrite

### Task 4.1: Rewrite `/sparks/page.tsx`

**File:** `app/[locale]/(public)/sparks/page.tsx`

- [ ] Full rewrite. Server component.
- [ ] Auth gate at top:
   ```ts
   const session = await auth.api.getSession({ headers: await headers() })
   if (!session?.user?.id) {
     redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/sparks`)}`)
   }
   const viewerId = session.user.id
   ```
- [ ] Parse sp via the existing helpers from `lib/discover/url-state.ts`:
   ```ts
   const tab = parseRadio(pickRaw(sp, 'tab'), ['all','yours','following','friends','entered'] as const, 'all')
   const sort = parseRadio(pickRaw(sp, 'sort'), ['recent','ending','entries','status'] as const, 'recent')
   const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))
   ```
- [ ] Call `getCommunitySparksAction({ viewerId, tab, sort, page })` once.
- [ ] Render:
   - `<PageHead>` with `+ New Spark` slot.
   - `<SparksTabStrip>` with `current = tab` and `counts = result.data.bucketCounts`.
   - **Sort header row**: `{totalCount} sparks · Sort: <SparksSortDropdown current={sort} />`.
   - **If `sparks.length === 0`**: render `<SparksEmptyState tab={tab} locale={locale} />`.
   - **Else**: render the responsive grid with `<SparkCard spark={row} sourceTag={row.source} locale={locale} />`.
   - `<NumberedPagination>` at the bottom with `tab="sparks"`-style base params (use the existing pagination component).
- [ ] Drop the legacy walnut chrome (`cm-wrap w-5xl`) and use the same outer shell pattern as `/discover/page.tsx`: `<main className="mx-auto w-full px-6 pt-7 pb-6" style={{ maxWidth: '1920px' }}>`.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Run `npm test` — full suite green.
- [ ] **Manual smoke** (don't commit it):
   - Visit `/en/sparks` while signed in → tab strip renders, default `All` tab active, mixed sparks visible.
   - Switch to `Yours` → only your sparks visible with YOURS tags.
   - Switch to `Following`, `Friends`, `Entered` → each shows the right bucket.
   - Switch tabs → URL gains `?tab=X` and page resets.
   - Visit `/en/sparks` as guest → redirect to `/sign-in?next=/en/sparks`.
   - Empty buckets → empty-state card renders.
- [ ] Commit `feat(sparks/hub): /sparks page rewrite — 4-bucket tab strip + sortable grid.`

---

## Wave 5 — Smoke + ship

### Task 5.1: Manual smoke per spec §11

Visit `/en/sparks` and walk through every acceptance criterion:

- [ ] **§11.1** Guest redirect with `?next=` preserved.
- [ ] **§11.2** Authed viewer sees 5-tab strip with bucket counts.
- [ ] **§11.3** `All` tab interleaved across buckets with correct source tags.
- [ ] **§11.4-7** Each individual tab shows only its bucket with correct tag.
- [ ] **§11.8** Sort changes reorder + reset page.
- [ ] **§11.9** Pagination preserves tab + sort.
- [ ] **§11.10** Empty state copy + CTA correct per tab.
- [ ] **§11.11** SparkCard rendering identical to `/discover?tab=sparks` minus source-tag swap.
- [ ] **§11.12** URL bookmark survives refresh.
- [ ] **§11.13** Legacy walnut chrome gone; dark iOS surface in place.

### Task 5.2: AGENTS.md bookkeeping + ship

- [ ] Update AGENTS.md Resume Here: Last commit → ship SHA · Last updated → ship date · Current focus → "Sparks Hub shipped" · Next concrete step → next priority.
- [ ] Append a "Sparks Hub" entry to "What Has Been Built" with wave SHA map and deferred follow-ups.
- [ ] Commit `docs(agents): Sparks Hub shipped.`
- [ ] `git push origin main`.

---

## Deferred follow-ups (write into AGENTS.md at ship)

1. **Legacy `getSparksAction` deletion** — if zero callers remain after this work, delete from `sparks.actions.ts` in a follow-up cleanup commit.
2. **Activity-feed mode (layout D from brainstorm)** — possible future "Activity" tab on the Hub.
3. **Notifications integration** — when a spark you follow goes to voting / your entry gets voted on — handled by the existing notifications system; surfaced as a tab on the Hub later if useful.
4. **Per-bucket secondary filters** (status, genre) — possible v2 if the Hub grows.
5. **Bucket count caching** via `unstable_cache` keyed on viewerId if the count queries become hot.
6. **Friendship resolution test fixture** — the `friendships` UNION subquery deserves a focused unit test if it bites in production.
7. **Source tag promoted to design tokens** — the four `oklch(...)` tints are inline for v1; promote to `:root` vars if a second surface needs them.

---

## Self-review notes

- **Spec coverage:** every spec §11 acceptance criterion maps to a Wave 5 smoke step. Spec §3 IA maps to Wave 4 page rewrite. Spec §7 data layer maps to Wave 1.
- **Type consistency:** `CommunitySparkSource` defined once in `sparks-hub.actions.ts`; consumed by `<SparkCard>` + `<SparksTabStrip>`. `SparksTab` defined in `sparks-tab-strip.tsx`; consumed by `sparks-empty-state.tsx`.
- **File responsibility:** 5 new files + 2 modified files. Each new file < 250 LOC. `sparks-hub.actions.ts` is the biggest at ~250 LOC including bucket builders.
- **No placeholders:** the only `// ...` ellipses inline are deliberate skeletons inside task code blocks — the executor fills them per the surrounding spec.
