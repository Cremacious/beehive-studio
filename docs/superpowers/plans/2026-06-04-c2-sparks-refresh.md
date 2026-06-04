# C2 — Sparks Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the richer features from beehive-books-online prompts into Sparks — optional entry titles, one-level threaded comments, PUBLIC/FRIENDS/PRIVATE visibility + discoverable, stored status enum + customizable voting window, canonical `/sparks/*` routes with 308 redirects from `/discover/spark/*`.

**Architecture:** Additive schema changes (defaults preserve existing behavior). Sweep-on-read for status transitions (mirrors H4 word-goal precedent). Per-action visibility gates use C1's `areFriends` + `isBlocked` helpers via new `canViewSpark` / `canEnterSpark` / `canVoteSpark` predicates. Route migration follows SP-A's `permanentRedirect` shim pattern.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM on Neon Postgres, vitest + tsc, shadcn primitives (Dialog, DropdownMenu), sonner toasts.

**Spec:** [docs/superpowers/specs/2026-06-04-c2-sparks-refresh-design.md](../specs/2026-06-04-c2-sparks-refresh-design.md)
**Phase overview:** [docs/superpowers/specs/2026-06-04-community-phase-overview.md](../specs/2026-06-04-community-phase-overview.md)

---

## Task Dependencies

```
T1 (schema) → T2 (helpers) → T3,T4,T5,T6,T7 (server actions) → T8 (hook gates)
                                ↓
                             T9 (new routes) → T10 (redirects + href audit)
                                ↓
                             T11,T12,T13,T14,T15 (UI changes) → T16 (smoke + ship)
```

T1 is the only hard sequential dependency. T2 helpers (predicates, derive-title, sweep) are pre-req for T3–T7 actions. T11–T15 UI tasks depend on their respective server actions being shipped. T8 is independent of UI but depends on T3 (createSpark adds visibility field).

---

## Task 1: Schema migration + backfills

**Files:**
- Create: `scripts/migrate-c2.ts`
- Modify: `db/schema/social.ts`

- [ ] **Step 1: Extend `db/schema/social.ts`** — append:

```ts
export const sparkVisibilityEnum = pgEnum('spark_visibility', ['PUBLIC', 'FRIENDS', 'PRIVATE'])
export const sparkStatusEnum = pgEnum('spark_status', ['OPEN', 'VOTING', 'CLOSED'])

export type SparkVisibility = (typeof sparkVisibilityEnum.enumValues)[number]
export type SparkStatus = (typeof sparkStatusEnum.enumValues)[number]
```

Then modify the existing `sparks` table — add 4 columns:

```ts
visibility: sparkVisibilityEnum('visibility').notNull().default('PUBLIC'),
discoverable: boolean('discoverable').notNull().default(true),
status: sparkStatusEnum('status').notNull().default('OPEN'),
votingEndsAt: timestamp('voting_ends_at'),
```

Modify `sparkEntries` — add 2 columns:

```ts
title: text('title'),
likeCount: integer('like_count').notNull().default(0),
```

Modify `sparkEntryComments` — add 1 column:

```ts
parentId: text('parent_id').references((): AnyPgColumn => sparkEntryComments.id, { onDelete: 'cascade' }),
```

- [ ] **Step 2: Create `scripts/migrate-c2.ts`** mirroring `migrate-h4.ts` shape:

```ts
/**
 * One-shot migration for C2 (Sparks Refresh):
 *  1. Create enums spark_visibility, spark_status.
 *  2. ALTER sparks ADD COLUMN visibility/discoverable/status/voting_ends_at.
 *  3. ALTER spark_entries ADD COLUMN title/like_count.
 *  4. ALTER spark_entry_comments ADD COLUMN parent_id.
 *  5. Backfill like_count from spark_votes COUNT.
 *  6. Backfill voting_ends_at from deadline + 48h.
 *  7. Print row counts for verification.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c2.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running C2 schema migration...')

  await sql`DO $$ BEGIN
    CREATE TYPE spark_visibility AS ENUM ('PUBLIC','FRIENDS','PRIVATE');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  await sql`DO $$ BEGIN
    CREATE TYPE spark_status AS ENUM ('OPEN','VOTING','CLOSED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ 1/7 enums created')

  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS visibility spark_visibility NOT NULL DEFAULT 'PUBLIC'`
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true`
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS status spark_status NOT NULL DEFAULT 'OPEN'`
  await sql`ALTER TABLE sparks ADD COLUMN IF NOT EXISTS voting_ends_at timestamp`
  console.log('✓ 2/7 sparks columns added')

  await sql`ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS title text`
  await sql`ALTER TABLE spark_entries ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0`
  console.log('✓ 3/7 spark_entries columns added')

  await sql`ALTER TABLE spark_entry_comments ADD COLUMN IF NOT EXISTS parent_id text REFERENCES spark_entry_comments(id) ON DELETE CASCADE`
  console.log('✓ 4/7 spark_entry_comments.parent_id added')

  await sql`
    UPDATE spark_entries
    SET like_count = (SELECT count(*)::int FROM spark_votes WHERE entry_id = spark_entries.id)
    WHERE like_count = 0
  `
  console.log('✓ 5/7 like_count backfilled')

  await sql`
    UPDATE sparks
    SET voting_ends_at = deadline + interval '48 hours'
    WHERE voting_ends_at IS NULL AND deadline IS NOT NULL
  `
  console.log('✓ 6/7 voting_ends_at backfilled')

  const [{ sparks_count }] = await sql`SELECT count(*)::int AS sparks_count FROM sparks` as any
  const [{ entries_count }] = await sql`SELECT count(*)::int AS entries_count FROM spark_entries` as any
  console.log(`✓ 7/7 verification — ${sparks_count} sparks, ${entries_count} entries`)

  console.log('\nC2 migration complete.')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-c2.ts`
Expected: 7 ✓ steps. Re-run to confirm idempotency.

- [ ] **Step 4: Tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + 475/475 green.

- [ ] **Step 5: Commit**

```bash
git add db/schema/social.ts scripts/migrate-c2.ts
git commit -m "feat(c2/schema): sparks visibility/discoverable/status/votingEndsAt + entries title/likeCount + comments parentId"
```
(HEREDOC with Co-Authored-By trailer.)

---

## Task 2: Helpers — predicates + deriveTitle + sweep

**Files:**
- Create: `lib/sparks/predicates.ts`
- Create: `lib/sparks/derive-title.ts`
- Create: `lib/sparks/sweep-status.ts`
- Test: `lib/sparks/__tests__/{predicates,derive-title,sweep-status}.test.ts`

- [ ] **Step 1: `lib/sparks/derive-title.ts`**

```ts
export function deriveTitle(explicitTitle: string | null | undefined, content: string): string {
  const trimmed = explicitTitle?.trim()
  if (trimmed) return trimmed
  const firstLine = content.split('\n')[0]?.trim() ?? ''
  if (!firstLine) return 'Untitled entry'
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine
}
```

Tests in `lib/sparks/__tests__/derive-title.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveTitle } from '../derive-title'

