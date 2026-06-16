# Hive Card Redesign + Suggested Hives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the current `<HiveHubCard>` (Hives Hub T5) with a redesigned V2 card (avatar-stack hero) promoted to `components/hive/hive-card.tsx`, re-skinning all `/hives` + `/discover` hive surfaces consistently. Rename `Open` tab → `Suggested` with smart ranking (friend-members → FoF → public+discoverable fallback) returning `suggestionReason: string | null` per row. Drop "X SLOTS" footer text. Extend the Trending rail panel to viewport height.

**Architecture:** Single canonical `<HiveCard>` shared between `/[locale]/(app)/hives` (hub) and `/[locale]/(public)/discover` (rail + grid + sub-routes). Schema extensions are projection-only (no DDL): widen `getUserHivesView` + `getDiscoverableHivesAction` + trending rail action with `memberPreviews` via ROW_NUMBER() window. New `getSuggestedHivesAction` composes friend + FoF + trending tiers. Pattern is the 4th hub-pattern iteration — execution is mechanical at this point.

**Tech Stack:** Next.js 16 server components, Drizzle ORM (raw SQL via `db.execute` for complex queries), React 19, Tailwind 4.

**Spec:** [docs/superpowers/specs/2026-06-16-hive-card-redesign-design.md](../specs/2026-06-16-hive-card-redesign-design.md)

---

## File map

**New files:**
- `lib/actions/hives-suggested.actions.ts` — `getSuggestedHivesAction`
- `components/hive/hive-card.tsx` — shared V2 card
- `lib/actions/__tests__/hives-suggested.test.ts` — surface tests for ranking + dedup

**Modified files:**
- `lib/actions/hive.actions.ts` — widen `getUserHivesView` + `getDiscoverableHivesAction` projections (memberPreviews, bookTitle/coverUrl on discoverable)
- `lib/actions/hives-rail.actions.ts` — widen `getTrendingHivesForRailAction` (memberPreviews), bump default/max limit
- `lib/actions/hives-hub.actions.ts` — swap `getDiscoverableHivesAction` → `getSuggestedHivesAction`; rename bucket `open` → `suggested`; add `suggestionReason` to `CommunityHiveRow`
- `app/[locale]/(app)/hives/_components/hives-tab-strip.tsx` — tab label `Open` → `Suggested`
- `app/[locale]/(app)/hives/_components/hive-hub-card.tsx` — thin re-export of `components/hive/hive-card.tsx`
- `app/[locale]/(app)/hives/_components/hives-right-rail.tsx` — flex layout with viewport-height trending panel
- `app/[locale]/(app)/hives/page.tsx` — `?tab=open` 308 redirect; parseRadio union update
- `app/[locale]/(app)/hives/_components/pick-hive-ghosts.ts` — rename `'open'` tab case
- `app/[locale]/(public)/discover/_components/rail-hive-card.tsx` + `discover-hive-card.tsx` — render shared `<HiveCard>` (or delete + replace at call sites if cleaner)

---

## Task 1: Projection widening — memberPreviews + open-hive book joins

**Files:** `lib/actions/hive.actions.ts`

### Step 1: Widen `getUserHivesView`

Current query (raw SQL via `db.execute`) projects: id, name, description, bookId, bookTitle, bookCoverUrl, visibility, discoverable, status, memberCount, lastActiveAt, viewerRole.

Add a `memberPreviews` projection — top 4 members by joined_at DESC (most-recent first), each `{ userId, avatarUrl }`. Use a correlated subquery building JSON, or a LATERAL JOIN + aggregation. Postgres pattern:

```sql
LEFT JOIN LATERAL (
  SELECT json_agg(
    json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url)
    ORDER BY sub.joined_at DESC
  ) FILTER (WHERE sub.user_id IS NOT NULL) AS previews
  FROM (
    SELECT hm2.user_id, up2.avatar_url, hm2.joined_at
    FROM hive_members hm2
    LEFT JOIN user_profiles up2 ON up2.user_id = hm2.user_id
    WHERE hm2.hive_id = h.id
    ORDER BY hm2.joined_at DESC
    LIMIT 4
  ) sub
) mp ON true
```

Then project `COALESCE(mp.previews, '[]'::json) AS "memberPreviews"` in the outer SELECT. Result: `memberPreviews: { userId: string; avatarUrl: string | null }[]` on `UserHiveView`.

Update the `UserHiveView` TypeScript type to add `memberPreviews: Array<{ userId: string; avatarUrl: string | null }>`.

