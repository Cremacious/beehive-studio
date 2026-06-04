# C1 — Community Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation of the Community phase — proper friends graph, blocks, mutes, invite-by-link, a `/community` hub IA, the `social_activity` event-store feed, profile-page friendship UI, nav user-avatar dropdown, FRIENDS visibility enforcement.

**Architecture:** Append-only `social_activity` event store (mirrors `hive_activity` pattern from H1). Single SELECT cursor-paginated feed. Friend graph stays on existing `friendships` table; blocks + mutes live in their own global tables. Activity events fire inside source-action transactions via `recordSocialActivityTx`. Privacy enforced by `areFriends()` + `isBlocked()` React-cached helpers; blocks masquerade as `NOT_FOUND` to hide their existence.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM on Neon Postgres, better-auth v1, shadcn DropdownMenu + Dialog, sonner toasts, vitest + tsc for verification.

**Spec:** [docs/superpowers/specs/2026-06-04-c1-community-foundation-design.md](../specs/2026-06-04-c1-community-foundation-design.md)
**Phase overview:** [docs/superpowers/specs/2026-06-04-community-phase-overview.md](../specs/2026-06-04-community-phase-overview.md)

---

## Task Dependencies

```
T1 (schema) → T2 (helpers) → T4 (canReadBook)
                ↓
              T3 (recordActivity) → T5,T6 (actions) → T7 (feed action) → T8 (event hooks)
                                       ↓
                                    T11 (profile) ← T12 (nav) ← T13 (invite route)
                                       ↓
                                    T9 (/community) → T10 (/friends)
                                                      ↓
                                                  T14 (notifs) → T15 (hive Discover) → T16 (smoke + ship)
```

T1 is the only hard sequential dependency for everything else. T2-T6 can be parallelized after T1. T7+T8 need T3 + helpers. UI tasks (T9-T13) need their action layer (T5-T8).

---

## Task 1: Schema migration + enum additions

**Files:**
- Create: `scripts/migrate-c1.ts`
- Modify: `db/schema/social.ts`

- [ ] **Step 1: Write failing migration runner test**

Create `scripts/__tests__/migrate-c1.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('migrate-c1 schema definitions', () => {
  it('exports new tables from social schema', async () => {
    const schema = await import('@/db/schema/social');
    expect(schema.socialActivity).toBeDefined();
    expect(schema.userBlocks).toBeDefined();
    expect(schema.userMutes).toBeDefined();
    expect(schema.friendInvites).toBeDefined();
    expect(schema.socialActivityTypeEnum).toBeDefined();
  });
});
```

Run: `npx vitest run scripts/__tests__/migrate-c1.test.ts`
Expected: FAIL — exports not defined.

- [ ] **Step 2: Extend `db/schema/social.ts`**

Append to existing `db/schema/social.ts`:

```ts
import { pgEnum, pgTable, primaryKey, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const socialActivityTypeEnum = pgEnum('social_activity_type', [
  'book_published',
  'chapter_posted',
  'book_liked',
  'book_commented',
  'spark_entry_submitted',
  'spark_won_community',
  'spark_won_creator_choice',
  'hive_created',
  'hive_joined',
]);

export const socialActivity = pgTable(
  'social_activity',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: socialActivityTypeEnum('type').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    actorCreatedIdx: index('social_activity_actor_created_idx').on(t.actorId, t.createdAt.desc()),
    subjectIdx: index('social_activity_subject_idx').on(t.subjectType, t.subjectId),
  }),
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: text('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.blockerId, t.blockedId] }),
    blockedIdx: index('user_blocks_blocked_idx').on(t.blockedId),
  }),
);

export const userMutes = pgTable(
  'user_mutes',
  {
    muterId: text('muter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    mutedId: text('muted_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.muterId, t.mutedId] }),
  }),
);

export const friendInvites = pgTable(
  'friend_invites',
  {
    token: text('token').primaryKey(),
    inviterId: text('inviter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    claimedBy: text('claimed_by').references(() => users.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    inviterIdx: index('friend_invites_inviter_idx').on(t.inviterId),
  }),
);

export type SocialActivityType = (typeof socialActivityTypeEnum.enumValues)[number];
```

- [ ] **Step 3: Verify schema test passes**

Run: `npx vitest run scripts/__tests__/migrate-c1.test.ts`
Expected: PASS.

- [ ] **Step 4: Write idempotent migration runner**

Create `scripts/migrate-c1.ts` (mirror `scripts/migrate-h4.ts` shape):

```ts
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // 1. Create social_activity_type enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE social_activity_type AS ENUM (
        'book_published','chapter_posted','book_liked','book_commented',
        'spark_entry_submitted','spark_won_community','spark_won_creator_choice',
        'hive_created','hive_joined'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `;
  console.log('✓ 1/7 social_activity_type enum');

  // 2. Create social_activity table
  await sql`
    CREATE TABLE IF NOT EXISTS social_activity (
      id text PRIMARY KEY,
      actor_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      type social_activity_type NOT NULL,
      subject_type text NOT NULL,
      subject_id text NOT NULL,
      payload jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS social_activity_actor_created_idx ON social_activity (actor_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS social_activity_subject_idx ON social_activity (subject_type, subject_id)`;
  console.log('✓ 2/7 social_activity table');

  // 3. user_blocks
  await sql`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      blocked_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (blocker_id, blocked_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id)`;
  console.log('✓ 3/7 user_blocks table');

  // 4. user_mutes
  await sql`
    CREATE TABLE IF NOT EXISTS user_mutes (
      muter_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      muted_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (muter_id, muted_id)
    )
  `;
  console.log('✓ 4/7 user_mutes table');

  // 5. friend_invites
  await sql`
    CREATE TABLE IF NOT EXISTS friend_invites (
      token text PRIMARY KEY,
      inviter_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      expires_at timestamp NOT NULL,
      claimed_by text REFERENCES "user"(id) ON DELETE SET NULL,
      claimed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS friend_invites_inviter_idx ON friend_invites (inviter_id)`;
  console.log('✓ 5/7 friend_invites table');

  // 6/7. notification enum additions
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FRIEND_REQUEST'`;
  console.log('✓ 6/7 FRIEND_REQUEST notification type');
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'FRIEND_ACCEPTED'`;
  console.log('✓ 7/7 FRIEND_ACCEPTED notification type');

  console.log('\nC1 migration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-c1.ts`
Expected: 7 ✓ steps printed. Re-run to confirm idempotency: all 7 ✓ again.

- [ ] **Step 6: Verify tsc clean across schema changes**

Run: `npx tsc --noEmit`
Expected: clean (the schema additions don't break any existing consumer because the new tables are net-new).

- [ ] **Step 7: Commit**

```bash
git add db/schema/social.ts scripts/migrate-c1.ts scripts/__tests__/migrate-c1.test.ts
git commit -m "feat(c1/schema): social_activity + user_blocks + user_mutes + friend_invites"
```

---

## Task 2: Pure helpers — areFriends, isBlocked, getMutualFriends

**Files:**
- Create: `lib/social/are-friends.ts`
- Create: `lib/social/is-blocked.ts`
- Create: `lib/social/get-mutual-friends.ts`
- Test: `lib/social/__tests__/are-friends.test.ts`
- Test: `lib/social/__tests__/is-blocked.test.ts`
- Test: `lib/social/__tests__/get-mutual-friends.test.ts`

- [ ] **Step 1: Write failing `areFriends` test**

Create `lib/social/__tests__/are-friends.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: { query: { friendships: { findFirst: vi.fn() } } },
}));

import { db } from '@/db';
import { areFriends } from '../are-friends';

describe('areFriends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false for self', async () => {
    expect(await areFriends('u1', 'u1')).toBe(false);
  });

  it('returns true when ACCEPTED row exists requester→recipient', async () => {
    (db.query.friendships.findFirst as any).mockResolvedValue({ id: 'f1' });
    expect(await areFriends('u1', 'u2')).toBe(true);
  });

  it('returns true when ACCEPTED row exists recipient→requester (reverse direction)', async () => {
    (db.query.friendships.findFirst as any).mockResolvedValue({ id: 'f1' });
    expect(await areFriends('u2', 'u1')).toBe(true);
  });

  it('returns false when no row found', async () => {
    (db.query.friendships.findFirst as any).mockResolvedValue(undefined);
    expect(await areFriends('u1', 'u2')).toBe(false);
  });
});
```

Run: `npx vitest run lib/social/__tests__/are-friends.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement `areFriends`**

Create `lib/social/are-friends.ts`:

```ts
import { cache } from 'react';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { friendships } from '@/db/schema/social';

export const areFriends = cache(async (userIdA: string, userIdB: string): Promise<boolean> => {
  if (userIdA === userIdB) return false;
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        and(eq(friendships.requesterId, userIdA), eq(friendships.recipientId, userIdB)),
        and(eq(friendships.requesterId, userIdB), eq(friendships.recipientId, userIdA)),
      ),
    ),
    columns: { id: true },
  });
  return !!row;
});
```

- [ ] **Step 3: Run `areFriends` tests**

Run: `npx vitest run lib/social/__tests__/are-friends.test.ts`
Expected: PASS (4/4).

- [ ] **Step 4: Write failing `isBlocked` test**

Create `lib/social/__tests__/is-blocked.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: { query: { userBlocks: { findFirst: vi.fn() } } },
}));

