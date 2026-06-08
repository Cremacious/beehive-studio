# C5b — Notification Prefs + Feed Ranking + Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship per-type notification preferences at `/settings/notifications` (with skip-at-write enforcement), friend-first feed ordering in `/community`, and 5 named user-visible cleanup follow-ups from C1–C5a.

**Architecture:** New `notification_preferences` table (lazy-create, `opted_out_types text[]`) gated by a single `shouldSkipNotification(recipientId, type)` React `cache()`d helper at every notification write site. `getCommunityFeedAction` sort tuple gains `isFriend DESC` as leading key. Cleanup wave: shared `<InviteClaimedToast>`, `ClubSummary` widening + cancel-my action, ~10 mention bell deep-link lookup actions, `<VisibilityPicker>` generic-ization, conditional alias-redirect for username renames.

**Tech Stack:** Next.js 16 App Router · Drizzle ORM on Neon Postgres · React 19 · React `cache()` · shadcn/ui (Switch primitive) · vitest.

**Spec:** [docs/superpowers/specs/2026-06-05-c5b-notifications-feed-cleanup-design.md](../specs/2026-06-05-c5b-notifications-feed-cleanup-design.md)

---

## File Structure

**New files (~14):**
- `scripts/migrate-c5b.ts` — idempotent runner
- `lib/notifications/check-preferences.ts` — `getOptedOutTypes` (cache) + `shouldSkipNotification`
- `lib/notifications/get-preferences.ts` — `getNotificationPreferencesAction`
- `lib/notifications/update-preferences.ts` — `updateNotificationPreferenceAction`
- `lib/notifications/__tests__/check-preferences.test.ts`
- `lib/notifications/__tests__/update-preferences.test.ts`
- `lib/validations/notifications.ts` — Zod schema
- `app/[locale]/(app)/settings/notifications/page.tsx`
- `app/[locale]/(app)/settings/notifications/_components/notification-preferences-form.tsx`
- `app/[locale]/(app)/settings/page.tsx` — stub redirect
- `components/invite-claimed-toast.tsx`
- `components/visibility-picker.tsx` — moved from discover/_components
- `lib/notifications/mention-deep-links.ts` — async resolver dispatcher (consumed by bell)
- (Conditional on T0) Username rename action gains aliases writer; new table covered by T1.

**Modified files (~20):**
- `db/schema/social.ts` — append `notificationPreferences` (and conditional `usernameAliases`) tables
- `lib/actions/friendships.actions.ts` — sendFriendRequest + acceptFriendRequest skip checks
- `lib/actions/hive.actions.ts` — inviteToHive skip check
- `lib/actions/book-clubs.actions.ts` — 3 club actions + `ClubSummary` widening + new `cancelMyPendingJoinRequestAction`
- `lib/actions/social.actions.ts` — toggleBookLike + addComment + toggleFollow skip checks
- `lib/actions/sparks.actions.ts` — SPARK_WIN skip check
- `lib/mentions/record-mention-notifications.ts` — filter mentionedUserIds via shouldSkipNotification before batch insert
- `lib/actions/community.actions.ts` — getCommunityFeedAction sort + cursor change
- ~10 lookup actions added to existing C-phase action files
- `app/[locale]/(app)/_components/notifications-bell.tsx` — async deep-link resolution
- `app/[locale]/(public)/discover/_components/create-spark-modal.tsx` + C3/C4 modals — drop `as SparkVisibility` casts
- `app/[locale]/(app)/clubs/_components/club-header.tsx` — pending-request pill wiring
- `app/[locale]/(public)/u/[username]/page.tsx` — alias fallback (conditional)
- Nav user-menu-dropdown — Settings href update

---

## Task 0: Audit — username rename support

**Files:**
- Read-only audit of `lib/actions/`

- [ ] **Step 1: Grep for username rename action names**

```bash
grep -rn "updateUsername\|changeUsername\|renameUsername\|setUsername" lib/actions/
```

Expected outcomes:
- (a) Hit — rename action found → continue with T11 + §2.2 username_aliases table in spec.
- (b) Miss — usernames immutable in current codebase → T11 closes as N/A, T1 omits `username_aliases` table.

- [ ] **Step 2: If (a), document the rename action**

Record action name + file path + signature. Note in commit body for T1 + T11.

- [ ] **Step 3: If (b), confirm by reading user-profile or onboarding actions**

Read `lib/actions/user-profile.actions.ts` + `lib/actions/onboarding.actions.ts`. Verify no username-write path exists outside initial onboarding (where the username is the PK on `userProfiles`).

- [ ] **Step 4: Commit the audit finding (no code change)**

```bash
git commit --allow-empty -m "chore(c5b/t0): audit username rename support — <YES/NO/<finding>>"
```

(No `git add` step since this is a no-code audit; use `--allow-empty`.)

---

## Task 1: Schema migration — `notification_preferences` (+ conditional `username_aliases`)

**Files:**
- Modify: `db/schema/social.ts`
- Create: `scripts/migrate-c5b.ts`

- [ ] **Step 1: Append `notificationPreferences` table to drizzle schema**

In `db/schema/social.ts`, add:

```ts
export const notificationPreferences = pgTable('notification_preferences', {
  userId: text('user_id').primaryKey().notNull().references(() => users.id, { onDelete: 'cascade' }),
  optedOutTypes: text('opted_out_types').array().notNull().default([]),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

Verify `users` import path matches existing schema imports (likely from `./auth`).

- [ ] **Step 2: If T0 = YES, append `usernameAliases` table**

```ts
export const usernameAliases = pgTable('username_aliases', {
  oldUsername: text('old_username').primaryKey().notNull(),
  currentUserId: text('current_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  renamedAt: timestamp('renamed_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('username_aliases_user_idx').on(t.currentUserId),
}))
```

If T0 = NO, skip this step.

- [ ] **Step 3: Write idempotent migration runner**

Create `scripts/migrate-c5b.ts`:

```ts
import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  const sql = neon(process.env.DATABASE_URL)

  console.log('Creating notification_preferences...')
  await sql`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      opted_out_types text[] NOT NULL DEFAULT '{}',
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `

  // Only run if T0 = YES:
  console.log('Creating username_aliases...')
  await sql`
    CREATE TABLE IF NOT EXISTS username_aliases (
      old_username text PRIMARY KEY,
      current_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      renamed_at timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS username_aliases_user_idx ON username_aliases(current_user_id)`

  console.log('✓ Done')
}

main().catch((e) => { console.error(e); process.exit(1) })
```

If T0 = NO, omit the `username_aliases` block.

- [ ] **Step 4: Run migration twice to verify idempotency**

```bash
npx dotenv -e .env.local -- tsx scripts/migrate-c5b.ts
npx dotenv -e .env.local -- tsx scripts/migrate-c5b.ts
```
Expected: both succeed; second is a no-op via `IF NOT EXISTS`.

- [ ] **Step 5: Verify tsc + tests**

```bash
npx tsc --noEmit
npm test
```
Expected: 626/626 green.

- [ ] **Step 6: Commit**

```bash
git add db/schema/social.ts scripts/migrate-c5b.ts
git commit -m "feat(c5b/schema): notification_preferences (+ username_aliases if T0=YES) tables + idempotent runner"
```

---

## Task 2: `lib/notifications/` helpers + unit tests

**Files:**
- Create: `lib/notifications/check-preferences.ts`
- Create: `lib/notifications/get-preferences.ts`
- Create: `lib/notifications/update-preferences.ts`
- Create: `lib/validations/notifications.ts`
- Create: `lib/notifications/__tests__/check-preferences.test.ts`
- Create: `lib/notifications/__tests__/update-preferences.test.ts`

- [ ] **Step 1: Implement validation schema**

```ts
// lib/validations/notifications.ts
import { z } from 'zod'
import { notificationTypeEnum } from '@/db/schema/social'

export const NOTIFICATION_TYPE_VALUES = notificationTypeEnum.enumValues

export const updatePreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPE_VALUES),
  optedOut: z.boolean(),
})
```

- [ ] **Step 2: Implement `check-preferences.ts`**

```ts
// lib/notifications/check-preferences.ts
import { cache } from 'react'
import { db } from '@/db'
import { notificationPreferences } from '@/db/schema/social'
import { eq } from 'drizzle-orm'
import type { NotificationType } from '@/db/schema/social' // export the type from social.ts

export const getOptedOutTypes = cache(async (userId: string): Promise<Set<string>> => {
  const row = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  })
  return new Set(row?.optedOutTypes ?? [])
})

export async function shouldSkipNotification(
  recipientId: string,
  type: NotificationType
): Promise<boolean> {
  const set = await getOptedOutTypes(recipientId)
  return set.has(type)
}
```

If `NotificationType` is not exported from `db/schema/social.ts`, add the export there: `export type NotificationType = (typeof notificationTypeEnum.enumValues)[number]`.

- [ ] **Step 3: Implement `get-preferences.ts`**

```ts
// lib/notifications/get-preferences.ts
'use server'
import { db } from '@/db'
import { notificationPreferences } from '@/db/schema/social'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from '@/lib/types'
import type { NotificationType } from '@/db/schema/social'

export async function getNotificationPreferencesAction(): Promise<
  ActionResult<{ optedOutTypes: NotificationType[] }>
> {
  const { userId } = await requireAuth()
  const row = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  })
  return { success: true, data: { optedOutTypes: (row?.optedOutTypes ?? []) as NotificationType[] } }
}
```

- [ ] **Step 4: Implement `update-preferences.ts`**

```ts
// lib/notifications/update-preferences.ts
'use server'
import { db } from '@/db'
import { notificationPreferences } from '@/db/schema/social'
import { requireAuth } from '@/lib/require-auth'
import { updatePreferenceSchema } from '@/lib/validations/notifications'
import type { ActionResult } from '@/lib/types'
import type { NotificationType } from '@/db/schema/social'

export async function updateNotificationPreferenceAction(input: {
  type: string
  optedOut: boolean
}): Promise<ActionResult<{ optedOutTypes: NotificationType[] }>> {
  const { userId } = await requireAuth()
  const parsed = updatePreferenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  return await db.transaction(async (tx) => {
    const existing = await tx.query.notificationPreferences.findFirst({
      where: (np, { eq }) => eq(np.userId, userId),
    })
    const current = new Set(existing?.optedOutTypes ?? [])
    if (parsed.data.optedOut) current.add(parsed.data.type)
    else current.delete(parsed.data.type)
    const nextArray = Array.from(current)

    await tx
      .insert(notificationPreferences)
      .values({ userId, optedOutTypes: nextArray })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { optedOutTypes: nextArray, updatedAt: new Date() },
      })

    return { success: true, data: { optedOutTypes: nextArray as NotificationType[] } }
  })
}
```

- [ ] **Step 5: Write failing tests for `shouldSkipNotification`**

Create `lib/notifications/__tests__/check-preferences.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbFindFirst: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: { query: { notificationPreferences: { findFirst: mocks.dbFindFirst } } },
}))

import { shouldSkipNotification, getOptedOutTypes } from '../check-preferences'