### Step 2: Widen `getDiscoverableHivesAction`

Current projection from `HiveSummary` is `{ id, bookId, name, description, visibility, status, ownerId, memberCount, createdAt }`. Add via LEFT JOIN to books:
- `bookTitle` from `books.title`
- `bookCoverUrl` from `books.coverUrl`
- `memberPreviews` (same LATERAL JOIN as step 1) — currently `memberCount: 0` hardcoded; replace with actual COUNT.

Update `HiveSummary` type to add `bookTitle: string | null`, `bookCoverUrl: string | null`, `memberPreviews: Array<{ userId, avatarUrl }>`. Real `memberCount` from a subquery (or include in the LATERAL block).

### Step 3: tsc + commit

```bash
npx tsc --noEmit
git add lib/actions/hive.actions.ts
git commit -m "feat(hives): widen getUserHivesView + getDiscoverableHivesAction projections — memberPreviews + book joins on discoverable."
```

Verification before commit: open `/en/hives` in dev OR run a quick `db.execute` in a script to confirm the LATERAL JOIN syntax works against Postgres. If `json_agg(... ORDER BY)` doesn't parse, fall back to `array_agg` + `jsonb_array_elements`.

Report: any SQL adjustments + the actual projected shape.

---

## Task 2: `getSuggestedHivesAction` with 3-tier ranking

**Files:**
- Create: `lib/actions/hives-suggested.actions.ts`
- Create: `lib/actions/__tests__/hives-suggested.test.ts`

### Step 1: Write the action

Three tiers, fetched in parallel, then deduped + sliced server-side:

**Tier 1 — Friend-members:** Hives where someone the viewer follows is a member.
```sql
SELECT h.id, h.name, h.description, h.book_id AS "bookId",
       b.title AS "bookTitle", b.cover_url AS "bookCoverUrl",
       h.visibility, h.discoverable, h.status, h.created_at AS "createdAt",
       (SELECT COUNT(*)::int FROM hive_members WHERE hive_id = h.id) AS "memberCount",
       (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id) AS "lastActiveAt",
       COUNT(DISTINCT f.followee_id) AS "friendCount",
       MAX(up.username) FILTER (WHERE row_n = 1) AS "topFriendUsername",
       <memberPreviews LATERAL>
FROM hives h
INNER JOIN hive_members hm ON hm.hive_id = h.id
INNER JOIN follows f ON f.followee_id = hm.user_id AND f.follower_id = $viewer
LEFT JOIN books b ON b.id = h.book_id
LEFT JOIN user_profiles up ON up.user_id = f.followee_id
LEFT JOIN (SELECT hive_id FROM hive_members WHERE user_id = $viewer) vm ON vm.hive_id = h.id
WHERE h.visibility = 'PUBLIC' AND h.discoverable = true AND vm.hive_id IS NULL
GROUP BY h.id, b.title, b.cover_url
ORDER BY COUNT(DISTINCT f.followee_id) DESC, MAX(hm.joined_at) DESC
LIMIT 30
```

For each Tier 1 row, set `suggestionReason`:
- `friendCount === 1` → `"@{topFriendUsername} is a member"`
- `friendCount >= 2` → `"{friendCount} friends are members"`

**Tier 2 — Friend-of-friend:** Hives where someone-the-viewer-doesn't-follow-but-a-follow-of-the-viewer-follows is a member. Exclude Tier 1 ids.
```sql
SELECT h.id, ..., <same projection>,
       MAX(up.username) FILTER (WHERE row_n = 1) AS "fofUsername"  -- the intermediate
FROM hives h
INNER JOIN hive_members hm ON hm.hive_id = h.id
INNER JOIN follows f1 ON f1.followee_id = hm.user_id  -- some user X follows the member
INNER JOIN follows f2 ON f2.followee_id = f1.follower_id AND f2.follower_id = $viewer
                                                       -- viewer follows X
LEFT JOIN ...
WHERE h.visibility = 'PUBLIC' AND h.discoverable = true
  AND h.id NOT IN ($tier1_ids)
  AND h.id NOT IN ($viewer_hive_ids)
  AND f1.follower_id != $viewer  -- ensure FoF, not direct friend
GROUP BY h.id, ...
ORDER BY COUNT(DISTINCT f2.followee_id) DESC, MAX(hm.joined_at) DESC
LIMIT 30
```