import { db } from '@/db';
import { isBlocked } from '../is-blocked';

describe('isBlocked', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false for self', async () => {
    expect(await isBlocked('u1', 'u1')).toBe(false);
  });

  it('returns true when viewer blocked target', async () => {
    (db.query.userBlocks.findFirst as any).mockResolvedValue({ blockerId: 'u1' });
    expect(await isBlocked('u1', 'u2')).toBe(true);
  });

  it('returns true when target blocked viewer (reverse)', async () => {
    (db.query.userBlocks.findFirst as any).mockResolvedValue({ blockerId: 'u2' });
    expect(await isBlocked('u1', 'u2')).toBe(true);
  });

  it('returns false when no block in either direction', async () => {
    (db.query.userBlocks.findFirst as any).mockResolvedValue(undefined);
    expect(await isBlocked('u1', 'u2')).toBe(false);
  });
});
```

Run: `npx vitest run lib/social/__tests__/is-blocked.test.ts`
Expected: FAIL.

- [ ] **Step 5: Implement `isBlocked`**

Create `lib/social/is-blocked.ts`:

```ts
import { cache } from 'react';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { userBlocks } from '@/db/schema/social';

export const isBlocked = cache(async (viewerId: string, targetId: string): Promise<boolean> => {
  if (viewerId === targetId) return false;
  const row = await db.query.userBlocks.findFirst({
    where: or(
      and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, targetId)),
      and(eq(userBlocks.blockerId, targetId), eq(userBlocks.blockedId, viewerId)),
    ),
    columns: { blockerId: true },
  });
  return !!row;
});
```

Run tests: PASS expected.

- [ ] **Step 6: Write failing `getMutualFriends` test**

Create `lib/social/__tests__/get-mutual-friends.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}));

import { db } from '@/db';
import { getMutualFriends } from '../get-mutual-friends';

describe('getMutualFriends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty when neither user has friends', async () => {
    const mock = { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
    (db.select as any).mockReturnValue(mock);
    const result = await getMutualFriends('u1', 'u2', 10);
    expect(result.mutuals).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns mutuals limited and with total count separate', async () => {
    // see implementation for fixture shape
    const sampleMutuals = [
      { userId: 'a', username: 'alice', displayName: 'Alice', avatarUrl: null },
      { userId: 'b', username: 'bob', displayName: 'Bob', avatarUrl: null },
    ];
    const mock = { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(sampleMutuals) };
    (db.select as any).mockReturnValue(mock);
    const result = await getMutualFriends('u1', 'u2', 3);
    expect(result.mutuals).toHaveLength(2);
    expect(result.mutuals[0].username).toBe('alice');
  });
});
```

Run: FAIL.

- [ ] **Step 7: Implement `getMutualFriends`**

Create `lib/social/get-mutual-friends.ts`:

```ts
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { friendships, userProfiles } from '@/db/schema/social';

export type MutualFriend = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
    ),
    columns: { requesterId: true, recipientId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.recipientId : r.requesterId));
}

export async function getMutualFriends(
  viewerId: string,
  otherUserId: string,
  limit = 9,
): Promise<{ mutuals: MutualFriend[]; total: number }> {
  if (viewerId === otherUserId) return { mutuals: [], total: 0 };
  const [viewerFriends, otherFriends] = await Promise.all([
    getAcceptedFriendIds(viewerId),
    getAcceptedFriendIds(otherUserId),
  ]);
  const otherSet = new Set(otherFriends);
  const intersect = viewerFriends.filter((id) => otherSet.has(id));
  if (intersect.length === 0) return { mutuals: [], total: 0 };

  const rows = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, intersect))
    .limit(limit);

  return { mutuals: rows, total: intersect.length };
}
```

Run tests: PASS expected (2/2).

- [ ] **Step 8: Commit**

```bash
git add lib/social/are-friends.ts lib/social/is-blocked.ts lib/social/get-mutual-friends.ts lib/social/__tests__/
git commit -m "feat(c1/social): areFriends + isBlocked + getMutualFriends helpers"
```

---

## Task 3: `recordSocialActivityTx` + dedupe

**Files:**
- Create: `lib/social/types.ts`
- Create: `lib/social/record-activity.ts`
- Test: `lib/social/__tests__/record-activity.test.ts`

- [ ] **Step 1: Write the types module**

Create `lib/social/types.ts`:

```ts
import type { SocialActivityType } from '@/db/schema/social';

export type { SocialActivityType };

export type SubjectType = 'book' | 'chapter' | 'spark_entry' | 'hive' | 'comment';

/** Event types subject to per-(actor,subject) dedupe within `DEDUPE_WINDOW_MS` */
export const DEDUPE_ELIGIBLE: ReadonlySet<SocialActivityType> = new Set([
  'book_liked',
]);

export const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

export type RecordActivityOpts = {
  actorId: string;
  type: SocialActivityType;
  subjectType: SubjectType;
  subjectId: string;
  payload?: Record<string, unknown>;
};
```

- [ ] **Step 2: Write failing test**

Create `lib/social/__tests__/record-activity.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockFindFirst = vi.fn();
const fakeTx = {
  query: { socialActivity: { findFirst: mockFindFirst } },
  insert: vi.fn(() => ({ values: mockInsert })),
};

vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'fake-id' }));

import { recordSocialActivityTx } from '../record-activity';

describe('recordSocialActivityTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue([{ id: 'fake-id' }]);
    mockFindFirst.mockResolvedValue(undefined);
  });

  it('writes a non-dedupe-eligible event without dedupe check', async () => {
    await recordSocialActivityTx(fakeTx as any, {
      actorId: 'u1', type: 'book_published', subjectType: 'book', subjectId: 'b1',
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(fakeTx.insert).toHaveBeenCalled();
  });

  it('writes a dedupe-eligible event when no recent row exists', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await recordSocialActivityTx(fakeTx as any, {
      actorId: 'u1', type: 'book_liked', subjectType: 'book', subjectId: 'b1',
    });
    expect(mockFindFirst).toHaveBeenCalled();
    expect(fakeTx.insert).toHaveBeenCalled();
  });

  it('skips dedupe-eligible event when a recent row exists within window', async () => {
    mockFindFirst.mockResolvedValue({ id: 'prev' });
    await recordSocialActivityTx(fakeTx as any, {
      actorId: 'u1', type: 'book_liked', subjectType: 'book', subjectId: 'b1',
    });
    expect(fakeTx.insert).not.toHaveBeenCalled();
  });
});
```

Run: FAIL.

- [ ] **Step 3: Implement `recordSocialActivityTx`**

Create `lib/social/record-activity.ts`:

```ts
import { createId } from '@paralleldrive/cuid2';
import { and, eq, gte } from 'drizzle-orm';
import type { db as Db } from '@/db';
import { socialActivity } from '@/db/schema/social';
import { DEDUPE_ELIGIBLE, DEDUPE_WINDOW_MS, type RecordActivityOpts } from './types';

