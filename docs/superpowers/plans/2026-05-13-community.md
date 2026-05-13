# Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 7 — Community: author profiles, notification wiring, Hives tab on /discover, and the full Sparks feature (writing prompt contests with voting and creator's choice).

**Spec:** `docs/superpowers/specs/2026-05-13-community-design.md`

**Architecture:** All new routes in `(public)` group. Sparks status computed from `deadline` (not stored). `sparkVotes` table prevents double-voting. Notifications fired in-process from server actions (lazy `SPARK_WIN` on first `getSparkAction` call after close).

---

## Schema Notes

Read these before writing any query:

- `sparks`: `id (uuid PK)`, `creatorId (text → users.id)`, `title (text)`, `description (text)`, `rules (text)`, `deadline (timestamp)`, `createdAt`
  - **Add:** `wordLimit (integer nullable)`, `creatorChoiceEntryId (uuid nullable → sparkEntries.id)`, `winnerEntryId (uuid nullable → sparkEntries.id)`
- `sparkEntries`: `id (uuid PK)`, `sparkId (uuid → sparks.id)`, `userId (text → users.id)`, `chapterId`, `votes`, `createdAt`
  - **Remove:** `chapterId`, `votes`
  - **Add:** `content (text not null)`, `wordCount (integer not null default 0)`
- `sparkVotes` (new): `userId (text → users.id)`, `entryId (uuid → sparkEntries.id)`, `createdAt`. PK: `(userId, entryId)`
- `notifications`: `id`, `userId`, `type (enum)`, `actorId`, `resourceType`, `resourceId`, `read`, `createdAt` — already exists, all types already in enum
- `userProfiles`: `userId`, `username`, `displayName`, `bio`, `avatarUrl`
- `hives`: already has public hive data; `getPublicHivesAction` already exists

**Spark status (computed):**
- `OPEN`: `now < deadline`
- `VOTING`: `deadline ≤ now < deadline + 48h`
- `CLOSED`: `now ≥ deadline + 48h`

---

## Task 1: DB Schema Changes

**Files:**
- Modify: `db/schema/social.ts` (or wherever sparks/sparkEntries are defined — check the file)

- [ ] **Step 1: Locate and read the schema file**

Find where `sparks` and `sparkEntries` are defined:
```bash
grep -r "sparks" db/schema/ --include="*.ts" -l
```

- [ ] **Step 2: Modify `sparks` table**

Add three nullable columns to the `sparks` Drizzle table definition:
```ts
wordLimit: integer('word_limit'),
creatorChoiceEntryId: uuid('creator_choice_entry_id').references(() => sparkEntries.id),
winnerEntryId: uuid('winner_entry_id').references(() => sparkEntries.id),
```

- [ ] **Step 3: Modify `sparkEntries` table**

Remove `chapterId` and `votes` columns. Add:
```ts
content: text('content').notNull().default(''),
wordCount: integer('word_count').notNull().default(0),
```

- [ ] **Step 4: Add `sparkVotes` table**

```ts
export const sparkVotes = pgTable('spark_votes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id').notNull().references(() => sparkEntries.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.entryId] }),
}))
```

Export `sparkVotes` from the schema index if needed.

- [ ] **Step 5: Run migration**

```bash
npx drizzle-kit push
```

If the project uses `generate` + `migrate` instead, run those. Fix any errors (e.g., removing columns with data may need `--force` or a data migration).

- [ ] **Step 6: Run type check**

```bash
node_modules\.bin\tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add db/
git commit -m "feat: schema changes for Phase 7 — sparkVotes table, sparks/sparkEntries columns"
```

---

## Task 2: Sparks Server Actions

**Files:**
- Create: `lib/actions/sparks.actions.ts`

**Key types:**
```ts
export type SparkStatus = 'OPEN' | 'VOTING' | 'CLOSED'

export type SparkSummary = {
  id: string
  prompt: string          // maps to sparks.title
  deadline: Date
  wordLimit: number | null
  status: SparkStatus
  entryCount: number
  creatorUsername: string | null
  creatorDisplayName: string | null
  winnerUsername: string | null  // null if not CLOSED or no entries
}

export type SparkDetail = SparkSummary & {
  description: string | null
  rules: string | null
  creatorUserId: string
  creatorChoiceEntryId: string | null
  winnerEntryId: string | null
}

export type SparkEntrySummary = {
  id: string
  sparkId: string
  authorUserId: string
  authorUsername: string | null
  authorDisplayName: string | null
  contentPreview: string   // first 300 chars of content
  wordCount: number
  voteCount: number
  userHasVoted: boolean    // false if unauthenticated
  createdAt: Date
}

export type SparkEntryDetail = SparkEntrySummary & {
  content: string          // full text
}

export type EntryComment = {
  id: string
  content: string
  createdAt: Date
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}
```

**Helper:**
```ts
function computeStatus(deadline: Date): SparkStatus {
  const now = Date.now()
  const dl = deadline.getTime()
  if (now < dl) return 'OPEN'
  if (now < dl + 48 * 60 * 60 * 1000) return 'VOTING'
  return 'CLOSED'
}
```

- [ ] **Step 1: Write `getSparksAction`**