For each Tier 2 row: `suggestionReason = "{N} mutuals via @{fofUsername}"` (N = distinct intermediates).

**Tier 3 — Trending fallback:** PUBLIC + discoverable hives, viewer not already in, exclude Tier 1+2 ids. Ranked by `hive_activity` count last 7d.
```sql
-- Reuses the trending-rail query shape with an added NOT IN exclusion + viewer-not-in filter.
```

Tier 3 rows have `suggestionReason = null`.

### Step 2: Stitching + dedup

After parallel fetch, concat `[...tier1, ...tier2, ...tier3]`, dedupe by `hive.id` (keep first occurrence — Tier 1 wins), then slice to `args.limit ?? 100`.

### Step 3: Action signature

```ts
export async function getSuggestedHivesAction(args: { limit?: number }): Promise<ActionResult<SuggestedHive[]>>

export type SuggestedHive = HiveSummary & {
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  bookTitle: string | null
  bookCoverUrl: string | null
  suggestionReason: string | null
}
```

Note: `HiveSummary` already widens in T1; if not, this type intersects to fill the gaps.

### Step 4: Tests

`lib/actions/__tests__/hives-suggested.test.ts` — 4 surface-shape tests (action exists, returns success shape, returns `suggestionReason` field on row, parallel fetch doesn't double-count). Reuse the `vi.mock('@/db', ...)` + `makeQueryProxy()` pattern.

### Step 5: tsc + tests + commit

```bash
npx tsc --noEmit
npm test
git add lib/actions/hives-suggested.actions.ts lib/actions/__tests__/hives-suggested.test.ts
git commit -m "feat(hives/hub): getSuggestedHivesAction — 3-tier ranking (friend > FoF > trending) with suggestionReason."
```

Report: any SQL adjustments + test pass count + Suggested ranking edge cases handled.

---

## Task 3: Update aggregator + tab union

**Files:**
- Modify: `lib/actions/hives-hub.actions.ts`

### Step 1: Update types + bucket logic

- `CommunityHivesTab` union: replace `'open'` with `'suggested'`.
- `CommunityHiveSource` union: replace `'open'` with `'suggested'`.
- `CommunityHiveRow` gains `suggestionReason: string | null` field. Default `null` for yours/member rows; populated for suggested rows from `getSuggestedHivesAction`.

### Step 2: Swap action call

Inside `getCommunityHivesAction`, replace the `getDiscoverableHivesAction` call with:
```ts
const suggestedR = await getSuggestedHivesAction({ limit: SINGLE_BUCKET_CAP })
const suggestedHives = suggestedR.success ? suggestedR.data : []
```

The filter "exclude viewer's hives" already happens inside `getSuggestedHivesAction` (Tier queries include `AND h.id NOT IN ($viewer_hive_ids)`), so the existing `viewerHiveIds.has(h.id)` filter post-fetch becomes redundant — drop it.

### Step 3: Update `openSummaryToRow` → `suggestedHiveToRow`

Rename the helper. It now maps a `SuggestedHive` (with `suggestionReason`, `memberPreviews`, `bookTitle`, `bookCoverUrl`, real `memberCount`, `lastActiveAt`) to `CommunityHiveRow` with source `'suggested'` and the reason copied through.

### Step 4: Bucket counts + return shape

`bucketCounts` keyed `{ all, yours, member, suggested }` (was `{...open}`).

### Step 5: tsc + commit

```bash
npx tsc --noEmit
git add lib/actions/hives-hub.actions.ts
git commit -m "feat(hives/hub): aggregator uses getSuggestedHivesAction; bucket open → suggested; row carries suggestionReason."
```

Report: any TypeScript pain on the union swap.

---

## Task 4: Shared `<HiveCard>` component (V2 redesign)

**Files:**
- Create: `components/hive/hive-card.tsx`
- Modify: `app/[locale]/(app)/hives/_components/hive-hub-card.tsx` (thin re-export)

### Step 1: Build the shared card

Server component at `components/hive/hive-card.tsx`. Props:
```ts
type HiveCardData = {
  id: string
  name: string
  bookTitle: string | null
  source: 'yours' | 'member' | 'suggested'
  viewerRole: 'OWNER' | 'MODERATOR' | 'CONTRIBUTOR' | 'BETA_READER' | null
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  suggestionReason: string | null
  /** Optional: word-goal percentage (0-100). When non-null + > 0, footer shows WORD GOAL · N%. */
  wordGoalPct?: number | null
}

type Props = { hive: HiveCardData; locale: string }
```

Layout (V2 — see spec):
- Outer: `relative rounded-[14px] flex flex-col items-center text-center gap-3 p-[18px_16px_14px] min-h-[220px]` with gradient bg and shadow per spec.
- Suggested mode (`source === 'suggested'`): swap base gradient to one stop darker (`var(--canvas-dark-200)` → `var(--canvas-dark-150)`) AND add `border: 2px dashed oklch(0.6 0.15 150 / 0.45)`. Important: thicker than the prior 1.5px per user direction.
- Role pill: `absolute top-3 right-3`. Glyph + label per source per spec.
- Avatar stack hero: centered, 36×36 circles overlapping `-10px`, `border: 3px solid` matching the card's base gradient stop (use `--canvas-dark-250` for non-suggested, `--canvas-dark-200` for suggested so the border blends with the card surface). Render `memberPreviews.slice(0, 4)`. If `memberCount > 4`, append `+N` chip (overflow = `memberCount - 4`).
  - If a `memberPreviews[i].avatarUrl` is null, render a colored gradient placeholder circle with the first letter of `userId` (or fall back to a fixed gradient).
- Hive name: Comfortaa bold 15px `var(--canvas-dark-ink-strong)`, line-clamp-2.
- Eyebrow: mono uppercase 10px `var(--canvas-dark-ink-muted)`, `letter-spacing: 0.06em`. `AROUND {bookTitle}` if linked; `STANDALONE HIVE` if not.
- Why-suggested line (only when `suggestionReason !== null`): `bg: oklch(0.6 0.15 150 / 0.08), border-left: 2px solid oklch(0.6 0.15 150), padding: 6px 10px, border-radius: 4px, font: 11px, text-align: left, width: 100%`. Parse `**xxx**` markdown-style bold into a `<strong>` with `color: oklch(0.75 0.15 150)`. Server-side regex split is fine.
- Footer: `mt-auto pt-[10px] border-t border-[rgba(255,255,255,0.04)] flex justify-between items-center w-full mono 10px uppercase`.
  - Left: activity pulse (6×6 green dot + 3px halo) + `Active ${relTime(lastActiveAt)}` ONLY when `lastActiveAt !== null`.
  - Right: `WORD GOAL · ${pct}%` ONLY when `wordGoalPct !== null && wordGoalPct > 0`. NO "X SLOTS" text per user direction.
  - If both sides are empty, render `{memberCount} ${plural} ` on the right as a fallback so the footer isn't empty.

Click target: full-card `Link` wrapper. Href:
- `source === 'yours' || 'member'` → `/${locale}/hive/${id}`
- `source === 'suggested'` → `/${locale}/hive/${id}` (PUBLIC hives are viewable to all signed-in users; if access denied, the hive page itself handles the gate).

### Step 2: Re-export from hub location

`app/[locale]/(app)/hives/_components/hive-hub-card.tsx` becomes:
```ts
export { HiveCard as HiveHubCard } from '@/components/hive/hive-card'
export type { HiveCardData } from '@/components/hive/hive-card'
```

This preserves the existing import path in `<HivesGrid>` without breaking anything.

### Step 3: Wire suggestionReason + memberPreviews through `<HivesGrid>` props

`<HivesGrid>` receives `CommunityHiveRow[]` from `<HivesPage>`. Each row now carries `suggestionReason` + `memberPreviews`. `<HiveHubCard>` (which is now `<HiveCard>`) consumes them directly via the shared `HiveCardData` shape.

In `<HivesGrid>`, mapping `<HiveHubCard hive={row} />` should compile cleanly since `CommunityHiveRow` is a superset of `HiveCardData`.

### Step 4: tsc + commit

```bash
npx tsc --noEmit
git add components/hive/hive-card.tsx app/[locale]/\(app\)/hives/_components/hive-hub-card.tsx
git commit -m "feat(hive/card): V2 shared HiveCard — avatar-stack hero, dashed suggested variant, no SLOTS text."
```

Report: any prop-shape adjustment needed in `<HivesGrid>`.

---

## Task 5: Hub consumers — tab strip + page + ghosts

**Files:**
- Modify: `app/[locale]/(app)/hives/_components/hives-tab-strip.tsx`
- Modify: `app/[locale]/(app)/hives/page.tsx`
- Modify: `app/[locale]/(app)/hives/_components/pick-hive-ghosts.ts`

### Step 1: Tab strip rename

In `hives-tab-strip.tsx`:
- Update `HivesTab` type union: `'open'` → `'suggested'`.
- Update TABS array: `{ id: 'open', label: 'Open' }` → `{ id: 'suggested', label: 'Suggested' }`.

### Step 2: Page redirect + parseRadio

In `page.tsx`:
- `parseRadio(rawTab, ['all', 'yours', 'member', 'open']...)` → `['all', 'yours', 'member', 'suggested']`.
- Add backward-compat at the top: `if (rawTab === 'open') redirect(\`/${locale}/hives?tab=suggested\`)`.

### Step 3: Ghosts pick-helper

In `pick-hive-ghosts.ts`, update tab-handling switch — replace any `case 'open':` with `case 'suggested':`. Same priority array.

### Step 4: bucketCounts prop shape

`<HivesTabStrip counts={bucketCounts}>` — counts shape is `{ all, yours, member, suggested }` now. Verify the tab-strip's `count` lookup uses the new key.

### Step 5: tsc + commit

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hives/_components/hives-tab-strip.tsx \
        app/[locale]/\(app\)/hives/page.tsx \
        app/[locale]/\(app\)/hives/_components/pick-hive-ghosts.ts
git commit -m "feat(hives/hub): rename Open tab to Suggested + ?tab=open 308 redirect."
```

Report: any other tab-string references found via grep that need updating.

---

## Task 6: Re-skin /discover hive cards

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/rail-hive-card.tsx`
- Modify: `app/[locale]/(public)/discover/_components/discover-hive-card.tsx`
- (Possibly modify) sub-routes under `app/[locale]/(public)/discover/hives/` if they import card components directly

### Step 1: Audit discover hive consumers

Run `grep -rn "RailHiveCard\|DiscoverHiveCard" app/` to find ALL consumers. Note each call site + the prop shape passed.

### Step 2: Pick re-skin strategy per file

For each consumer, decide:
- **A.** Replace inline with `<HiveCard from='@/components/hive/hive-card'>`, mapping the consumer's data to `HiveCardData` shape. Best when the consumer has all the data needed (memberPreviews, suggestionReason which is always null on /discover, lastActiveAt, bookTitle, etc.).
- **B.** Keep the card file but make it a thin re-export of `<HiveCard>` with prop adapter.

Default to A unless the consumer passes a clearly different shape.

### Step 3: Wire memberPreviews into discover data

`/discover?tab=hives` uses `searchHivesDiscoverAction` (W2.3 from the discover redesign — `lib/actions/discover-hives.actions.ts`). Verify its `projectToHiveCards` projection already includes member previews. If not, extend it the same way Task 1 extended `getUserHivesView`.

Same for any rail/trending sub-route action.

### Step 4: Suggested-mode handling on /discover

`/discover?tab=hives` doesn't show "suggested" cards — it shows discoverable hives uniformly. Cards rendered there have `source: 'suggested'` (default for non-membership cards) but `suggestionReason: null`, so the why-suggested line stays hidden. The SUGGESTED pill still appears, which is fine — it correctly flags these as join-able.

If Chris wants `/discover` cards to NOT show the SUGGESTED pill (since the tab itself signals discoverability), pass an extra prop `<HiveCard hive={...} showRolePill={false} />` to suppress it. Add the prop to `HiveCardData` as optional. v1: default `true`; flip to `false` on /discover. Document in report.

### Step 5: Delete dead variants

After all consumers point at `<HiveCard>`, the old `RailHiveCard` + `DiscoverHiveCard` files have zero callers. Delete them. If sub-routes still want a thin re-export for back-compat, keep them as re-exports of `<HiveCard>`.

### Step 6: tsc + commit

```bash
npx tsc --noEmit
git add app/[locale]/\(public\)/discover/_components/ lib/actions/discover-hives.actions.ts
git commit -m "feat(discover/hives): adopt shared <HiveCard> on rail + grid surfaces; drop dead variants."
```

Report: deleted-files list + consumer audit findings + any data-shape adapters needed.

---

## Task 7: Rail panel viewport-height + trending limit bump

**Files:**
- Modify: `app/[locale]/(app)/hives/_components/hives-right-rail.tsx`
- Modify: `lib/actions/hives-rail.actions.ts`

### Step 1: Bump trending limit

In `hives-rail.actions.ts`, `getTrendingHivesForRailAction`:
- Default `limit = 3` → `12`.
- Max `limit = 10` → `30`.
- Project `memberPreviews` (same LATERAL JOIN as Task 1).

`RailTrendingHive` type gains `memberPreviews: Array<{ userId, avatarUrl }>`.

### Step 2: Rail layout rewrite

In `hives-right-rail.tsx`, change the aside from:
```tsx
<aside style={{ position: 'sticky', top: 80, width: 300, alignSelf: 'start' }} className="hidden xl:flex flex-col gap-4">
```
to:
```tsx
<aside
  className="hidden xl:flex flex-col gap-4"
  style={{
    position: 'sticky',
    top: 80,
    width: 300,
    height: 'calc(100vh - 100px)',
    alignSelf: 'start',
  }}
>
```

Stats panel stays natural-height. Trending panel becomes:
```tsx
<RailPanel
  title="Trending hives"
  seeAllHref={`/${locale}/discover?tab=hives`}
  seeAllLabel="Discover →"
  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
>
  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
    {/* trending rows */}
  </div>
</RailPanel>
```

`<RailPanel>` may need a `style` prop added so the flex behavior threads through. If RailPanel is a small inline component (yes — defined in this file), just adjust it directly.

### Step 3: Optional — trending rows render as mini `<HiveCard>` in compact mode?

The current trending rail rows are bare `Link` with text only. For consistency with the redesigned card aesthetic, consider rendering them as small (compact) `<HiveCard>` variants. DEFERRED — too much scope creep for this task. Keep rail rows as-is (text + meta).

### Step 4: tsc + commit

```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/hives/_components/hives-right-rail.tsx \
        lib/actions/hives-rail.actions.ts
git commit -m "feat(hives/hub): Trending rail panel fills viewport with internal scroll; limit 3 → 12."
```

Report: panel renders correctly at typical desktop viewport; nothing visually broken on shorter viewports.

---

## Task 8: Smoke + AGENTS.md + push

### Step 1: Manual smoke at `/en/hives`

- [ ] Tab strip shows 4 pills with last labeled `Suggested` (not `Open`).
- [ ] `?tab=open` 308 redirects to `?tab=suggested`.
- [ ] Card hero is the 36×36 avatar stack centered (not a thumb on the left).
- [ ] Suggested cards have a thicker dashed green border + green ✦ SUGGESTED pill.
- [ ] When a suggested card has a `suggestionReason`, the why-suggested line appears (`@x is a member` etc.).
- [ ] Standalone hives render `STANDALONE HIVE` eyebrow with no thumb/image.
- [ ] Linked hives render `AROUND {BOOK TITLE}` eyebrow with no thumb/image (V2 doesn't use one).
- [ ] No "X SLOTS" text anywhere on the card footer.
- [ ] Trending rail panel fills the viewport height with internal scroll.
- [ ] Trending panel populated with up to 12 hives (or less if dev DB has fewer).
- [ ] `/discover?tab=hives` cards now render with the V2 shape too — same avatar-stack hero.

### Step 2: AGENTS.md update + commit

Update Resume Here:
- Bump `Last updated` to 2026-06-16 with shipping summary.
- Add per-task SHA map T1-T7.
- Add load-bearing patterns from this work.
- Set `Next concrete step` to "push + observe in prod" or whatever's next.

### Step 3: Push

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- V2 card shape — Task 4 ✅
- Suggested differentiation (dashed border + pill + reason line) — Task 4 ✅
- Tab rename — Tasks 3 + 5 ✅
- Friend/FoF ranking — Task 2 ✅
- memberPreviews projection — Tasks 1 + 2 + 7 ✅
- Trending rail to viewport — Task 7 ✅
- No "X SLOTS" text — Task 4 (footer rules) ✅
- Word goal label fix — Task 4 (footer rules) ✅
- Cross-surface re-skin — Task 6 ✅

**Placeholder scan:** None. All tasks have concrete files + concrete deliverables.

**Type consistency:** `HiveCardData` defined once in Task 4, consumed by Tasks 5 + 6. `suggestionReason: string | null` consistent across Tasks 2-4. `CommunityHivesTab` union swap is the same in Tasks 3 + 5.

**Risks:**
- T1's LATERAL JOIN syntax is the most likely place to hit a Postgres-version dialect issue. If it fails, fall back to a correlated `json_agg` in the outer SELECT.
- T6's discover consumer audit may surface more files than expected. If the cascade gets too wide, scope reduction: leave one or two sub-routes on the legacy card variants and mark in follow-ups.