type DrizzleTx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export async function recordSocialActivityTx(
  tx: DrizzleTx,
  opts: RecordActivityOpts,
): Promise<void> {
  if (DEDUPE_ELIGIBLE.has(opts.type)) {
    const windowStart = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const existing = await tx.query.socialActivity.findFirst({
      where: and(
        eq(socialActivity.actorId, opts.actorId),
        eq(socialActivity.type, opts.type),
        eq(socialActivity.subjectId, opts.subjectId),
        gte(socialActivity.createdAt, windowStart),
      ),
      columns: { id: true },
    });
    if (existing) return;
  }

  await tx.insert(socialActivity).values({
    id: createId(),
    actorId: opts.actorId,
    type: opts.type,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    payload: opts.payload ?? null,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/social/__tests__/record-activity.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/social/types.ts lib/social/record-activity.ts lib/social/__tests__/record-activity.test.ts
git commit -m "feat(c1/social): recordSocialActivityTx + dedupe map"
```

---

## Task 4: Extend `canReadBook` (FRIENDS gate + block masquerade)

**Files:**
- Modify: `lib/books/can-read.ts`
- Test: `lib/books/__tests__/can-read.test.ts` (expand existing)

- [ ] **Step 1: Read the existing `lib/books/can-read.ts` to understand current shape**

Run: `Read lib/books/can-read.ts` — confirm current signature `canReadBook({ book, viewerUserId }) → 'OK' | 'PRIVATE' | 'FRIENDS_ONLY' | 'NOT_FOUND'`.

- [ ] **Step 2: Add failing test cases**

In `lib/books/__tests__/can-read.test.ts`, append:

```ts
import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';

vi.mock('@/lib/social/are-friends', () => ({ areFriends: vi.fn() }));
vi.mock('@/lib/social/is-blocked', () => ({ isBlocked: vi.fn() }));

describe('canReadBook — C1 extensions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns OK on FRIENDS book when viewer is friend of author', async () => {
    (areFriends as any).mockResolvedValue(true);
    (isBlocked as any).mockResolvedValue(false);
    const book = { id: 'b1', userId: 'author', visibility: 'FRIENDS' } as any;
    expect(await canReadBook({ book, viewerUserId: 'viewer' })).toBe('OK');
  });

  it('returns FRIENDS_ONLY on FRIENDS book when viewer is not friend', async () => {
    (areFriends as any).mockResolvedValue(false);
    (isBlocked as any).mockResolvedValue(false);
    const book = { id: 'b1', userId: 'author', visibility: 'FRIENDS' } as any;
    expect(await canReadBook({ book, viewerUserId: 'viewer' })).toBe('FRIENDS_ONLY');
  });

  it('returns NOT_FOUND when blocked in either direction (masquerade)', async () => {
    (isBlocked as any).mockResolvedValue(true);
    const book = { id: 'b1', userId: 'author', visibility: 'PUBLIC' } as any;
    expect(await canReadBook({ book, viewerUserId: 'viewer' })).toBe('NOT_FOUND');
  });
});
```

Run: FAIL — mocks not wired.

- [ ] **Step 3: Modify `lib/books/can-read.ts`**

Replace the existing FRIENDS handling branch. The full file:

```ts
import { areFriends } from '@/lib/social/are-friends';
import { isBlocked } from '@/lib/social/is-blocked';

export type CanReadResult = 'OK' | 'PRIVATE' | 'FRIENDS_ONLY' | 'NOT_FOUND';

export async function canReadBook(opts: {
  book: { id: string; userId: string; visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE' } | null;
  viewerUserId: string | null;
}): Promise<CanReadResult> {
  if (!opts.book) return 'NOT_FOUND';

  // Author always reads.
  if (opts.viewerUserId && opts.viewerUserId === opts.book.userId) return 'OK';

  // Block masquerade — even PUBLIC books vanish if either side blocks.
  if (opts.viewerUserId && (await isBlocked(opts.viewerUserId, opts.book.userId))) {
    return 'NOT_FOUND';
  }

  if (opts.book.visibility === 'PUBLIC') return 'OK';
  if (opts.book.visibility === 'PRIVATE') return 'PRIVATE';

  // FRIENDS tier
  if (!opts.viewerUserId) return 'FRIENDS_ONLY';
  if (await areFriends(opts.viewerUserId, opts.book.userId)) return 'OK';
  return 'FRIENDS_ONLY';
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/books/__tests__/can-read.test.ts`
Expected: PASS — all prior + 3 new cases green.

- [ ] **Step 5: Full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: 438+ tests green, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/books/can-read.ts lib/books/__tests__/can-read.test.ts
git commit -m "feat(c1/can-read): FRIENDS gate via areFriends + block masquerade"
```

---

## Task 5: Friendship actions expansion (8 actions)

**Files:**
- Modify: `lib/actions/friendships.actions.ts`
- Create: `lib/validations/friendship.ts`
- Test: `lib/actions/__tests__/friendships-actions.test.ts`

- [ ] **Step 1: Validation schemas**

Create `lib/validations/friendship.ts`:

```ts
import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  recipientUsername: z.string().min(1).max(32),
});

export const friendshipIdSchema = z.object({
  requestId: z.string().min(1),
});

export const unfriendSchema = z.object({
  otherUserId: z.string().min(1),
});

export const searchUsersSchema = z.object({
  query: z.string().trim().min(1).max(64),
  limit: z.number().int().min(1).max(20).optional(),
});
```

- [ ] **Step 2: Surface-shape test**

Create `lib/actions/__tests__/friendships-actions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn(() => 'u1') }));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/social/is-blocked', () => ({ isBlocked: vi.fn(() => false) }));

import * as actions from '@/lib/actions/friendships.actions';

describe('friendships.actions surface', () => {
  it('exports sendFriendRequestAction (arity 1)', () => {
    expect(typeof actions.sendFriendRequestAction).toBe('function');
    expect(actions.sendFriendRequestAction.length).toBe(1);
  });
  it('exports acceptFriendRequestAction', () => { expect(typeof actions.acceptFriendRequestAction).toBe('function'); });
  it('exports rejectFriendRequestAction', () => { expect(typeof actions.rejectFriendRequestAction).toBe('function'); });
  it('exports cancelFriendRequestAction', () => { expect(typeof actions.cancelFriendRequestAction).toBe('function'); });
  it('exports unfriendAction', () => { expect(typeof actions.unfriendAction).toBe('function'); });
  it('exports getFriendsAction', () => { expect(typeof actions.getFriendsAction).toBe('function'); });
  it('exports getPendingRequestsAction', () => { expect(typeof actions.getPendingRequestsAction).toBe('function'); });
  it('exports getFriendCountAction', () => { expect(typeof actions.getFriendCountAction).toBe('function'); });
  it('exports searchUsersAction', () => { expect(typeof actions.searchUsersAction).toBe('function'); });
});
```

Run: FAIL — exports missing.

- [ ] **Step 3: Implement the 9 actions**

Rewrite `lib/actions/friendships.actions.ts` end-to-end. Key shape per action:

```ts
'use server';

import { createId } from '@paralleldrive/cuid2';
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { friendships, notifications, userProfiles } from '@/db/schema/social';
import { users } from '@/db/schema/auth';
import { requireAuth } from '@/lib/require-auth';
import { isBlocked } from '@/lib/social/is-blocked';
import {
  sendFriendRequestSchema, friendshipIdSchema, unfriendSchema, searchUsersSchema,
} from '@/lib/validations/friendship';
import type { ActionResult } from '@/lib/types/action-result';

export async function sendFriendRequestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth();
  const parsed = sendFriendRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };

  const recipientProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.username, parsed.data.recipientUsername),
    columns: { userId: true },
  });
  if (!recipientProfile) return { success: false, error: 'RECIPIENT_NOT_FOUND' };

  const recipientId = recipientProfile.userId;
  if (recipientId === userId) return { success: false, error: 'SELF_FRIEND' };
  if (await isBlocked(userId, recipientId)) return { success: false, error: 'BLOCKED' };

  const existing = await db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, userId), eq(friendships.recipientId, recipientId)),
      and(eq(friendships.requesterId, recipientId), eq(friendships.recipientId, userId)),
    ),
    columns: { id: true, status: true },
  });
  if (existing) {
    return { success: false, error: existing.status === 'ACCEPTED' ? 'ALREADY_FRIENDS' : 'REQUEST_ALREADY_PENDING' };
  }

  const id = createId();
  await db.transaction(async (tx) => {
    await tx.insert(friendships).values({
      id, requesterId: userId, recipientId, status: 'PENDING',
    });
    await tx.insert(notifications).values({
      id: createId(),
      userId: recipientId,
      type: 'FRIEND_REQUEST',
      payload: { requesterId: userId },
    });
  });
  return { success: true, data: { id } };
}

export async function acceptFriendRequestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth();
  const parsed = friendshipIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };

  const row = await db.query.friendships.findFirst({
    where: and(eq(friendships.id, parsed.data.requestId), eq(friendships.recipientId, userId), eq(friendships.status, 'PENDING')),
  });
  if (!row) return { success: false, error: 'REQUEST_NOT_FOUND' };

  await db.transaction(async (tx) => {
    await tx.update(friendships)
      .set({ status: 'ACCEPTED', acceptedAt: new Date() })
      .where(eq(friendships.id, row.id));
    await tx.insert(notifications).values({
      id: createId(),
      userId: row.requesterId,
      type: 'FRIEND_ACCEPTED',
      payload: { accepterId: userId },
    });
  });
  return { success: true, data: { id: row.id } };
}

export async function rejectFriendRequestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth();
  const parsed = friendshipIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  const result = await db.delete(friendships)
    .where(and(eq(friendships.id, parsed.data.requestId), eq(friendships.recipientId, userId), eq(friendships.status, 'PENDING')))
    .returning({ id: friendships.id });
  if (result.length === 0) return { success: false, error: 'REQUEST_NOT_FOUND' };
  return { success: true, data: { id: result[0].id } };
}

export async function cancelFriendRequestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth();
  const parsed = friendshipIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  const result = await db.delete(friendships)
    .where(and(eq(friendships.id, parsed.data.requestId), eq(friendships.requesterId, userId), eq(friendships.status, 'PENDING')))
    .returning({ id: friendships.id });
  if (result.length === 0) return { success: false, error: 'REQUEST_NOT_FOUND' };
  return { success: true, data: { id: result[0].id } };
}

export async function unfriendAction(input: unknown): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth();
  const parsed = unfriendSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  const result = await db.delete(friendships)
    .where(and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.recipientId, parsed.data.otherUserId)),
        and(eq(friendships.requesterId, parsed.data.otherUserId), eq(friendships.recipientId, userId)),
      ),
    ))
    .returning({ id: friendships.id });
  return { success: true, data: { removed: result.length > 0 } };
}

export async function getFriendsAction(targetUserId: string): Promise<ActionResult<Array<{ userId: string; username: string | null; displayName: string | null; avatarUrl: string | null; mutualCount: number; acceptedAt: Date | null }>>> {
  const viewerId = await requireAuth();
  // Fetch friendships of target where status=ACCEPTED.
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(eq(friendships.requesterId, targetUserId), eq(friendships.recipientId, targetUserId)),
    ),
    columns: { requesterId: true, recipientId: true, acceptedAt: true },
  });
  const friendIds = rows.map((r) => (r.requesterId === targetUserId ? r.recipientId : r.requesterId));
  if (friendIds.length === 0) return { success: true, data: [] };

  // Filter out blocked-relative-to-viewer
  // (omitted for brevity in plan — implement an IN-query to user_blocks)
  const profiles = await db.query.userProfiles.findMany({
    where: inArray(userProfiles.userId, friendIds),
    columns: { userId: true, username: true, displayName: true, avatarUrl: true },
  });
  const acceptedAtMap = new Map(rows.map((r) => [
    r.requesterId === targetUserId ? r.recipientId : r.requesterId,
    r.acceptedAt,
  ]));

  // Mutual count vs viewer — only when viewer !== target.
  // For each friend, count intersection of (their friend ids) ∩ (viewer friend ids).
  // For C1 implementation efficiency, compute mutuals in a follow-up batch using existing helper.

  const data = profiles.map((p) => ({
    userId: p.userId,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    mutualCount: 0, // TODO in same task: compute via getMutualFriends batch
    acceptedAt: acceptedAtMap.get(p.userId) ?? null,
  }));
  return { success: true, data };
}

export async function getPendingRequestsAction(): Promise<ActionResult<{ received: any[]; sent: any[] }>> {
  const userId = await requireAuth();
  const [received, sent] = await Promise.all([
    db.query.friendships.findMany({
      where: and(eq(friendships.status, 'PENDING'), eq(friendships.recipientId, userId)),
      columns: { id: true, requesterId: true, createdAt: true },
    }),
    db.query.friendships.findMany({
      where: and(eq(friendships.status, 'PENDING'), eq(friendships.requesterId, userId)),
      columns: { id: true, recipientId: true, createdAt: true },
    }),
  ]);
  // Join profiles for both
  const ids = Array.from(new Set([...received.map((r) => r.requesterId), ...sent.map((r) => r.recipientId)]));
  const profiles = await db.query.userProfiles.findMany({
    where: inArray(userProfiles.userId, ids),
    columns: { userId: true, username: true, displayName: true, avatarUrl: true },
  });
  const pmap = new Map(profiles.map((p) => [p.userId, p]));
  return {
    success: true,
    data: {
      received: received.map((r) => ({ id: r.id, createdAt: r.createdAt, profile: pmap.get(r.requesterId) ?? null })),
      sent: sent.map((r) => ({ id: r.id, createdAt: r.createdAt, profile: pmap.get(r.recipientId) ?? null })),
    },
  };
}

export async function getFriendCountAction(targetUserId: string): Promise<ActionResult<number>> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(and(
      eq(friendships.status, 'ACCEPTED'),
      or(eq(friendships.requesterId, targetUserId), eq(friendships.recipientId, targetUserId)),
    ));
  return { success: true, data: count };
}

export async function searchUsersAction(input: unknown): Promise<ActionResult<Array<{ userId: string; username: string | null; displayName: string | null; avatarUrl: string | null }>>> {
  const userId = await requireAuth();
  const parsed = searchUsersSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  const limit = parsed.data.limit ?? 10;
  const q = `%${parsed.data.query}%`;
  const rows = await db.query.userProfiles.findMany({
    where: or(ilike(userProfiles.username, q), ilike(userProfiles.displayName, q)),
    columns: { userId: true, username: true, displayName: true, avatarUrl: true },
    limit: limit + 1, // overscan to filter blocked + self
  });
  // Filter self + blocked-either-direction (block lookup IN-list query for efficiency)
  const filteredIds = rows.filter((r) => r.userId !== userId);
  // Block filter: query user_blocks for any pair involving viewer + any candidate
  // (implementation detail: see code in repo after T5 ships)
  return { success: true, data: filteredIds.slice(0, limit) };
}
```

**Note on mutualCount TODO inside `getFriendsAction`:** before committing the task, replace the `mutualCount: 0` placeholder with an actual batch lookup. Pattern: after collecting `friendIds`, fetch viewer's friend list once, then for each friend in the result, run `getMutualFriends(viewer, friendUserId)` (or batch via a single SQL aggregate). For C1, doing one `getMutualFriends` call per friend is acceptable for typical N≤200 friends. Optimize later if a profile takes >200ms to load.

- [ ] **Step 4: Run surface-shape tests**

Run: `npx vitest run lib/actions/__tests__/friendships-actions.test.ts`
Expected: PASS (9/9).

- [ ] **Step 5: Full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/friendships.actions.ts lib/validations/friendship.ts lib/actions/__tests__/friendships-actions.test.ts
git commit -m "feat(c1/friendships): 9 actions (send/accept/reject/cancel/unfriend/list/pending/count/search)"
```

---

## Task 6: Blocks + Mutes + Friend-Invites action files

**Files:**
- Create: `lib/actions/blocks.actions.ts`
- Create: `lib/actions/mutes.actions.ts`
- Create: `lib/actions/friend-invites.actions.ts`
- Create: `lib/validations/social.ts`
- Test: `lib/actions/__tests__/blocks-actions.test.ts`
- Test: `lib/actions/__tests__/mutes-actions.test.ts`
- Test: `lib/actions/__tests__/friend-invites-actions.test.ts`

- [ ] **Step 1: Validations**

Create `lib/validations/social.ts`:

```ts
import { z } from 'zod';
export const userTargetSchema = z.object({ targetUserId: z.string().min(1) });
export const claimInviteSchema = z.object({ token: z.string().min(16).max(64) });
```

- [ ] **Step 2: Blocks actions**

Create `lib/actions/blocks.actions.ts`:

```ts
'use server';

import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { userBlocks, friendships, follows, notifications } from '@/db/schema/social';
import { requireAuth } from '@/lib/require-auth';
import { userTargetSchema } from '@/lib/validations/social';
import type { ActionResult } from '@/lib/types/action-result';

export async function blockUserAction(input: unknown): Promise<ActionResult<{ blocked: boolean }>> {
  const userId = await requireAuth();
  const parsed = userTargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  if (parsed.data.targetUserId === userId) return { success: false, error: 'SELF_BLOCK' };

  await db.transaction(async (tx) => {
    await tx.insert(userBlocks)
      .values({ blockerId: userId, blockedId: parsed.data.targetUserId })
      .onConflictDoNothing();
    // Delete friendship in either direction
    await tx.delete(friendships).where(or(
      and(eq(friendships.requesterId, userId), eq(friendships.recipientId, parsed.data.targetUserId)),
      and(eq(friendships.requesterId, parsed.data.targetUserId), eq(friendships.recipientId, userId)),
    ));
    // Delete follows in either direction
    await tx.delete(follows).where(or(
      and(eq(follows.followerId, userId), eq(follows.followeeId, parsed.data.targetUserId)),
      and(eq(follows.followerId, parsed.data.targetUserId), eq(follows.followeeId, userId)),
    ));
    // Delete any pending notifications between the two
    // (omitted from snippet — implement via .where on both userId + payload.targetUserId match if payload search is feasible; otherwise leave existing notifications alone since they don't reveal sensitive info)
  });
  return { success: true, data: { blocked: true } };
}

export async function unblockUserAction(input: unknown): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth();
  const parsed = userTargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  const result = await db.delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, parsed.data.targetUserId)))
    .returning({ blockerId: userBlocks.blockerId });
  return { success: true, data: { removed: result.length > 0 } };
}

