# Clubs Hub + Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Rebuild `/[locale]/clubs` as a personal community hub mirroring `/sparks` + `/hives`. Replace the current club card with a Facebook-group-style V2 card pinned at 340×360 fixed dimensions across every state. Add `cover_image_url` to `book_clubs`. Wire `getSuggestedClubsAction` with friend/FoF/trending ranking. Cross-surface re-skin so the shared `<ClubCard>` renders on `/clubs` hub + `/discover?tab=clubs` + `/discover/clubs/...` sub-routes.

**Architecture:** 5th hub-pattern surface. Pattern is mature (sparks → friends → hives → reading-lists → clubs). Schema is additive (one nullable column). New actions compose existing data + the new column. Single shared `<ClubCard>` at `components/club/club-card.tsx`. Trending rail extends to viewport per hives precedent.

**Tech Stack:** Next.js 16 server components, Drizzle ORM (raw SQL where helpful), React 19, Tailwind 4, Cloudinary upload (existing pipeline).

**Spec:** [docs/superpowers/specs/2026-06-16-clubs-hub-design.md](../specs/2026-06-16-clubs-hub-design.md)

---

## File map

**New files:**
- `scripts/migrate-clubs-cover.ts` — idempotent migration adding `cover_image_url`
- `lib/actions/clubs-suggested.actions.ts` — `getSuggestedClubsAction`
- `lib/actions/clubs-hub.actions.ts` — `getCommunityClubsAction` aggregator
- `lib/actions/clubs-rail.actions.ts` — `getViewerClubStatsAction` + `getTrendingClubsForRailAction`
- `components/club/club-card.tsx` — shared V2 fixed-dimension card
- `app/[locale]/(app)/clubs/_components/clubs-tab-strip.tsx`
- `app/[locale]/(app)/clubs/_components/clubs-sort-dropdown.tsx`
- `app/[locale]/(app)/clubs/_components/clubs-hub-pagination.tsx`
- `app/[locale]/(app)/clubs/_components/clubs-right-rail.tsx`
- `app/[locale]/(app)/clubs/_components/clubs-grid.tsx` (client interleave)
- `app/[locale]/(app)/clubs/_components/club-ghost-card.tsx`
- `app/[locale]/(app)/clubs/_components/pick-club-ghosts.ts` (+ tests)
- `app/[locale]/(app)/clubs/_components/use-dismissed-club-ghosts.ts`
- `lib/actions/__tests__/clubs-suggested.test.ts`

**Modified files:**
- `db/schema/social.ts` — add `coverImageUrl` to `bookClubs`
- `lib/actions/book-clubs.actions.ts` — widen `ClubSummary` shape + `getClubsAction` projection with `memberPreviews` + `coverImageUrl`
- `lib/actions/discover-clubs.actions.ts` — widen discover row with `memberPreviews` + `coverImageUrl`
- `app/[locale]/(app)/clubs/page.tsx` — full rewrite (2-col layout, auth gate, URL parsing)
- `app/[locale]/(app)/clubs/_components/club-card.tsx` — replace with thin re-export of shared `<ClubCard>`
- `app/[locale]/(app)/clubs/_components/create-club-modal.tsx` — add Cover image upload field
- `app/[locale]/(public)/discover/_components/rail-club-card.tsx` — thin wrapper over shared `<ClubCard>`
- `app/[locale]/(public)/discover/_components/discover-club-card.tsx` — same wrapper or delete if zero callers

---

## Task 1: Schema migration — `cover_image_url`

**Files:**
- Create: `scripts/migrate-clubs-cover.ts`
- Modify: `db/schema/social.ts` (add column to `bookClubs`)

### Step 1: Add column to schema
In `db/schema/social.ts`, find `export const bookClubs = pgTable('book_clubs', {...})` and add:
```ts
coverImageUrl: text('cover_image_url'),
```
Place it near `description` for logical grouping.