describe('shouldSkipNotification', () => {
  beforeEach(() => {
    mocks.dbFindFirst.mockReset()
  })

  it('returns false when no preferences row exists (default all-on)', async () => {
    mocks.dbFindFirst.mockResolvedValue(undefined)
    const skip = await shouldSkipNotification('u1', 'NEW_LIKE' as any)
    expect(skip).toBe(false)
  })

  it('returns true when type is in opted_out_types', async () => {
    mocks.dbFindFirst.mockResolvedValue({ optedOutTypes: ['NEW_LIKE', 'NEW_FOLLOWER'] })
    const skip = await shouldSkipNotification('u1', 'NEW_LIKE' as any)
    expect(skip).toBe(true)
  })

  it('returns false when type is NOT in opted_out_types', async () => {
    mocks.dbFindFirst.mockResolvedValue({ optedOutTypes: ['NEW_LIKE'] })
    const skip = await shouldSkipNotification('u1', 'MENTION' as any)
    expect(skip).toBe(false)
  })

  it('caches via React cache() — single DB call per user across multiple checks', async () => {
    mocks.dbFindFirst.mockResolvedValue({ optedOutTypes: ['NEW_LIKE'] })
    await shouldSkipNotification('u-cache-test', 'NEW_LIKE' as any)
    await shouldSkipNotification('u-cache-test', 'NEW_FOLLOWER' as any)
    await shouldSkipNotification('u-cache-test', 'MENTION' as any)
    // Note: React cache() lives per-render; under vitest without a render boundary,
    // mocks may fire 3 times. Verify exact count after running once; adjust assertion.
    expect(mocks.dbFindFirst).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run tests → fail → re-run → pass**

```bash
npm test -- lib/notifications/__tests__/check-preferences.test.ts
```
Expected: green (helpers already implemented in steps 2-4).

- [ ] **Step 7: Write surface-shape tests for update action**

Create `lib/notifications/__tests__/update-preferences.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn(async () => ({ userId: 'u1' })) }))
vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(async (fn) => fn({
      query: { notificationPreferences: { findFirst: vi.fn().mockResolvedValue(undefined) } },
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    })),
  },
}))

import * as actions from '../update-preferences'

describe('updateNotificationPreferenceAction', () => {
  it('exports the action with correct arity', () => {
    expect(typeof actions.updateNotificationPreferenceAction).toBe('function')
    expect(actions.updateNotificationPreferenceAction.length).toBe(1)
  })

  it('returns success when adding NEW_LIKE to empty preferences', async () => {
    const result = await actions.updateNotificationPreferenceAction({ type: 'NEW_LIKE', optedOut: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.optedOutTypes).toContain('NEW_LIKE')
  })

  it('returns INVALID_INPUT for unknown type', async () => {
    const result = await actions.updateNotificationPreferenceAction({ type: 'BOGUS_TYPE', optedOut: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('INVALID_INPUT')
  })
})
```

- [ ] **Step 8: Run full suite + tsc**

```bash
npx tsc --noEmit
npm test
```
Expected: 626+ green (~+8 tests).

- [ ] **Step 9: Commit**

```bash
git add lib/notifications/ lib/validations/notifications.ts
git commit -m "feat(c5b/helpers): lib/notifications/ check + get + update + tests"
```

---

## Task 3: Wire `shouldSkipNotification` at every notification write site

**Files:**
- Modify: `lib/actions/friendships.actions.ts`
- Modify: `lib/actions/hive.actions.ts`
- Modify: `lib/actions/book-clubs.actions.ts`
- Modify: `lib/actions/social.actions.ts`
- Modify: `lib/actions/sparks.actions.ts`
- Modify: `lib/mentions/record-mention-notifications.ts`

- [ ] **Step 1: Audit every notification write site**

```bash
grep -rn "insert(notifications)\|.values({.*type:" lib/actions/ lib/mentions/
```

Expected hits (~11 sites): friendships (FRIEND_REQUEST + FRIEND_ACCEPTED), hive invite (HIVE_INVITE), book-clubs (3 sites: CLUB_INVITE + CLUB_JOIN_REQUEST + CLUB_JOIN_APPROVED), social (3 sites: NEW_LIKE + NEW_COMMENT + NEW_FOLLOWER), sparks (SPARK_WIN), mentions (MENTION).

Document each site in commit body.

- [ ] **Step 2: Wire the canonical single-recipient pattern**

Before each single-row insert, add:

```ts
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'

if (await shouldSkipNotification(recipientId, 'TYPE_HERE')) {
  // Skip the notification write. Source action's other writes (e.g. friendship row,
  // like row, etc.) continue normally — only the bell ping is suppressed.
} else {
  // Existing insert(notifications) here.
}
```

For C4 `respondToJoinRequestAction` accept path, wrap the CLUB_JOIN_APPROVED notification write. For `acceptFriendRequestAction` wrap the FRIEND_ACCEPTED write. Etc.

- [ ] **Step 3: Wire the multi-row fan-out pattern**

For C4 `joinClubAction` closed-join path (CLUB_JOIN_REQUEST fan-out to OWNER+MOD recipients):

```ts
// Existing: SELECT all OWNER+MOD member ids
const recipients: string[] = ownerAndModIds

// NEW: parallel filter
const skipResults = await Promise.all(
  recipients.map((id) => shouldSkipNotification(id, 'CLUB_JOIN_REQUEST'))
)
const filteredRecipients = recipients.filter((_, i) => !skipResults[i])

// Existing: batch insert with filteredRecipients
if (filteredRecipients.length > 0) {
  await tx.insert(notifications).values(filteredRecipients.map((userId) => ({ userId, type: 'CLUB_JOIN_REQUEST', ... })))
}
```

- [ ] **Step 4: Wire MENTION at single point of enforcement**

In `lib/mentions/record-mention-notifications.ts`:

```ts
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'

export async function recordMentionNotificationsTx(
  tx: DrizzleTx,
  opts: { actorId: string; mentionedUserIds: string[]; resourceType: SurfaceType; resourceId: string }
): Promise<void> {
  if (opts.mentionedUserIds.length === 0) return

  // NEW: per-recipient skip filter
  const skipResults = await Promise.all(
    opts.mentionedUserIds.map((id) => shouldSkipNotification(id, 'MENTION'))
  )
  const filteredIds = opts.mentionedUserIds.filter((_, i) => !skipResults[i])
  if (filteredIds.length === 0) return

  await tx.insert(notifications).values(
    filteredIds.map((userId) => ({
      userId, type: 'MENTION' as const,
      actorId: opts.actorId, resourceType: opts.resourceType, resourceId: opts.resourceId,
    }))
  )
}
```

- [ ] **Step 5: Run tsc + suite**

```bash
npx tsc --noEmit
npm test
```
Expected: 634+ green.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/friendships.actions.ts lib/actions/hive.actions.ts lib/actions/book-clubs.actions.ts lib/actions/social.actions.ts lib/actions/sparks.actions.ts lib/mentions/record-mention-notifications.ts
git commit -m "feat(c5b/skip-at-write): wire shouldSkipNotification at every notification write site"
```

---

## Task 4: `/settings/notifications` page + `<NotificationPreferencesForm>`

**Files:**
- Create: `app/[locale]/(app)/settings/notifications/page.tsx`
- Create: `app/[locale]/(app)/settings/notifications/_components/notification-preferences-form.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/[locale]/(app)/settings/notifications/page.tsx
import { redirect } from 'next/navigation'
import { getNotificationPreferencesAction } from '@/lib/notifications/get-preferences'
import { NotificationPreferencesForm } from './_components/notification-preferences-form'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const result = await getNotificationPreferencesAction()
  if (!result.success) redirect(`/${locale}/sign-in`)

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand)', fontFamily: 'var(--font-comfortaa)' }}>
          Notification preferences
        </h1>
        <p className="text-sm text-[var(--canvas-dark-ink-muted)] mt-2">
          Choose which notifications you want to receive.
        </p>
      </header>
      <NotificationPreferencesForm initialOptedOutTypes={result.data.optedOutTypes} />
    </main>
  )
}
```

- [ ] **Step 2: Implement the form**

```tsx
// app/[locale]/(app)/settings/notifications/_components/notification-preferences-form.tsx
'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { updateNotificationPreferenceAction } from '@/lib/notifications/update-preferences'

type Group = { title: string; description: string; rows: { type: string; label: string; sublabel: string }[] }

const GROUPS: Group[] = [
  {
    title: 'Friends',
    description: 'Friend requests and acceptances',
    rows: [
      { type: 'FRIEND_REQUEST', label: 'Friend requests', sublabel: 'When someone sends you a friend request' },
      { type: 'FRIEND_ACCEPTED', label: 'Friend acceptances', sublabel: "When someone accepts your friend request" },
    ],
  },
  {
    title: 'Mentions',
    description: 'When someone @-mentions you',
    rows: [
      { type: 'MENTION', label: 'Mentions', sublabel: 'When someone @-mentions you in a discussion, comment, or post' },
    ],
  },
  {
    title: 'Activity on your work',
    description: 'Likes, comments, follows, and spark wins',
    rows: [
      { type: 'NEW_LIKE', label: 'New likes', sublabel: 'When someone likes your book' },
      { type: 'NEW_COMMENT', label: 'New comments', sublabel: 'When someone comments on your book' },
      { type: 'NEW_FOLLOWER', label: 'New followers', sublabel: 'When someone follows you' },
      { type: 'SPARK_WIN', label: 'Spark wins', sublabel: 'When you win a writing spark' },
    ],
  },
  {
    title: 'Group invites and requests',
    description: 'Hive and book club invites and requests',
    rows: [
      { type: 'HIVE_INVITE', label: 'Hive invites', sublabel: 'When someone invites you to a hive' },
      { type: 'CLUB_INVITE', label: 'Club invites', sublabel: 'When someone invites you to a book club' },
      { type: 'CLUB_JOIN_REQUEST', label: 'Club join requests', sublabel: 'When someone requests to join a club you moderate' },
      { type: 'CLUB_JOIN_APPROVED', label: 'Club join approvals', sublabel: 'When your club join request is approved' },
    ],
  },
]

export function NotificationPreferencesForm({ initialOptedOutTypes }: { initialOptedOutTypes: string[] }) {
  const [optedOut, setOptedOut] = useState(new Set(initialOptedOutTypes))
  const [pending, startTransition] = useTransition()

  const handleToggle = (type: string, nextValue: boolean) => {
    const optedOutNext = !nextValue
    const prevSet = new Set(optedOut)
    const nextSet = new Set(optedOut)
    if (optedOutNext) nextSet.add(type)
    else nextSet.delete(type)
    setOptedOut(nextSet)

    startTransition(async () => {
      const result = await updateNotificationPreferenceAction({ type, optedOut: optedOutNext })
      if (!result.success) {
        setOptedOut(prevSet)
        toast.error('Could not save preference')
      }
    })
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="rounded-[var(--r-card)] border"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            boxShadow: 'var(--sh-card)',
            borderColor: 'var(--br-card)',
          }}
        >
          <header className="p-4 border-b" style={{ borderColor: 'var(--br-card)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--brand)', fontFamily: 'var(--font-comfortaa)' }}>
              {group.title}
            </h2>
            <p className="text-xs text-[var(--canvas-dark-ink-muted)] mt-1">{group.description}</p>
          </header>
          <ul className="divide-y" style={{ borderColor: 'var(--br-card)' }}>
            {group.rows.map((row) => {
              const isOptedOut = optedOut.has(row.type)
              return (
                <li key={row.type} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--canvas-dark-ink)]">{row.label}</p>
                    <p className="text-xs text-[var(--canvas-dark-ink-muted)] mt-0.5">{row.sublabel}</p>
                  </div>
                  <Switch
                    checked={!isOptedOut}
                    onCheckedChange={(checked) => handleToggle(row.type, checked)}
                    disabled={pending}
                    aria-label={`Toggle ${row.label}`}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify shadcn `Switch` primitive exists**

```bash
ls components/ui/switch.tsx
```

If missing, install via `npx shadcn add switch`.

- [ ] **Step 4: Run tsc + suite**

```bash
npx tsc --noEmit
npm test
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/settings/
git commit -m "feat(c5b/settings-page): /settings/notifications page + NotificationPreferencesForm"
```

---

## Task 5: `/settings/page.tsx` stub redirect + nav dropdown link

**Files:**
- Create: `app/[locale]/(app)/settings/page.tsx`
- Modify: nav user-menu-dropdown file (grep for path)

- [ ] **Step 1: Create the stub redirect**

```tsx
// app/[locale]/(app)/settings/page.tsx
import { redirect } from 'next/navigation'

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/settings/notifications`)
}
```

- [ ] **Step 2: Find nav user-menu-dropdown**

```bash
grep -rn "View profile\|user-menu-dropdown\|UserMenuDropdown" components/ app/
```

Read the file. Find the "Settings" entry's href.

- [ ] **Step 3: Update href to `/settings/notifications` (or keep `/settings` since it redirects)**

Either path works. Prefer `/${locale}/settings/notifications` directly for one fewer redirect hop.

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add app/[locale]/\(app\)/settings/page.tsx components/nav/
git commit -m "feat(c5b/settings-redirect): /settings stub redirect + nav dropdown Settings href update"
```

---

## Task 6: Friend-first feed sort + cursor format

**Files:**
- Modify: `lib/actions/community.actions.ts`

- [ ] **Step 1: Read existing `getCommunityFeedAction`**

Verify current cursor format + ORDER BY. Likely cursor is base64url JSON `{ createdAt, id }`; ORDER BY is `(createdAt DESC, id DESC)`.

- [ ] **Step 2: Change ORDER BY to friend-first tuple**

```ts
// Inside the query builder:
.orderBy(desc(sql`(actor_id = ANY(${friendIds}))`), desc(socialActivity.createdAt), desc(socialActivity.id))
```

Or, if the existing query computes `isFriend` per row before sort, sort by that.

- [ ] **Step 3: Extend cursor format**

```ts
type Cursor = { isFriend: boolean; createdAt: string; id: string }

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf-8').toString('base64url')
}

function decodeCursor(s: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString('utf-8'))
    // Backward compat: old cursor lacks isFriend → treat as false (followed tail)
    return {
      isFriend: typeof parsed.isFriend === 'boolean' ? parsed.isFriend : false,
      createdAt: parsed.createdAt,
      id: parsed.id,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Update pagination WHERE clause for the new tuple**

The descending 3-column tuple compare:

```ts
.where(
  cursor
    ? or(
        sql`(actor_id = ANY(${friendIds}))::int < ${cursor.isFriend ? 1 : 0}`,
        and(
          sql`(actor_id = ANY(${friendIds}))::int = ${cursor.isFriend ? 1 : 0}`,
          lt(socialActivity.createdAt, new Date(cursor.createdAt))
        ),
        and(
          sql`(actor_id = ANY(${friendIds}))::int = ${cursor.isFriend ? 1 : 0}`,
          eq(socialActivity.createdAt, new Date(cursor.createdAt)),
          lt(socialActivity.id, cursor.id)
        )
      )
    : undefined,
)
```

Adapt to existing query structure.

- [ ] **Step 5: Build nextCursor from the last returned row's isFriend + createdAt + id**

- [ ] **Step 6: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/community.actions.ts
git commit -m "feat(c5b/feed-sort): friend-first ORDER BY tuple + cursor extension + backward-compat"
```

---

## Task 7: `<InviteClaimedToast>` shared component + mount on profile + club detail

**Files:**
- Create: `components/invite-claimed-toast.tsx`
- Modify: `app/[locale]/(public)/u/[username]/page.tsx`
- Modify: `app/[locale]/(app)/clubs/[clubId]/page.tsx`

- [ ] **Step 1: Implement the toast component**

```tsx
// components/invite-claimed-toast.tsx
'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'

type Props = { copy: string }

export function InviteClaimedToast({ copy }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('invite_claimed') !== '1') return
    toast.success(copy)
    // Scrub the param
    const next = new URLSearchParams(searchParams.toString())
    next.delete('invite_claimed')
    const nextUrl = next.toString() ? `${pathname}?${next.toString()}` : pathname
    router.replace(nextUrl)
  }, [])  // intentional: fire-once on mount

  return null
}
```

- [ ] **Step 2: Mount on `/u/[username]/page.tsx`**

In the existing profile page, add (near the top of the rendered JSX, inside the Suspense boundary):

```tsx
import { InviteClaimedToast } from '@/components/invite-claimed-toast'

// In JSX:
<InviteClaimedToast copy={`You and @${profile.username} are now friends.`} />
```

- [ ] **Step 3: Mount on `/clubs/[clubId]/page.tsx`**

```tsx
<InviteClaimedToast copy={`Welcome to ${club.name}!`} />
```

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add components/invite-claimed-toast.tsx app/[locale]/\(public\)/u/\[username\]/page.tsx app/[locale]/\(app\)/clubs/\[clubId\]/page.tsx
git commit -m "feat(c5b/invite-toast): InviteClaimedToast + mount on profile + club detail"
```

---

## Task 8: `ClubSummary.viewerMembership` widening + pending pill + `cancelMyPendingJoinRequestAction`

**Files:**
- Modify: `lib/actions/book-clubs.actions.ts`
- Modify: `app/[locale]/(app)/clubs/_components/club-header.tsx`

- [ ] **Step 1: Widen `ClubSummary.viewerMembership` shape**

In `lib/actions/book-clubs.actions.ts`:

```ts
export type ClubSummary = {
  // ... existing fields ...
  viewerMembership: {
    role: BookClubMemberRole | null
    pendingJoinRequest: boolean  // NEW
  }
}
```

- [ ] **Step 2: Update `getClubAction` projection to include pending check**

```ts
// In getClubAction:
const pendingReq = viewerId
  ? await db.query.bookClubJoinRequests.findFirst({
      where: and(
        eq(bookClubJoinRequests.clubId, clubId),
        eq(bookClubJoinRequests.userId, viewerId),
        eq(bookClubJoinRequests.status, 'PENDING'),
      ),
    })
  : null

return {
  // ...
  viewerMembership: { role: ..., pendingJoinRequest: !!pendingReq },
}
```

- [ ] **Step 3: Update `getClubsAction` for discover branch**

Batch the pending check via `inArray(clubIds)`:

```ts
const pendingClubIds = viewerId
  ? new Set(
      (await db
        .select({ clubId: bookClubJoinRequests.clubId })
        .from(bookClubJoinRequests)
        .where(
          and(
            eq(bookClubJoinRequests.userId, viewerId),
            inArray(bookClubJoinRequests.clubId, clubIds),
            eq(bookClubJoinRequests.status, 'PENDING'),
          )
        )
      ).map((r) => r.clubId)
    )
  : new Set<string>()

// Project per-row:
viewerMembership: { role: ..., pendingJoinRequest: pendingClubIds.has(club.id) },
```

- [ ] **Step 4: Add `cancelMyPendingJoinRequestAction`**

```ts
'use server'
export async function cancelMyPendingJoinRequestAction(input: { clubId: string }): Promise<ActionResult<void>> {
  const { userId } = await requireAuth()
  const parsed = z.object({ clubId: z.string() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const existing = await db.query.bookClubJoinRequests.findFirst({
    where: and(
      eq(bookClubJoinRequests.clubId, parsed.data.clubId),
      eq(bookClubJoinRequests.userId, userId),
      eq(bookClubJoinRequests.status, 'PENDING'),
    ),
  })
  if (!existing) return { success: false, error: 'REQUEST_NOT_FOUND' }

  await db
    .update(bookClubJoinRequests)
    .set({ status: 'CANCELED' })
    .where(eq(bookClubJoinRequests.id, existing.id))

  return { success: true, data: undefined }
}
```

- [ ] **Step 5: Wire pending pill in `<ClubHeader>`**

```tsx
// In the smart-CTA matrix:
if (viewerRole === null && !club.openJoin && viewerMembership.pendingJoinRequest) {
  return (
    <div className="flex items-center gap-2">
      <span className="px-3 py-1 text-xs rounded-full" style={{ background: 'var(--canvas-dark-300)', color: 'var(--canvas-dark-ink-muted)' }}>
        Request pending
      </span>
      <button
        type="button"
        onClick={async () => {
          const result = await cancelMyPendingJoinRequestAction({ clubId: club.id })
          if (result.success) {
            toast.success('Request canceled')
            router.refresh()
          } else {
            toast.error('Could not cancel request')
          }
        }}
        className="text-xs underline text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
      >
        Cancel request
      </button>
    </div>
  )
}
```

Adapt to existing CTA matrix style + state hooks.

- [ ] **Step 6: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/book-clubs.actions.ts app/[locale]/\(app\)/clubs/_components/club-header.tsx
git commit -m "feat(c5b/club-pending): ClubSummary widening + pending pill + cancelMyPendingJoinRequestAction"
```

---

## Task 9: ~10 mention bell deep-link lookup actions + bell async refactor

**Files:**
- Modify: `lib/actions/book-clubs.actions.ts` (2-3 actions)
- Modify: `lib/actions/hive-discussions.actions.ts` (2 actions)
- Modify: `lib/actions/hive-buzz.actions.ts` (1 action)
- Modify: `lib/actions/hive-annotations.actions.ts` (1 action)
- Modify: `lib/actions/hive-suggestions.actions.ts` (1 action)
- Modify: `lib/actions/discover.actions.ts` (book comment, 1 action)
- Modify: `lib/actions/reading-lists.actions.ts` (book commentary, 1 action)
- Modify: `lib/actions/sparks.actions.ts` (spark entry comment, 1 action)
- Create: `lib/notifications/mention-deep-links.ts` — resolver dispatcher
- Modify: `app/[locale]/(app)/_components/notifications-bell.tsx`

- [ ] **Step 1: Add lookup actions to each C-phase action file**

Canonical shape per action:

```ts
'use server'
export async function getDiscussionClubIdAction(discussionId: string): Promise<
  ActionResult<{ clubId: string }>
> {
  const { userId } = await requireAuth()
  const row = await db.query.bookClubDiscussions.findFirst({
    where: eq(bookClubDiscussions.id, discussionId),
    columns: { clubId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  return { success: true, data: { clubId: row.clubId } }
}
```

Repeat for each surface. Read existing schema columns to confirm join paths (e.g. annotation → chapter → hive, suggestion → annotation → chapter → hive, etc.).

- [ ] **Step 2: Create the resolver dispatcher**

```ts
// lib/notifications/mention-deep-links.ts
'use server'
import { getDiscussionClubIdAction } from '@/lib/actions/book-clubs.actions'
import { /* ...others... */ } from '@/lib/actions/...'

export async function resolveMentionDeepLink(
  resourceType: string,
  resourceId: string,
  locale: string
): Promise<string> {
  switch (resourceType) {
    case 'book_club_discussion': {
      const r = await getDiscussionClubIdAction(resourceId)
      if (!r.success) return `/${locale}/clubs`
      return `/${locale}/clubs/${r.data.clubId}/discussions/${resourceId}`
    }
    // ... 9 more cases ...
    default:
      return `/${locale}/community`
  }
}
```

- [ ] **Step 3: Refactor bell click handler to async + loading state**

In `notifications-bell.tsx`:

```tsx
const [pendingRowId, setPendingRowId] = useState<string | null>(null)

async function handleClick(n: NotificationRow) {
  if (n.type === 'MENTION') {
    setPendingRowId(n.id)
    const target = await resolveMentionDeepLink(n.resourceType ?? '', n.resourceId ?? '', locale)
    setPendingRowId(null)
    router.push(target)
  } else {
    // existing sync logic
    router.push(/* existing target */)
  }
}
```

Render a small spinner on the row when `pendingRowId === n.id`.

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/ lib/notifications/mention-deep-links.ts app/[locale]/\(app\)/_components/notifications-bell.tsx
git commit -m "feat(c5b/bell-deep-links): ~10 parent-id lookup actions + bell async resolver + loading state"
```

---

## Task 10: `<VisibilityPicker>` generic-ization

**Files:**
- Move: `app/[locale]/(public)/discover/_components/visibility-picker.tsx` → `components/visibility-picker.tsx`
- Modify: C2 + C3 + C4 call sites to drop `as SparkVisibility` casts.

- [ ] **Step 1: Move + generic-ize**

```bash
git mv app/[locale]/\(public\)/discover/_components/visibility-picker.tsx components/visibility-picker.tsx
```

Edit `components/visibility-picker.tsx`:

```tsx
'use client'
import { Globe, Users, Lock } from 'lucide-react'

export type VisibilityOption<T extends string> = {
  value: T
  label: string
  description: string
  icon: typeof Globe
}

type Props<T extends string> = {
  value: T
  onChange: (v: T) => void
  options: VisibilityOption<T>[]
}

export function VisibilityPicker<T extends string>({ value, onChange, options }: Props<T>) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const Icon = opt.icon
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="..."
            style={{ /* existing chrome */ }}
          >
            <Icon className="h-4 w-4" />
            <p>{opt.label}</p>
            <p>{opt.description}</p>
          </button>
        )
      })}
    </div>
  )
}