export async function getBlockedUsersAction(): Promise<ActionResult<string[]>> {
  const userId = await requireAuth();
  const rows = await db.query.userBlocks.findMany({
    where: eq(userBlocks.blockerId, userId),
    columns: { blockedId: true },
  });
  return { success: true, data: rows.map((r) => r.blockedId) };
}
```

- [ ] **Step 3: Mutes actions**

Create `lib/actions/mutes.actions.ts`:

```ts
'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMutes } from '@/db/schema/social';
import { requireAuth } from '@/lib/require-auth';
import { userTargetSchema } from '@/lib/validations/social';
import type { ActionResult } from '@/lib/types/action-result';

export async function muteUserAction(input: unknown): Promise<ActionResult<{ muted: boolean }>> {
  const userId = await requireAuth();
  const parsed = userTargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  if (parsed.data.targetUserId === userId) return { success: false, error: 'SELF_MUTE' };
  await db.insert(userMutes)
    .values({ muterId: userId, mutedId: parsed.data.targetUserId })
    .onConflictDoNothing();
  return { success: true, data: { muted: true } };
}

export async function unmuteUserAction(input: unknown): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth();
  const parsed = userTargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };
  const result = await db.delete(userMutes)
    .where(and(eq(userMutes.muterId, userId), eq(userMutes.mutedId, parsed.data.targetUserId)))
    .returning({ muterId: userMutes.muterId });
  return { success: true, data: { removed: result.length > 0 } };
}