describe('deriveTitle', () => {
  it('returns explicit title trimmed when set', () => {
    expect(deriveTitle('  My Title  ', 'body')).toBe('My Title')
  })
  it('falls back to first line of content when title blank', () => {
    expect(deriveTitle(null, 'First line\nSecond line')).toBe('First line')
  })
  it('returns Untitled entry when both blank', () => {
    expect(deriveTitle('', '')).toBe('Untitled entry')
    expect(deriveTitle(null, '\n\n')).toBe('Untitled entry')
  })
  it('truncates long first line to 80 chars + ellipsis', () => {
    const long = 'a'.repeat(100)
    expect(deriveTitle(null, long)).toBe('a'.repeat(80) + '…')
  })
})
```

Run: `npx vitest run lib/sparks/__tests__/derive-title.test.ts` → 4/4 green.

- [ ] **Step 2: `lib/sparks/predicates.ts`**

```ts
import { areFriends } from '@/lib/social/are-friends'
import { isBlocked } from '@/lib/social/is-blocked'
import type { SparkVisibility, SparkStatus } from '@/db/schema/social'

type SparkLike = { creatorId: string; visibility: SparkVisibility; status?: SparkStatus }

export async function canViewSpark(viewerId: string | null, spark: SparkLike): Promise<boolean> {
  if (viewerId && (await isBlocked(viewerId, spark.creatorId))) return false
  if (spark.visibility === 'PUBLIC') return true
  if (spark.visibility === 'PRIVATE') return viewerId === spark.creatorId
  // FRIENDS
  if (!viewerId) return false
  if (viewerId === spark.creatorId) return true
  return await areFriends(viewerId, spark.creatorId)
}

export async function canEnterSpark(viewerId: string | null, spark: SparkLike): Promise<boolean> {
  if (!viewerId) return false
  if (viewerId === spark.creatorId) return false
  if (spark.status !== 'OPEN') return false
  return await canViewSpark(viewerId, spark)
}

export async function canVoteSpark(viewerId: string | null, spark: SparkLike): Promise<boolean> {
  if (!viewerId) return false
  if (spark.status !== 'VOTING') return false
  return await canViewSpark(viewerId, spark)
}
```

Tests in `lib/sparks/__tests__/predicates.test.ts` — mock `@/lib/social/{are-friends,is-blocked}`. Cover:
- `canViewSpark`: PUBLIC unconditional (8 lines), FRIENDS friend/non-friend/self (3), PRIVATE creator-only (2), block masquerade in each (3). Total ~10 cases.
- `canEnterSpark`: status OPEN required, creator can't enter own, anon can't enter. ~5 cases.
- `canVoteSpark`: status VOTING required, anon can't vote. ~3 cases.

Test mock pattern (top-level vi.mock per [ca51b28] lesson):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/social/are-friends', () => ({ areFriends: vi.fn() }))
vi.mock('@/lib/social/is-blocked', () => ({ isBlocked: vi.fn() }))

import { areFriends } from '@/lib/social/are-friends'
import { isBlocked } from '@/lib/social/is-blocked'
import { canViewSpark } from '../predicates'

describe('canViewSpark', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true for PUBLIC spark when not blocked', async () => {
    (isBlocked as any).mockResolvedValue(false)
    expect(await canViewSpark('v', { creatorId: 'c', visibility: 'PUBLIC' })).toBe(true)
  })

  it('returns false for PUBLIC spark when blocked', async () => {
    (isBlocked as any).mockResolvedValue(true)
    expect(await canViewSpark('v', { creatorId: 'c', visibility: 'PUBLIC' })).toBe(false)
  })

  it('FRIENDS spark allows friend viewer', async () => {
    (isBlocked as any).mockResolvedValue(false)
    ;(areFriends as any).mockResolvedValue(true)
    expect(await canViewSpark('v', { creatorId: 'c', visibility: 'FRIENDS' })).toBe(true)
  })

  it('FRIENDS spark denies non-friend viewer', async () => {
    (isBlocked as any).mockResolvedValue(false)
    ;(areFriends as any).mockResolvedValue(false)
    expect(await canViewSpark('v', { creatorId: 'c', visibility: 'FRIENDS' })).toBe(false)
  })

  it('PRIVATE spark allows creator', async () => {
    (isBlocked as any).mockResolvedValue(false)
    expect(await canViewSpark('c', { creatorId: 'c', visibility: 'PRIVATE' })).toBe(true)
  })

  it('PRIVATE spark denies non-creator', async () => {
    (isBlocked as any).mockResolvedValue(false)
    expect(await canViewSpark('v', { creatorId: 'c', visibility: 'PRIVATE' })).toBe(false)
  })

  it('anon viewer on PUBLIC returns true', async () => {
    expect(await canViewSpark(null, { creatorId: 'c', visibility: 'PUBLIC' })).toBe(true)
  })

  it('anon viewer on FRIENDS returns false', async () => {
    expect(await canViewSpark(null, { creatorId: 'c', visibility: 'FRIENDS' })).toBe(false)
  })
})
```