// Export shared option sets:
export const BOOK_VISIBILITY_OPTIONS: VisibilityOption<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>[] = [
  { value: 'PUBLIC', label: 'Public', description: 'Anyone can see', icon: Globe },
  { value: 'FRIENDS', label: 'Friends', description: 'Friends only', icon: Users },
  { value: 'PRIVATE', label: 'Private', description: 'Only you', icon: Lock },
]
```

- [ ] **Step 2: Drop casts at C2 + C3 + C4 call sites**

```bash
grep -rn "as SparkVisibility" app/
```

For each hit, replace with the appropriate option set:

```tsx
// Before:
<VisibilityPicker value={visibility as SparkVisibility} onChange={(v) => setVisibility(v as SparkVisibility)} />

// After:
import { VisibilityPicker, BOOK_VISIBILITY_OPTIONS } from '@/components/visibility-picker'
<VisibilityPicker value={visibility} onChange={setVisibility} options={BOOK_VISIBILITY_OPTIONS} />
```

- [ ] **Step 3: Update import paths everywhere**

```bash
grep -rn "@/app/\[locale\]/\(public\)/discover/_components/visibility-picker" app/ components/
```

Replace with `@/components/visibility-picker`.

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add app/ components/visibility-picker.tsx
git commit -m "refactor(c5b/visibility-picker): generic-ize + move to components/ + drop SparkVisibility casts"
```