export async function getMutedUsersAction(): Promise<ActionResult<string[]>> {
  const userId = await requireAuth();
  const rows = await db.query.userMutes.findMany({
    where: eq(userMutes.muterId, userId),
    columns: { mutedId: true },
  });
  return { success: true, data: rows.map((r) => r.mutedId) };
}
```

- [ ] **Step 4: Friend invites actions**

Create `lib/actions/friend-invites.actions.ts`:

```ts
'use server';

import { randomBytes } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { friendInvites, friendships, notifications, userProfiles } from '@/db/schema/social';
import { requireAuth } from '@/lib/require-auth';
import { isBlocked } from '@/lib/social/is-blocked';
import { claimInviteSchema } from '@/lib/validations/social';
import type { ActionResult } from '@/lib/types/action-result';

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function createFriendInviteAction(): Promise<ActionResult<{ token: string; expiresAt: Date }>> {
  const userId = await requireAuth();
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await db.insert(friendInvites).values({ token, inviterId: userId, expiresAt });
  return { success: true, data: { token, expiresAt } };
}

export async function claimFriendInviteAction(input: unknown): Promise<ActionResult<{ inviterUsername: string | null; alreadyFriends: boolean }>> {
  const userId = await requireAuth();
  const parsed = claimInviteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' };

  const invite = await db.query.friendInvites.findFirst({
    where: eq(friendInvites.token, parsed.data.token),
  });
  if (!invite) return { success: false, error: 'TOKEN_NOT_FOUND' };
  if (invite.claimedAt) return { success: false, error: 'TOKEN_ALREADY_CLAIMED' };
  if (invite.expiresAt < new Date()) return { success: false, error: 'TOKEN_EXPIRED' };
  if (invite.inviterId === userId) return { success: false, error: 'SELF_INVITE' };
  if (await isBlocked(userId, invite.inviterId)) return { success: false, error: 'BLOCKED' };

  const existing = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, 'ACCEPTED'),
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.recipientId, invite.inviterId)),
        and(eq(friendships.requesterId, invite.inviterId), eq(friendships.recipientId, userId)),
      ),
    ),
  });

  const inviterProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, invite.inviterId),
    columns: { username: true },
  });

  await db.transaction(async (tx) => {
    await tx.update(friendInvites).set({ claimedBy: userId, claimedAt: new Date() }).where(eq(friendInvites.token, invite.token));
    if (!existing) {
      await tx.insert(friendships).values({
        id: createId(),
        requesterId: invite.inviterId,
        recipientId: userId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      });
      await tx.insert(notifications).values({
        id: createId(),
        userId: invite.inviterId,
        type: 'FRIEND_ACCEPTED',
        payload: { accepterId: userId },
      });
    }
  });

  return { success: true, data: { inviterUsername: inviterProfile?.username ?? null, alreadyFriends: !!existing } };
}
```

- [ ] **Step 5: Surface-shape tests for all 3 files**

Create `lib/actions/__tests__/blocks-actions.test.ts`, `mutes-actions.test.ts`, `friend-invites-actions.test.ts` mirroring the T5 shape — assert `typeof X === 'function'` and arity for each export. (Body identical pattern; omitted here.)

- [ ] **Step 6: Run + tsc + commit**

```bash
npx vitest run lib/actions/__tests__/{blocks,mutes,friend-invites}-actions.test.ts
npx tsc --noEmit
git add lib/actions/blocks.actions.ts lib/actions/mutes.actions.ts lib/actions/friend-invites.actions.ts lib/validations/social.ts lib/actions/__tests__/{blocks,mutes,friend-invites}-actions.test.ts
git commit -m "feat(c1/social): blocks + mutes + friend-invites action files"
```

---

## Task 7: Rewrite `getCommunityFeedAction` + subject hydration

**Files:**
- Modify: `lib/actions/community.actions.ts`
- Test: `lib/actions/__tests__/community-actions.test.ts`

- [ ] **Step 1: Surface-shape test**

Create `lib/actions/__tests__/community-actions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn(() => 'u1') }));
vi.mock('@/db', () => ({ db: {} }));

import * as actions from '@/lib/actions/community.actions';

describe('community.actions surface', () => {
  it('exports getCommunityFeedAction', () => {
    expect(typeof actions.getCommunityFeedAction).toBe('function');
  });
  it('exports getSuggestedWritersAction', () => {
    expect(typeof actions.getSuggestedWritersAction).toBe('function');
  });
});
```

Run: FAIL initially if exports are missing/renamed.

- [ ] **Step 2: Rewrite `getCommunityFeedAction`**

In `lib/actions/community.actions.ts`, replace existing implementation:

```ts
'use server';

import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { socialActivity, friendships, follows, userBlocks, userMutes, userProfiles } from '@/db/schema/social';
import { books, binderItems } from '@/db/schema/books';
import { hives } from '@/db/schema/hive';
import { requireAuth } from '@/lib/require-auth';
import type { ActionResult } from '@/lib/types/action-result';
import type { SocialActivityType } from '@/db/schema/social';

export type FeedRow = {
  id: string;
  type: SocialActivityType;
  createdAt: Date;
  actor: { userId: string; username: string | null; displayName: string | null; avatarUrl: string | null };
  subject: {
    type: 'book' | 'chapter' | 'spark_entry' | 'hive' | 'comment';
    id: string;
    title?: string | null;
    coverUrl?: string | null;
    bookId?: string | null;
  };
  payload: Record<string, unknown> | null;
  isFriend: boolean;
};