```ts
export async function getSparksAction(
  filter: 'active' | 'closed' = 'active',
  page: number = 1
): Promise<ActionResult<{ sparks: SparkSummary[]; hasMore: boolean }>> {
  const PAGE_SIZE = 20
  const offset = (page - 1) * PAGE_SIZE
  const now = new Date()
  const votingEnd = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  // active = OPEN or VOTING (deadline > now - 48h)
  // closed = CLOSED (deadline <= now - 48h)
  const rows = await db
    .select({
      id: sparks.id,
      prompt: sparks.title,
      deadline: sparks.deadline,
      wordLimit: sparks.wordLimit,
      creatorUserId: sparks.creatorId,
      creatorUsername: userProfiles.username,
      creatorDisplayName: userProfiles.displayName,
      entryCount: sql<number>`COUNT(DISTINCT ${sparkEntries.id})`,
    })
    .from(sparks)
    .leftJoin(userProfiles, eq(sparks.creatorId, userProfiles.userId))
    .leftJoin(sparkEntries, eq(sparkEntries.sparkId, sparks.id))
    .where(
      filter === 'active'
        ? sql`${sparks.deadline} > ${votingEnd}`
        : sql`${sparks.deadline} <= ${votingEnd}`
    )
    .groupBy(sparks.id, userProfiles.username, userProfiles.displayName)
    .orderBy(filter === 'active' ? asc(sparks.deadline) : desc(sparks.deadline))
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > PAGE_SIZE
  return {
    success: true,
    data: {
      sparks: rows.slice(0, PAGE_SIZE).map(r => ({
        ...r,
        status: computeStatus(r.deadline),
        winnerUsername: null,
      })),
      hasMore,
    },
  }
}
```

- [ ] **Step 2: Write `getSparkAction`**

Fetches detail + lazily finalizes (fires SPARK_WIN) when CLOSED and `winnerEntryId IS NULL`:

```ts
export async function getSparkAction(sparkId: string): Promise<ActionResult<SparkDetail>> {
  const [spark] = await db
    .select()
    .from(sparks)
    .leftJoin(userProfiles, eq(sparks.creatorId, userProfiles.userId))
    .where(eq(sparks.id, sparkId))
    .limit(1)

  if (!spark) return { success: false, error: 'NOT_FOUND' }

  const status = computeStatus(spark.sparks.deadline)

  // Lazy finalization: compute winner once when first CLOSED
  if (status === 'CLOSED' && !spark.sparks.winnerEntryId) {
    const [topEntry] = await db
      .select({
        entryId: sparkEntries.id,
        userId: sparkEntries.userId,
        voteCount: sql<number>`COUNT(${sparkVotes.userId})`,
      })
      .from(sparkEntries)
      .leftJoin(sparkVotes, eq(sparkVotes.entryId, sparkEntries.id))
      .where(eq(sparkEntries.sparkId, sparkId))
      .groupBy(sparkEntries.id, sparkEntries.userId)
      .orderBy(desc(sql`COUNT(${sparkVotes.userId})`))
      .limit(1)

    if (topEntry) {
      await db
        .update(sparks)
        .set({ winnerEntryId: topEntry.entryId })
        .where(eq(sparks.id, sparkId))

      // Fire SPARK_WIN notification for most-voted winner
      await db.insert(notifications).values({
        userId: topEntry.userId,
        type: 'SPARK_WIN',
        actorId: spark.sparks.creatorId,
        resourceType: 'spark',
        resourceId: sparkId,
      })
    }
  }

  // ... return SparkDetail shape
}
```

- [ ] **Step 3: Write `createSparkAction`**

```ts
export async function createSparkAction(input: {
  prompt: string
  deadline: Date
  wordLimit?: number
}): Promise<ActionResult<{ sparkId: string }>> {
  const userId = await requireAuth()

  // Free tier: max 1 active Spark (OPEN or VOTING)
  const now = new Date()
  const votingEnd = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const [activeCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(sparks)
    .where(and(eq(sparks.creatorId, userId), sql`${sparks.deadline} > ${votingEnd}`))

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium && (activeCount?.count ?? 0) >= 1) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const parsed = createSparkSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const [spark] = await db
    .insert(sparks)
    .values({
      creatorId: userId,
      title: parsed.data.prompt,
      deadline: parsed.data.deadline,
      wordLimit: parsed.data.wordLimit ?? null,
    })
    .returning({ id: sparks.id })

  return { success: true, data: { sparkId: spark.id } }
}
```

- [ ] **Step 4: Write `getSparkEntriesAction`**

```ts
export async function getSparkEntriesAction(
  sparkId: string,
  sort: 'top' | 'new' = 'top',
  page: number = 1
): Promise<ActionResult<{ entries: SparkEntrySummary[]; hasMore: boolean }>> {
  // Try to get current user for userHasVoted — don't require auth
  let currentUserId: string | null = null
  try { currentUserId = await requireAuth() } catch { /* unauthenticated */ }

  const PAGE_SIZE = 20
  const offset = (page - 1) * PAGE_SIZE

  const rows = await db
    .select({
      id: sparkEntries.id,
      sparkId: sparkEntries.sparkId,
      authorUserId: sparkEntries.userId,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      content: sparkEntries.content,
      wordCount: sparkEntries.wordCount,
      voteCount: sql<number>`COUNT(DISTINCT ${sparkVotes.userId})`,
      createdAt: sparkEntries.createdAt,
    })
    .from(sparkEntries)
    .leftJoin(userProfiles, eq(sparkEntries.userId, userProfiles.userId))
    .leftJoin(sparkVotes, eq(sparkVotes.entryId, sparkEntries.id))
    .where(eq(sparkEntries.sparkId, sparkId))
    .groupBy(sparkEntries.id, userProfiles.username, userProfiles.displayName)
    .orderBy(
      sort === 'top'
        ? desc(sql`COUNT(DISTINCT ${sparkVotes.userId})`)
        : desc(sparkEntries.createdAt)
    )
    .limit(PAGE_SIZE + 1)
    .offset(offset)

  // Check which entries the current user has voted on
  let votedEntryIds = new Set<string>()
  if (currentUserId && rows.length > 0) {
    const entryIds = rows.slice(0, PAGE_SIZE).map(r => r.id)
    const votes = await db
      .select({ entryId: sparkVotes.entryId })
      .from(sparkVotes)
      .where(and(eq(sparkVotes.userId, currentUserId), inArray(sparkVotes.entryId, entryIds)))
    votedEntryIds = new Set(votes.map(v => v.entryId))
  }

  const hasMore = rows.length > PAGE_SIZE
  return {
    success: true,
    data: {
      entries: rows.slice(0, PAGE_SIZE).map(r => ({
        ...r,
        contentPreview: r.content.slice(0, 300),
        userHasVoted: votedEntryIds.has(r.id),
      })),
      hasMore,
    },
  }
}
```