### Step 2: Write idempotent migration script
```ts
// scripts/migrate-clubs-cover.ts
import 'dotenv/config'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('Adding cover_image_url to book_clubs...')
  await db.execute(sql`
    ALTER TABLE book_clubs ADD COLUMN IF NOT EXISTS cover_image_url text
  `)
  console.log('Done.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

### Step 3: Run + verify
```bash
npx tsx scripts/migrate-clubs-cover.ts
```
Verify with a quick `db.execute(sql\`SELECT column_name FROM information_schema.columns WHERE table_name='book_clubs' AND column_name='cover_image_url'\`)` — should return 1 row.

### Step 4: tsc + commit
```bash
npx tsc --noEmit
git add db/schema/social.ts scripts/migrate-clubs-cover.ts
git commit -m "feat(clubs): add cover_image_url to book_clubs (nullable Cloudinary URL)."
```

Report: any IS NULL row count + idempotency check (running twice = no-op).

---

## Task 2: Widen ClubSummary + projections

**Files:**
- Modify: `lib/actions/book-clubs.actions.ts`
- Modify: `lib/actions/discover-clubs.actions.ts`

### Step 1: Widen `ClubSummary` type
In `book-clubs.actions.ts`, find the `ClubSummary` type (line ~75) and add:
```ts
export type ClubSummary = {
  // ... existing fields ...
  coverImageUrl: string | null
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActivityAt: Date | null  // confirm if already present
}
```

### Step 2: Widen `getClubsAction` projection
Find the SQL/query in `getClubsAction` (line ~289). Add `cover_image_url` to the SELECT, alias to camelCase if needed. Add `memberPreviews` via the same correlated subquery pattern from the hive redesign T1:
```sql
COALESCE((
  SELECT json_agg(json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url))
  FROM (
    SELECT bcm2.user_id, up2.avatar_url
    FROM book_club_members bcm2
    LEFT JOIN user_profiles up2 ON up2.user_id = bcm2.user_id
    WHERE bcm2.club_id = c.id
    ORDER BY bcm2.joined_at DESC
    LIMIT 4
  ) sub
), '[]'::json) AS "memberPreviews"
```

### Step 3: Widen `discover-clubs.actions.ts` projection
Same pattern. The discover row gains `coverImageUrl` + `memberPreviews`. Update the returned type.

### Step 4: tsc + run tests
```bash
npx tsc --noEmit
npm test
```
The widening is additive — existing consumers should compile cleanly. If any consumer destructures exhaustively and breaks, fix at the destructure site (don't widen the return type narrower than the projection).

### Step 5: Commit
```bash
git add lib/actions/book-clubs.actions.ts lib/actions/discover-clubs.actions.ts
git commit -m "feat(clubs): widen ClubSummary + discover projections — coverImageUrl + memberPreviews."
```

Report: any consumer that needed adjustment + the actual SQL used.

---

## Task 3: `getSuggestedClubsAction` with 3-tier ranking

**Files:**
- Create: `lib/actions/clubs-suggested.actions.ts`
- Create: `lib/actions/__tests__/clubs-suggested.test.ts`

### Step 1: Mirror the Hives suggested-action pattern
`lib/actions/hives-suggested.actions.ts` (shipped at `59006e6`) is the exemplar. Clone its 3-tier structure with these adjustments:

- Tier 1 — Friend-members: `INNER JOIN book_club_members bcm` + `INNER JOIN follows f ON f.followee_id = bcm.user_id AND f.follower_id = $viewer`. Exclude clubs viewer is already in (`NOT IN (SELECT club_id FROM book_club_members WHERE user_id = $viewer)`). ORDER BY friendCount DESC.
- Tier 2 — Friend-of-friend: double-self-join on `follows` (f1 follows the member, viewer follows f1.follower). Exclude Tier 1 ids + viewer's clubs + direct-follow case (`NOT EXISTS` guard).
- Tier 3 — Trending fallback: PUBLIC + discoverable clubs ranked by activity (clubs use multiple activity sources; per the spec, count `book_club_discussions` + `book_club_members` joins + `book_club_books` adds in last 7d).

Each tier projects the same shape including `memberPreviews` via the correlated subquery. Set `suggestionReason` per tier:
- Tier 1 row: `"@{topFriendUsername} is a member"` (friendCount=1) / `"{N} friends are members"` (>= 2)
- Tier 2 row: `"{N} mutuals via @{fofUsername}"`
- Tier 3 row: `null`

### Step 2: Stitch + dedupe
Sequential — `await tier1Q` first (need ids), then `Promise.all([tier2Q, tier3Q])` with `tier1Ids` interpolated as `sql.join(...)` IN-clauses. Empty-list guard: `sql\`NULL\`` so `id NOT IN (NULL)` is vacuously true.

Concat → dedupe by `club.id` (first occurrence wins) → slice to `args.limit ?? 100`.

### Step 3: Return type
```ts
export type SuggestedClub = ClubSummary & {
  suggestionReason: string | null
}
```
Note: `ClubSummary` is already widened by T2, so `memberPreviews` + `coverImageUrl` ride along.

### Step 4: 4 surface-shape tests
Mirror `lib/actions/__tests__/hives-suggested.test.ts`. Use `vi.mock('@/db', ...)` + `makeQueryProxy()`. Top-level `import * as suggestedActions` (NOT dynamic per-test imports — documented flake pattern).

Tests:
1. Action exports as function.
2. Returns success shape.
3. Returns rows carrying `suggestionReason` field.
4. Empty case returns empty array.

### Step 5: tsc + tests + commit
```bash
npx tsc --noEmit
npx vitest run lib/actions/__tests__/clubs-suggested.test.ts
npm test
git add lib/actions/clubs-suggested.actions.ts lib/actions/__tests__/clubs-suggested.test.ts
git commit -m "feat(clubs/hub): getSuggestedClubsAction — 3-tier ranking (friend > FoF > trending) with suggestionReason."
```

Report: actual SQL per tier + any FoF cost flag (mirror hives — document `LIMIT 30` cap).

---

## Task 4: Aggregator + rail actions

**Files:**
- Create: `lib/actions/clubs-hub.actions.ts`
- Create: `lib/actions/clubs-rail.actions.ts`

### Step 1: `clubs-hub.actions.ts` aggregator
Mirror `lib/actions/hives-hub.actions.ts` (shipped earlier this session). Exports:
```ts
export type CommunityClubsTab = 'all' | 'yours' | 'member' | 'suggested'
export type CommunityClubsSort = 'active' | 'newest' | 'a-z' | 'members'
export type CommunityClubSource = 'yours' | 'member' | 'suggested'

export type CommunityClubRow = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  currentBookId: string | null
  currentBookTitle: string | null  // optional projection; null if no current book
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  openJoin: boolean
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  viewerRole: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  source: CommunityClubSource
  suggestionReason: string | null
}

export async function getCommunityClubsAction(input: {
  tab: CommunityClubsTab
  sort: CommunityClubsSort
  page: number
}): Promise<ActionResult<{ clubs: CommunityClubRow[]; totalCount: number; bucketCounts: { all: number; yours: number; member: number; suggested: number } }>>
```

Compose from `getClubsAction({ filter: 'mine' })` + `getSuggestedClubsAction()`. Split mine into yours (viewerRole='OWNER') + member (else). Bucket per tab. Sort + slice. PAGE_SIZE = 9.

`currentBookTitle` — fetch via LEFT JOIN to `book_club_books` (status='CURRENT') + `books`. Falls back to null when no current book.

### Step 2: `clubs-rail.actions.ts`
Mirror `lib/actions/hives-rail.actions.ts`. Two actions:

```ts
export async function getViewerClubStatsAction(): Promise<ActionResult<{
  owned: number
  memberOf: number
  booksFinished: number  // COUNT book_club_books WHERE status='PAST' AND club_id IN viewer's clubs
  currentlyReading: number  // COUNT clubs WHERE currentBookId IS NOT NULL AND viewer is a member
}>>

export async function getTrendingClubsForRailAction(args: { limit?: number }): Promise<ActionResult<RailTrendingClub[]>>
```

Trending: default limit 12, max 30. Sort by activity_7d DESC. Project `coverImageUrl`, `currentBookTitle`, `memberCount`, `memberPreviews`.

### Step 3: tsc + commit
```bash
npx tsc --noEmit
git add lib/actions/clubs-hub.actions.ts lib/actions/clubs-rail.actions.ts
git commit -m "feat(clubs/hub): aggregator + rail actions — getCommunityClubs + getViewerClubStats + getTrendingClubsForRail."
```

Report: any column-name surprises in `book_club_*` schema vs the plan code.

---

## Task 5: Shared `<ClubCard>` at `components/club/club-card.tsx`

**Files:**
- Create: `components/club/club-card.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/club-card.tsx` (thin re-export)

### Step 1: Build the shared card
Server component. Pin dimensions at 340×360. Reference mockup at `.superpowers/brainstorm/30856-1781620504/content/clubs-v2-fixed.html` for exact CSS.

Props:
```ts
export type ClubCardData = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  source: 'yours' | 'member' | 'suggested'
  viewerRole: 'OWNER' | 'MODERATOR' | 'MEMBER' | null
  openJoin: boolean
  memberCount: number
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  lastActiveAt: Date | null
  currentBookTitle: string | null
  suggestionReason: string | null
  /** When false, suppress role pill (e.g. on /discover where SUGGESTED is tab-implicit). Default true. */
  showRolePill?: boolean
}

type Props = { club: ClubCardData; locale: string }
```

Implement per spec:
- Outer `Link` wrapper, full-card click target. Href: `/${locale}/clubs/${id}` for all sources.
- Card outer: `width: 340px; height: 360px; border-radius: 14px; overflow: hidden`. Default gradient `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))`. Suggested gradient one stop darker + 2px dashed green border.
- Cover (170×340): `<img>` when `coverImageUrl` non-null, else fallback gradient div with first-letter initial. Role pill absolute top-right (when `showRolePill !== false`).
- Body (190h, padding 12×14): 4 fixed-height slots:
  - Slot 1 (40h): name (line-clamp-2) + access pill (OPEN/CLOSED based on `openJoin`)
  - Slot 2 (50h): description (line-clamp-3) OR description (line-clamp-1) + why-suggested pill on suggested cards
  - Slot 3 (28h): member avatar stack (24×24, -6px overlap, max 4 + `+N` chip)
  - Footer (28h + 8h pad + 1h border): pulse + `Active {relTime}` left, `{N} MEMBERS` right

Why-suggested line: parse `**bold**` markers via `/\*\*(.+?)\*\*/g` regex split into tokenized array of strings + `<strong>` elements. Same pattern as hive card.

Use `relTime` helper from `lib/utils/rel-time.ts`.

### Step 2: Replace `app/[locale]/(app)/clubs/_components/club-card.tsx`
Read existing file first. Replace its content with a thin re-export:
```ts
export { ClubCard as ClubHubCard } from '@/components/club/club-card'
export type { ClubCardData } from '@/components/club/club-card'
```

Audit all consumers of the OLD `<ClubCard>` (community feed, profile pages, etc.) via `grep -rn "from.*clubs/_components/club-card"` and update prop-shape mapping if needed. Likely candidates: `community/_components/sidebar/my-clubs-panel.tsx`, `(public)/u/[username]/page.tsx`.

### Step 3: tsc + commit
```bash
npx tsc --noEmit
git add components/club/club-card.tsx app/[locale]/\(app\)/clubs/_components/club-card.tsx
git commit -m "feat(club/card): V2 shared ClubCard — 340x360 fixed, cover-hero, dashed suggested variant."
```

Report: consumer audit findings + any prop-shape adapters needed at call sites.

---

## Task 6: Hub primitives + right rail

**Files:**
- Create: `app/[locale]/(app)/clubs/_components/clubs-tab-strip.tsx`
- Create: `app/[locale]/(app)/clubs/_components/clubs-sort-dropdown.tsx`
- Create: `app/[locale]/(app)/clubs/_components/clubs-hub-pagination.tsx`
- Create: `app/[locale]/(app)/clubs/_components/clubs-right-rail.tsx`

All four are byte-for-byte adaptations of the `/hives` siblings shipped this session.

### Step 1: `clubs-tab-strip.tsx`
Clone `app/[locale]/(app)/hives/_components/hives-tab-strip.tsx`. Swap:
- Type: `HivesTab` → `ClubsTab = 'all' | 'yours' | 'member' | 'suggested'`
- TABS: 4 entries (All / Yours / Member / Suggested)
- URL: `/hives` → `/clubs`

### Step 2: `clubs-sort-dropdown.tsx`
Clone the hives sibling. Same 4 SORT_OPTIONS (active / newest / a-z / members), same label strings, fallback `'active'`.

### Step 3: `clubs-hub-pagination.tsx`
Clone `hives-hub-pagination.tsx`. basePath `/hives` → `/clubs`.

### Step 4: `clubs-right-rail.tsx`
Clone `hives-right-rail.tsx`. Adjust:
- 2 panels: "Your club stats" + "Trending clubs" (drop "Active in your network").
- Stats tiles: Owned (brand-yellow) / Member of / Books finished / Currently reading.
- Trending panel: `flex: 1` + internal scroll (mirror hives T7). Limit 12. Each row 28×28 cover thumb (or initial circle) + club name + mono meta (`N MEMBERS · NOW READING X` or `N MEMBERS · OPEN`).
- Click → `/clubs/${id}`.
- Use the polymorphic `<RailPanel>` with style/headerStyle/bodyStyle slots (pattern from hives T7).

### Step 5: tsc + commit
```bash
npx tsc --noEmit
git add app/[locale]/\(app\)/clubs/_components/clubs-tab-strip.tsx \
        app/[locale]/\(app\)/clubs/_components/clubs-sort-dropdown.tsx \
        app/[locale]/\(app\)/clubs/_components/clubs-hub-pagination.tsx \
        app/[locale]/\(app\)/clubs/_components/clubs-right-rail.tsx
git commit -m "feat(clubs/hub): tab strip + sort dropdown + pagination + right rail."
```

Report: any structural deviation from the hives siblings.

---

## Task 7: Ghost cards + dismiss hook + pickClubGhosts helper

**Files:**
- Create: `app/[locale]/(app)/clubs/_components/pick-club-ghosts.ts`
- Create: `app/[locale]/(app)/clubs/_components/__tests__/pick-club-ghosts.test.ts`
- Create: `app/[locale]/(app)/clubs/_components/use-dismissed-club-ghosts.ts`
- Create: `app/[locale]/(app)/clubs/_components/club-ghost-card.tsx`

### Step 1: `pick-club-ghosts.ts`
Clone `pick-hive-ghosts.ts`. Swap the variant union:
```ts
export type ClubGhostVariant =
  | 'create-club'
  | 'join-suggested'
  | 'invite-members'
  | 'set-current-book'
  | 'add-to-queue'
  | 'start-discussion'
```

Input type:
```ts
type PickClubGhostsInput = {
  tab: ClubsTab
  realCount: number
  ownCount: number
  hasSoloClub: boolean        // any owned club with memberCount = 1
  hasNoCurrentBook: boolean   // any owned club with currentBookId === null
  hasEmptyQueue: boolean      // any owned club with no queue books
  hasRecentDiscussion: boolean // any club has discussion in last 7d
  dismissed: Set<ClubGhostVariant>
}
```

Per-tab priority arrays per spec. Same `GHOST_MAX=5` / `TARGET_TOTAL=6` math.

### Step 2: 6 unit tests at `__tests__/pick-club-ghosts.test.ts`
Mirror `pick-hive-ghosts.test.ts`. Verify cap math + per-tab branches + dismissed-filter + conditional filters (hasSoloClub gates invite-members, etc.).

### Step 3: `use-dismissed-club-ghosts.ts`
Clone `use-dismissed-hive-ghosts.ts`. localStorage key `'clubs-hub:dismissed-ghosts'`.

### Step 4: `club-ghost-card.tsx`
Clone `hive-ghost-card.tsx`. Adjust:
- Dimensions: **340×360 fixed** to match `<ClubCard>` (not the hive card's flexible min-height).
- 6 variants in COPY record per spec table.
- CTAs per spec:
  - `create-club` → opens `<CreateClubModal>` flow (the page wires this via a button trigger; pass a callback prop)
  - `join-suggested` → `/${locale}/clubs/${trendingClub.id}` when present
  - `invite-members` → `/${locale}/clubs/${smallestOwnedClubId}/members`
  - `set-current-book` → `/${locale}/clubs/${anyOwnedClubId}?tab=books`
  - `add-to-queue` → `/${locale}/clubs/${anyOwnedClubId}?tab=books`
  - `start-discussion` → `/${locale}/clubs/${anyOwnedClubId}?tab=discussions`
- Em-dash check: per AGENTS.md copy rule, no em-dashes in user-facing strings.

### Step 5: tsc + tests + commit
```bash
npx tsc --noEmit
npm test
git add app/[locale]/\(app\)/clubs/_components/pick-club-ghosts.ts \
        app/[locale]/\(app\)/clubs/_components/__tests__/pick-club-ghosts.test.ts \
        app/[locale]/\(app\)/clubs/_components/use-dismissed-club-ghosts.ts \
        app/[locale]/\(app\)/clubs/_components/club-ghost-card.tsx
git commit -m "feat(clubs/hub): ghost cards + dismiss hook + pickGhosts helper + 6 tests."
```

Report: any copy edits for em-dash compliance + test pass count.

---

## Task 8: Page rewrite + CreateClubModal cover field + discover re-skin

**Files:**
- Modify: `app/[locale]/(app)/clubs/page.tsx` (full rewrite)
- Create: `app/[locale]/(app)/clubs/_components/clubs-grid.tsx` (client interleave)
- Modify: `app/[locale]/(app)/clubs/_components/create-club-modal.tsx` (cover upload field)
- Modify: `app/[locale]/(public)/discover/_components/rail-club-card.tsx` (thin wrapper)
- Modify (or delete): `app/[locale]/(public)/discover/_components/discover-club-card.tsx`

### Step 1: `<ClubsGrid>` client component
Clone `hives-grid.tsx`. Renders real `<ClubCard>`s followed by `<ClubGhostCard>`s. Mounts `useDismissedClubGhosts` + calls `pickClubGhosts`.

### Step 2: Page rewrite
Drop the legacy `cm-main`/`cm-wrap.w-5xl` chrome + `<PageHead>` + empty-hero. Replace with:
- Outer container max-width 1680px, padding `px-6 pt-7 pb-6`
- 2-col grid `xl:grid-cols-[minmax(0,1fr)_300px]`
- Auth gate: guests redirect to `/sign-in?next=/clubs`
- Legacy URL redirect: `if (rawFilter === 'mine') redirect(\`/${locale}/clubs?tab=yours\`)`
- URL parse: `tab` (`['all','yours','member','suggested']`), `sort` (`['active','newest','a-z','members']`), `page` (Math.max(1, parseIntParam))
- Parallel fetches: `getCommunityClubsAction({tab,sort,page})` + `getTrendingClubsForRailAction({limit: 1})` (for ghost CTA target)
- Header: H1 "Clubs" + subtitle + `<CreateClubButton>` on right (use existing component inline)
- Tab strip + sort dropdown in one flex row
- `<ClubsGrid>` body
- `<ClubsHubPagination>` gated on `totalCount > PAGE_SIZE`
- `<ClubsRightRail>` as second column

Ghost context derivation (server-side from fetched data):
- `bucketCounts` from `result.data.bucketCounts`
- `hasSoloClub` — any club in current page slice with `viewerRole='OWNER' && memberCount === 1`. Document v1-limitation (page-slice-scoped).
- `hasNoCurrentBook` — any owned club with `currentBookId === null` in page slice
- `hasEmptyQueue` — DEFERRED. Hardcode `false` for v1 (need a separate query).
- `hasRecentDiscussion` — DEFERRED. Hardcode `false` for v1.
- `smallestOwnedClubId` — owned club with smallest `memberCount`
- `anyOwnedClubId` — first owned club id

### Step 3: `<CreateClubModal>` cover upload field
Read existing modal. Add a new field:
- Label: "Cover image (optional)"
- Use Cloudinary upload (reuse `useCloudinaryUpload('covers')` hook from book wizard if available, else inline the upload call)
- Preview thumb after upload + "Remove" link
- Form state: `coverImageUrl: string | null`
- Wire to `createClubAction` — verify the action accepts `coverImageUrl` (may need to widen `lib/validations/book-club.ts` Zod schema).

### Step 4: Update `createClubAction` Zod schema
In `lib/validations/book-club.ts`, find `createClubSchema` and add `coverImageUrl: z.string().url().optional().nullable()`.

In `lib/actions/book-clubs.actions.ts:createClubAction`, accept the field and INSERT it.

### Step 5: Discover re-skin
- `rail-club-card.tsx` — replace card body with thin wrapper rendering shared `<ClubCard>`:
  ```tsx
  import { ClubCard, type ClubCardData } from '@/components/club/club-card'

  export function RailClubCard({ club, locale }: Props) {
    const data: ClubCardData = {
      id: club.id,
      name: club.name,
      description: club.description ?? null,
      coverImageUrl: club.coverImageUrl ?? null,
      source: 'suggested',
      viewerRole: null,
      openJoin: club.openJoin ?? true,
      memberCount: club.memberCount,
      memberPreviews: club.memberPreviews ?? [],
      lastActiveAt: club.lastActivityAt ?? null,
      currentBookTitle: club.currentBookTitle ?? null,
      suggestionReason: null,
      showRolePill: false,  // tab-implicit on /discover
    }
    return <ClubCard club={data} locale={locale} />
  }
  ```
- `discover-club-card.tsx` — same pattern OR delete if zero callers post-rewrite.

### Step 6: tsc + commit
```bash
npx tsc --noEmit
npm test
git add app/[locale]/\(app\)/clubs/ app/[locale]/\(public\)/discover/_components/rail-club-card.tsx app/[locale]/\(public\)/discover/_components/discover-club-card.tsx lib/validations/book-club.ts lib/actions/book-clubs.actions.ts
git commit -m "feat(clubs/hub): page rewrite + 2-col layout + ghost interleave + CreateClubModal cover upload + discover re-skin."
```

Report: deleted-files list + Zod schema additions + any consumer downstream broke during the discover re-skin.

---

## Task 9: Smoke + AGENTS.md + push

### Step 1: Manual smoke at `/en/clubs`
Per spec acceptance criteria (1-13):
1. New column exists; existing clubs have `cover_image_url IS NULL`.
2. Cards render at 340×360 fixed regardless of state — confirm via DevTools.
3. Cover image renders via `<img>` when set; fallback gradient + initial when null.
4. Body row heights stay fixed: 40 / 50 / 28 / footer-37. Description clamps don't push the card taller.
5. Tab strip: 4 pills, last labeled `Suggested`. URL `?tab=open` not a concern (no legacy `open` for clubs).
6. Hub layout 1680px outer, right rail visible at xl+, collapses below.
7. Suggested cards visibly distinct: dashed green border + ✦ SUGGESTED pill + why-line.
8. Ghost cards fill sparse buckets. Dismiss × persists across reload (localStorage).
9. Pagination renders when totalCount > 9. Chrome matches `/discover?tab=books`.
10. CreateClubModal has Cover image upload affordance.
11. `/discover?tab=clubs` cards render with V2 shape (no SUGGESTED pill — tab-implicit).
12. Trending rail panel fills viewport with internal scroll, populated with up to 12 clubs.
13. Legacy `/clubs?filter=mine` 308-redirects to `?tab=yours`.

### Step 2: AGENTS.md update
- Bump `Last updated` to reflect clubs hub code-complete.
- Add SHA map T1-T8.
- Add patterns now load-bearing.
- Set `Next concrete step` to "push to remote + observe in prod" or whatever's next.

### Step 3: Commit + push
```bash
git add AGENTS.md
git commit -m "docs(agents): clubs hub shipped — 8 commits, 340x360 fixed-dimension card."
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Schema add — Task 1 ✅
- Fixed-dimension V2 card — Task 5 ✅
- Cover image upload — Task 8 ✅
- Hub layout + tabs + sort + pagination — Tasks 6 + 8 ✅
- Suggested action — Task 3 ✅
- Aggregator + rail actions — Task 4 ✅
- Ghost cards + dismiss + helper — Task 7 ✅
- Cross-surface re-skin — Task 8 ✅
- Trending rail viewport-fill — Task 6 ✅
- All 13 acceptance criteria mapped to tasks.

**Placeholder scan:** None.

**Type consistency:** `ClubCardData` defined in Task 5, `CommunityClubRow` in Task 4 is a superset. `SuggestedClub` from Task 3 maps into `CommunityClubRow` via Task 4 helper.

**Risks** (carry-forward from spec):
- FoF query cost (mitigated: `LIMIT 30` per tier).
- `memberCount` denorm staleness (audit during smoke if counts look off).
- `<CoverPicker>` reuse from book wizard (Task 8 verifies; falls back to one-off if needed).
- Card height clamp on extra-long content (acceptable v1; detail page shows full text).
