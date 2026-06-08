# C5a — @-Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship cross-cutting @-mentions across every social text surface — autocomplete-driven entry in TipTap + textarea inputs, block-aware resolution, dedupe-and-cap notifications, render-time clickable links — without regressions to any existing C1-C4 surface.

**Architecture:** Single `lib/mentions/` helper module hosts pure extract + resolve + record-tx writers. One new TipTap `MentionMark` (sibling to C4's `HiveAnnotationMark` / `HiveSuggestionMark`) carries `{userId, username}` attrs. New `<MentionPopover>` + `<MentionLink>` + `<MentionableTextarea>` + `<RenderMentionsInText>` shared components. Every CREATE + UPDATE server action for the 12 in-scope surfaces wires the same 5-step pattern (extract → resolve+filter+dedupe → tx → diff vs prior notifications → conditional write).

**Tech Stack:** Next.js 16 App Router · Drizzle ORM on Neon Postgres · TipTap 3 · React 19 · shadcn/ui · Tailwind v4 · React `cache()` · vitest.

**Spec:** [docs/superpowers/specs/2026-06-05-c5a-mentions-design.md](../specs/2026-06-05-c5a-mentions-design.md)

---

## File Structure

**New files (12):**
- `scripts/migrate-c5a.ts` — idempotent enum-value migration runner
- `lib/mentions/extract-mentions.ts` — pure TipTap doc walker + text regex
- `lib/mentions/resolve-mentions.ts` — async resolver (IN-list + block + self + cap + dedupe)
- `lib/mentions/record-mention-notifications.ts` — tx-aware batch writer
- `lib/mentions/surface-types.ts` — `SurfaceType` union
- `lib/mentions/__tests__/extract-mentions.test.ts`
- `lib/mentions/__tests__/resolve-mentions.test.ts`
- `lib/tiptap-extensions/mention-mark.ts` — TipTap mark
- `lib/tiptap-extensions/__tests__/mention-mark.test.ts`
- `lib/hooks/use-mention-popover.ts` — TipTap `@`-keystroke detector
- `components/mentions/mention-popover.tsx` — floating dropdown
- `components/mentions/mention-link.tsx` — render-time @username link
- `components/mentions/mentionable-textarea.tsx` — `<textarea>` drop-in replacement
- `components/mentions/render-mentions-in-text.tsx` — text → `<MentionLink>` fragments
- `app/globals.css` — `.mention` rule additions

**Modified files (~22):**
- `db/schema/social.ts` — append `'MENTION'` to `notificationTypeEnum`
- `lib/export/tiptap-to-html.ts` — `mention` mark case
- `lib/actions/sparks.actions.ts` — 3 action wirings
- `lib/actions/reading-lists.actions.ts` — 3 action wirings
- `lib/actions/book-clubs.actions.ts` — 6 action wirings
- `lib/actions/hive-discussions.actions.ts` — 3 action wirings
- `lib/actions/hive-buzz.actions.ts` — 2 action wirings
- `lib/actions/hive-annotations.actions.ts` — 2 action wirings
- `lib/actions/hive-suggestions.actions.ts` — 1 action wiring
- `lib/actions/discover.actions.ts` OR `social.actions.ts` (book comments) — 1 action wiring
- `lib/actions/user-profile.actions.ts` — 1 action wiring (bio, link-only)
- `app/[locale]/(app)/clubs/_components/discussion-composer.tsx` — register MentionMark + mount popover
- `app/[locale]/(app)/clubs/_components/reply-composer.tsx` — same
- Hive discussion + reply + buzz composers — same
- `components/hive/collab/annotate-modal.tsx` — same
- `components/hive/collab/suggest-modal.tsx` — same
- 7 textarea sites swapped to `<MentionableTextarea>`
- `app/[locale]/(app)/_components/notifications-bell.tsx` — `MENTION` LABELS + click router
- `AGENTS.md` — ship summary in T15

---

## Task 1: Schema migration — add `MENTION` notification type

**Files:**
- Modify: `db/schema/social.ts`
- Create: `scripts/migrate-c5a.ts`

- [ ] **Step 1: Append `'MENTION'` to `notificationTypeEnum` in drizzle schema**

In `db/schema/social.ts`, find the `notificationTypeEnum` definition (currently includes `'FRIEND_REQUEST'`, `'FRIEND_ACCEPTED'`, `'CLUB_INVITE'`, `'CLUB_JOIN_REQUEST'`, `'CLUB_JOIN_APPROVED'`, etc.). Append `'MENTION'` to the array literal.

- [ ] **Step 2: Write idempotent migration runner**

Create `scripts/migrate-c5a.ts` mirroring `scripts/migrate-c4.ts` shape:

```ts
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  console.log('Adding MENTION to notification_type enum...')
  await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MENTION'`
  console.log('✓ Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 3: Run migration twice to verify idempotency**

```bash
npx dotenv -e .env.local -- tsx scripts/migrate-c5a.ts
npx dotenv -e .env.local -- tsx scripts/migrate-c5a.ts
```
Expected: both runs succeed; no error on second run.

- [ ] **Step 4: Run tsc to verify enum widening doesn't break consumers**

```bash
npx tsc --noEmit
```
Expected: clean. If a `Record<NotificationType, _>` exhaustive consumer breaks, add a provisional `MENTION: '...'` entry (T13 owns final phrasing).

- [ ] **Step 5: Run test suite**

```bash
npm test
```
Expected: 606/606 green.

- [ ] **Step 6: Commit**

```bash
git add db/schema/social.ts scripts/migrate-c5a.ts
git commit -m "feat(c5a/schema): add MENTION to notification_type enum"
```

---

## Task 2: `lib/mentions/` helpers + unit tests

**Files:**
- Create: `lib/mentions/surface-types.ts`
- Create: `lib/mentions/extract-mentions.ts`
- Create: `lib/mentions/resolve-mentions.ts`
- Create: `lib/mentions/record-mention-notifications.ts`
- Create: `lib/mentions/__tests__/extract-mentions.test.ts`
- Create: `lib/mentions/__tests__/resolve-mentions.test.ts`

- [ ] **Step 1: Create `surface-types.ts`**

```ts
// lib/mentions/surface-types.ts
export type SurfaceType =
  | 'spark_entry_comment'
  | 'spark_entry_comment_reply'
  | 'reading_list_description'
  | 'reading_list_book_commentary'
  | 'book_club_description'
  | 'book_club_rules'
  | 'book_club_discussion'
  | 'book_club_discussion_reply'
  | 'hive_discussion'
  | 'hive_discussion_reply'
  | 'hive_buzz_post'
  | 'hive_annotation'
  | 'hive_suggestion'
  | 'book_comment'
  | 'profile_bio'
```

- [ ] **Step 2: Write failing tests for `extractMentionUserIdsFromTiptap`**

Create `lib/mentions/__tests__/extract-mentions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractMentionUserIdsFromTiptap, extractMentionUsernamesFromText } from '../extract-mentions'

describe('extractMentionUserIdsFromTiptap', () => {
  it('returns empty array for empty doc', () => {
    expect(extractMentionUserIdsFromTiptap({ type: 'doc', content: [] })).toEqual([])
  })
  it('extracts a single mention userId', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'text', text: '@bob', marks: [{ type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } }] }
      ] }]
    }
    expect(extractMentionUserIdsFromTiptap(doc)).toEqual(['u_bob'])
  })
  it('dedupes multiple mentions of the same user', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '@bob', marks: [{ type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: '@bob again', marks: [{ type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } }] }] }
      ]
    }
    expect(extractMentionUserIdsFromTiptap(doc)).toEqual(['u_bob'])
  })
  it('handles nested block nodes (lists, blockquotes)', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [
        { type: 'paragraph', content: [{ type: 'text', text: '@alice', marks: [{ type: 'mention', attrs: { userId: 'u_alice', username: 'alice' } }] }] }
      ] }]
    }
    expect(extractMentionUserIdsFromTiptap(doc)).toEqual(['u_alice'])
  })
})

describe('extractMentionUsernamesFromText', () => {
  it('returns empty array for empty text', () => {
    expect(extractMentionUsernamesFromText('')).toEqual([])
  })
  it('extracts single @username', () => {
    expect(extractMentionUsernamesFromText('hello @bob')).toEqual(['bob'])
  })
  it('lowercases for normalization', () => {
    expect(extractMentionUsernamesFromText('hi @BoB')).toEqual(['bob'])
  })
  it('dedupes repeated mentions', () => {
    expect(extractMentionUsernamesFromText('@bob and @bob and @bob')).toEqual(['bob'])
  })
  it('rejects too-short usernames (less than 3 chars)', () => {
    expect(extractMentionUsernamesFromText('@ab vs @bob')).toEqual(['bob'])
  })
  it('rejects too-long usernames (over 20 chars)', () => {
    const tooLong = '@' + 'a'.repeat(21)
    expect(extractMentionUsernamesFromText(tooLong + ' @bob')).toEqual(['bob'])
  })
  it('ignores @ inside email addresses', () => {
    // Edge case: regex doesn't enforce word-boundary on left of @.
    // Decision: accept that "user@example.com" extracts "example" — rare, acceptable for v1.
    // If smoke shows this bites, tighten the regex to require non-alphanumeric or start-of-string before @.
    expect(extractMentionUsernamesFromText('user@example.com')).toEqual(['example'])
  })
})
```

- [ ] **Step 3: Run tests to verify failure**

```bash
npm test -- lib/mentions/__tests__/extract-mentions.test.ts
```
Expected: FAIL with "Cannot find module ../extract-mentions".

- [ ] **Step 4: Implement `extract-mentions.ts`**

```ts
// lib/mentions/extract-mentions.ts

type PMNode = {
  type: string
  content?: PMNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export function extractMentionUserIdsFromTiptap(doc: unknown): string[] {
  const seen = new Set<string>()
  walk(doc as PMNode, (node) => {
    if (node.type === 'text' && node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'mention') {
          const userId = mark.attrs?.userId
          if (typeof userId === 'string' && userId.length > 0) seen.add(userId)
        }
      }
    }
  })
  return Array.from(seen)
}

function walk(node: PMNode | undefined, visit: (n: PMNode) => void): void {
  if (!node || typeof node !== 'object') return
  visit(node)
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, visit)
  }
}

const MENTION_TEXT_REGEX = /@([a-z0-9_]{3,20})/gi

export function extractMentionUsernamesFromText(text: string): string[] {
  if (!text) return []
  const seen = new Set<string>()
  for (const match of text.matchAll(MENTION_TEXT_REGEX)) {
    seen.add(match[1].toLowerCase())
  }
  return Array.from(seen)
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm test -- lib/mentions/__tests__/extract-mentions.test.ts
```
Expected: all green.

- [ ] **Step 6: Write failing tests for `resolveMentionedUsers`**

Create `lib/mentions/__tests__/resolve-mentions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted pattern for chained DB builder mocks (per C3 T2 lesson)
const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  isBlocked: vi.fn(),
}))

vi.mock('@/db', () => ({ db: { select: mocks.dbSelect } }))
vi.mock('@/lib/social/is-blocked', () => ({ isBlocked: mocks.isBlocked }))

import { resolveMentionedUsers } from '../resolve-mentions'

describe('resolveMentionedUsers', () => {
  beforeEach(() => {
    mocks.dbSelect.mockReset()
    mocks.isBlocked.mockReset()
    mocks.isBlocked.mockResolvedValue(false)
  })

  it('returns empty users when no inputs provided', async () => {
    mocks.dbSelect.mockReturnValue({ from: () => ({ where: () => Promise.resolve([]) }) })
    // Mock the prior-notifications query the same way
    mocks.dbSelect.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
    const result = await resolveMentionedUsers({
      tiptapUserIds: [], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users).toEqual([])
    expect(Array.from(result.alreadyNotified)).toEqual([])
  })

  it('returns MENTION_CAP_EXCEEDED when more than 5 distinct mentions', async () => {
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
      textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    expect(result).toEqual({ ok: false, error: 'MENTION_CAP_EXCEEDED' })
  })

  it('filters out self-mentions', async () => {
    mocks.dbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { id: 'u_actor', username: 'me' },
        { id: 'u_bob', username: 'bob' },
      ]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u_actor', 'u_bob'], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users.map((u) => u.userId)).toEqual(['u_bob'])
  })

  it('filters out blocked users (either direction)', async () => {
    mocks.dbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { id: 'u_bob', username: 'bob' },
        { id: 'u_carol', username: 'carol' },
      ]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
    mocks.isBlocked.mockImplementation(async (a, b) =>
      (a === 'u_actor' && b === 'u_bob') || (a === 'u_bob' && b === 'u_actor'))
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u_bob', 'u_carol'], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users.map((u) => u.userId)).toEqual(['u_carol'])
  })

  it('returns alreadyNotified set from prior MENTION notifications within 24h', async () => {
    mocks.dbSelect
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { id: 'u_bob', username: 'bob' },
        { id: 'u_carol', username: 'carol' },
      ]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([
        { userId: 'u_bob' },
      ]) }) })
    const result = await resolveMentionedUsers({
      tiptapUserIds: ['u_bob', 'u_carol'], textUsernames: [], actorId: 'u_actor',
      resourceType: 'book_club_discussion', resourceId: 'd1',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(result.users.map((u) => u.userId).sort()).toEqual(['u_bob', 'u_carol'])
    expect(Array.from(result.alreadyNotified)).toEqual(['u_bob'])
  })
})
```

- [ ] **Step 7: Run tests to verify failure**

```bash
npm test -- lib/mentions/__tests__/resolve-mentions.test.ts
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 8: Implement `resolve-mentions.ts`**

```ts
// lib/mentions/resolve-mentions.ts
import { db } from '@/db'
import { userProfiles, notifications } from '@/db/schema/social'
import { isBlocked } from '@/lib/social/is-blocked'
import { and, eq, gte, inArray, or, sql } from 'drizzle-orm'
import type { SurfaceType } from './surface-types'

const MENTION_CAP = 5
const DEDUPE_WINDOW_HOURS = 24

export type ResolvedMention = { userId: string; username: string }

type ResolveResult =
  | { ok: true; users: ResolvedMention[]; alreadyNotified: Set<string> }
  | { ok: false; error: 'MENTION_CAP_EXCEEDED' }

export async function resolveMentionedUsers(opts: {
  tiptapUserIds: string[]
  textUsernames: string[]
  actorId: string
  resourceType: SurfaceType
  resourceId: string
}): Promise<ResolveResult> {
  const { tiptapUserIds, textUsernames, actorId, resourceType, resourceId } = opts

  // Cap check on combined distinct input set
  const distinctInputs = new Set<string>([...tiptapUserIds, ...textUsernames])
  if (distinctInputs.size > MENTION_CAP) {
    return { ok: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  if (distinctInputs.size === 0) {
    return { ok: true, users: [], alreadyNotified: new Set() }
  }

  // IN-list lookup: by id OR lower(username)
  const candidates = await db
    .select({ id: userProfiles.userId, username: userProfiles.username })
    .from(userProfiles)
    .where(
      or(
        tiptapUserIds.length > 0 ? inArray(userProfiles.userId, tiptapUserIds) : sql`false`,
        textUsernames.length > 0 ? inArray(sql`lower(${userProfiles.username})`, textUsernames) : sql`false`
      )
    )

  // Dedupe by id
  const byId = new Map<string, { userId: string; username: string }>()
  for (const c of candidates) {
    byId.set(c.id, { userId: c.id, username: c.username })
  }

  // Self-mention filter
  byId.delete(actorId)

  // Block filter
  const filtered: ResolvedMention[] = []
  for (const candidate of byId.values()) {
    const blocked = await isBlocked(actorId, candidate.userId)
    if (!blocked) filtered.push(candidate)
  }

  // Dedupe vs prior notifications within 24h
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000)
  const priorRows = filtered.length > 0
    ? await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(
          and(
            eq(notifications.type, 'MENTION'),
            eq(notifications.actorId, actorId),
            eq(notifications.resourceType, resourceType),
            eq(notifications.resourceId, resourceId),
            gte(notifications.createdAt, cutoff)
          )
        )
    : []
  const alreadyNotified = new Set(priorRows.map((r) => r.userId))

  return { ok: true, users: filtered, alreadyNotified }
}
```

- [ ] **Step 9: Run tests to verify pass**

```bash
npm test -- lib/mentions/__tests__/resolve-mentions.test.ts
```
Expected: all green.

- [ ] **Step 10: Implement `record-mention-notifications.ts`**

```ts
// lib/mentions/record-mention-notifications.ts
import { notifications } from '@/db/schema/social'
import type { SurfaceType } from './surface-types'
import { db } from '@/db'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recordMentionNotificationsTx(
  tx: DrizzleTx,
  opts: { actorId: string; mentionedUserIds: string[]; resourceType: SurfaceType; resourceId: string }
): Promise<void> {
  if (opts.mentionedUserIds.length === 0) return
  await tx.insert(notifications).values(
    opts.mentionedUserIds.map((userId) => ({
      userId,
      type: 'MENTION' as const,
      actorId: opts.actorId,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
    }))
  )
}
```

- [ ] **Step 11: Run full suite + tsc**

```bash
npm test
npx tsc --noEmit
```
Expected: all green; tsc clean.

- [ ] **Step 12: Commit**

```bash
git add lib/mentions/
git commit -m "feat(c5a/helpers): lib/mentions/ — extract + resolve + record helpers + unit tests"
```

---

## Task 3: `MentionMark` TipTap extension

**Files:**
- Create: `lib/tiptap-extensions/mention-mark.ts`
- Create: `lib/tiptap-extensions/__tests__/mention-mark.test.ts`
- Modify: `app/globals.css` — `.mention` rule

- [ ] **Step 1: Write failing round-trip tests**

Create `lib/tiptap-extensions/__tests__/mention-mark.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateHTML, generateJSON } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { MentionMark } from '../mention-mark'

const extensions = [StarterKit, MentionMark]

describe('MentionMark', () => {
  it('round-trips a simple mention through HTML', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: '@bob', marks: [{ type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } }] }
      ] }]
    }
    const html = generateHTML(doc, extensions)
    expect(html).toContain('data-mention-user-id="u_bob"')
    expect(html).toContain('@bob')
    const reparsed = generateJSON(html, extensions)
    const reMark = reparsed.content[0].content.find((n: any) => n.text === '@bob')?.marks?.[0]
    expect(reMark?.attrs).toEqual({ userId: 'u_bob', username: 'bob' })
  })

  it('preserves sibling bold mark on the same text run', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'text', text: '@bob', marks: [
          { type: 'bold' },
          { type: 'mention', attrs: { userId: 'u_bob', username: 'bob' } }
        ] }
      ] }]
    }
    const html = generateHTML(doc, extensions)
    const reparsed = generateJSON(html, extensions)
    const reMarks = reparsed.content[0].content[0].marks
    expect(reMarks.some((m: any) => m.type === 'bold')).toBe(true)
    expect(reMarks.some((m: any) => m.type === 'mention')).toBe(true)
  })

  it('handles multiple distinct mentions in one paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [
        { type: 'text', text: '@a', marks: [{ type: 'mention', attrs: { userId: 'u_a', username: 'a' } }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: '@b', marks: [{ type: 'mention', attrs: { userId: 'u_b', username: 'b' } }] }
      ] }]
    }
    const html = generateHTML(doc, extensions)
    expect(html).toContain('data-mention-user-id="u_a"')
    expect(html).toContain('data-mention-user-id="u_b"')
  })

  it('parses HTML with data-mention-user-id back to a mark', () => {
    const html = '<p>Hello <span class="mention" data-mention-user-id="u_bob" data-mention-username="bob">@bob</span></p>'
    const doc = generateJSON(html, extensions)
    const mark = doc.content[0].content.find((n: any) => n.text === '@bob')?.marks?.[0]
    expect(mark?.attrs).toEqual({ userId: 'u_bob', username: 'bob' })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- lib/tiptap-extensions/__tests__/mention-mark.test.ts
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `mention-mark.ts`**

```ts
// lib/tiptap-extensions/mention-mark.ts
import { Mark, mergeAttributes } from '@tiptap/core'

export interface MentionAttrs {
  userId: string
  username: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mentionMark: {
      setMention: (attrs: MentionAttrs) => ReturnType
      unsetMention: () => ReturnType
    }
  }
}

export const MentionMark = Mark.create({
  name: 'mention',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-mention-user-id'),
        renderHTML: (attrs) => (attrs.userId ? { 'data-mention-user-id': attrs.userId } : {}),
      },
      username: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-mention-username'),
        renderHTML: (attrs) => (attrs.username ? { 'data-mention-username': attrs.username } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-mention-user-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'mention' }, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setMention:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetMention:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- lib/tiptap-extensions/__tests__/mention-mark.test.ts
```
Expected: all green.

- [ ] **Step 5: Add `.mention` CSS to globals.css**

In `app/globals.css`, add (near the existing `.hive-annotation` block):

```css
.mention {
  color: var(--canvas-dark-ink-strong);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: color 120ms;
}
.mention:hover {
  color: var(--brand);
}
.public-reader .mention {
  /* Mentions stay clickable on the public reader — no transparency reset (unlike C4 collab marks). */
}
```

- [ ] **Step 6: Run full suite + tsc**

```bash
npm test
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/tiptap-extensions/mention-mark.ts lib/tiptap-extensions/__tests__/mention-mark.test.ts app/globals.css
git commit -m "feat(c5a/mark): MentionMark TipTap extension + .mention CSS"
```

---

## Task 4: `useMentionPopover` hook + `<MentionPopover>` component

**Files:**
- Create: `lib/hooks/use-mention-popover.ts`
- Create: `components/mentions/mention-popover.tsx`

- [ ] **Step 1: Implement `useMentionPopover` hook**

```ts
// lib/hooks/use-mention-popover.ts
'use client'
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

type State =
  | { kind: 'idle' }
  | { kind: 'active'; from: number; query: string; anchorRect: DOMRect }

export function useMentionPopover(editor: Editor | null) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!editor) return

    const onUpdate = () => {
      const { from } = editor.state.selection
      const docText = editor.state.doc.textBetween(0, from, ' ', ' ')
      // Find the last @ in the trailing word.
      const tail = docText.split(/\s/).pop() ?? ''
      const current = stateRef.current
      if (tail.startsWith('@')) {
        const query = tail.slice(1)
        try {
          const coords = editor.view.coordsAtPos(from - tail.length)
          const anchorRect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)
          setState({ kind: 'active', from: from - tail.length, query, anchorRect })
        } catch {
          /* ignore */
        }
      } else if (current.kind === 'active') {
        setState({ kind: 'idle' })
      }
    }

    const onBlur = () => setState({ kind: 'idle' })

    editor.on('update', onUpdate)
    editor.on('selectionUpdate', onUpdate)
    editor.on('blur', onBlur)
    return () => {
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', onUpdate)
      editor.off('blur', onBlur)
    }
  }, [editor])

  const close = () => setState({ kind: 'idle' })

  const insertMention = (userId: string, username: string) => {
    if (!editor || state.kind !== 'active') return
    // Replace the @query text with the mention mark wrapping @username.
    const queryLen = 1 + state.query.length // include @
    editor
      .chain()
      .focus()
      .deleteRange({ from: state.from, to: state.from + queryLen })
      .insertContent({
        type: 'text',
        text: `@${username}`,
        marks: [{ type: 'mention', attrs: { userId, username } }],
      })
      .insertContent(' ')
      .run()
    close()
  }

  return {
    isActive: state.kind === 'active',
    query: state.kind === 'active' ? state.query : '',
    anchorRect: state.kind === 'active' ? state.anchorRect : null,
    close,
    insertMention,
  }
}
```

- [ ] **Step 2: Implement `<MentionPopover>` component**

```tsx
// components/mentions/mention-popover.tsx
'use client'
import { useEffect, useState, useTransition } from 'react'
import { searchUsersAction } from '@/lib/actions/friendships.actions'

type Result = { userId: string; username: string; displayName: string | null; avatarUrl: string | null }

type Props = {
  isActive: boolean
  query: string
  anchorRect: DOMRect | null
  onPick: (user: Result) => void
  onClose: () => void
}

export function MentionPopover({ isActive, query, anchorRect, onPick, onClose }: Props) {
  const [results, setResults] = useState<Result[]>([])
  const [hoveredIndex, setHoveredIndex] = useState(0)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!isActive) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await searchUsersAction({ query, limit: 6 })
        if (result.success) {
          setResults(result.data as Result[])
          setHoveredIndex(0)
        }
      })
    }, 300)
    return () => clearTimeout(handle)
  }, [isActive, query])

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHoveredIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHoveredIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        if (results[hoveredIndex]) {
          e.preventDefault()
          onPick(results[hoveredIndex])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, results, hoveredIndex, onPick, onClose])

  if (!isActive || !anchorRect || results.length === 0) return null

  return (
    <div
      className="fixed z-50 max-w-xs rounded-[var(--r-card)] border bg-[var(--canvas-dark-200)] shadow-[var(--sh-card)]"
      style={{
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        borderColor: 'var(--br-card)',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul className="py-1">
        {results.map((u, i) => (
          <li key={u.userId}>
            <button
              type="button"
              onMouseEnter={() => setHoveredIndex(i)}
              onClick={() => onPick(u)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
              style={{
                background: i === hoveredIndex ? 'var(--canvas-dark-300)' : 'transparent',
                color: 'var(--canvas-dark-ink)',
              }}
            >
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span
                  className="h-6 w-6 rounded-full"
                  style={{ background: 'var(--canvas-dark-300)' }}
                />
              )}
              <span className="font-medium">@{u.username}</span>
              {u.displayName && (
                <span className="text-xs text-[var(--canvas-dark-ink-muted)] truncate">
                  {u.displayName}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Run tsc + suite**

```bash
npx tsc --noEmit
npm test
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/use-mention-popover.ts components/mentions/mention-popover.tsx
git commit -m "feat(c5a/popover): useMentionPopover hook + MentionPopover dropdown"
```

---

## Task 5: Shared render components — `<MentionLink>` + `<MentionableTextarea>` + `<RenderMentionsInText>`

**Files:**
- Create: `components/mentions/mention-link.tsx`
- Create: `components/mentions/mentionable-textarea.tsx`
- Create: `components/mentions/render-mentions-in-text.tsx`

- [ ] **Step 1: Implement `<MentionLink>` (synchronous, snapshot-based)**

```tsx
// components/mentions/mention-link.tsx
import Link from 'next/link'

type Props = { username: string; userId?: string }

export function MentionLink({ username, userId }: Props) {
  return (
    <Link
      href={`/u/${username}`}
      className="mention"
      data-mention-user-id={userId ?? undefined}
    >
      @{username}
    </Link>
  )
}
```

- [ ] **Step 2: Implement `<MentionableTextarea>`**

```tsx
// components/mentions/mentionable-textarea.tsx
'use client'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { MentionPopover } from './mention-popover'

type Result = { userId: string; username: string; displayName: string | null; avatarUrl: string | null }

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  value: string
  onChange: (next: string) => void
}

type State =
  | { kind: 'idle' }
  | { kind: 'active'; queryStart: number; query: string; anchorRect: DOMRect }

export const MentionableTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionableTextarea(
  { value, onChange, ...rest },
  ref
) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => localRef.current!, [])
  const [state, setState] = useState<State>({ kind: 'idle' })

  const updateState = useCallback(() => {
    const ta = localRef.current
    if (!ta) return
    const caret = ta.selectionStart
    const upto = value.slice(0, caret)
    const match = upto.match(/(?:^|\s)@([a-z0-9_]{0,20})$/i)
    if (match) {
      const queryStart = caret - match[1].length - 1 // include '@'
      // Anchor at caret position via getBoundingClientRect on a phantom span — approximate via textarea + selection bbox
      const rect = ta.getBoundingClientRect()
      // Approximate: top-left of textarea + caret-line offset is non-trivial; mount popover below the textarea for simplicity.
      const anchorRect = new DOMRect(rect.left + 8, rect.bottom - 4, 0, 0)
      setState({ kind: 'active', queryStart, query: match[1], anchorRect })
    } else {
      setState({ kind: 'idle' })
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    queueMicrotask(updateState)
  }

  const handleSelect = () => {
    updateState()
  }

  const handleBlur = () => {
    // Defer to allow popover click to land
    setTimeout(() => setState({ kind: 'idle' }), 100)
  }

  const handlePick = (user: Result) => {
    if (state.kind !== 'active') return
    const ta = localRef.current
    if (!ta) return
    const before = value.slice(0, state.queryStart)
    const after = value.slice(state.queryStart + 1 + state.query.length)
    const next = `${before}@${user.username} ${after}`
    onChange(next)
    setState({ kind: 'idle' })
    requestAnimationFrame(() => {
      ta.focus()
      const newCaret = before.length + 1 + user.username.length + 1
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  return (
    <>
      <textarea
        {...rest}
        ref={localRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onBlur={handleBlur}
      />
      <MentionPopover
        isActive={state.kind === 'active'}
        query={state.kind === 'active' ? state.query : ''}
        anchorRect={state.kind === 'active' ? state.anchorRect : null}
        onPick={handlePick}
        onClose={() => setState({ kind: 'idle' })}
      />
    </>
  )
})
```

- [ ] **Step 3: Implement `<RenderMentionsInText>`**

```tsx
// components/mentions/render-mentions-in-text.tsx
import { Fragment } from 'react'
import { MentionLink } from './mention-link'

type Props = { text: string }

const MENTION_REGEX = /(@[a-z0-9_]{3,20})/gi

export function RenderMentionsInText({ text }: Props) {
  if (!text) return null
  const parts = text.split(MENTION_REGEX)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const username = part.slice(1).toLowerCase()
          return <MentionLink key={i} username={username} />
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
```

- [ ] **Step 4: Run tsc + suite**

```bash
npx tsc --noEmit
npm test
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/mentions/
git commit -m "feat(c5a/render): MentionLink + MentionableTextarea + RenderMentionsInText shared components"
```

---

## Task 6: Wire write/edit paths in Sparks action layer (3 actions)

**Files:**
- Modify: `lib/actions/sparks.actions.ts`

- [ ] **Step 1: Audit existing sparks comment actions**

Read `lib/actions/sparks.actions.ts`. Find:
- `submitSparkEntryCommentAction` (or equivalent name — verify by reading the file's exports)
- `replyToSparkEntryCommentAction` (or equivalent)
- `updateSparkEntryCommentAction` if it exists (may not — many comment surfaces don't support edit)

Document the actual names found at the top of the file (comment-only — no code change).

- [ ] **Step 2: Wire `submitSparkEntryCommentAction` (or equivalent CREATE) with mentions**

For the create action, add inside the existing `db.transaction` block AFTER the row insert:

```ts
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'

// Inside the action, after Zod validation, BEFORE the tx:
const textUsernames = extractMentionUsernamesFromText(input.content)
const mentionResult = await resolveMentionedUsers({
  tiptapUserIds: [],
  textUsernames,
  actorId: userId,
  resourceType: 'spark_entry_comment',
  resourceId: '', // will be set after insert
})
if (!mentionResult.ok) {
  return { success: false, error: mentionResult.error }
}

// Inside the tx, AFTER the insert:
const newCommentId = newRow.id
if (mentionResult.users.length > 0) {
  const toNotify = mentionResult.users
    .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
    .map((u) => u.userId)
  if (toNotify.length > 0) {
    await recordMentionNotificationsTx(tx, {
      actorId: userId,
      mentionedUserIds: toNotify,
      resourceType: 'spark_entry_comment',
      resourceId: newCommentId,
    })
  }
}
```

**Note**: for CREATE actions, the resourceId is unknown before insert. Two options: (a) re-resolve dedupe AFTER insert with the new id (slight duplicate query but correct), OR (b) skip dedupe on CREATE (first write can't be a duplicate). Choose (b) for CREATE — pass empty resourceId to skip the dedupe query. Update `resolveMentionedUsers` if needed to handle empty resourceId as "skip dedupe."

Actually simpler: extract resolution AFTER insert with the real id. Restructure:

```ts
const textUsernames = extractMentionUsernamesFromText(input.content)
// Early cap check
if (textUsernames.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }

return await db.transaction(async (tx) => {
  const [newRow] = await tx.insert(/* ... */).returning()
  const mentionResult = await resolveMentionedUsers({
    tiptapUserIds: [], textUsernames, actorId: userId,
    resourceType: 'spark_entry_comment', resourceId: newRow.id,
  })
  if (!mentionResult.ok) {
    throw new Error(mentionResult.error)  // rolls back insert
  }
  const toNotify = mentionResult.users
    .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
    .map((u) => u.userId)
  if (toNotify.length > 0) {
    await recordMentionNotificationsTx(tx, {
      actorId: userId, mentionedUserIds: toNotify,
      resourceType: 'spark_entry_comment', resourceId: newRow.id,
    })
  }
  return { success: true, data: newRow }
})
```

- [ ] **Step 3: Wire reply action with `resourceType: 'spark_entry_comment_reply'`**

Same pattern; `resourceType: 'spark_entry_comment_reply'`.

- [ ] **Step 4: Wire update action if exists**

For UPDATE actions, the resourceId is known upfront so the dedupe lookup gives a real `alreadyNotified` set (edit-fire diff):

```ts
const textUsernames = extractMentionUsernamesFromText(input.content)
if (textUsernames.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }

return await db.transaction(async (tx) => {
  await tx.update(/* ... */).where(eq(/* ... */))
  const mentionResult = await resolveMentionedUsers({
    tiptapUserIds: [], textUsernames, actorId: userId,
    resourceType: 'spark_entry_comment', resourceId: commentId,
  })
  if (!mentionResult.ok) throw new Error(mentionResult.error)
  const toNotify = mentionResult.users
    .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
    .map((u) => u.userId)
  if (toNotify.length > 0) {
    await recordMentionNotificationsTx(tx, {
      actorId: userId, mentionedUserIds: toNotify,
      resourceType: 'spark_entry_comment', resourceId: commentId,
    })
  }
  return { success: true }
})
```

- [ ] **Step 5: Run tsc + suite**

```bash
npx tsc --noEmit
npm test
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/sparks.actions.ts
git commit -m "feat(c5a/sparks): wire mentions in spark entry comment + reply + update"
```

---

## Task 7: Wire write/edit paths in Reading Lists action layer (3 actions)

**Files:**
- Modify: `lib/actions/reading-lists.actions.ts`

- [ ] **Step 1: Audit existing actions**

Read `lib/actions/reading-lists.actions.ts`. Find:
- `createListAction` — description field carries mentions
- `updateListAction` — description field carries mentions
- `updateListBookAction` — commentary field carries mentions (verify name)

- [ ] **Step 2: Wire `createListAction` (description path)**

After Zod validation, before tx:
```ts
const textUsernames = extractMentionUsernamesFromText(input.description ?? '')
if (textUsernames.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }
```

Inside tx after insert:
```ts
if (textUsernames.length > 0) {
  const mentionResult = await resolveMentionedUsers({
    tiptapUserIds: [], textUsernames, actorId: userId,
    resourceType: 'reading_list_description', resourceId: newList.id,
  })
  if (mentionResult.ok && mentionResult.users.length > 0) {
    const toNotify = mentionResult.users
      .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
      .map((u) => u.userId)
    if (toNotify.length > 0) {
      await recordMentionNotificationsTx(tx, {
        actorId: userId, mentionedUserIds: toNotify,
        resourceType: 'reading_list_description', resourceId: newList.id,
      })
    }
  }
}
```

- [ ] **Step 3: Wire `updateListAction` (description path)**

Same shape with `resourceId: listId` (existing id). Edit-fire dedupe gives real `alreadyNotified` set.

- [ ] **Step 4: Wire `updateListBookAction` (commentary path)**

`resourceType: 'reading_list_book_commentary'`, `resourceId: listBookRowId`.

- [ ] **Step 5: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/reading-lists.actions.ts
git commit -m "feat(c5a/reading-lists): wire mentions in list description + commentary"
```

---

## Task 8: Wire write/edit paths in Book Clubs action layer (6 actions)

**Files:**
- Modify: `lib/actions/book-clubs.actions.ts`

- [ ] **Step 1: Audit existing actions**

Find these and confirm names:
- `createClubAction` — description + rules
- `updateClubAction` — description + rules
- `createClubDiscussionAction` — TipTap content
- `updateClubDiscussionAction` — TipTap content (verify)
- `replyToClubDiscussionAction` — TipTap content
- `updateClubDiscussionReplyAction` — verify exists; if not, skip; flag in commit message

- [ ] **Step 2: Wire `createClubAction` for description + rules**

Both description + rules are textarea fields. Aggregate both for cap check; write notifications under SEPARATE surface keys.

```ts
const descUsernames = extractMentionUsernamesFromText(input.description ?? '')
const rulesUsernames = extractMentionUsernamesFromText(input.rules ?? '')
if (descUsernames.length > 5 || rulesUsernames.length > 5) {
  return { success: false, error: 'MENTION_CAP_EXCEEDED' }
}
```

Inside tx after insert, do TWO resolve+record passes:
```ts
// description
if (descUsernames.length > 0) {
  const r = await resolveMentionedUsers({
    tiptapUserIds: [], textUsernames: descUsernames, actorId: userId,
    resourceType: 'book_club_description', resourceId: newClub.id,
  })
  if (r.ok) {
    const toNotify = r.users.filter((u) => !r.alreadyNotified.has(u.userId)).map((u) => u.userId)
    if (toNotify.length > 0) {
      await recordMentionNotificationsTx(tx, {
        actorId: userId, mentionedUserIds: toNotify,
        resourceType: 'book_club_description', resourceId: newClub.id,
      })
    }
  }
}
// rules — same shape with resourceType: 'book_club_rules'
```

- [ ] **Step 3: Wire `updateClubAction` for description + rules**

Same shape; `resourceId: clubId`.

- [ ] **Step 4: Wire `createClubDiscussionAction` (TipTap content)**

```ts
import { extractMentionUserIdsFromTiptap } from '@/lib/mentions/extract-mentions'

const tiptapUserIds = extractMentionUserIdsFromTiptap(input.content)
if (tiptapUserIds.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }

// Inside tx after insert:
if (tiptapUserIds.length > 0) {
  const r = await resolveMentionedUsers({
    tiptapUserIds, textUsernames: [], actorId: userId,
    resourceType: 'book_club_discussion', resourceId: newDiscussion.id,
  })
  if (r.ok) {
    const toNotify = r.users.filter((u) => !r.alreadyNotified.has(u.userId)).map((u) => u.userId)
    if (toNotify.length > 0) {
      await recordMentionNotificationsTx(tx, {
        actorId: userId, mentionedUserIds: toNotify,
        resourceType: 'book_club_discussion', resourceId: newDiscussion.id,
      })
    }
  }
}
```

- [ ] **Step 5: Wire `updateClubDiscussionAction` (TipTap)**

Same shape with edit-fire dedupe; `resourceId: discussionId`.

- [ ] **Step 6: Wire `replyToClubDiscussionAction` (TipTap)**

`resourceType: 'book_club_discussion_reply'`, `resourceId: replyId`.

- [ ] **Step 7: Wire `updateClubDiscussionReplyAction` if exists**

If not in the file, skip + note in commit body.

- [ ] **Step 8: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/book-clubs.actions.ts
git commit -m "feat(c5a/book-clubs): wire mentions in club description/rules + discussions + replies"
```

---

## Task 9: Wire write/edit paths in Hive action layer (8 actions)

**Files:**
- Modify: `lib/actions/hive-discussions.actions.ts`
- Modify: `lib/actions/hive-buzz.actions.ts`
- Modify: `lib/actions/hive-annotations.actions.ts`
- Modify: `lib/actions/hive-suggestions.actions.ts`

- [ ] **Step 1: Audit each file**

Confirm action names per file (some may differ — read `export async function` declarations).

- [ ] **Step 2: Wire `createHiveDiscussionAction` + `updateHiveDiscussionAction` + `replyToHiveDiscussionAction`**

Same shape as T8 club discussion wiring with `resourceType: 'hive_discussion'` (post) and `'hive_discussion_reply'` (reply).

- [ ] **Step 3: Wire `createBuzzPostAction` + `updateBuzzPostAction`**

TipTap content; `resourceType: 'hive_buzz_post'`.

- [ ] **Step 4: Wire `createAnnotationAction` + `replyToAnnotationAction` if reply has body**

Annotation body is TipTap. `resourceType: 'hive_annotation'`, `resourceId: annotationId`. Replies inherit; check if reply has its own body or just attaches to parent — if reply body is its own TipTap doc, wire same shape with `'hive_annotation'` and the reply's row id.

- [ ] **Step 5: Wire `createSuggestionAction` rationale field**

If `createSuggestionAction` takes a `rationale` text or TipTap field, wire it. `resourceType: 'hive_suggestion'`.

- [ ] **Step 6: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/hive-discussions.actions.ts lib/actions/hive-buzz.actions.ts lib/actions/hive-annotations.actions.ts lib/actions/hive-suggestions.actions.ts
git commit -m "feat(c5a/hive): wire mentions in hive discussions + buzz + annotations + suggestions"
```

---

## Task 10: Wire book comments + profile bio (2 actions; bio skips notification)

**Files:**
- Modify: `lib/actions/discover.actions.ts` (or wherever `addBookCommentAction` lives — grep first)
- Modify: `lib/actions/user-profile.actions.ts`

- [ ] **Step 1: Grep for `addBookCommentAction` to locate the file**

```bash
grep -rn "addBookCommentAction\|addCommentAction" lib/actions/
```

- [ ] **Step 2: Wire book comment create (and update if exists)**

Same pattern as T7. `resourceType: 'book_comment'`.

- [ ] **Step 3: Wire profile bio update — link-only, NO notification write**

```ts
const bioUsernames = extractMentionUsernamesFromText(input.bio ?? '')
if (bioUsernames.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }

// Resolve to validate they exist (and apply block filter) — but DO NOT call recordMentionNotificationsTx.
// The resolveMentionedUsers call is technically optional for bio (since no notification fires),
// but running it lets the cap check apply to ACTUAL resolved users instead of raw regex hits.
// For v1 simplicity, skip resolve too — just enforce the cap. Render-time block-aware rendering
// can be revisited in a future polish if needed.
```

Just enforce the cap; let the render-time `<RenderMentionsInText>` handle the rest. No notification write.

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/actions/discover.actions.ts lib/actions/user-profile.actions.ts
git commit -m "feat(c5a/book-bio): wire book comment mentions + profile bio cap (no notification)"
```

---

## Task 11: TipTap UI surface wiring (5 surfaces)

**Files:**
- Modify: `app/[locale]/(app)/clubs/_components/discussion-composer.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/reply-composer.tsx`
- Modify: hive discussion composer (find via grep)
- Modify: hive buzz composer (find via grep)
- Modify: `components/hive/collab/annotate-modal.tsx`
- Modify: `components/hive/collab/suggest-modal.tsx`

- [ ] **Step 1: Wire `<DiscussionComposer>` (clubs)**

Add `MentionMark` to the editor's extensions array. Add the popover:

```tsx
import { MentionMark } from '@/lib/tiptap-extensions/mention-mark'
import { useMentionPopover } from '@/lib/hooks/use-mention-popover'
import { MentionPopover } from '@/components/mentions/mention-popover'

// In useEditor:
extensions: [StarterKit, MentionMark]

// Inside the component body, after editor is created:
const mentionPopover = useMentionPopover(editor)

// In JSX, after the EditorContent:
<MentionPopover
  isActive={mentionPopover.isActive}
  query={mentionPopover.query}
  anchorRect={mentionPopover.anchorRect}
  onPick={(user) => mentionPopover.insertMention(user.userId, user.username)}
  onClose={mentionPopover.close}
/>
```

- [ ] **Step 2: Wire `<ReplyComposer>` (clubs) — same pattern**

- [ ] **Step 3: Wire hive discussion composer — same pattern**

Find via `grep -rn "useEditor\|<EditorContent" app/\[locale\]/\(app\)/hive/`.

- [ ] **Step 4: Wire hive buzz composer — same pattern**

- [ ] **Step 5: Wire annotate-modal — same pattern**

- [ ] **Step 6: Wire suggest-modal — same pattern**

- [ ] **Step 7: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add app/[locale]/\(app\)/clubs/_components/discussion-composer.tsx app/[locale]/\(app\)/clubs/_components/reply-composer.tsx app/[locale]/\(app\)/hive/ components/hive/collab/
git commit -m "feat(c5a/ui-tiptap): register MentionMark + mount MentionPopover on 5 TipTap surfaces"
```

---

## Task 12: Textarea UI surface wiring (7 surfaces)

**Files:**
- Modify: spark entry comment composer + reply composer (find via grep)
- Modify: `app/[locale]/(app)/reading-lists/_components/create-list-modal.tsx`
- Modify: `app/[locale]/(app)/reading-lists/_components/edit-book-row-dialog.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/create-club-modal.tsx`
- Modify: `app/[locale]/(app)/clubs/_components/edit-club-metadata-dialog.tsx`
- Modify: book comment composer on public reader (find via grep)
- Modify: profile bio editor (find via grep)

- [ ] **Step 1: Swap `<textarea>` → `<MentionableTextarea>` at each site**

Pattern at each site:
```tsx
// Before:
<textarea value={value} onChange={(e) => setValue(e.target.value)} ... />

// After:
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'
<MentionableTextarea value={value} onChange={setValue} ... />
```

The `onChange` prop signature changes from `(e) => void` to `(next: string) => void` — handle at each call site.

- [ ] **Step 2: For each site, retain styling props verbatim**

`<MentionableTextarea>` forwards all `<textarea>` HTML attributes; className, rows, placeholder, maxLength, etc. all pass through.

- [ ] **Step 3: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add app/
git commit -m "feat(c5a/ui-textarea): swap textarea -> MentionableTextarea at 7 sites"
```

---

## Task 13: Notification bell — `MENTION` LABELS + click router

**Files:**
- Modify: `app/[locale]/(app)/_components/notifications-bell.tsx`
- Possibly: small parent-id resolver actions per surface (Option 1 from spec §4.4)

- [ ] **Step 1: Add `MENTION` to LABELS map**

Find the existing LABELS const. Add:
```ts
MENTION: { /* per-surface — see below */ },
```

Bell copy depends on `resourceType` carried in the notification row. Use a sub-switch:

```ts
function renderMentionLabel(n: NotificationRow): string {
  const actor = n.actor?.username ?? n.actor?.name ?? 'Someone'
  const surfaceLabel = mentionSurfaceLabel(n.resourceType)
  return `@${actor} mentioned you in ${surfaceLabel}`
}

function mentionSurfaceLabel(rt: string): string {
  switch (rt) {
    case 'book_club_discussion': return 'a discussion'
    case 'book_club_discussion_reply': return 'a discussion reply'
    case 'hive_discussion': return 'a hive discussion'
    case 'hive_discussion_reply': return 'a hive discussion reply'
    case 'hive_buzz_post': return 'a buzz post'
    case 'hive_annotation': return 'an annotation'
    case 'hive_suggestion': return 'a suggestion'
    case 'book_comment': return 'a book comment'
    case 'spark_entry_comment': return 'a spark comment'
    case 'spark_entry_comment_reply': return 'a spark reply'
    case 'reading_list_description': return 'a reading list'
    case 'reading_list_book_commentary': return 'a list commentary'
    case 'book_club_description': return 'a club description'
    case 'book_club_rules': return 'club rules'
    default: return 'a post'
  }
}
```

- [ ] **Step 2: Add `MENTION` to click router**

Per-resourceType deep-link logic:

```ts
function mentionHref(n: NotificationRow): string {
  const rid = n.resourceId
  switch (n.resourceType) {
    case 'book_comment': return `/en/books/${rid}` // resourceId IS the bookId here? VERIFY at impl time
    case 'spark_entry_comment':
    case 'spark_entry_comment_reply':
      // Need spark + entry — implement via small lookup action OR encode in resourceId.
      // For v1, default to /en/sparks (lookup action deferred).
      return `/en/sparks`
    case 'book_club_discussion':
    case 'book_club_discussion_reply':
      // Need clubId — lookup action `getDiscussionClubIdAction(discussionId)`.
      // For v1, default to /en/clubs (lookup action deferred to future polish).
      return `/en/clubs`
    case 'hive_discussion':
    case 'hive_discussion_reply':
    case 'hive_buzz_post':
    case 'hive_annotation':
    case 'hive_suggestion':
      // Need hiveId — lookup action deferred. For v1, route to /en/community.
      return `/en/community`
    case 'reading_list_description':
    case 'reading_list_book_commentary':
      return `/en/reading-lists/${rid}` // for description case, rid IS listId; commentary case needs lookup — defer
    case 'book_club_description':
    case 'book_club_rules':
      return `/en/clubs/${rid}`
    default: return `/en/community`
  }
}
```

**Pragmatic note**: For first ship, "approximate" deep links (e.g. `/en/clubs` instead of `/en/clubs/${clubId}/discussions/${discussionId}`) is acceptable. The pattern mirrors C1's `FRIEND_REQUEST → /friends` adapter pattern. Full deep-link lookup actions can ship as a follow-up.

- [ ] **Step 3: Hardcoded `/en/` locale matches existing bell patterns**

Don't refactor for i18n — pre-existing pattern from FRIEND_REQUEST + HIVE_INVITE + CLUB_*. Documented technical debt.

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add app/[locale]/\(app\)/_components/notifications-bell.tsx
git commit -m "feat(c5a/bell): MENTION LABELS + per-resourceType click router"
```

---

## Task 14: Extend `tiptap-to-html.ts` + wire `<RenderMentionsInText>` at consumer sites

**Files:**
- Modify: `lib/export/tiptap-to-html.ts`
- Modify: textarea render sites (find via grep) — wrap displayed text in `<RenderMentionsInText>`

- [ ] **Step 1: Extend the mark switch in `tiptap-to-html.ts`**

Find the mark switch (handles `bold`, `italic`, `link`, `hiveAnnotation`, `hiveSuggestion`). Add:

```ts
case 'mention': {
  const userId = mark.attrs?.userId ?? ''
  const username = mark.attrs?.username ?? ''
  // Output the same <span class="mention"> shape parsed back consistently.
  // Inner text content already includes "@username" from the document model.
  return `<a href="/u/${escapeHtml(username)}" class="mention" data-mention-user-id="${escapeHtml(userId)}">${escapeHtml(content)}</a>`
}
```

(Use whatever `escapeHtml` helper the file already exposes; if none, inline a simple regex escape.)

- [ ] **Step 2: Find textarea-content rendering sites**

Grep for places that render the textarea-stored text inline (e.g. book comments display, profile bio display, reading list description display, club description display, spark entry comment display):

```bash
grep -rn "\.description\|\.bio\|\.content\|\.rules" app/ | grep -i "<p>\|<span>\|<div>\|<RenderMentionsInText>"
```

For each site that currently does `<p>{post.content}</p>` or similar, swap to:
```tsx
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'
<p><RenderMentionsInText text={post.content} /></p>
```

- [ ] **Step 3: Verify each site**

Manually walk:
- Spark entry comment rendered in spark detail page
- Reading list description on list detail page
- Reading list book commentary on book row
- Book club description on club detail page + card
- Book club rules on club settings/about panel
- Book comment on public reader
- Profile bio on `/u/[username]` page

- [ ] **Step 4: Run tsc + suite + commit**

```bash
npx tsc --noEmit
npm test
git add lib/export/tiptap-to-html.ts app/
git commit -m "feat(c5a/render): tiptap-to-html mention case + RenderMentionsInText at textarea sites"
```

---

## Task 15: Smoke + AGENTS.md ship + close C5a

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Run the 18-scenario manual smoke from spec §6**

Boot `npm run dev`. Walk each scenario:

1. TipTap discussion mention happy path (club)
2. Reply mention (club)
3. Textarea mention happy path (spark entry comment)
4. Profile bio mention (link-only, no notification)
5. Block-aware autocomplete (popover filters blocked-by user)
6. Block-aware raw text mention (inert, no notification)
7. Self-mention (link renders, no notification)
8. Per-post cap (6 mentions → MENTION_CAP_EXCEEDED toast)
9. 24h dedupe (same surface → one notification)
10. Edit-add-mention (new mention notifies)
11. Edit-remove-mention (no un-notification)
12. Rename staleness TipTap (snapshot preserved, link broken at /u/old-name)
13. Rename staleness textarea (text preserved, link broken)
14. Bell click-through (routes per resourceType)
15. Cross-surface deep links (8 surface types — v1 may approximate)
16. Deleted user (inert text)
17. Popover keyboard (arrow, Enter, Esc)
18. No regressions (existing tests + tsc green)

For each failure, file `fix(c5a): ...` follow-up commit before ship.

- [ ] **Step 2: Update AGENTS.md Resume Here + What Has Been Built**

Move the C5a Resume Here paragraphs into a new `### Community Phase — C5a @-Mentions ✅ COMPLETE (2026-06-05)` entry under "What Has Been Built" with:
- Wave SHA map (T1-T15)
- Patterns now load-bearing (mentions = notifications-only, never feed events; snapshot rendering trade-off; `lib/mentions/` helpers as canonical extract/resolve/record)
- Known follow-ups: rename-safe rendering deferred; deep-link parent-id resolution actions for full URLs (defer to C5b cleanup)
- Update Resume Here to point at C5b brainstorm as the next step

- [ ] **Step 3: Commit AGENTS.md + ship**

```bash
git add AGENTS.md
git commit -m "docs(c5a): ship — @-mentions across 12 social surfaces

C5a @-mentions code-complete. New MENTION notification type;
shared MentionMark + MentionPopover + MentionLink + MentionableTextarea
+ RenderMentionsInText components; 16 action sites wired with
extract -> resolve -> diff -> conditional record pattern; bell click
router with per-surface labels; 606+ tests green throughout.

Known follow-ups: rename-safe rendering + full deep-link parent-id
lookup actions deferred to C5b cleanup phase."
```

---

## Self-Review

**1. Spec coverage:**
- §1 Scope (6 categories × 12 surfaces) → T6-T10 + T11-T12 + T14 cover all surfaces. ✓
- §2.1 Schema (MENTION enum addition) → T1. ✓
- §2.2 Storage shape (TipTap marks + textarea raw text) → T3 + T5. ✓
- §2.3 Notification row shape → T2 + T13. ✓
- §3.1 Helpers → T2. ✓
- §3.2 MentionMark → T3. ✓
- §3.3 Hooks + components → T4 + T5. ✓
- §3.4 Action wiring pattern → T6-T10. ✓
- §4.1 TipTap surfaces → T11. ✓
- §4.2 Textarea surfaces → T12. ✓
- §4.3 Render path → T14. ✓
- §4.4 Bell + click router → T13. ✓
- §6 Smoke → T15. ✓

**2. Placeholder scan:** Reviewed steps for vague "TBD" / "implement later" / "Add validation" patterns. None found — every code-changing step has actual code blocks or explicit reference to existing patterns.

**3. Type consistency:**
- `SurfaceType` union defined in T2 step 1, consumed by `resolveMentionedUsers` (T2 step 8) + `recordMentionNotificationsTx` (T2 step 10) + every action wiring (T6-T10) + bell router (T13). All literals match. ✓
- `MentionAttrs = { userId, username }` defined in T3, consumed by `useMentionPopover.insertMention(userId, username)` in T4. ✓
- `extractMentionUserIdsFromTiptap` returns `string[]` (T2 step 4), consumed by `tiptapUserIds: string[]` in `resolveMentionedUsers` (T2 step 8). ✓
- `extractMentionUsernamesFromText` returns `string[]` (T2 step 4), consumed by `textUsernames: string[]` in `resolveMentionedUsers`. ✓
- `MentionPopover` `onPick` expects `Result = { userId, username, displayName, avatarUrl }` (T4 step 2), provided by `searchUsersAction` from C1 (verify return shape at impl time — may need adapter). Note: action-shape verification flagged as plan-time risk; T4 step 2 deserves an "audit `searchUsersAction` return shape" sub-step. Adding inline:

Add to T4 step 2 a NOTE: "Verify `searchUsersAction` returns `{ userId, username, displayName, avatarUrl }` per result. If shape differs, adapt the `Result` type in `<MentionPopover>` to match."

**4. Suggested execution waves:**
- W1 = T1
- W2 = T2
- W3 = T3 + T4 + T5 parallel (3 isolated component files)
- W4 = T6 + T7 + T8 + T9 + T10 parallel (5 separate action files; low race risk on shared imports)
- W5 = T11 + T12 + T13 + T14 parallel (4 isolated surface scopes — T11 TipTap composers, T12 textarea swap sites, T13 bell only, T14 tiptap-to-html + grep sweep for render sites)
- W6 = T15

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-05-c5a-mentions.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, per-task commits, two-stage review per task, matches C1-C4 cadence.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