- [ ] **Step 5: Write remaining actions**

```ts
// Full entry (same as summary but includes full content)
getSparkEntryAction(sparkId, entryId) → ActionResult<SparkEntryDetail>

// Submit (OPEN only, one per user, word limit enforced)
submitSparkEntryAction(sparkId, content) → ActionResult<{ entryId: string }>
  // errors: AUTH_REQUIRED, SPARK_NOT_OPEN, ALREADY_SUBMITTED, WORD_LIMIT_EXCEEDED

// Edit own entry (OPEN only)
updateSparkEntryAction(entryId, content) → ActionResult<void>
  // errors: AUTH_REQUIRED, NOT_OWNER, SPARK_NOT_OPEN, WORD_LIMIT_EXCEEDED

// Vote toggle (VOTING only, not own entry)
voteSparkEntryAction(entryId) → ActionResult<{ voted: boolean }>
  // errors: AUTH_REQUIRED, VOTING_NOT_OPEN, CANNOT_VOTE_OWN_ENTRY
  // uses onConflictDoNothing for vote insert, delete for unvote

// Creator's choice (after deadline, must be Spark creator)
setCreatorChoiceAction(sparkId, entryId) → ActionResult<void>
  // errors: AUTH_REQUIRED, NOT_SPARK_CREATOR, SPARK_STILL_OPEN
  // fires SPARK_WIN notification to entry author

// Comments on entries (same pattern as book comments)
getSparkEntryCommentsAction(entryId, page?) → ActionResult<{ comments: EntryComment[]; hasMore: boolean }>
addSparkEntryCommentAction(entryId, content) → ActionResult<EntryComment>
  // errors: AUTH_REQUIRED, INVALID_CONTENT (max 1000 chars)
  // fires NEW_COMMENT notification to entry author (skip if commenter === author)
```

Add Zod schemas for validation:
```ts
const createSparkSchema = z.object({
  prompt: z.string().min(10).max(500),
  deadline: z.date().min(new Date(Date.now() + 60 * 60 * 1000)), // at least 1h from now
  wordLimit: z.number().int().positive().optional(),
})

const submitEntrySchema = z.object({
  content: z.string().min(1),
})
```

- [ ] **Step 6: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add lib/actions/sparks.actions.ts
git commit -m "feat: sparks server actions (CRUD, voting, creator's choice, comments)"
```

---

## Task 3: User Profile Server Actions

**Files:**
- Create: `lib/actions/user-profile.actions.ts`

**Types:**
```ts
export type PublicProfile = {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  followerCount: number
  followingCount: number
  wordCount: number        // sum of published chapters' word counts
  bookCount: number        // published books
  sparkCount: number       // total Sparks created
  isFollowing: boolean     // false if unauthenticated
}