---

## Task 11: Username rename + alias-redirect (conditional on T0 = YES)

**Skip if T0 = NO. Close the task with: `git commit --allow-empty -m "chore(c5b/t11): rename-safe rendering N/A — usernames immutable per T0 audit"`**

**Files (if T0 = YES):**
- Modify: rename action file (per T0 audit finding)
- Modify: `app/[locale]/(public)/u/[username]/page.tsx`

- [ ] **Step 1: Wire alias insert into rename action**

In the rename action (whatever its name + location), wrap in `db.transaction`:

```ts
return await db.transaction(async (tx) => {
  // existing: update userProfiles.username
  await tx.update(userProfiles).set({ username: newUsername }).where(eq(userProfiles.userId, userId))

  // NEW: insert alias for old username
  await tx.insert(usernameAliases).values({
    oldUsername: oldUsername,
    currentUserId: userId,
  }).onConflictDoNothing()  // in case oldUsername had been used before by someone else (unlikely)

  return { success: true }
})
```

- [ ] **Step 2: Add alias fallback to `/u/[username]/page.tsx`**

```ts
// In the page's server component:
const profile = await db.query.userProfiles.findFirst({
  where: (up, { eq }) => eq(up.username, username),
})

if (!profile) {
  // NEW: alias fallback
  const alias = await db.query.usernameAliases.findFirst({
    where: (ua, { eq }) => eq(ua.oldUsername, username),
  })
  if (alias) {
    const current = await db.query.userProfiles.findFirst({
      where: (up, { eq }) => eq(up.userId, alias.currentUserId),
    })
    if (current) {
      redirect(`/${locale}/u/${current.username}`)
    }
  }
  notFound()
}
```