Similar shape for `canEnterSpark` + `canVoteSpark`.

Run: `npx vitest run lib/sparks/__tests__/predicates.test.ts` → all green.

- [ ] **Step 3: `lib/sparks/sweep-status.ts`**

```ts
import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { sparks } from '@/db/schema/social'

/** Lazy auto-transition: OPEN past deadline → VOTING; VOTING past voting_ends_at → CLOSED. */
export async function sweepSparkStatuses(): Promise<void> {
  await db.update(sparks)
    .set({ status: 'VOTING' })
    .where(and(eq(sparks.status, 'OPEN'), lt(sparks.deadline, sql`now()`)))

  await db.update(sparks)
    .set({ status: 'CLOSED' })
    .where(and(eq(sparks.status, 'VOTING'), lt(sparks.votingEndsAt, sql`now()`)))
}
```

Test `lib/sparks/__tests__/sweep-status.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

const mockUpdate = vi.fn()
vi.mock('@/db', () => ({ db: { update: (...args: any[]) => mockUpdate(...args) } }))

import { sweepSparkStatuses } from '../sweep-status'

describe('sweepSparkStatuses', () => {
  it('issues two updates (OPEN→VOTING then VOTING→CLOSED)', async () => {
    const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }
    mockUpdate.mockReturnValue(chain)
    await sweepSparkStatuses()
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })
})
```

Run: 1/1 green.

- [ ] **Step 4: Full suite + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add lib/sparks/ lib/sparks/__tests__/
git commit -m "feat(c2/sparks): predicates + deriveTitle + sweepSparkStatuses helpers"
```

---

## Task 3: `createSparkAction` modifications

**Files:**
- Modify: `lib/actions/sparks.actions.ts` (`createSparkAction` only)
- Create or modify: `lib/validations/spark.ts` (find existing or create)

- [ ] **Step 1: Read existing `createSparkAction` + its Zod schema**

Locate the current Zod schema (likely in `lib/validations/spark.ts` or inline in actions file). Read end-to-end.

- [ ] **Step 2: Extend Zod schema**

Add 3 fields to the create-spark input schema:

```ts
visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
discoverable: z.boolean().optional().default(true),
votingDurationHours: z.number().int().min(1).max(720).default(48),
```

Add a `.transform()` that coerces `discoverable: false` when `visibility !== 'PUBLIC'` (matches `createBookSchema` precedent):

```ts
}).transform((data) => ({
  ...data,
  discoverable: data.visibility === 'PUBLIC' ? data.discoverable : false,
}))
```

- [ ] **Step 3: Modify `createSparkAction`**

After Zod parse, compute `votingEndsAt`:

```ts
const votingEndsAt = parsed.data.deadline
  ? new Date(parsed.data.deadline.getTime() + parsed.data.votingDurationHours * 3600_000)
  : null
```

Insert with the 4 new columns:

```ts
await db.insert(sparks).values({
  // ... existing fields ...
  visibility: parsed.data.visibility,
  discoverable: parsed.data.discoverable,
  status: 'OPEN',
  votingEndsAt,
})
```

- [ ] **Step 4: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add lib/actions/sparks.actions.ts lib/validations/spark.ts
git commit -m "feat(c2/createSpark): visibility + discoverable + votingDuration + votingEndsAt"
```

---

## Task 4: `getSparksAction` + `getSparkAction` — sweep + canViewSpark gate

**Files:**
- Modify: `lib/actions/sparks.actions.ts`

- [ ] **Step 1: Modify `getSparksAction`**

At the top of the action body (after `requireAuth` if it's auth-only, or after viewer-id resolution if it's optionally-authed):

```ts
import { sweepSparkStatuses } from '@/lib/sparks/sweep-status'
import { canViewSpark } from '@/lib/sparks/predicates'

// ... inside the action:
await sweepSparkStatuses()

// existing query — but ALSO return `creatorId, visibility, status` so we can filter
const rows = await db.select({ ...existing, creatorId, visibility, status, votingEndsAt }).from(sparks).where(...)

// Post-filter via canViewSpark (parallel)
const viewerId = /* viewer or null */
const visibleRows = await Promise.all(
  rows.map(async (r) => (await canViewSpark(viewerId, r)) ? r : null)
).then((arr) => arr.filter((r): r is NonNullable<typeof r> => r !== null))

return { success: true, data: visibleRows }
```

- [ ] **Step 2: Modify `getSparkAction`**

```ts
await sweepSparkStatuses()
const spark = await db.query.sparks.findFirst({ where: eq(sparks.id, sparkId) })
if (!spark) return { success: false, error: 'NOT_FOUND' }
if (!(await canViewSpark(viewerId, spark))) {
  return { success: false, error: 'NOT_FOUND' }  // masquerade
}
// ... existing return shape (extend with visibility, status, votingEndsAt) ...
```

- [ ] **Step 3: Tsc + tests + commit**

```bash
npx tsc --noEmit && npm test
git add lib/actions/sparks.actions.ts
git commit -m "feat(c2/getSparks): sweep + canViewSpark gate + block masquerade"
```

---

## Task 5: `submitSparkEntryAction` + `updateSparkEntryAction`

**Files:**
- Modify: `lib/actions/sparks.actions.ts`
- Modify: `lib/validations/spark.ts` (submit-entry + update-entry schemas)

- [ ] **Step 1: Add `title` to both Zod schemas**

```ts
title: z.string().trim().max(120).nullable().optional(),
```

- [ ] **Step 2: Modify `submitSparkEntryAction`**

After Zod parse + spark fetch, add the `canEnterSpark` check:

```ts
import { canEnterSpark } from '@/lib/sparks/predicates'

const spark = await db.query.sparks.findFirst({ where: eq(sparks.id, sparkId) })
if (!spark) return { success: false, error: 'NOT_FOUND' }
if (!(await canEnterSpark(userId, spark))) {
  return { success: false, error: 'NOT_ALLOWED' }
}
```

Insert path includes `title: parsed.data.title ?? null`.

**Activity hook gate update** — C1's existing `recordSocialActivityTx` call inside this action wraps in:

```ts
if (spark.visibility === 'PUBLIC') {
  await recordSocialActivityTx(tx, {
    actorId: userId,
    type: 'spark_entry_submitted',
    subjectType: 'spark_entry',
    subjectId: newEntryId,
    payload: { sparkId, sparkTitle: spark.title },
  })
}
```

- [ ] **Step 3: Modify `updateSparkEntryAction`**

Add title to the update path:

```ts
await db.update(sparkEntries).set({ ...existing, title: parsed.data.title ?? null, ... }).where(...)
```

- [ ] **Step 4: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add lib/actions/sparks.actions.ts lib/validations/spark.ts
git commit -m "feat(c2/sparkEntry): optional title + canEnterSpark gate + hook gate"
```

---

## Task 6: `voteSparkEntryAction` likeCount denorm + `getSparkEntriesAction` sort

**Files:**
- Modify: `lib/actions/sparks.actions.ts`

- [ ] **Step 1: Modify `voteSparkEntryAction`**

Convert to `db.transaction` if not already. Inside the tx, wrap the existing vote insert/delete with a paired `like_count` update:

```ts
import { canVoteSpark } from '@/lib/sparks/predicates'
import { sql } from 'drizzle-orm'

await db.transaction(async (tx) => {
  // Existing toggle logic — pseudocode:
  const existing = await tx.query.sparkVotes.findFirst({
    where: and(eq(sparkVotes.userId, userId), eq(sparkVotes.entryId, entryId)),
  })

  if (existing) {
    await tx.delete(sparkVotes).where(
      and(eq(sparkVotes.userId, userId), eq(sparkVotes.entryId, entryId))
    )
    await tx.update(sparkEntries)
      .set({ likeCount: sql`${sparkEntries.likeCount} - 1` })
      .where(eq(sparkEntries.id, entryId))
  } else {
    await tx.insert(sparkVotes).values({ userId, entryId })
    await tx.update(sparkEntries)
      .set({ likeCount: sql`${sparkEntries.likeCount} + 1` })
      .where(eq(sparkEntries.id, entryId))
  }
})
```

Add `canVoteSpark` gate BEFORE the tx:

```ts
const spark = await db.query.sparks.findFirst({
  where: eq(sparks.id, /* lookup via entry → spark */),
})
if (!spark || !(await canVoteSpark(userId, spark))) {
  return { success: false, error: 'NOT_ALLOWED' }
}
```

- [ ] **Step 2: Modify `getSparkEntriesAction`**

Add `title` + `likeCount` to projection. Sort branches on parent spark's status:

```ts
const spark = await db.query.sparks.findFirst({ where: eq(sparks.id, sparkId), columns: { status: true } })

const orderBy = spark?.status === 'OPEN'
  ? [desc(sparkEntries.createdAt)]
  : [desc(sparkEntries.likeCount), desc(sparkEntries.createdAt)]

const entries = await db.select({
  // ... existing ...
  title: sparkEntries.title,
  likeCount: sparkEntries.likeCount,
}).from(sparkEntries).where(eq(sparkEntries.sparkId, sparkId)).orderBy(...orderBy)
```

- [ ] **Step 3: Modify `getSparkEntryAction`**

Add `title` field to return projection.

- [ ] **Step 4: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add lib/actions/sparks.actions.ts
git commit -m "feat(c2/sparkVote): likeCount denorm + canVoteSpark + sort by likes when VOTING/CLOSED"
```

---

## Task 7: `replyToSparkCommentAction` + comment list reshape

**Files:**
- Modify: `lib/actions/sparks.actions.ts`
- Modify: `lib/validations/spark.ts`

- [ ] **Step 1: Locate existing comment list + create action**

Find: `commentOnSparkEntryAction` (or whatever the create-comment action is named — search for `sparkEntryComments` insert). Find the listing action returning `EntryComment[]`.

- [ ] **Step 2: Add `replyToSparkCommentAction`**

Zod schema:

```ts
export const replyToSparkCommentSchema = z.object({
  entryId: z.string().min(1),
  parentId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
})
```

Action:

```ts
import { canViewSpark } from '@/lib/sparks/predicates'
import { isBlocked } from '@/lib/social/is-blocked'

export async function replyToSparkCommentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = replyToSparkCommentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  // Fetch parent comment to enforce one-level
  const parent = await db.query.sparkEntryComments.findFirst({
    where: eq(sparkEntryComments.id, parsed.data.parentId),
    columns: { id: true, parentId: true, userId: true, entryId: true },
  })
  if (!parent) return { success: false, error: 'PARENT_NOT_FOUND' }
  if (parent.parentId !== null) return { success: false, error: 'REPLY_DEPTH_EXCEEDED' }
  if (parent.entryId !== parsed.data.entryId) return { success: false, error: 'PARENT_MISMATCH' }

  if (await isBlocked(userId, parent.userId)) return { success: false, error: 'BLOCKED' }

  // canViewSpark on the parent spark
  const entry = await db.query.sparkEntries.findFirst({
    where: eq(sparkEntries.id, parsed.data.entryId),
    columns: { sparkId: true },
  })
  if (!entry) return { success: false, error: 'NOT_FOUND' }
  const spark = await db.query.sparks.findFirst({
    where: eq(sparks.id, entry.sparkId),
    columns: { creatorId: true, visibility: true, status: true },
  })
  if (!spark || !(await canViewSpark(userId, spark))) return { success: false, error: 'NOT_ALLOWED' }

  const id = createId()
  await db.insert(sparkEntryComments).values({
    id, entryId: parsed.data.entryId, userId, content: parsed.data.content, parentId: parsed.data.parentId,
  })
  return { success: true, data: { id } }
}
```