export async function getCommunityFeedAction(input?: { cursor?: string; limit?: number }): Promise<ActionResult<{ rows: FeedRow[]; nextCursor: string | null }>> {
  const userId = await requireAuth();
  const limit = Math.min(input?.limit ?? 20, 50);

  // 1. Resolve viewer's friend ids + follow ids.
  const [friendRows, followRows, blockedRows, mutedRows] = await Promise.all([
    db.query.friendships.findMany({
      where: and(eq(friendships.status, 'ACCEPTED'), or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId))),
      columns: { requesterId: true, recipientId: true },
    }),
    db.query.follows.findMany({
      where: eq(follows.followerId, userId),
      columns: { followeeId: true },
    }),
    db.query.userBlocks.findMany({
      where: or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)),
      columns: { blockerId: true, blockedId: true },
    }),
    db.query.userMutes.findMany({
      where: eq(userMutes.muterId, userId),
      columns: { mutedId: true },
    }),
  ]);

  const friendIds = new Set(friendRows.map((r) => r.requesterId === userId ? r.recipientId : r.requesterId));
  const followIds = new Set(followRows.map((r) => r.followeeId));
  const sources = new Set([...friendIds, ...followIds]);
  if (sources.size === 0) return { success: true, data: { rows: [], nextCursor: null } };

  const blockedIds = new Set<string>();
  for (const r of blockedRows) {
    blockedIds.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  }
  const mutedIds = new Set(mutedRows.map((r) => r.mutedId));
  const exclude = new Set([...blockedIds, ...mutedIds]);

  const actorIds = Array.from(sources).filter((id) => !exclude.has(id));
  if (actorIds.length === 0) return { success: true, data: { rows: [], nextCursor: null } };

  // 2. Decode cursor.
  let cursorDate: Date | null = null;
  let cursorId: string | null = null;
  if (input?.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
      cursorDate = new Date(decoded.createdAt);
      cursorId = decoded.id;
    } catch {
      return { success: false, error: 'INVALID_CURSOR' };
    }
  }

  // 3. Feed query.
  const events = await db.query.socialActivity.findMany({
    where: and(
      inArray(socialActivity.actorId, actorIds),
      cursorDate
        ? or(
            lt(socialActivity.createdAt, cursorDate),
            and(eq(socialActivity.createdAt, cursorDate), lt(socialActivity.id, cursorId!)),
          )
        : undefined,
    ),
    orderBy: [desc(socialActivity.createdAt), desc(socialActivity.id)],
    limit: limit + 1,
  });

  const hasMore = events.length > limit;
  const pageEvents = hasMore ? events.slice(0, limit) : events;

  // 4. Hydrate actor profiles.
  const actorIdSet = Array.from(new Set(pageEvents.map((e) => e.actorId)));
  const actorProfiles = await db.query.userProfiles.findMany({
    where: inArray(userProfiles.userId, actorIdSet),
    columns: { userId: true, username: true, displayName: true, avatarUrl: true },
  });
  const actorMap = new Map(actorProfiles.map((p) => [p.userId, p]));

  // 5. Hydrate subjects by subjectType (grouped).
  const bookIds = pageEvents.filter((e) => e.subjectType === 'book').map((e) => e.subjectId);
  const chapterBinderItemIds = pageEvents.filter((e) => e.subjectType === 'chapter').map((e) => e.subjectId);
  const hiveIds = pageEvents.filter((e) => e.subjectType === 'hive').map((e) => e.subjectId);

  const [bookRows, chapterRows, hiveRows] = await Promise.all([
    bookIds.length ? db.query.books.findMany({ where: inArray(books.id, bookIds), columns: { id: true, title: true, coverUrl: true } }) : Promise.resolve([]),
    chapterBinderItemIds.length ? db.query.binderItems.findMany({ where: inArray(binderItems.id, chapterBinderItemIds), columns: { id: true, title: true, bookId: true } }) : Promise.resolve([]),
    hiveIds.length ? db.query.hives.findMany({ where: inArray(hives.id, hiveIds), columns: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const bookMap = new Map(bookRows.map((b) => [b.id, b]));
  const chapterMap = new Map(chapterRows.map((c) => [c.id, c]));
  const hiveMap = new Map(hiveRows.map((h) => [h.id, h]));

  // 6. Compose rows.
  const rows: FeedRow[] = pageEvents.map((e) => {
    const actor = actorMap.get(e.actorId) ?? { userId: e.actorId, username: null, displayName: null, avatarUrl: null };
    let subjectTitle: string | null | undefined;
    let subjectCover: string | null | undefined;
    let subjectBookId: string | null | undefined;
    if (e.subjectType === 'book') {
      const b = bookMap.get(e.subjectId);
      subjectTitle = b?.title;
      subjectCover = b?.coverUrl;
    } else if (e.subjectType === 'chapter') {
      const c = chapterMap.get(e.subjectId);
      subjectTitle = c?.title;
      subjectBookId = c?.bookId;
    } else if (e.subjectType === 'hive') {
      const h = hiveMap.get(e.subjectId);
      subjectTitle = h?.name;
    }
    return {
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      actor,
      subject: {
        type: e.subjectType as any,
        id: e.subjectId,
        title: subjectTitle ?? null,
        coverUrl: subjectCover ?? null,
        bookId: subjectBookId ?? null,
      },
      payload: e.payload as Record<string, unknown> | null,
      isFriend: friendIds.has(e.actorId),
    };
  });

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = pageEvents[pageEvents.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }), 'utf8').toString('base64url');
  }

  return { success: true, data: { rows, nextCursor } };
}

// getSuggestedWritersAction: keep existing logic but ensure block-filter is applied.
// (See existing implementation — extend with `getBlockedUsersAction` IN-list filter.)
export { getSuggestedWritersAction } from './_legacy-community';
```

(For `getSuggestedWritersAction`: preserve current implementation, optionally split into a `_legacy` file or keep in place — the export shape stays.)

- [ ] **Step 3: Drop dead community actions**

If `getMyHivesAction` still has a definition in this file from before H1, delete it (already folded into `getUserHivesView` per H1). Search for it: `grep getMyHivesAction lib/actions/community.actions.ts`.

- [ ] **Step 4: Run tests + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add lib/actions/community.actions.ts lib/actions/__tests__/community-actions.test.ts
git commit -m "feat(c1/feed): getCommunityFeedAction on social_activity event store"
```

---

## Task 8: Wire `recordSocialActivityTx` hooks into 7 source actions

**Files (modify each, add tx-internal call):**
- `lib/actions/book.actions.ts` (publishBookAction)
- `lib/actions/chapter.actions.ts` (saveChapterAction — only on REVISED/FINAL transition)
- `lib/actions/discover.actions.ts` (toggleBookLikeAction, addCommentAction)
- `lib/actions/sparks.actions.ts` (submitSparkEntryAction + winner-resolution paths)
- `lib/actions/hive.actions.ts` (createHiveAction)
- `lib/actions/hive-invites.actions.ts` or wherever `acceptHiveInviteAction` lives (`hive.actions.ts` per H1)

For each: import `recordSocialActivityTx`, find the existing `db.transaction(...)` block, insert the activity call alongside the source-row write. Pseudocode for `publishBookAction`:

```ts
await db.transaction(async (tx) => {
  // ... existing update logic ...
  await tx.update(books).set({ status: 'PUBLISHED' }).where(eq(books.id, bookId));
  if (book.visibility === 'PUBLIC' && book.discoverable) {
    await recordSocialActivityTx(tx, {
      actorId: userId,
      type: 'book_published',
      subjectType: 'book',
      subjectId: bookId,
      payload: { title: book.title, coverUrl: book.coverUrl },
    });
  }
});
```

- [ ] **Step 1: publishBookAction hook**

Read `lib/actions/book.actions.ts`, locate `publishBookAction`'s tx. Add the `recordSocialActivityTx` call gated by `book.visibility === 'PUBLIC' && book.discoverable === true`. Type `book_published`, subjectType `'book'`, subjectId `bookId`, payload `{ title }`.

- [ ] **Step 2: saveChapterAction hook**

Read `lib/actions/chapter.actions.ts`, locate `saveChapterAction`. The hook fires only when the chapter status transitions INTO `'REVISED'` or `'FINAL'` from a different prior status. Capture `priorStatus` before the update and compare:

```ts
const prior = await tx.query.chapters.findFirst({ where: eq(chapters.id, chapterId), columns: { status: true } });
// ... update ...
if (prior && prior.status !== 'REVISED' && (newStatus === 'REVISED' || newStatus === 'FINAL')) {
  const book = await tx.query.books.findFirst({ where: eq(books.id, bookId), columns: { visibility: true, discoverable: true, userId: true } });
  if (book && book.visibility === 'PUBLIC' && book.discoverable) {
    await recordSocialActivityTx(tx, {
      actorId: userId,
      type: 'chapter_posted',
      subjectType: 'chapter',
      subjectId: binderItemId,
      payload: { bookId, status: newStatus },
    });
  }
}
```

- [ ] **Step 3: toggleBookLikeAction hook**

Read `lib/actions/discover.actions.ts`, locate `toggleBookLikeAction`. Only fire on LIKE (insert), NOT on UNLIKE (delete). Gate on book PUBLIC+discoverable. Type `book_liked`, subjectType `'book'`. (Dedupe is automatic in `recordSocialActivityTx`.)

- [ ] **Step 4: addCommentAction hook**

Same file (`discover.actions.ts`). Inside the comment-insert tx, after the insert, write activity if the commented book is PUBLIC+discoverable. Type `book_commented`, subjectType `'comment'`, subjectId = comment id, payload `{ bookId, excerpt }`.

- [ ] **Step 5: submitSparkEntryAction + winner paths**