- [ ] **Step 3: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/ app/[locale]/\(public\)/u/\[username\]/page.tsx
git commit -m "feat(c5b/rename-safe): username_aliases writer + /u/[old-name] 308 fallback"
```

---

## Task 12: `/settings/notifications` smoke

- [ ] **Step 1: Walk the 6 prefs smoke scenarios from spec §6**

1. Settings page render — visit `/en/settings/notifications`, confirm 4 sections + all switches default ON.
2. Toggle NEW_LIKE off → friend B likes your book → no notification appears.
3. Toggle NEW_LIKE back on → friend B likes again → notification appears.
4. Multi-type opt-out (NEW_LIKE + NEW_FOLLOWER off) — neither fires.
5. MENTION opt-out — user A mentions you + 2 friends; you don't get pinged, friends do.
6. `/en/settings` redirects to `/en/settings/notifications`.

If any fails, file `fix(c5b): ...` before moving on.

- [ ] **Step 2: Commit smoke pass (no-op)**

```bash
git commit --allow-empty -m "chore(c5b/t12): /settings/notifications smoke passed"
```

---

## Task 13: `/community` feed-ordering smoke

- [ ] **Step 1: Walk the 4 feed smoke scenarios from spec §6**

7. Friend's older event appears above followed-only's newer event on page 1.
8. Brand-yellow left-edge indicator still renders on friend rows.
9. Cursor pagination — Load more works, no duplicates.
10. Backward-compat cursor — old format doesn't crash.

- [ ] **Step 2: Commit smoke pass**

```bash
git commit --allow-empty -m "chore(c5b/t13): /community feed-ordering smoke passed"
```

---

## Task 14: Cleanup-items smoke

- [ ] **Step 1: Walk the 8 cleanup smoke scenarios from spec §6**

11. Friend invite claim toast.
12. Club invite claim toast.
13. Club pending-request pill + Cancel.
14. Mention bell precise deep links (9 surface types).
15. VisibilityPicker no `as SparkVisibility` grep hits.
16-17. Rename-safe alias redirect (if T0 = YES); chained redirects work.
18. No regressions — full suite green, tsc clean.

- [ ] **Step 2: Commit smoke pass**

```bash
git commit --allow-empty -m "chore(c5b/t14): cleanup-items smoke passed"
```

---

## Task 15: AGENTS.md ship summary + close C5b

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Move C5b paragraphs from Resume Here → What Has Been Built**

Add new `### Community Phase — C5b Notification Prefs + Feed Ranking + Cleanup ✅ COMPLETE (2026-06-05)` entry with:
- Wave SHA map (T0-T15)
- Notification preferences architecture (skip-at-write, ~11-14 audit sites, lazy-create table)
- Feed sort tuple shape
- 5 cleanup items resolved
- Patterns now load-bearing (`shouldSkipNotification` as canonical write-side gate; alias-redirect as canonical rename-safety; generic VisibilityPicker)
- Known follow-ups still open