- [ ] **Step 3: Extend comment listing to return parentId**

Update the existing `getEntryCommentsAction` (or equivalent) projection to include `parentId`. Caller (UI in T13) groups via Map.

- [ ] **Step 4: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add lib/actions/sparks.actions.ts lib/validations/spark.ts
git commit -m "feat(c2/sparkComments): replyToSparkCommentAction + parentId in listing"
```

---

## Task 8: Activity hook gate updates (3 sites)

**Files:**
- Modify: `lib/actions/sparks.actions.ts`

- [ ] **Step 1: Locate all 3 `recordSocialActivityTx` call sites for spark events**

Grep: `grep -n "recordSocialActivityTx" lib/actions/sparks.actions.ts`. The 3 sites from C1 T8 are inside `submitSparkEntryAction` + spark winner-resolution paths (`setCreatorChoiceAction` + lazy-finalize in `getSparkAction`).

Note: T5 already updated `submitSparkEntryAction`'s gate. T8 covers the two winner sites.

- [ ] **Step 2: Add visibility gate to each winner hook**

For both `setCreatorChoiceAction` (creator's choice winner) and the lazy-finalize block in `getSparkAction` (community vote winner), wrap the existing `recordSocialActivityTx` call:

```ts
if (spark.visibility === 'PUBLIC') {
  await recordSocialActivityTx(tx, {
    actorId: winnerEntry.userId,
    type: 'spark_won_creator_choice', // or spark_won_community
    subjectType: 'spark_entry',
    subjectId: winnerEntry.id,
    payload: { sparkId: spark.id, sparkTitle: spark.title },
  })
}
```

- [ ] **Step 3: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add lib/actions/sparks.actions.ts
git commit -m "feat(c2/hooks): gate spark winner events on visibility=PUBLIC"
```

---

## Task 9: New canonical `/sparks/*` routes

**Files:**
- Create: `app/[locale]/(public)/sparks/page.tsx`
- Create: `app/[locale]/(public)/sparks/[sparkId]/page.tsx`
- Create: `app/[locale]/(public)/sparks/[sparkId]/entry/[entryId]/page.tsx`

- [ ] **Step 1: `/sparks` index** (`app/[locale]/(public)/sparks/page.tsx`)

Server component. Three stacked sections.

```tsx
import { getSparksAction } from '@/lib/actions/sparks.actions'
import { SparkCard } from '@/app/[locale]/(public)/discover/_components/spark-card'
import { CreateSparkButton } from '@/app/[locale]/(public)/discover/_components/create-spark-button'

export default async function SparksIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const result = await getSparksAction()
  if (!result.success) return <div>Failed to load sparks.</div>
  const sparks = result.data

  const active = sparks.filter((s) => s.status === 'OPEN')
  const voting = sparks.filter((s) => s.status === 'VOTING')
  const closed = sparks.filter((s) => s.status === 'CLOSED')

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-bold text-[var(--brand)]" style={{ fontFamily: 'var(--font-comfortaa)' }}>
          Sparks
        </h1>
        <CreateSparkButton locale={locale} />
      </header>

      <section className="mb-10">
        <h2 className="text-sm font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          Active sparks
        </h2>
        {active.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">No active sparks. Be the first to start one.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {active.map((s) => <SparkCard key={s.id} spark={s} locale={locale} />)}
          </div>
        )}
      </section>

      {voting.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
            Voting now
          </h2>
          <ul className="space-y-2">
            {voting.map((s) => <SparkCard key={s.id} spark={s} locale={locale} variant="compact" />)}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
            Past sparks
          </h2>
          <ul className="space-y-2">
            {closed.map((s) => <SparkCard key={s.id} spark={s} locale={locale} variant="compact" />)}
          </ul>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 2: `/sparks/[sparkId]` detail** — port from existing `/discover/spark/[sparkId]/page.tsx`

Copy the existing server logic verbatim. Add to the rendered header:

```tsx
<StatusPill status={spark.status} />
<VisibilityPill visibility={spark.visibility} />
{spark.status === 'VOTING' && spark.votingEndsAt && (
  <Countdown to={spark.votingEndsAt} prefix="Voting ends in" />
)}
```

(Components defined in T14.)

- [ ] **Step 3: `/sparks/[sparkId]/entry/[entryId]` reader** — port from `/discover/spark/[sparkId]/entry/[entryId]/page.tsx`

Same logic. Render `deriveTitle(entry.title, entry.content)` as the entry heading.

- [ ] **Step 4: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/(public)/sparks/
git commit -m "feat(c2/sparks-routes): /sparks index + detail + entry reader pages"
```

---

## Task 10: 308 redirects + href audit

**Files:**
- Modify: `app/[locale]/(public)/discover/spark/[sparkId]/page.tsx`
- Modify: `app/[locale]/(public)/discover/spark/[sparkId]/entry/[entryId]/page.tsx`
- Modify: components linking to `/discover/spark/*`

- [ ] **Step 1: Replace `/discover/spark/[sparkId]/page.tsx` with redirect shim**

```tsx
import { permanentRedirect } from 'next/navigation'

export default async function Page({ params }: { params: Promise<{ locale: string; sparkId: string }> }) {
  const { locale, sparkId } = await params
  permanentRedirect(`/${locale}/sparks/${sparkId}`)
}
```

- [ ] **Step 2: Same for entry route**

```tsx
import { permanentRedirect } from 'next/navigation'

export default async function Page({ params }: { params: Promise<{ locale: string; sparkId: string; entryId: string }> }) {
  const { locale, sparkId, entryId } = await params
  permanentRedirect(`/${locale}/sparks/${sparkId}/entry/${entryId}`)
}
```