Read `lib/actions/sparks.actions.ts`. Locate `submitSparkEntryAction` — fire `spark_entry_submitted` if parent spark privacy is PUBLIC. Locate winner-resolution paths (community vote + creator's choice) — fire `spark_won_community` / `spark_won_creator_choice` with subjectType `'spark_entry'`.

- [ ] **Step 6: createHiveAction + acceptHiveInviteAction hooks**

`createHiveAction` (in `lib/actions/hive.actions.ts`): fire `hive_created` if the hive is PUBLIC+discoverable. `acceptHiveInviteAction` (same file or `hive-invites.actions.ts`): fire `hive_joined` if the joined hive is PUBLIC+discoverable.

- [ ] **Step 7: Run full suite + tsc**

```bash
npm test && npx tsc --noEmit
```

Expected: all 438+ green, tsc clean. (Spec compliance for the new behavior is verified via smoke; the hooks add tx writes only.)

- [ ] **Step 8: Commit**

```bash
git add lib/actions/book.actions.ts lib/actions/chapter.actions.ts lib/actions/discover.actions.ts lib/actions/sparks.actions.ts lib/actions/hive.actions.ts
git commit -m "feat(c1/hooks): recordSocialActivityTx hooks in 7 source actions"
```

---

## Task 9: `/community` page rewrite

**Files:**
- Modify: `app/[locale]/(app)/community/page.tsx`
- Create: `app/[locale]/(app)/community/_components/section-rail.tsx`
- Create: `app/[locale]/(app)/community/_components/activity-feed.tsx` (rewrite of existing)
- Create: `app/[locale]/(app)/community/_components/activity-event-row.tsx` (rewrite of existing)
- Create: `app/[locale]/(app)/community/_components/requests-card.tsx`

- [ ] **Step 1: Server page composes 4-fetch shape**

`page.tsx` parallel-fetches: `getCommunityFeedAction({ limit: 20 })`, `getPendingRequestsAction()` (use received-only count), `getMyActiveSparksAction()`, section-rail counts (friends count via `getFriendCountAction(viewerId)`, hives count via `getUserHivesView`, sparks count from active sparks).

```tsx
const [feed, requests, sparks, friendsCount, hives] = await Promise.all([
  getCommunityFeedAction({ limit: 20 }),
  getPendingRequestsAction(),
  getMyActiveSparksAction(),
  getFriendCountAction(viewerId),
  getUserHivesView(viewerId),
]);
```

- [ ] **Step 2: `<SectionRail>` component (presentational)**

Create `_components/section-rail.tsx` (client OK; pure presentational). 5 tiles in a horizontal row: Friends · Hives · Sparks · Lists · Clubs. Each tile: lucide icon + label + small count badge. Click routes via `<Link>`. Lists + Clubs link to `/reading-lists` and `/clubs` which return Coming-Soon stub pages (Task 9 also writes those stubs — see step 4).

- [ ] **Step 3: `<ActivityEventRow>` per-event-type rendering**

Create `_components/activity-event-row.tsx` (client). Verb map covers all 9 `social_activity_type` values. Each row: actor avatar (Link to `/u/[actor.username]`) + verb sentence + subject card.

Verb sentences:
- `book_published` → "@x published *Title*"
- `chapter_posted` → "@x posted a new chapter *Title*"
- `book_liked` → "@x liked *Title*"
- `book_commented` → "@x commented on *Title*"
- `spark_entry_submitted` → "@x entered the Spark *Title*"
- `spark_won_community` → "@x won the community vote for Spark *Title*"
- `spark_won_creator_choice` → "@x was picked as the creator's choice for Spark *Title*"
- `hive_created` → "@x started a new hive *Title*"
- `hive_joined` → "@x joined the hive *Title*"

`isFriend` adds a subtle brand-yellow left edge.

- [ ] **Step 4: `<ActivityFeed>` cursor pagination via `useTransition`**

Create `_components/activity-feed.tsx` (client). State: `rows`, `nextCursor`. "Load older" button calls `getCommunityFeedAction({ cursor: nextCursor })` and appends.

- [ ] **Step 5: `<RequestsCard>`**

Create `_components/requests-card.tsx`. Receives `count` + `sampleAvatars`. Renders nothing when count===0. Shows "N pending · Manage →" → `/friends?tab=requests`.

- [ ] **Step 6: Coming-Soon stubs**

Create `app/[locale]/(app)/reading-lists/page.tsx` and `app/[locale]/(app)/clubs/page.tsx` rendering the existing `<ComingSoon phase="C3" />` and `<ComingSoon phase="C4" />` pattern.

- [ ] **Step 7: Full suite + smoke + commit**

```bash
npm test && npx tsc --noEmit
git add app/[locale]/(app)/community/ app/[locale]/(app)/reading-lists/ app/[locale]/(app)/clubs/
git commit -m "feat(c1/community-page): hybrid hub IA with section rail + feed + sidebar"
```

---

## Task 10: `/friends` page rewrite

**Files:**
- Modify: `app/[locale]/(app)/friends/page.tsx`
- Create: `app/[locale]/(app)/friends/_components/friends-tab-strip.tsx`
- Create: `app/[locale]/(app)/friends/_components/friends-list-tab.tsx`
- Create: `app/[locale]/(app)/friends/_components/requests-tab.tsx`
- Create: `app/[locale]/(app)/friends/_components/sent-tab.tsx`
- Create: `app/[locale]/(app)/friends/_components/suggested-tab.tsx`
- Create: `app/[locale]/(app)/friends/_components/user-search.tsx`
- Create: `app/[locale]/(app)/friends/_components/invite-link-dialog.tsx`

- [ ] **Step 1: Tab strip + URL state**

Page reads `searchParams.tab`, defaults to `'friends'`. `<FriendsTabStrip>` is a client component rendering 4 tabs with `<Link>`-based routing (`?tab=requests` etc).

- [ ] **Step 2: Friends list tab**

Server component (or client + fetched on mount). Each row: avatar + display + @username + mutual count + ⋯ kebab via shadcn DropdownMenu. Mute / Block via `ConfirmDialog`; Unfriend via `ConfirmDialog`.

- [ ] **Step 3: Requests + Sent tabs**

`getPendingRequestsAction` returns `{ received, sent }`. Requests tab renders received; Sent renders sent. Accept/Reject + Cancel buttons inline.

- [ ] **Step 4: Suggested tab**

`getSuggestedWritersAction({ limit: 20 })` → grid of cards. Add Friend button (calls `sendFriendRequestAction({ recipientUsername })`). Optionally Follow button.

- [ ] **Step 5: User search popover**

`<UserSearch>` client component with debounced input (300ms). Calls `searchUsersAction({ query })`. Hits render as popover under the input with click → /u/[username].

- [ ] **Step 6: Invite-link dialog**

`<InviteLinkDialog>` client component. On open, calls `createFriendInviteAction()`. Displays the URL `${baseUrl}/${locale}/friend-invite/${token}` in a recessed input with Copy button (same chrome as `<ShareBookDialog>`). 14-day expiry shown.

- [ ] **Step 7: Test + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add app/[locale]/(app)/friends/
git commit -m "feat(c1/friends-page): 4-tab strip + search + invite-by-link Dialog"
```

---

## Task 11: Profile page friendship UI + block-aware fetch

**Files:**
- Modify: `app/[locale]/(public)/u/[username]/page.tsx`
- Create: `app/[locale]/(public)/u/[username]/_components/friend-status-section.tsx`
- Create: `app/[locale]/(public)/u/[username]/_components/profile-unavailable.tsx`

- [ ] **Step 1: Block-aware fetch**

In `page.tsx`, after resolving target user from username + before rendering: `if (await isBlocked(viewerId, target.userId)) return <ProfileUnavailable />;` (block masquerade — never reveal block existence).

- [ ] **Step 2: Friend status derivation**

Server-side: resolve current friendship status between viewer and target.

```ts
const friendship = await db.query.friendships.findFirst({
  where: or(
    and(eq(friendships.requesterId, viewerId), eq(friendships.recipientId, target.userId)),
    and(eq(friendships.requesterId, target.userId), eq(friendships.recipientId, viewerId)),
  ),
});
const status: FriendStatus = friendship
  ? (friendship.status === 'ACCEPTED' ? 'friends'
    : friendship.requesterId === viewerId ? 'request_sent' : 'request_received')
  : 'none';
```

- [ ] **Step 3: `<FriendStatusSection>`**

Client component. Props: `{ status, friendshipId, targetUserId, targetUsername }`. Renders:
- Status pill (Friends / Request sent / Request received / no pill)
- Primary CTA: Add Friend / Cancel / Accept (+ Reject secondary) / ⋯ kebab when friends
- Mutual-friends row (calls `getMutualFriends(viewer, target)` server-side, passes as prop)
- ⋯ kebab: View on /friends, Mute, Block (each → ConfirmDialog)

- [ ] **Step 4: Stats row gain**

Existing stats row extended: add `friendsCount` next to followers/following. Server-fetch `getFriendCountAction(target.userId)`.

- [ ] **Step 5: `<ProfileUnavailable>`**

Simple centered card on `bg-[#262728]`: lucide UserX icon + "This profile is unavailable" + Discover CTA. Mirrors `<AccessDenied>` chrome.

- [ ] **Step 6: Test + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add app/[locale]/(public)/u/[username]/
git commit -m "feat(c1/profile): friendship UI + block-aware masquerade fetch"
```

---

## Task 12: Nav user-avatar dropdown

**Files:**
- Modify: existing AppNav user-avatar render site (locate via grep for `session.user.image` in `components/nav/` or `app/[locale]/(app)/layout.tsx`)
- Create: `components/nav/user-menu-dropdown.tsx`

- [ ] **Step 1: Create `<UserMenuDropdown>`**

Client component using shadcn `<DropdownMenu>`:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="…avatar styles…">
      <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem asChild>
      <Link href={`/${locale}/u/${username}`}>View profile</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href={`/${locale}/friends`}>Friends</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href={`/${locale}/settings`}>Settings</Link>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => signOut(...)}>Sign out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Props: `{ username: string | null, avatarUrl: string | null, locale: string }`.

- [ ] **Step 2: Wire into AppNav**

Replace the current bare-avatar render with `<UserMenuDropdown>`. AppNav stays a server component; the dropdown is mounted as a client child.

- [ ] **Step 3: Tsc + smoke + commit**

```bash
npm test && npx tsc --noEmit
git add components/nav/user-menu-dropdown.tsx <AppNav file>
git commit -m "feat(c1/nav): user-avatar DropdownMenu with View profile + Friends + Settings + Sign out"
```

---

## Task 13: `/friend-invite/[token]` route

**Files:**
- Create: `app/[locale]/(public)/friend-invite/[token]/page.tsx`
- Create: `app/[locale]/(public)/friend-invite/[token]/_components/invite-result.tsx`

- [ ] **Step 1: Server page**

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { claimFriendInviteAction } from '@/lib/actions/friend-invites.actions';

export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/${locale}/sign-up?next=${encodeURIComponent(`/${locale}/friend-invite/${token}`)}`);
  }
  const result = await claimFriendInviteAction({ token });
  if (!result.success) {
    return <InviteResult error={result.error} locale={locale} />;
  }
  const { inviterUsername, alreadyFriends } = result.data;
  if (inviterUsername) {
    redirect(`/${locale}/u/${inviterUsername}?invite_claimed=1`);
  }
  return <InviteResult success={alreadyFriends ? 'already_friends' : 'accepted'} locale={locale} />;
}
```

- [ ] **Step 2: `<InviteResult>` error branches**

Renders centered card with error-specific copy:
- TOKEN_NOT_FOUND → "This invite link doesn't exist"
- TOKEN_EXPIRED → "This invite link expired"
- TOKEN_ALREADY_CLAIMED → "This invite link has already been used"
- SELF_INVITE → "You can't claim your own invite"
- BLOCKED → "This invite can't be accepted right now"

All with a "Back to Discover" CTA.

- [ ] **Step 3: Toast on successful redirect**

In the inviter profile page, read `searchParams.invite_claimed`, fire `toast.success("You and @${inviterUsername} are now friends.")` client-side via a small `<InviteToast>` client mount that calls `sonner` then `router.replace` to strip the param.

- [ ] **Step 4: Sign-up `?next=` path validation**

Verify the existing `safeNextPath` helper accepts `/friend-invite/[token]` paths. If it rejects them, extend it. (Per SP-A, the helper allows same-origin paths.)

- [ ] **Step 5: Test + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add app/[locale]/(public)/friend-invite/
git commit -m "feat(c1/invite-route): /friend-invite/[token] sign-up redirect + claim flow"
```