export type ActivityEvent = {
  type: 'chapter_published' | 'spark_created' | 'entry_commented' | 'creator_choice'
  label: string            // rendered description
  resourceId: string       // bookId, sparkId, etc.
  createdAt: Date
}
```

- [ ] **Step 1: Write `getPublicProfileAction`**

```ts
export async function getPublicProfileAction(
  username: string
): Promise<ActionResult<PublicProfile>> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.username, username))
    .limit(1)

  if (!profile) return { success: false, error: 'NOT_FOUND' }

  const [followerCount, followingCount, wordCountResult, bookCountResult, sparkCountResult] =
    await Promise.all([
      db.select({ count: count() }).from(follows).where(eq(follows.followeeId, profile.userId)),
      db.select({ count: count() }).from(follows).where(eq(follows.followerId, profile.userId)),
      db.select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
        .from(chapters)
        .innerJoin(books, eq(books.id, chapters.bookId))
        .where(and(eq(books.userId, profile.userId), eq(books.status, 'PUBLISHED'))),
      db.select({ count: count() }).from(books)
        .where(and(eq(books.userId, profile.userId), eq(books.status, 'PUBLISHED'))),
      db.select({ count: count() }).from(sparks).where(eq(sparks.creatorId, profile.userId)),
    ])

  // Check if current user follows this profile
  let isFollowing = false
  try {
    const currentUserId = await requireAuth()
    const [follow] = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, currentUserId), eq(follows.followeeId, profile.userId)))
      .limit(1)
    isFollowing = !!follow
  } catch { /* unauthenticated */ }

  return {
    success: true,
    data: {
      userId: profile.userId,
      username: profile.username ?? '',
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      followerCount: followerCount[0]?.count ?? 0,
      followingCount: followingCount[0]?.count ?? 0,
      wordCount: wordCountResult[0]?.total ?? 0,
      bookCount: bookCountResult[0]?.count ?? 0,
      sparkCount: sparkCountResult[0]?.count ?? 0,
      isFollowing,
    },
  }
}
```

- [ ] **Step 2: Write `getProfileBooksAction`**

```ts
export async function getProfileBooksAction(userId: string): Promise<ActionResult<DiscoverBook[]>> {
  // Reuse the DiscoverBook type from discover.actions.ts
  // Query published books with like/bookmark counts, ordered by likeCount desc
  // Similar to getDiscoverFeedAction but filtered to one author, no pagination
}
```

- [ ] **Step 3: Write `getProfileSparksAction`**

```ts
export async function getProfileSparksAction(userId: string): Promise<ActionResult<SparkSummary[]>> {
  // Return OPEN + VOTING sparks created by userId
  // Same query as getSparksAction but filtered by creatorId and only active
}
```

- [ ] **Step 4: Write `getProfileActivityAction`**

Uses a UNION across four sources, limited to 20 most recent:

```ts
export async function getProfileActivityAction(
  userId: string
): Promise<ActionResult<ActivityEvent[]>> {
  // Four sources using sql template literal unions:
  // 1. binderItems (type='chapter') where book.userId = userId and book.status = 'PUBLISHED'
  //    → type: 'chapter_published', label: 'Published chapter "{title}" in "{bookTitle}"'
  // 2. sparks where creatorId = userId
  //    → type: 'spark_created', label: 'Created a Spark: "{title}"'
  // 3. sparkEntryComments where entry.userId = userId (comments they left on others' entries)
  //    → type: 'entry_commented', label: 'Commented on an entry in a Spark'
  // 4. sparks where creatorChoiceEntryId IS NOT NULL and creatorId = userId
  //    → type: 'creator_choice', label: 'Picked a creator\'s choice'
  // Combine with sql`UNION ALL`, order by createdAt DESC, limit 20
}
```

- [ ] **Step 5: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add lib/actions/user-profile.actions.ts
git commit -m "feat: user profile server actions (profile, books, sparks, activity)"
```

---

## Task 4: Notification Wiring

**Files:**
- Modify: `lib/actions/social.actions.ts`

Add `db.insert(notifications)` calls after each successful DB write. Import `notifications` from `@/db/schema` and use the existing `notifications` table.

- [ ] **Step 1: Wire `toggleFollowAction`**

After inserting into `follows` (only when following, not unfollowing):
```ts
// Inside the "insert follow" branch:
await db.insert(notifications).values({
  userId: targetUserId,           // the person being followed
  type: 'NEW_FOLLOWER',
  actorId: userId,                // the follower
  resourceType: 'user',
  resourceId: userId,
})
```

- [ ] **Step 2: Wire `toggleBookLikeAction`**

After inserting into `bookLikes` (only when liking, not unliking). Look up the book's `userId` first:
```ts
const [book] = await db.select({ userId: books.userId }).from(books).where(eq(books.id, bookId)).limit(1)
if (book && book.userId !== userId) {  // don't notify yourself
  await db.insert(notifications).values({
    userId: book.userId,
    type: 'NEW_LIKE',
    actorId: userId,
    resourceType: 'book',
    resourceId: bookId,
  })
}
```

- [ ] **Step 3: Wire `addCommentAction`**

After inserting the comment, look up the book's `userId`:
```ts
if (book.userId !== userId) {
  await db.insert(notifications).values({
    userId: book.userId,
    type: 'NEW_COMMENT',
    actorId: userId,
    resourceType: 'book',
    resourceId: bookId,
  })
}
```

- [ ] **Step 4: Update notifications bell label map**

The existing `notifications-bell.tsx` has a hardcoded label map. Add labels for `NEW_FOLLOWER`, `NEW_LIKE`, `NEW_COMMENT`, `SPARK_WIN`:

```ts
const LABELS: Record<string, string> = {
  // existing...
  NEW_FOLLOWER: 'started following you',
  NEW_LIKE: 'liked your book',
  NEW_COMMENT: 'commented on your book',
  SPARK_WIN: 'your Spark entry won!',
}
```

- [ ] **Step 5: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add lib/actions/social.actions.ts app/
git commit -m "feat: wire NEW_FOLLOWER, NEW_LIKE, NEW_COMMENT, SPARK_WIN notifications"
```

---

## Task 5: Discover Tab Bar + Sparks Tab + Hives Tab

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`
- Create: `app/[locale]/(public)/discover/_components/tabs.tsx`
- Create: `app/[locale]/(public)/discover/_components/spark-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/hive-card.tsx`

- [ ] **Step 1: Write `tabs.tsx`**

Client component. Reads `?tab` from `useSearchParams`, updates URL on click.