- [ ] **Step 3: Internal href audit**

```bash
grep -rn "/discover/spark/" app/ components/
```

For each hit (not the redirect shims themselves):
- Update `<Link href={`/${locale}/discover/spark/${id}`}>` → `<Link href={`/${locale}/sparks/${id}`}>`.

Known consumers per spec §4.3:
- `app/[locale]/(public)/discover/_components/spark-card.tsx` if it links back
- `app/[locale]/(public)/discover/_components/spark-entry-card.tsx`
- `app/[locale]/(app)/community/_components/sidebar/active-sparks-panel.tsx`
- `app/[locale]/(app)/community/_components/section-rail.tsx` — Sparks tile `href` flips from `/discover?tab=sparks` to `/sparks`
- `app/[locale]/(app)/community/_components/activity-event-row.tsx` — for `spark_*` event subjects
- `/u/[username]/page.tsx` profile if it lists sparks

- [ ] **Step 4: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/ components/
git commit -m "feat(c2/redirects): 308 from /discover/spark/* to /sparks/* + internal href audit"
```

---

## Task 11: `<CreateSparkModal>` form additions

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/create-spark-modal.tsx`
- Create: `app/[locale]/(public)/discover/_components/visibility-picker.tsx`

- [ ] **Step 1: `<VisibilityPicker>`** — 3-card radio reusing `<SharingControls>` shape

```tsx
'use client'
import { Globe, Users, Lock } from 'lucide-react'
import type { SparkVisibility } from '@/db/schema/social'

type Props = {
  value: SparkVisibility
  onChange: (next: SparkVisibility) => void
}

const OPTIONS: Array<{ value: SparkVisibility; label: string; icon: typeof Globe; blurb: string }> = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, blurb: 'Anyone can see and enter.' },
  { value: 'FRIENDS', label: 'Friends', icon: Users, blurb: 'Only your friends can see and enter.' },
  { value: 'PRIVATE', label: 'Private', icon: Lock, blurb: 'Only you can see this spark.' },
]

export function VisibilityPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left p-3 rounded-[var(--r-card)] border ${
              active ? 'border-[var(--brand)] bg-[var(--brand)]/8' : 'border-[var(--br-card)]'
            }`}
          >
            <Icon className="h-4 w-4 mb-2 text-[var(--brand)]" />
            <div className="font-semibold text-sm">{opt.label}</div>
            <div className="text-xs text-[var(--canvas-dark-ink-muted)]">{opt.blurb}</div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Modify `<CreateSparkModal>`**

Add 3 new form rows above the existing submit button:

```tsx
const [visibility, setVisibility] = useState<SparkVisibility>('PUBLIC')
const [discoverable, setDiscoverable] = useState(true)
const [votingDurationHours, setVotingDurationHours] = useState<24 | 48 | 72 | 168>(48)

// Force-clear discoverable when visibility leaves PUBLIC
useEffect(() => {
  if (visibility !== 'PUBLIC') setDiscoverable(false)
}, [visibility])

// In JSX:
<div>
  <label className="text-xs font-mono uppercase mb-1.5 block text-[var(--canvas-dark-ink-muted)]">Visibility</label>
  <VisibilityPicker value={visibility} onChange={setVisibility} />
</div>

<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={discoverable}
    disabled={visibility !== 'PUBLIC'}
    onChange={(e) => setDiscoverable(e.target.checked)}
  />
  <span>Show in Discover</span>
  {visibility !== 'PUBLIC' && (
    <span className="text-xs text-[var(--canvas-dark-ink-muted)]">(only PUBLIC sparks can be discoverable)</span>
  )}
</label>

<div>
  <label className="text-xs font-mono uppercase mb-1.5 block text-[var(--canvas-dark-ink-muted)]">Voting window</label>
  <div className="grid grid-cols-4 gap-2">
    {[24, 48, 72, 168].map((h) => (
      <button
        key={h}
        type="button"
        onClick={() => setVotingDurationHours(h as any)}
        className={`text-sm py-2 rounded-[var(--r-row)] border ${
          votingDurationHours === h ? 'border-[var(--brand)] bg-[var(--brand)]/8' : 'border-[var(--br-card)]'
        }`}
      >
        {h === 168 ? '1 week' : `${h}h`}
      </button>
    ))}
  </div>
</div>
```

Pass the new fields into the `createSparkAction` call.

- [ ] **Step 3: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/(public)/discover/_components/{create-spark-modal,visibility-picker}.tsx
git commit -m "feat(c2/createSparkModal): visibility picker + discoverable + voting duration"
```

---

## Task 12: `<SparkSubmitPanel>` title input + `<SparkEntryCard>` title rendering

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/spark-submit-panel.tsx`
- Modify: `app/[locale]/(public)/discover/_components/spark-entry-card.tsx`

- [ ] **Step 1: Add optional title input to `<SparkSubmitPanel>`**

Above the existing content textarea:

```tsx
const [title, setTitle] = useState('')

<div>
  <label className="text-xs font-mono uppercase mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
    Title <span className="lowercase">(optional)</span>
  </label>
  <input
    type="text"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    maxLength={120}
    placeholder="Leave blank to derive from your first line."
    className="w-full px-3 py-2 rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] text-sm"
    style={{ boxShadow: 'var(--sh-inset)' }}
  />
</div>
```

Pass into `submitSparkEntryAction({ ..., title: title.trim() || null })`.

- [ ] **Step 2: Render derived title in `<SparkEntryCard>`**

```tsx
import { deriveTitle } from '@/lib/sparks/derive-title'

const displayTitle = deriveTitle(entry.title, entry.content)

<h3 className="font-bold text-[var(--canvas-dark-ink-strong)]" style={{ fontFamily: 'var(--font-comfortaa)' }}>
  {displayTitle}
</h3>
```