---

## Task 14: Notifications enum extension + bell-list rendering

**Files:**
- Modify: existing notifications bell-list component (locate via grep `NEW_FOLLOWER`)
- Modify: `db/schema/social.ts` (notification_type enum — done in T1 migration; verify schema mirrors)

- [ ] **Step 1: Sync drizzle enum to DB**

If `db/schema/social.ts` declares `notificationTypeEnum` as a `pgEnum`, add `'FRIEND_REQUEST'` and `'FRIEND_ACCEPTED'` to the array literal. (The DB already has them from T1 migration step 6/7; the drizzle declaration just needs to match for type inference.)

- [ ] **Step 2: Extend bell-list message map**

Find the existing notification copy map (likely in `lib/notifications/copy.ts` or inline in the bell component). Add:

```ts
FRIEND_REQUEST: (payload) => `@${payload.requesterUsername} sent you a friend request`,
FRIEND_ACCEPTED: (payload) => `@${payload.accepterUsername} accepted your friend request`,
```

Payloads from T5: `{ requesterId }` and `{ accepterId }` — need to extend to include username. **Fix:** in `sendFriendRequestAction` + `acceptFriendRequestAction` + `claimFriendInviteAction`, write payload as `{ requesterId, requesterUsername }` / `{ accepterId, accepterUsername }`. Lookup the username before the tx insert.

- [ ] **Step 3: Test + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add db/schema/social.ts <bell-list file> lib/actions/friendships.actions.ts lib/actions/friend-invites.actions.ts
git commit -m "feat(c1/notifications): FRIEND_REQUEST + FRIEND_ACCEPTED types + bell copy"
```

---

## Task 15: Hive FRIENDS visibility filter on Discover

**Files:**
- Modify: `lib/actions/discover.actions.ts` (or wherever `getDiscoverableHivesAction` lives — H1 may have moved it)

- [ ] **Step 1: Read existing `getDiscoverableHivesAction`**

Locate it; it currently filters `visibility='PUBLIC' AND discoverable=true`.

- [ ] **Step 2: Extend with FRIENDS branch**

If a hive is FRIENDS+discoverable, surface it ONLY to viewers who are friends of the hive owner. Implementation: keep PUBLIC+discoverable hives unconditional; UNION with FRIENDS+discoverable hives where `areFriends(viewer, owner) = true`. Or simpler: fetch all (PUBLIC OR FRIENDS) + discoverable, then post-filter the FRIENDS ones in JS using a `Set` of viewer's friend ids.

```ts
const viewerFriendIds = ...; // from existing query
const candidates = await db.query.hives.findMany({
  where: and(
    eq(hives.discoverable, true),
    or(eq(hives.visibility, 'PUBLIC'), eq(hives.visibility, 'FRIENDS')),
  ),
  // ... existing joins ...
});
const filtered = candidates.filter((h) => h.visibility === 'PUBLIC' || viewerFriendIds.has(h.ownerId));
```

- [ ] **Step 3: Test + tsc + commit**

```bash
npm test && npx tsc --noEmit
git add lib/actions/discover.actions.ts
git commit -m "feat(c1/discover): hive FRIENDS visibility surfaces to friends only"
```

---

## Task 16: Manual smoke + AGENTS.md update + ship

- [ ] **Step 1: Run full test suite + tsc one final time**

```bash
npm test && npx tsc --noEmit
```

Expected: 438+ tests green, tsc clean.

- [ ] **Step 2: Run smoke checklist**

Walk all 23 scenarios from spec §13. File any `fix(c1): ...` follow-up commits as bugs surface.

- [ ] **Step 3: Update AGENTS.md "Resume Here" block**

Replace "Current focus" with shipping summary (mirroring H1–H4 + reader-redesign precedents). Include:
- Task SHA list
- Patterns now load-bearing (`areFriends` + `isBlocked` are the canonical privacy helpers; new social tables = no parallel implementations; `recordSocialActivityTx` is the canonical feed-write path)
- Known follow-ups
- Carry-forward smoke targets (the 23 from spec §13)

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): record C1 Community Foundation ship"
```

- [ ] **Step 5: Tell Chris**

"C1 Foundation is code-complete and ready for smoke. Walk the 23-scenario checklist; file `fix(c1): ...` commits for any bugs found. After smoke passes, decide C2 priority (Sparks refresh — smallest delta) or jump to C3/C4."

---

## Self-Review

**Spec coverage:** Walked the spec end-to-end against tasks:
- §2.1 4 new tables → T1 ✓
- §2.2 1 new enum → T1 ✓
- §2.3 enum extensions → T1 + T14 ✓
- §2.4 migration → T1 ✓
- §3 helpers → T2 + T3 ✓
- §4 server actions → T5 + T6 + T7 ✓
- §4.6 7 event hooks → T8 ✓
- §5 privacy gates → T4 + T11 (profile fetch) + T15 (hive Discover) ✓
- §6.1 /community page → T9 ✓
- §6.2 /friends page → T10 ✓
- §6.3 profile page → T11 ✓
- §6.4 nav dropdown → T12 ✓
- §6.5 invite route → T13 ✓
- §7 notifications → T14 ✓
- §11 test posture → distributed across tasks ✓

**Placeholder scan:** No "TBD" / "implement later" / "add appropriate handling" in shipped task steps. The one `mutualCount: 0` placeholder inside T5 step 3 has an explicit follow-up note ("replace before committing the task") — that's a deferred-inside-task fix, not a plan failure.

**Type consistency:**
- `SocialActivityType` exported from `db/schema/social.ts` (T1) → used in `lib/social/types.ts` (T3) → consumed by `recordSocialActivityTx` opts (T3) and `community.actions.ts`'s `FeedRow.type` (T7). Names match.
- `DrizzleTx` type used in T3 imports `db` type — same pattern H4 uses.
- `MutualFriend` type in T2 has fields `userId / username / displayName / avatarUrl` matching profile rows used in T7 + T11.
- Function called `recordSocialActivityTx` in T3 → same name in T8 hooks.

No drift detected. Plan locked.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-c1-community-foundation.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task + two-stage review (implementer → reviewer per task), per-task commit checkpoints. Matches the H1–H4 + reader-redesign cadence.

2. **Inline Execution** — execute tasks in the current session via executing-plans, batched with checkpoints.

For C1 specifically, subagent-driven is strongly recommended — 16 tasks is too many for inline without context drift, and the test suite + tsc gate per task is the safety net.

Pick one when ready to start. Chris's existing preference (per AGENTS.md feedback memories) is subagent-driven with per-task checkpoints; default to that unless he overrides.