```tsx
'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'

type Tab = 'books' | 'sparks' | 'hives'

const TABS: { id: Tab; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'sparks', label: '⚡ Sparks' },
  { id: 'hives', label: 'Hives' },
]

export function DiscoverTabs({ currentTab }: { currentTab: Tab }) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname.split('/')[1]

  return (
    <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 flex items-center justify-between">
      <div className="flex">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => router.push(`/${locale}/discover?tab=${tab.id}`)}
            className={`px-5 py-3 text-[13px] border-b-2 transition-colors cursor-pointer ${
              currentTab === tab.id
                ? 'text-[#FFC300] border-[#FFC300] font-semibold'
                : 'text-[#666] border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

Wrap in `<Suspense>` in the page (it uses `useSearchParams` internally via the parent — parent passes `currentTab` as a prop so Suspense is only needed if the component itself reads searchParams; since it doesn't, no Suspense needed here).

- [ ] **Step 2: Write `spark-card.tsx`**

```tsx
import Link from 'next/link'
import type { SparkSummary } from '@/lib/actions/sparks.actions'

const STATUS_STYLES = {
  OPEN: { badge: '⚡ OPEN', bg: 'bg-[#2a1a00]', text: 'text-[#FFC300]' },
  VOTING: { badge: '🗳 VOTING', bg: 'bg-[#1a1a3a]', text: 'text-[#8888ff]' },
  CLOSED: { badge: '✓ CLOSED', bg: 'bg-[#1e1e1e]', text: 'text-[#444]' },
}

function timeLeft(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return ''
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  return days > 0 ? `· ${days}d left` : `· ${hours}h left`
}

type Props = { spark: SparkSummary; locale: string }

export function SparkCard({ spark, locale }: Props) {
  const style = STATUS_STYLES[spark.status]
  return (
    <Link href={`/${locale}/discover/spark/${spark.id}`} className="block">
      <div className={`border border-[#2a2a2a] rounded-lg p-4 cursor-pointer hover:border-[#3a3a3a] transition-colors ${
        spark.status === 'VOTING' ? 'bg-[#1a1a2a] border-[#3a3a5a]' : 'bg-[#1a1a1a]'
      }`}>
        <div className="flex justify-between items-start mb-2.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
            {style.badge}{spark.status === 'OPEN' ? timeLeft(spark.deadline) : ''}
          </span>
          <span className="text-[#555] text-[11px]">{spark.entryCount} entries</span>
        </div>
        <p className="text-white text-[14px] font-semibold leading-snug mb-2.5">"{spark.prompt}"</p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#2a2a2a] shrink-0" />
          <span className="text-[#666] text-[11px]">
            by <span className="text-[#aaa]">{spark.creatorDisplayName ?? spark.creatorUsername ?? 'Unknown'}</span>
          </span>
          {spark.wordLimit && (
            <span className="text-[#444] text-[11px]">· max {spark.wordLimit} words</span>
          )}
        </div>
        {spark.status === 'CLOSED' && spark.winnerUsername && (
          <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
            <span className="text-[11px] text-[#FFC300]">🏆 {spark.winnerUsername}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Write `hive-card.tsx`**

```tsx
import type { PublicHive } from '@/lib/actions/hive.actions' // use existing type or define inline

type Props = { hive: { id: string; name: string; description: string | null; memberCount: number; bookCount: number }; locale: string }

export function HiveCard({ hive, locale }: Props) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors">
      <p className="text-white text-[14px] font-semibold mb-1.5">{hive.name}</p>
      {hive.description && (
        <p className="text-[#777] text-[12px] leading-relaxed mb-3 line-clamp-2">{hive.description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-[11px] text-[#555]">
          <span>{hive.memberCount} members</span>
          <span>{hive.bookCount} books</span>
        </div>
        <button className="px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#888] rounded text-[11px] hover:border-[#3a3a3a] hover:text-white transition-colors cursor-pointer">
          Request to Join
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Modify discover `page.tsx`**

Add `tab` to searchParams, render `DiscoverTabs`, and conditionally render Books/Sparks/Hives content:

```tsx
type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; sort?: string; genre?: string }>
}

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params
  const resolved = await searchParams
  const tab = (resolved.tab === 'sparks' || resolved.tab === 'hives') ? resolved.tab : 'books'
  // ... existing sort/genre logic for books tab

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="px-6 pt-8 pb-0">
        <h1 className="text-2xl font-semibold text-white mb-1">Discover</h1>
        <p className="text-[#666] text-[13px]">Explore books, writers, and writing prompts</p>
      </div>
      <div className="mt-4">
        <DiscoverTabs currentTab={tab} />
      </div>

      {tab === 'books' && (
        <div className="mt-0">
          <Suspense fallback={<div className="h-[88px] border-b border-[#2a2a2a]" />}>
            <FeedFilters currentSort={sort} currentGenre={genre} />
          </Suspense>
          {/* existing feed content */}
        </div>
      )}

      {tab === 'sparks' && <SparksTab locale={locale} />}
      {tab === 'hives' && <HivesTab locale={locale} />}
    </div>
  )
}
```

`SparksTab` and `HivesTab` are async server components defined in the same file or as separate files. `SparksTab` calls `getSparksAction('active')` and `getSparksAction('closed')`. `HivesTab` calls the existing `getPublicHivesAction`.

The `SparksTab` also renders a "+ Create Spark" button that opens `CreateSparkModal` (client component — Task 6).

- [ ] **Step 5: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add "app/[locale]/(public)/discover/"
git commit -m "feat: discover tab bar, Sparks tab, Hives tab"
```

---

## Task 6: Spark Detail Page + CreateSpark Modal

**Files:**
- Create: `app/[locale]/(public)/discover/spark/[sparkId]/page.tsx`
- Create: `app/[locale]/(public)/discover/_components/spark-entry-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/spark-vote-button.tsx`
- Create: `app/[locale]/(public)/discover/_components/create-spark-modal.tsx`

- [ ] **Step 1: Write `spark-vote-button.tsx`**

Client component with optimistic toggle.

```tsx
'use client'
import { useState, useTransition } from 'react'
import { voteSparkEntryAction } from '@/lib/actions/sparks.actions'

type Props = {
  entryId: string
  initialVoted: boolean
  initialCount: number
  status: 'OPEN' | 'VOTING' | 'CLOSED'
  isOwnEntry: boolean
  isAuthenticated: boolean
}

export function SparkVoteButton({ entryId, initialVoted, initialCount, status, isOwnEntry, isAuthenticated }: Props) {
  const [voted, setVoted] = useState(initialVoted)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  if (status === 'OPEN') {
    return <span className="text-[#555] text-[11px]">▲ voting opens after deadline</span>
  }
  if (status === 'CLOSED') {
    return <span className="text-[#555] text-[11px]">▲ {count} votes</span>
  }
  if (!isAuthenticated) {
    return <span className="text-[#555] text-[11px]">Sign in to vote</span>
  }
  if (isOwnEntry) {
    return <span className="text-[#555] text-[11px]">▲ {count} votes (your entry)</span>
  }

  const handleVote = () => {
    const next = !voted
    setVoted(next)
    setCount(c => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = await voteSparkEntryAction(entryId)
      if (!result.success) { setVoted(!next); setCount(c => c + (next ? -1 : 1)) }
    })
  }

  return (
    <button
      onClick={handleVote}
      disabled={isPending}
      className={`text-[11px] px-3 py-1 rounded transition-colors cursor-pointer ${
        voted ? 'bg-[#FFC300] text-black font-semibold' : 'bg-[#2a2a2a] text-[#888] hover:text-white'
      }`}
    >
      ▲ {count} {voted ? 'Voted' : 'Vote'}
    </button>
  )
}
```

- [ ] **Step 2: Write `spark-entry-card.tsx`**

```tsx
import Link from 'next/link'
import { SparkVoteButton } from './spark-vote-button'
import type { SparkEntrySummary, SparkStatus } from '@/lib/actions/sparks.actions'

type Props = {
  entry: SparkEntrySummary
  sparkId: string
  locale: string
  sparkStatus: SparkStatus
  currentUserId: string | null
  isSparkCreator: boolean
}

export function SparkEntryCard({ entry, sparkId, locale, sparkStatus, currentUserId, isSparkCreator }: Props) {
  const isOwnEntry = currentUserId === entry.authorUserId

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-[#2a2a2a] shrink-0" />
        <span className="text-[#aaa] text-[12px] font-semibold">{entry.authorDisplayName ?? entry.authorUsername ?? 'Unknown'}</span>
        <span className="text-[#444] text-[11px]">· {entry.wordCount} words</span>
        {isOwnEntry && <span className="text-[#555] text-[10px]">(your entry)</span>}
      </div>
      <p className="text-[#888] text-[13px] leading-relaxed mb-3 line-clamp-3">{entry.contentPreview}</p>
      <div className="flex items-center gap-2">
        <SparkVoteButton
          entryId={entry.id}
          initialVoted={entry.userHasVoted}
          initialCount={entry.voteCount}
          status={sparkStatus}
          isOwnEntry={isOwnEntry}
          isAuthenticated={!!currentUserId}
        />
        {isSparkCreator && sparkStatus !== 'OPEN' && (
          <button className="text-[11px] text-[#666] hover:text-[#FFC300] transition-colors cursor-pointer ml-1">
            ★ Creator's choice
          </button>
        )}
        <div className="flex-1" />
        <Link
          href={`/${locale}/discover/spark/${sparkId}/entry/${entry.id}`}
          className="text-[11px] text-[#666] border border-[#2a2a2a] px-3 py-1 rounded hover:text-white hover:border-[#3a3a3a] transition-colors"
        >
          View full entry →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `create-spark-modal.tsx`**

Client component modal triggered by "+ Create Spark" button.

```tsx
'use client'
import { useState, useTransition } from 'react'
import { createSparkAction } from '@/lib/actions/sparks.actions'
import { useRouter } from 'next/navigation'

export function CreateSparkModal({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [deadline, setDeadline] = useState('')
  const [wordLimit, setWordLimit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await createSparkAction({
        prompt,
        deadline: new Date(deadline),
        wordLimit: wordLimit ? parseInt(wordLimit) : undefined,
      })
      if (result.success) {
        setOpen(false)
        router.push(`/${locale}/discover/spark/${result.data.sparkId}`)
      } else {
        setError(result.error === 'FREE_LIMIT_REACHED'
          ? 'You already have an active Spark. Upgrade to premium for unlimited Sparks.'
          : 'Failed to create Spark. Check your inputs and try again.')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-[#FFC300] text-black font-bold text-[12px] rounded-md cursor-pointer"
      >
        + Create Spark
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-white text-[18px] font-semibold mb-4">New Spark</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[#666] text-[11px] uppercase tracking-wide block mb-1">Prompt *</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Write a prompt that sparks creativity…"
                  rows={3}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] resize-none focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
              <div>
                <label className="text-[#666] text-[11px] uppercase tracking-wide block mb-1">Deadline *</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
              <div>
                <label className="text-[#666] text-[11px] uppercase tracking-wide block mb-1">Word limit (optional)</label>
                <input
                  type="number"
                  value={wordLimit}
                  onChange={e => setWordLimit(e.target.value)}
                  placeholder="Leave blank for no limit"
                  className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md px-3 py-2 text-[#ccc] text-[13px] focus:outline-none focus:border-[#3a3a3a]"
                />
              </div>
              {error && <p className="text-red-400 text-[12px]">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-[#888] text-[13px] cursor-pointer">Cancel</button>
                <button
                  onClick={submit}
                  disabled={isPending || !prompt.trim() || !deadline}
                  className="px-5 py-2 bg-[#FFC300] text-black font-bold text-[13px] rounded-md disabled:opacity-40 cursor-pointer"
                >
                  {isPending ? 'Creating…' : 'Create Spark'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Write the Spark detail page**

```tsx
// app/[locale]/(public)/discover/spark/[sparkId]/page.tsx

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSparkAction, getSparkEntriesAction } from '@/lib/actions/sparks.actions'
import { SparkEntryCard } from '../../_components/spark-entry-card'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type Props = { params: Promise<{ locale: string; sparkId: string }> }

export default async function SparkDetailPage({ params }: Props) {
  const { locale, sparkId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const [sparkResult, entriesResult] = await Promise.all([
    getSparkAction(sparkId),
    getSparkEntriesAction(sparkId, 'top', 1),
  ])

  if (!sparkResult.success) notFound()
  const spark = sparkResult.data
  const entries = entriesResult.success ? entriesResult.data.entries : []
  const entriesHasMore = entriesResult.success ? entriesResult.data.hasMore : false

  const isCreator = userId === spark.creatorUserId

  // Has the user already submitted an entry?
  const userEntry = entries.find(e => e.authorUserId === userId)

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Nav */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-3">
        <Link href={`/${locale}/discover?tab=sparks`} className="text-[#888] text-[13px] hover:text-white transition-colors">
          ← Sparks
        </Link>
      </div>

      {/* Hero */}
      {/* ... prompt, status badge, creator, deadline, entry count */}

      {/* CLOSED: winner banner */}
      {/* Submit panel: shown when OPEN and authenticated and no userEntry */}
      {/* Entries list with SparkEntryCard */}
    </div>
  )
}
```

Fill in the full hero, submit panel, winner banner, and entry list following the approved mockup. The submit panel is a client component (`SparkSubmitPanel`) that holds the textarea and calls `submitSparkEntryAction`.

- [ ] **Step 5: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add "app/[locale]/(public)/discover/spark/" "app/[locale]/(public)/discover/_components/"
git commit -m "feat: spark detail page, entry cards, vote button, create spark modal"
```

---

## Task 7: Full Entry Page

**Files:**
- Create: `app/[locale]/(public)/discover/spark/[sparkId]/entry/[entryId]/page.tsx`

- [ ] **Step 1: Write the entry page**

Server component. Fetches entry + spark (for context bar + status) + comments in parallel. Renders full prose at reading width, comments section below (same pattern as `CommentsPanel` from Phase 6 — reuse that component or clone it for entry comments).

```tsx
// app/[locale]/(public)/discover/spark/[sparkId]/entry/[entryId]/page.tsx

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSparkAction, getSparkEntryAction, getSparkEntryCommentsAction } from '@/lib/actions/sparks.actions'
import { SparkVoteButton } from '../../../_components/spark-vote-button'
import { SparkEntryCommentsPanel } from '../../../_components/spark-entry-comments-panel'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type Props = { params: Promise<{ locale: string; sparkId: string; entryId: string }> }

export default async function SparkEntryPage({ params }: Props) {
  const { locale, sparkId, entryId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const [sparkResult, entryResult, commentsResult] = await Promise.all([
    getSparkAction(sparkId),
    getSparkEntryAction(sparkId, entryId),
    getSparkEntryCommentsAction(entryId, 1),
  ])

  if (!sparkResult.success || !entryResult.success) notFound()

  const spark = sparkResult.data
  const entry = entryResult.data
  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Top nav: back link + vote button */}
      {/* Prompt context bar */}
      {/* Full entry prose (640px max-width) */}
      {/* Comments panel */}
    </div>
  )
}
```

Create `spark-entry-comments-panel.tsx` — a client component identical in structure to `CommentsPanel` from Phase 6 but calling `addSparkEntryCommentAction` instead of `addCommentAction`.

- [ ] **Step 2: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add "app/[locale]/(public)/discover/spark/[sparkId]/entry/"
git add "app/[locale]/(public)/discover/_components/spark-entry-comments-panel.tsx"
git commit -m "feat: full spark entry page with comments"
```

---

## Task 8: Author Profile Page

**Files:**
- Create: `app/[locale]/(public)/u/[username]/page.tsx`
- Create: `app/[locale]/(public)/u/[username]/_components/follow-button.tsx`

- [ ] **Step 1: Write `follow-button.tsx`**

Client component — same optimistic pattern as `SocialActions` from Phase 6.

```tsx
'use client'
import { useState, useTransition } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'

type Props = {
  targetUserId: string
  locale: string
  initialFollowing: boolean
  isAuthenticated: boolean
}

export function FollowButton({ targetUserId, locale, initialFollowing, isAuthenticated }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [isPending, startTransition] = useTransition()

  if (!isAuthenticated) {
    return (
      <a href={`/${locale}/sign-in`} className="px-4 py-1.5 border border-[#2a2a2a] text-[#888] rounded-md text-[12px] hover:text-white transition-colors">
        Sign in to follow
      </a>
    )
  }

  const handle = () => {
    const next = !following
    setFollowing(next)
    startTransition(async () => {
      const result = await toggleFollowAction(targetUserId)
      if (!result.success) setFollowing(!next)
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`px-4 py-1.5 rounded-md text-[12px] transition-colors cursor-pointer ${
        following
          ? 'bg-[#2a2a2a] text-[#aaa] hover:text-white'
          : 'border border-[#2a2a2a] text-[#888] hover:text-white'
      }`}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  )
}
```

- [ ] **Step 2: Write the author profile page**

```tsx
// app/[locale]/(public)/u/[username]/page.tsx

import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  getPublicProfileAction,
  getProfileBooksAction,
  getProfileSparksAction,
  getProfileActivityAction,
} from '@/lib/actions/user-profile.actions'
import { FollowButton } from './_components/follow-button'
import { BookCard } from '../discover/_components/book-card'
import { SparkCard } from '../discover/_components/spark-card'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type Props = { params: Promise<{ locale: string; username: string }> }

export default async function AuthorProfilePage({ params }: Props) {
  const { locale, username } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const profileResult = await getPublicProfileAction(username)
  if (!profileResult.success) notFound()
  const profile = profileResult.data

  const [booksResult, sparksResult, activityResult] = await Promise.all([
    getProfileBooksAction(profile.userId),
    getProfileSparksAction(profile.userId),
    getProfileActivityAction(profile.userId),
  ])

  const books = booksResult.success ? booksResult.data : []
  const openSparks = sparksResult.success ? sparksResult.data : []
  const activity = activityResult.success ? activityResult.data : []

  const ACTIVITY_ICONS = {
    chapter_published: '📖',
    spark_created: '⚡',
    entry_commented: '💬',
    creator_choice: '⭐',
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Header: avatar, name, bio, stats row, follow button */}
      <div className="px-6 py-7 border-b border-[#2a2a2a]">
        <div className="flex gap-5 items-start max-w-3xl">
          <div className="w-18 h-18 rounded-full bg-gradient-to-br from-[#3a2a1a] to-[#1a1a3a] shrink-0 flex items-center justify-center text-3xl">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
              : '✍'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-white text-[22px] font-bold">{profile.displayName ?? profile.username}</h1>
              <FollowButton
                targetUserId={profile.userId}
                locale={locale}
                initialFollowing={profile.isFollowing}
                isAuthenticated={!!userId}
              />
            </div>
            {profile.bio && (
              <p className="text-[#888] text-[13px] leading-relaxed max-w-lg mb-2.5">{profile.bio}</p>
            )}
            <div className="flex gap-4 flex-wrap text-[12px]">
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.followerCount}</strong> followers</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.followingCount}</strong> following</span>
              <span className="text-[#444]">·</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.wordCount >= 1000 ? `${Math.round(profile.wordCount / 1000)}k` : profile.wordCount}</strong> words written</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.bookCount}</strong> books</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.sparkCount}</strong> Sparks</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl">
        {/* Published Books */}
        {books.length > 0 && (
          <section className="mb-8">
            <p className="text-[#555] text-[11px] uppercase tracking-widest mb-3">Published Books</p>
            <div className="grid grid-cols-4 gap-3">
              {books.map(book => <BookCard key={book.id} book={book} locale={locale} />)}
            </div>
          </section>
        )}

        {/* Open Sparks */}
        {openSparks.length > 0 && (
          <section className="mb-8">
            <p className="text-[#555] text-[11px] uppercase tracking-widest mb-3">Open Sparks</p>
            <div className="flex flex-col gap-2">
              {openSparks.map(spark => (
                <Link key={spark.id} href={`/${locale}/discover/spark/${spark.id}`}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 flex items-center gap-3 hover:border-[#3a3a3a] transition-colors">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    spark.status === 'VOTING' ? 'bg-[#1a1a3a] text-[#8888ff]' : 'bg-[#2a1a00] text-[#FFC300]'
                  }`}>
                    {spark.status === 'VOTING' ? '🗳 voting' : '⚡ open'}
                  </span>
                  <p className="text-[#aaa] text-[13px] flex-1">"{spark.prompt}"</p>
                  <span className="text-[#555] text-[11px] shrink-0">{spark.entryCount} entries →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        {activity.length > 0 && (
          <section>
            <p className="text-[#555] text-[11px] uppercase tracking-widest mb-3">Recent Activity</p>
            <div className="flex flex-col gap-3">
              {activity.map((event, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-[16px] mt-0.5">{ACTIVITY_ICONS[event.type]}</span>
                  <div>
                    <p className="text-[#777] text-[12px] leading-relaxed">{event.label}</p>
                    <p className="text-[#444] text-[11px]">{new Date(event.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add `/u/` to middleware public paths**

In `middleware.ts`, add `stripped.startsWith('/u/')` to `isPublicPath()`.

- [ ] **Step 4: Run type check and commit**

```bash
node_modules\.bin\tsc --noEmit
git add "app/[locale]/(public)/u/" middleware.ts
git commit -m "feat: author profile page with books, sparks, activity, follow button"
```

---

## Self-Review Notes

- `computeStatus` is a pure function called in every Spark action — keep it in a shared helper at the top of `sparks.actions.ts`.
- `getSparkAction` lazy finalization races if two users open the page simultaneously just after close. The `UPDATE ... WHERE winner_entry_id IS NULL` is effectively a check-then-set; a DB-level unique guard isn't needed since writing the same winner twice is idempotent. Notification deduplication: check `notifications` table for existing `SPARK_WIN` for this `resourceId` before inserting.
- `inArray` from `drizzle-orm` is needed in `getSparkEntriesAction` for the voted-entry lookup — import it.
- All new routes are in `(public)` — no auth middleware changes needed except adding `/u/` prefix.
- The `BookCard` component already accepts a `locale` prop from Phase 6 — use it directly on the profile page.
- `getPublicHivesAction` already exists for the Hives tab — check its return type and build `HiveCard` around it.
- Word count enforcement in `submitSparkEntryAction`: count words server-side (split on whitespace) and compare to `spark.wordLimit`. Don't trust the client's word count.