- [ ] **Step 3: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/(public)/discover/_components/{spark-submit-panel,spark-entry-card}.tsx
git commit -m "feat(c2/sparkEntryUI): title input + derived-title rendering"
```

---

## Task 13: `<SparkEntryComments>` threaded rewrite

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/spark-entry-comments-panel.tsx`

- [ ] **Step 1: Group comments by parent**

The action now returns `parentId`. Group:

```ts
const topLevel = comments.filter((c) => c.parentId === null)
const repliesByParent = new Map<string, EntryComment[]>()
for (const c of comments) {
  if (c.parentId) {
    const arr = repliesByParent.get(c.parentId) ?? []
    arr.push(c)
    repliesByParent.set(c.parentId, arr)
  }
}
```

- [ ] **Step 2: Render threaded structure**

```tsx
{topLevel.map((c) => {
  const replies = repliesByParent.get(c.id) ?? []
  return (
    <div key={c.id} className="border-b border-[var(--br-card)] py-3">
      <CommentRow comment={c} onReplyClick={() => setReplyingTo(c.id)} />
      {replies.length > 0 && (
        <div className="ml-8 border-l border-[var(--br-card)] pl-4 mt-3 space-y-3">
          {replies.map((r) => <CommentRow key={r.id} comment={r} isReply />)}
        </div>
      )}
      {replyingTo === c.id && (
        <div className="ml-8 mt-3">
          <ReplyComposer parentId={c.id} entryId={entry.id} onSubmit={async (content) => {
            await replyToSparkCommentAction({ entryId: entry.id, parentId: c.id, content })
            setReplyingTo(null)
            router.refresh()
          }} />
        </div>
      )}
    </div>
  )
})}
```

`<CommentRow isReply>` does NOT render a Reply button (one-level enforcement).

- [ ] **Step 3: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/(public)/discover/_components/spark-entry-comments-panel.tsx
git commit -m "feat(c2/sparkComments): threaded comments with one-level reply UI"
```

---

## Task 14: Spark detail header — status pill + visibility pill + countdown

**Files:**
- Create: `app/[locale]/(public)/discover/_components/status-pill.tsx`
- Create: `app/[locale]/(public)/discover/_components/visibility-pill.tsx`
- Create: `app/[locale]/(public)/discover/_components/countdown.tsx`
- Modify: spark detail page header in `/sparks/[sparkId]/page.tsx` (and the existing `/discover/spark/[sparkId]/page.tsx` if needed; T10 already swapped it to redirect)

- [ ] **Step 1: `<StatusPill>`**

```tsx
import type { SparkStatus } from '@/db/schema/social'

const STATUS_META: Record<SparkStatus, { label: string; token: string }> = {
  OPEN: { label: 'Open', token: '--status-success' },
  VOTING: { label: 'Voting', token: '--brand' },
  CLOSED: { label: 'Closed', token: '--canvas-dark-ink-muted' },
}

export function StatusPill({ status }: { status: SparkStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
      style={{
        background: `oklch(from var(${meta.token}) l c h / 0.14)`,
        color: `var(${meta.token})`,
        border: `1px solid oklch(from var(${meta.token}) l c h / 0.3)`,
      }}
    >
      {meta.label}
    </span>
  )
}
```

- [ ] **Step 2: `<VisibilityPill>`**

```tsx
import { Globe, Users, Lock } from 'lucide-react'
import type { SparkVisibility } from '@/db/schema/social'

const META: Record<SparkVisibility, { label: string; Icon: typeof Globe }> = {
  PUBLIC: { label: 'Public', Icon: Globe },
  FRIENDS: { label: 'Friends', Icon: Users },
  PRIVATE: { label: 'Private', Icon: Lock },
}