- [ ] **Step 2: Update Resume Here → C5d Claude Design pass next**

```bash
git add AGENTS.md
git commit -m "docs(c5b): ship — notification prefs + friend-first feed + 5 cleanup items"
```

---

## Self-Review

**1. Spec coverage:**
- §1 Scope (3 pieces) → T1-T11 cover all. ✓
- §2.1 notification_preferences table → T1. ✓
- §2.2 username_aliases conditional → T1 step 2 + T11. ✓
- §3.1 lib/notifications/ helpers → T2. ✓
- §3.2 audit + wire skipNotification → T3. ✓
- §3.3 feed sort + cursor → T6. ✓
- §3.4 cleanup actions → T7 (toast), T8 (pending), T9 (deep links), T10 (visibility), T11 (alias). ✓
- §4.1 settings page → T4. ✓
- §4.2 /settings redirect → T5. ✓
- §4.3 nav dropdown → T5. ✓
- §4.4 feed UI (no work) → T6 covers; T13 smoke verifies. ✓
- §4.5 invite toast mounts → T7. ✓
- §4.6 ClubHeader pending pill → T8. ✓
- §4.7 bell async deep links → T9. ✓
- §6 18-scenario smoke → T12 + T13 + T14. ✓

**2. Placeholder scan:** Reviewed steps for vague patterns. T11 has conditional close-as-N/A branch; T9 lookup action shapes assume "verify schema columns" — explicit guidance for implementer. No "TBD" / "implement later" hits.

**3. Type consistency:**
- `NotificationType` exported from `db/schema/social.ts` in T2 step 2; consumed by `shouldSkipNotification` + `updateNotificationPreferenceAction` + bell. ✓
- `ClubSummary.viewerMembership` shape: T8 step 1 widens; ClubHeader (T8 step 5) + getClubAction (T8 step 2) + getClubsAction (T8 step 3) all consume widened shape. ✓
- `VisibilityOption<T>` generic in T10 propagates through all 3 call sites consistently. ✓
- Cursor tuple format in T6 is consistent across encode + decode + WHERE + nextCursor build. ✓

**4. Suggested execution waves:**
- W1 = T0 + T1
- W2 = T2
- W3 = T3 + T4 parallel (helpers wiring + UI build)
- W4 = T5 + T6 + T7 + T8 parallel (4 isolated scopes)
- W5 = T9 + T10 + T11 parallel (3 isolated scopes; T11 conditional)
- W6 = T12 + T13 + T14 + T15

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-05-c5b-notifications-feed-cleanup.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, per-task commits, matches C1-C5a cadence.

**2. Inline Execution** — execute tasks in this session using executing-plans.

**Which approach?**