export function VisibilityPill({ visibility }: { visibility: SparkVisibility }) {
  const { label, Icon } = META[visibility]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
```

- [ ] **Step 3: `<Countdown>`**

Client component computing relative time-remaining. Re-renders every 60s.

```tsx
'use client'
import { useEffect, useState } from 'react'

export function Countdown({ to, prefix }: { to: Date; prefix: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const diffMs = to.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const h = Math.floor(diffMs / 3600_000)
  const label = h >= 24 ? `${Math.floor(h / 24)}d` : h >= 1 ? `${h}h` : `${Math.floor(diffMs / 60_000)}m`
  return <span className="text-xs text-[var(--canvas-dark-ink-muted)]">{prefix} {label}</span>
}
```

- [ ] **Step 4: Mount in `/sparks/[sparkId]/page.tsx` header**

```tsx
<div className="flex items-center gap-2 mb-3">
  <StatusPill status={spark.status} />
  <VisibilityPill visibility={spark.visibility} />
  {spark.status === 'VOTING' && spark.votingEndsAt && (
    <Countdown to={spark.votingEndsAt} prefix="Voting ends in" />
  )}
</div>
```

- [ ] **Step 5: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/(public)/{sparks,discover}/
git commit -m "feat(c2/sparkDetail): status + visibility pills + voting countdown"
```

---

## Task 15: `<SparkCard>` pills + community section rail update

**Files:**
- Modify: `app/[locale]/(public)/discover/_components/spark-card.tsx`
- Modify: `app/[locale]/(app)/community/_components/section-rail.tsx`

- [ ] **Step 1: Add pills to `<SparkCard>`**

```tsx
import { StatusPill } from './status-pill'
import { VisibilityPill } from './visibility-pill'

// In the card body, near the title:
<div className="flex items-center gap-2 mb-1">
  {spark.status !== 'OPEN' && <StatusPill status={spark.status} />}
  {spark.visibility !== 'PUBLIC' && <VisibilityPill visibility={spark.visibility} />}
</div>
```

- [ ] **Step 2: Update community section rail Sparks tile**

In `section-rail.tsx`, locate the Sparks tile and change its `href` from `/discover?tab=sparks` to `/sparks`.

- [ ] **Step 3: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/
git commit -m "feat(c2/sparkCard): visibility + status pills + community rail tile to /sparks"
```

---

## Task 16: Manual smoke + AGENTS.md update + ship

- [ ] **Step 1: Run full test suite + tsc one final time**

```bash
npm test && npx tsc --noEmit
```

Expected: 475+ tests green (with new C2 tests added), tsc clean.

- [ ] **Step 2: Run smoke checklist**

Boot `npm run dev`. Walk these scenarios:

1. Create a PUBLIC+discoverable spark → confirm it appears in /sparks "Active" section + on /discover Sparks tab + on /community section rail.
2. Create a FRIENDS spark → confirm: appears on YOUR /sparks; not visible to a non-friend test account; visible to a friend account.
3. Create a PRIVATE spark → confirm only creator can see it on /sparks.
4. Discoverable flip: try checking discoverable while visibility=FRIENDS → confirm checkbox disabled with explanatory text.
5. Submit entry to OPEN PUBLIC spark with no title → confirm `<SparkEntryCard>` displays first line as title.
6. Submit entry with explicit title → confirm title displayed.
7. Try to submit entry to your own spark → confirm `NOT_ALLOWED`.
8. Vote on an entry during VOTING status → confirm `like_count` increments + entry list re-sorts by likes.
9. Try to vote during OPEN status → confirm `NOT_ALLOWED`.
10. Post a top-level comment on an entry.
11. Reply to a comment → confirm reply indents under parent.
12. Try to reply to a reply → confirm UI doesn't expose the affordance (one-level enforcement). If you bypass via API, confirm `REPLY_DEPTH_EXCEEDED`.
13. Spark with `deadline=now-1h` → reload /sparks → confirm spark moved to "Voting now" via lazy sweep.
14. Spark with `voting_ends_at=now-1h` → reload → confirm moved to "Past sparks".
15. 308 redirect: open `/discover/spark/<id>` → confirm HTTP 308 to `/sparks/<id>` in the network tab.
16. Block flow: A creates a PUBLIC spark; B blocks A; B's /sparks shows nothing (spark masquerades as NOT_FOUND); A's /sparks unchanged.
17. Feed gating: A creates a FRIENDS spark; B follows A but isn't a friend → confirm B does NOT see `spark_entry_submitted` events for that spark in /community feed.

If any fails → file a `fix(c2): ...` commit.

- [ ] **Step 3: Update AGENTS.md "Resume Here"**

Replace "Current focus" with the C2 shipping summary mirroring C1's pattern:
- Wave SHA list (each task)
- Patterns now load-bearing (sweep-on-read for status; visibility picker shape reusable for C4 clubs; `deriveTitle` reusable for any future "first-line fallback" pattern; `<StatusPill>`/`<VisibilityPill>` reusable across C3/C4)
- Known follow-ups
- Carry-forward smoke targets (the 17 above)

Set "Next concrete step" to: Chris picks next phase — C3 Reading Lists (net-new schema-heavy) or C5 polish.

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): record C2 Sparks Refresh ship"
```

- [ ] **Step 5: Hand off to Chris**

"C2 Sparks Refresh is code-complete and ready for smoke. Walk the 17-scenario checklist; file `fix(c2): ...` commits for any bugs found. After smoke passes, decide next phase: C3 Reading Lists or C5 polish."

---

## Self-Review

**Spec coverage:**
- §2.1 schema additions → T1 ✓
- §2.2 enums → T1 ✓
- §2.3 migration → T1 ✓
- §3.1 predicates → T2 ✓
- §3.2 sweep → T2 ✓
- §3.3 action modifications → T3-T7 ✓
- §3.4 hook gate updates → T5 (submitSpark) + T8 (winners) ✓
- §3.5 replyToSparkCommentAction → T7 ✓
- §4 route migration → T9 + T10 ✓
- §5.1 CreateSparkModal extensions → T11 ✓
- §5.2 SparkSubmitPanel title input → T12 ✓
- §5.3 SparkEntryCard title rendering → T12 ✓
- §5.4 threaded comments → T13 ✓
- §5.5 spark detail header → T14 ✓
- §5.6 SparkCard pills → T15 ✓
- §5.7 community rail tile update → T15 ✓
- §6 privacy gate enforcement → T4 + T5 + T6 + T7 ✓
- §7 test posture → distributed across T2 + T3-T7 ✓

**Placeholder scan:** No "TBD" / "implement later". One non-blocking deferral inside T6 step 1: the existing `voteSparkEntryAction` body needs to be read first to confirm the toggle shape — but the action shape is pseudo-coded with concrete logic.

**Type consistency:**
- `SparkVisibility` / `SparkStatus` exported from schema (T1) → consumed by `lib/sparks/predicates.ts` (T2) → used in `<VisibilityPicker>` (T11) + `<StatusPill>`/`<VisibilityPill>` (T14) + form state (T11). Names match.
- `deriveTitle(explicit, content)` signature in T2 matches T12 call site.
- `SparkLike` shape in `predicates.ts` (`{ creatorId, visibility, status? }`) matches what action callers pass.

No drift detected. Plan locked.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-c2-sparks-refresh.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh implementer per task + per-task review + per-task commits. Matches C1 cadence.

2. **Inline Execution** — execute tasks in current session via executing-plans, batched with checkpoints.

For C2: subagent-driven is recommended. Suggested waves:
- **Wave 1:** T1 alone (schema migration, hard sequential prereq).
- **Wave 2:** T2 alone (helpers — pre-req for action tasks).
- **Wave 3 (parallel):** T3 + T4 + T5 + T6 + T7 + T8 — all action modifications, different code paths.
- **Wave 4:** T9 alone (new routes — establishes UI shape).
- **Wave 5 (parallel):** T10 + T11 + T12 + T13 + T14 + T15 — UI changes, isolated component scopes.
- **Wave 6:** T16 (smoke + ship).

Chris picks when ready. Default to subagent-driven unless overridden.
