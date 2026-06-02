# Public Book Reader Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the public book overview page at `/[locale]/books/[bookId]` to display book metadata richly on a `#262728`-bg, centered, stacked-section layout that matches the iOS-inspired design system — and switch the read-tracking model to a true per-chapter manual checkbox backed by a new `chapter_reads` table.

**Architecture:** Centered `max-w-5xl` server component orchestrates new colocated client components: `<BookHero>` · sticky `<BookTabStrip>` · `<ChaptersPanel>` · `<CommentsPanel>` · `<AboutSection>` · existing `<SeriesFooter>` (restyled). A `<ShareBookDialog>` (shadcn Dialog) handles copy-link with a privacy note. A new `chapter_reads` join table records per-chapter reads; `readingProgress` is preserved unchanged as the "Continue Reading" cursor.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · shadcn/ui Dialog · Drizzle ORM on Neon Postgres · sonner (already mounted) · lucide-react icons · vitest for unit tests.

**Spec:** [docs/superpowers/specs/2026-06-02-public-book-reader-page-redesign-design.md](../specs/2026-06-02-public-book-reader-page-redesign-design.md)

**Working agreement:** Per Chris's preferences in AGENTS.md — commits land straight to `main`, per-task verification (no batching), subagent-driven execution preserves context. After each commit run `npx tsc --noEmit` and `npm test` before marking the task done.

---

## File Map

**New files (under `app/[locale]/(public)/books/_components/`):**
- `book-hero.tsx` (client)
- `book-tab-strip.tsx` (client)
- `chapters-panel.tsx` (client)
- `comments-panel.tsx` (client) — *new colocated copy; the legacy one at `(public)/_components/comments-panel.tsx` gets retired in T12*
- `about-section.tsx` (server)
- `share-book-dialog.tsx` (client)

**Modified existing:**
- `app/[locale]/(public)/books/[bookId]/page.tsx` — full rewrite of the orchestrator
- `app/[locale]/(public)/books/_components/access-denied.tsx` — chrome refresh
- `app/[locale]/(public)/_components/series-footer.tsx` — chrome refresh
- `lib/actions/reading.actions.ts` — reshape `markChapterReadAction` + `getReadingProgressAction`; add `unmarkChapterReadAction`
- `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx` — pass `binderItemId` instead of `chapterId` to the reshaped `markChapterReadAction`
- `db/schema/social.ts` — new `chapterReads` table export
- `scripts/migrate-reader-redesign.ts` — new idempotent migration runner (T1)

**Likely deleted (T12 audit):**
- `app/[locale]/(public)/_components/chapter-list.tsx`
- `app/[locale]/(public)/_components/comments-panel.tsx`
- `app/[locale]/(public)/_components/social-actions.tsx`

---

## Task 1: Add `chapter_reads` table + migration

**Files:**
- Modify: `db/schema/social.ts`
- Create: `scripts/migrate-reader-redesign.ts`

- [ ] **Step 1: Add the `chapterReads` table to the Drizzle schema**

In `db/schema/social.ts`, immediately after the `readingProgress` table definition (around line 61), add:

```ts
export const chapterReads = pgTable('chapter_reads', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  chapterBinderItemId: text('chapter_binder_item_id').notNull().references(() => binderItems.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.chapterBinderItemId] }),
  index('chapter_reads_user_book_idx').on(t.userId, t.bookId),
])
```

If `index` is not already imported at the top of the file, add it to the existing `drizzle-orm/pg-core` import. If `binderItems` is not imported, add `import { binderItems } from './books'` (or wherever it's defined — check the existing `chapters` import at the top of this file for the correct path; in this codebase, `binderItems` lives in `db/schema/books.ts`).

- [ ] **Step 2: Write the idempotent migration runner**

Create `scripts/migrate-reader-redesign.ts`. Use the same shape as `scripts/migrate-h4.ts` for reference (`tsx` shebang-runnable script that runs raw SQL through Drizzle's `db.execute(sql\`...\`)`):

```ts
import 'dotenv/config'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('Migrate: reader page redesign')

  // chapter_reads table (idempotent)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chapter_reads (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_binder_item_id text NOT NULL REFERENCES binder_items(id) ON DELETE CASCADE,
      read_at timestamp DEFAULT now() NOT NULL,
      PRIMARY KEY (user_id, chapter_binder_item_id)
    )
  `)
  console.log('  ✓ chapter_reads table')

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chapter_reads_user_book_idx
    ON chapter_reads (user_id, book_id)
  `)
  console.log('  ✓ chapter_reads_user_book_idx')

  console.log('Migration complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Run the migration on the dev DB**

```bash
npx tsx scripts/migrate-reader-redesign.ts
```

Expected output:
```
Migrate: reader page redesign
  ✓ chapter_reads table
  ✓ chapter_reads_user_book_idx
Migration complete.
```

- [ ] **Step 4: Verify the migration is idempotent**

Re-run the same command. Expected: identical output, no errors (the `IF NOT EXISTS` guards make it safe).

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add db/schema/social.ts scripts/migrate-reader-redesign.ts
git commit -m "$(cat <<'EOF'
feat(reader): add chapter_reads table for true manual mark-as-read

New additive table chapter_reads (user_id + chapter_binder_item_id
composite PK + denorm book_id with index + read_at timestamp). Migration
runner is idempotent via IF NOT EXISTS. readingProgress table is NOT
touched; it continues to drive lastChapterId for "Continue Reading"
and the auto-mark behavior on /read/[chapterId].

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Reshape reading actions to use `chapter_reads`

**Files:**
- Modify: `lib/actions/reading.actions.ts`
- Modify: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx`
- Create: `lib/actions/__tests__/reading-actions.test.ts`

The existing `markChapterReadAction` takes `chapterId` (the `chapters.id` PK). Reshape it to take `chapterBinderItemId` (the `binderItems.id` PK) so the API matches how reads are tracked everywhere else in the app. Internally it resolves `chapter_id` for the `readingProgress` upsert. Also add `unmarkChapterReadAction` and reshape `getReadingProgressAction` to read from `chapter_reads`.

- [ ] **Step 1: Write failing tests**

Create `lib/actions/__tests__/reading-actions.test.ts`. Tests focus on the gating + return-shape contract; DB-level integration is exercised by manual smoke. Use the codebase's existing test pattern — most action tests in this repo are pure-unit tests of pure helpers; DB-touching actions are typically covered by manual smoke. Since the new logic is mostly DB plumbing, the unit-testable surface is small. Write three tests that cover the orientation we care about:

```ts
import { describe, it, expect } from 'vitest'

describe('reading actions surface', () => {
  it('exports markChapterReadAction, unmarkChapterReadAction, getReadingProgressAction', async () => {
    const mod = await import('@/lib/actions/reading.actions')
    expect(typeof mod.markChapterReadAction).toBe('function')
    expect(typeof mod.unmarkChapterReadAction).toBe('function')
    expect(typeof mod.getReadingProgressAction).toBe('function')
  })

  it('markChapterReadAction is async and takes (bookId, chapterBinderItemId)', async () => {
    const mod = await import('@/lib/actions/reading.actions')
    expect(mod.markChapterReadAction.length).toBe(2)
  })

  it('unmarkChapterReadAction is async and takes (bookId, chapterBinderItemId)', async () => {
    const mod = await import('@/lib/actions/reading.actions')
    expect(mod.unmarkChapterReadAction.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- lib/actions/__tests__/reading-actions.test.ts
```

Expected: third test fails with `mod.unmarkChapterReadAction is not a function` (the first two pass against the existing module).

- [ ] **Step 3: Reshape `lib/actions/reading.actions.ts`**

Replace the entire file with:

```ts
'use server'

import { db } from '@/db'
import { readingProgress, chapterReads, binderItems, chapters } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import type { ActionResult } from './book.actions'

export type ReadingProgressResult = {
  lastChapterId: string | null
  readChapterBinderItemIds: string[]
}

export async function markChapterReadAction(
  bookId: string,
  chapterBinderItemId: string
): Promise<ActionResult<void>> {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  // Resolve chapters.id for the readingProgress cursor upsert.
  const [chapterRow] = await db
    .select({ chapterId: chapters.id })
    .from(chapters)
    .where(eq(chapters.binderItemId, chapterBinderItemId))
    .limit(1)

  const now = new Date()

  // Idempotent insert into the read set.
  await db
    .insert(chapterReads)
    .values({ userId, bookId, chapterBinderItemId, readAt: now })
    .onConflictDoNothing({ target: [chapterReads.userId, chapterReads.chapterBinderItemId] })

  // Cursor upsert is preserved so "Continue Reading" and the auto-mark from
  // /read/[chapterId] keep working uninterrupted.
  if (chapterRow?.chapterId) {
    await db
      .insert(readingProgress)
      .values({ userId, bookId, chapterId: chapterRow.chapterId, lastOpenedAt: now })
      .onConflictDoUpdate({
        target: [readingProgress.userId, readingProgress.bookId],
        set: { chapterId: chapterRow.chapterId, lastOpenedAt: now },
      })
  }

  return { success: true, data: undefined }
}

export async function unmarkChapterReadAction(
  bookId: string,
  chapterBinderItemId: string
): Promise<ActionResult<void>> {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  await db
    .delete(chapterReads)
    .where(
      and(
        eq(chapterReads.userId, userId),
        eq(chapterReads.chapterBinderItemId, chapterBinderItemId)
      )
    )

  // Deliberately do NOT touch readingProgress — the cursor is a separate
  // concern from the read set, and unmarking a chapter shouldn't reset
  // "Continue Reading".
  return { success: true, data: undefined }
}

export async function getReadingProgressAction(
  bookId: string
): Promise<ActionResult<ReadingProgressResult>> {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  const [progress] = await db
    .select({ chapterId: readingProgress.chapterId })
    .from(readingProgress)
    .where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, bookId)))
    .limit(1)

  const reads = await db
    .select({ chapterBinderItemId: chapterReads.chapterBinderItemId })
    .from(chapterReads)
    .where(and(eq(chapterReads.userId, userId), eq(chapterReads.bookId, bookId)))

  return {
    success: true,
    data: {
      lastChapterId: progress?.chapterId ?? null,
      readChapterBinderItemIds: reads.map((r) => r.chapterBinderItemId),
    },
  }
}
```

- [ ] **Step 4: Update the auto-mark call site in the chapter reader**

In `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx`, find the line:

```ts
await markChapterReadAction(bookId, chapterId)
```

Replace it with:

```ts
await markChapterReadAction(bookId, chapter.binderItemId)
```

The `chapter` row (loaded a few lines above) already has `binderItemId` available; if it's not in the existing SELECT, add `binderItemId: chapters.binderItemId` to the projection of the chapter fetch.

- [ ] **Step 5: Run tests + typecheck**

```bash
npm test -- lib/actions/__tests__/reading-actions.test.ts
npx tsc --noEmit
```

Expected: all three new tests pass; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/reading.actions.ts lib/actions/__tests__/reading-actions.test.ts app/[locale]/\(public\)/books/[bookId]/read/[chapterId]/page.tsx
git commit -m "$(cat <<'EOF'
feat(reader): reshape mark/unmark/get reading actions for chapter_reads

markChapterReadAction now takes chapterBinderItemId (was chapterId) and
inserts into chapter_reads (idempotent ON CONFLICT DO NOTHING). It also
still upserts readingProgress.chapterId so "Continue Reading" and the
auto-mark from /read/[chapterId] keep their existing behavior.

New unmarkChapterReadAction deletes from chapter_reads only — the
readingProgress cursor is intentionally left alone since the read set
and the "last visited" cursor are separate concerns.

getReadingProgressAction's return shape is unchanged; the
readChapterBinderItemIds list now comes from chapter_reads (true
per-chapter set), replacing the prior at-or-before-cursor derivation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Build `<ShareBookDialog>` (shadcn Dialog with copy-link)

**Files:**
- Create: `app/[locale]/(public)/books/_components/share-book-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Lock, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { ReactNode } from 'react'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  url: string
  visibility: Visibility
  trigger: ReactNode
}

export function ShareBookDialog({ url, visibility, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const privacyNote =
    visibility === 'PRIVATE'
      ? { Icon: Lock, text: 'Only people you invite can open this link.' }
      : visibility === 'FRIENDS'
      ? { Icon: Users, text: 'Only your friends can open this link.' }
      : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this book</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share URL"
            className="flex-1 min-w-0 rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] px-3 py-2 text-sm text-[var(--canvas-dark-ink)] outline-none"
            style={{ boxShadow: 'var(--sh-inset)' }}
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-[var(--r-btn)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
            aria-live="polite"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        {privacyNote && (
          <p className="mt-2 flex items-center gap-2 text-xs text-[var(--canvas-dark-ink-muted)]">
            <privacyNote.Icon className="h-3.5 w-3.5" />
            {privacyNote.text}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/share-book-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(reader): add ShareBookDialog with copy-link + privacy note

shadcn Dialog wrapper. Copy button uses navigator.clipboard, flips label
to 'Copied ✓' for 2s, fires a sonner toast. Privacy note appears below
the URL for FRIENDS or PRIVATE books explaining who can open the link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build `<BookHero>`

**Files:**
- Create: `app/[locale]/(public)/books/_components/book-hero.tsx`

The hero is the most data-dense surface. It owns optimistic state for Favorite + Bookmark, takes the read-set count as a prop (so it can show `Chapters X / Y read`), exposes a `read-set-change` callback so the page-level wrapper in T11 can keep `<ChaptersPanel>` and `<BookHero>` in sync, and renders the `<ShareBookDialog>` trigger.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Globe, Lock, Users, Heart, Bookmark, Share2, BookOpen, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { toggleBookLikeAction, toggleBookmarkAction } from '@/lib/actions/social.actions'
import type { PublicBook } from '@/lib/actions/discover.actions'
import { ShareBookDialog } from './share-book-dialog'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  book: PublicBook & { visibility: Visibility; commentCount: number }
  locale: string
  shareUrl: string
  isAuthor: boolean
  isAuthenticated: boolean
  startReadingHref: string | null
  continueReadingHref: string | null
  totalChapters: number
  readCount: number
  initialLiked: boolean
  initialBookmarked: boolean
  initialLikeCount: number
}

function formatWordCount(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

const VISIBILITY_META: Record<Visibility, { Icon: typeof Globe; label: string }> = {
  PUBLIC: { Icon: Globe, label: 'Public' },
  FRIENDS: { Icon: Users, label: 'Friends' },
  PRIVATE: { Icon: Lock, label: 'Private' },
}

export function BookHero({
  book,
  locale,
  shareUrl,
  isAuthor,
  isAuthenticated,
  startReadingHref,
  continueReadingHref,
  totalChapters,
  readCount,
  initialLiked,
  initialBookmarked,
  initialLikeCount,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [, startTransition] = useTransition()

  const handleLike = () => {
    if (!isAuthenticated) {
      toast.info('Sign in to favorite this book')
      return
    }
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = await toggleBookLikeAction(book.id)
      if (!result.success) {
        setLiked(!next)
        setLikeCount((c) => c + (next ? -1 : 1))
        toast.error('Could not update favorite')
      }
    })
  }

  const handleBookmark = () => {
    if (!isAuthenticated) {
      toast.info('Sign in to bookmark this book')
      return
    }
    const next = !bookmarked
    setBookmarked(next)
    startTransition(async () => {
      const result = await toggleBookmarkAction(book.id)
      if (!result.success) {
        setBookmarked(!next)
        toast.error('Could not update bookmark')
      }
    })
  }

  const Visibility = VISIBILITY_META[book.visibility]
  const readCta = continueReadingHref ?? startReadingHref
  const readCtaLabel = continueReadingHref ? 'Continue Reading →' : 'Start Reading →'

  const stats = [
    {
      label: 'Chapters',
      value: isAuthenticated && totalChapters > 0 ? `${readCount} / ${totalChapters}` : String(totalChapters),
    },
    { label: 'Words', value: formatWordCount(book.wordCount) },
    { label: 'Likes', value: String(likeCount) },
    { label: 'Comments', value: String(book.commentCount) },
  ]

  return (
    <section
      className="rounded-[var(--r-card)] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="grid gap-6 sm:[grid-template-columns:200px_1fr]">
        <div className="aspect-[2/3] w-[200px] overflow-hidden rounded-[var(--r-card)]" style={{ boxShadow: 'var(--sh-card)' }}>
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[var(--canvas-dark-350)] to-[var(--canvas-dark-200)]" />
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <h1 className="font-comfortaa text-[28px] font-bold leading-tight text-[var(--brand)]">{book.title}</h1>

          <div className="flex items-center gap-2">
            {book.authorAvatarUrl ? (
              <img src={book.authorAvatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-[var(--canvas-dark-300)]" />
            )}
            <span className="text-sm text-[var(--canvas-dark-ink-muted)]">by</span>
            <Link
              href={`/${locale}/u/${book.authorUsername}`}
              className="text-sm text-[var(--canvas-dark-ink-strong)] hover:underline"
            >
              {book.authorDisplayName ?? `@${book.authorUsername}`}
            </Link>
          </div>

          {book.seriesName && (
            <div className="text-[11px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] font-mono">
              {book.seriesNumber !== null ? (
                <>Book {book.seriesNumber} of <span className="italic">{book.seriesName}</span></>
              ) : (
                <>Part of <span className="italic">{book.seriesName}</span></>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {book.genre && (
              <span className="rounded-[var(--r-pill)] bg-[var(--canvas-dark-300)] px-3 py-1 text-xs text-[var(--canvas-dark-ink)]">
                {book.genre}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] bg-[var(--canvas-dark-300)] px-3 py-1 text-xs text-[var(--canvas-dark-ink)]">
              <Visibility.Icon className="h-3 w-3" />
              {Visibility.label}
            </span>
            {book.tags?.slice(0, 5).map((tag) => (
              <span key={tag} className="rounded-[var(--r-pill)] bg-[var(--canvas-dark-300)] px-3 py-1 text-xs text-[var(--canvas-dark-ink-muted)]">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-5">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-wide text-[var(--canvas-dark-ink-muted)]">{s.label}</p>
                <p className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)]">{s.value}</p>
              </div>
            ))}
          </div>

          {book.synopsis && (
            <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-[var(--canvas-dark-ink)]">
              {book.synopsis}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {readCta && (
              <Link
                href={readCta}
                className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
              >
                <BookOpen className="h-4 w-4" />
                {readCtaLabel}
              </Link>
            )}
            <button
              onClick={handleLike}
              aria-pressed={liked}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] px-4 py-2 text-sm text-[var(--canvas-dark-ink)]"
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
              }}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-current text-[var(--brand)]' : ''}`} />
              {liked ? 'Favorited' : 'Favorite'}
            </button>
            <ShareBookDialog
              url={shareUrl}
              visibility={book.visibility}
              trigger={
                <button
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] px-4 py-2 text-sm text-[var(--canvas-dark-ink)]"
                  style={{
                    background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                    boxShadow: 'var(--sh-tile)',
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              }
            />
            <button
              onClick={handleBookmark}
              aria-pressed={bookmarked}
              className="inline-flex items-center gap-1.5 rounded-[var(--r-btn)] px-4 py-2 text-sm text-[var(--canvas-dark-ink)]"
              style={{
                background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                boxShadow: 'var(--sh-tile)',
              }}
            >
              <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current text-[var(--brand)]' : ''}`} />
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
            {isAuthor && (
              <Link
                href={`/${locale}/studio/${book.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit in studio →
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. (If `PublicBook` doesn't expose `visibility` or `commentCount` yet, T11 will add them to the page-level projection before passing them in — the type widening here via `& { visibility, commentCount }` covers the gap.)

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/book-hero.tsx
git commit -m "$(cat <<'EOF'
feat(reader): add BookHero with rich cover + metadata + CTA row

Cover-left 200px / metadata-right grid: title (Comfortaa brand-yellow) +
author link + series line + genre/privacy/tags pills + 4-stat row
(Chapters X/Y read · Words · Likes · Comments) + line-clamp-3 synopsis +
CTA row (Start/Continue Reading brand pill + Favorite + Share with
ShareBookDialog + Bookmark + Edit in studio author-only).

Favorite + Bookmark are optimistic with rollback. Guests see the
buttons but a click prompts sign-in via sonner toast.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Build `<BookTabStrip>` (sticky scroll-spy)

**Files:**
- Create: `app/[locale]/(public)/books/_components/book-tab-strip.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'

const TABS = [
  { id: 'chapters', label: 'Chapters' },
  { id: 'comments', label: 'Comments' },
  { id: 'about', label: 'About' },
] as const

type TabId = (typeof TABS)[number]['id']

export function BookTabStrip() {
  const [activeId, setActiveId] = useState<TabId>('chapters')

  useEffect(() => {
    const sectionEls = TABS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => el !== null
    )
    if (sectionEls.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (top) setActiveId(top.target.id as TabId)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    sectionEls.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleClick = (id: TabId) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      className="sticky top-0 z-10 -mx-2 my-4 flex gap-1 rounded-[var(--r-pill)] px-2 py-1.5 backdrop-blur"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
      aria-label="Book sections"
    >
      {TABS.map((t) => {
        const isActive = activeId === t.id
        return (
          <a
            key={t.id}
            href={`#${t.id}`}
            onClick={handleClick(t.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-[var(--r-pill)] px-4 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-[var(--brand)] font-semibold text-[var(--brand-ink)]'
                : 'text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/book-tab-strip.tsx
git commit -m "$(cat <<'EOF'
feat(reader): add sticky BookTabStrip with IntersectionObserver scroll-spy

Three tabs (Chapters / Comments / About). Sticky top: 0 with the panel
gradient + sh-card backing so content doesn't bleed through. Click
smooth-scrolls to the section. Active tracking via IntersectionObserver
with rootMargin tuned (-80px top, -60% bottom) so the active pill
updates just before a section header crosses the top.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Build `<ChaptersPanel>` with mark-as-read toggle + progress bar

**Files:**
- Create: `app/[locale]/(public)/books/_components/chapters-panel.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Circle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { markChapterReadAction, unmarkChapterReadAction } from '@/lib/actions/reading.actions'
import { isChapterReaderVisible, type ChapterStatus } from '@/lib/books/is-chapter-reader-visible'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  order: number
  status: ChapterStatus
  updatedAt: Date | string
}

type Props = {
  bookId: string
  readerBasePath: string
  chapters: ChapterItem[]
  initialReadSet: string[]
  isAuthor: boolean
  isAuthenticated: boolean
  onReadSetChange?: (next: Set<string>) => void
}

function formatUpdatedLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ChaptersPanel({
  bookId,
  readerBasePath,
  chapters,
  initialReadSet,
  isAuthor,
  isAuthenticated,
  onReadSetChange,
}: Props) {
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set(initialReadSet))
  const [, startTransition] = useTransition()

  const visibleChapters = isAuthor
    ? chapters
    : chapters.filter((c) => isChapterReaderVisible(c.status))

  const totalCount = visibleChapters.length
  const readCount = visibleChapters.filter((c) => readSet.has(c.binderItemId)).length
  const progressPct = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0

  const toggle = (binderItemId: string) => {
    if (!isAuthenticated) {
      toast.info('Sign in to track your progress')
      return
    }
    const next = new Set(readSet)
    const wasRead = next.has(binderItemId)
    if (wasRead) next.delete(binderItemId)
    else next.add(binderItemId)
    setReadSet(next)
    onReadSetChange?.(next)
    startTransition(async () => {
      const result = wasRead
        ? await unmarkChapterReadAction(bookId, binderItemId)
        : await markChapterReadAction(bookId, binderItemId)
      if (!result.success) {
        // rollback
        const rollback = new Set(readSet)
        setReadSet(rollback)
        onReadSetChange?.(rollback)
        toast.error(wasRead ? "Couldn't unmark" : "Couldn't mark as read")
      }
    })
  }

  return (
    <section
      id="chapters"
      className="rounded-[var(--r-card)] p-6 scroll-mt-20"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="mb-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-comfortaa text-lg font-bold text-[var(--brand)]">Chapters</h2>
          {isAuthenticated && totalCount > 0 && (
            <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
              {readCount} / {totalCount} read
            </span>
          )}
        </div>
        {isAuthenticated && totalCount > 0 && (
          <div
            className="mt-2 h-1 overflow-hidden rounded-full"
            style={{ background: 'var(--canvas-dark-100)', boxShadow: 'var(--sh-inset)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: 'var(--brand)' }}
            />
          </div>
        )}
      </div>

      {visibleChapters.length === 0 ? (
        <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">No chapters yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {visibleChapters.map((ch, i) => {
            const isRead = readSet.has(ch.binderItemId)
            const isReaderVisible = isAuthor || isChapterReaderVisible(ch.status)
            return (
              <li
                key={ch.chapterId}
                className="flex items-center gap-3 rounded-[var(--r-row)] px-3 py-2.5"
                style={{
                  background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  boxShadow: 'var(--sh-tile)',
                }}
              >
                {isAuthenticated && isReaderVisible ? (
                  <button
                    onClick={() => toggle(ch.binderItemId)}
                    aria-pressed={isRead}
                    aria-label={`Mark "${ch.title}" as ${isRead ? 'unread' : 'read'}`}
                    className="shrink-0"
                  >
                    {isRead ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--brand)]" />
                    ) : (
                      <Circle className="h-5 w-5 text-[var(--canvas-dark-ink-muted)]" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}
                <span className="w-6 shrink-0 text-xs text-[var(--canvas-dark-ink-muted)]">{i + 1}</span>
                {isReaderVisible ? (
                  <Link
                    href={`${readerBasePath}/read/${ch.chapterId}`}
                    className="flex-1 truncate text-sm text-[var(--canvas-dark-ink-strong)] hover:underline"
                  >
                    {ch.title}
                  </Link>
                ) : (
                  <span className="flex-1 truncate text-sm italic text-[var(--canvas-dark-ink-muted)]">
                    {ch.title}
                  </span>
                )}
                {isReaderVisible ? (
                  <span className="shrink-0 text-xs text-[var(--canvas-dark-ink-muted)]">
                    Updated {formatUpdatedLabel(ch.updatedAt)}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
                    Draft — coming soon
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/chapters-panel.tsx
git commit -m "$(cat <<'EOF'
feat(reader): add ChaptersPanel with manual mark-as-read + progress bar

Section card with header (Chapters heading + X/Y read subtitle + thin
brand-yellow progress bar on inset rail). Rows are tile-gradient pills
with: Circle / CheckCircle2 toggle (left, click toggles optimistically,
hidden for guests + locked chapters), 1-based index, title link, Updated
label OR 'Draft — coming soon' for non-author + non-reader-visible.

No per-row word count (book total lives in the hero stats).

onReadSetChange callback lets the page-level orchestrator share the
read-set with BookHero so the hero's 'Chapters X/Y read' stat updates
live when a user toggles a row.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Build colocated `<CommentsPanel>`

**Files:**
- Create: `app/[locale]/(public)/books/_components/comments-panel.tsx`

This is a re-skinned + colocated replacement for `app/[locale]/(public)/_components/comments-panel.tsx`. The legacy one stays in place until T12 audits its callers.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { addCommentAction } from '@/lib/actions/social.actions'
import { getBookCommentsAction, type BookComment } from '@/lib/actions/discover.actions'

type Props = {
  bookId: string
  locale: string
  initialComments: BookComment[]
  initialHasMore: boolean
  initialCount: number
  isAuthenticated: boolean
  viewerAvatarUrl: string | null
}

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function CommentsPanel({
  bookId,
  locale,
  initialComments,
  initialHasMore,
  initialCount,
  isAuthenticated,
  viewerAvatarUrl,
}: Props) {
  const [comments, setComments] = useState(initialComments)
  const [count, setCount] = useState(initialCount)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed || !isAuthenticated) return
    setDraft('')
    startTransition(async () => {
      const result = await addCommentAction(bookId, trimmed)
      if (result.success) {
        setComments((prev) => [result.data, ...prev])
        setCount((c) => c + 1)
      } else {
        setDraft(trimmed)
        toast.error('Could not post comment')
      }
    })
  }

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1
      const result = await getBookCommentsAction(bookId, nextPage)
      if (result.success) {
        setComments((prev) => [...prev, ...result.data.comments])
        setHasMore(result.data.hasMore)
        setPage(nextPage)
      } else {
        toast.error('Could not load more comments')
      }
    })
  }

  return (
    <section
      id="comments"
      className="rounded-[var(--r-card)] p-6 scroll-mt-20"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-comfortaa text-lg font-bold text-[var(--brand)]">Comments</h2>
        <span className="text-xs text-[var(--canvas-dark-ink-muted)]">{count}</span>
      </div>

      {isAuthenticated ? (
        <div className="mb-5 flex gap-3">
          {viewerAvatarUrl ? (
            <img src={viewerAvatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--canvas-dark-300)]" />
          )}
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              className="w-full resize-none rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] px-3 py-2 text-sm text-[var(--canvas-dark-ink-strong)] outline-none placeholder:text-[var(--canvas-dark-ink-muted)]"
              style={{ boxShadow: 'var(--sh-inset)' }}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={submit}
                disabled={isPending || !draft.trim()}
                className="rounded-[var(--r-btn)] bg-[var(--brand)] px-4 py-1.5 text-sm font-semibold text-[var(--brand-ink)] disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-[var(--canvas-dark-ink-muted)]">
          <Link href={`/${locale}/sign-in`} className="text-[var(--brand)] hover:underline">
            Sign in
          </Link>{' '}
          to leave a comment.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {c.authorAvatarUrl ? (
                <img src={c.authorAvatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--canvas-dark-300)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <Link
                    href={`/${locale}/u/${c.authorUsername}`}
                    className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)] hover:underline"
                  >
                    {c.authorDisplayName ?? `@${c.authorUsername}`}
                  </Link>
                  <span className="text-xs text-[var(--canvas-dark-ink-muted)]">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--canvas-dark-ink)]">
                  {c.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-5 text-center">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="rounded-[var(--r-btn)] px-4 py-1.5 text-sm text-[var(--canvas-dark-ink)] disabled:opacity-40"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            Load more
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/comments-panel.tsx
git commit -m "$(cat <<'EOF'
feat(reader): add colocated CommentsPanel for the new reader page

Re-skinned panel chrome (panel gradient + sh-card). Avatar + composer +
flat list + Load more pagination. Authed users get the composer; guests
get a Sign in link. Post is optimistic with rollback + sonner toast on
failure. No threading, no per-comment likes (v1).

This is a new colocated component; the legacy CommentsPanel at
(public)/_components/comments-panel.tsx is left in place until T12
audits its callers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Build `<AboutSection>`

**Files:**
- Create: `app/[locale]/(public)/books/_components/about-section.tsx`

- [ ] **Step 1: Write the component**

```tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  locale: string
  synopsis: string | null
  firstPublishedAt: Date
  lastUpdatedAt: Date
  author: {
    userId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  }
}

function fmt(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function AboutSection({ locale, synopsis, firstPublishedAt, lastUpdatedAt, author }: Props) {
  return (
    <section
      id="about"
      className="rounded-[var(--r-card)] p-6 scroll-mt-20"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <h2 className="mb-4 font-comfortaa text-lg font-bold text-[var(--brand)]">About this book</h2>

      {synopsis ? (
        <div className="mb-6 max-w-prose space-y-3 text-sm leading-relaxed text-[var(--canvas-dark-ink)]">
          {synopsis.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm italic text-[var(--canvas-dark-ink-muted)]">
          The author hasn&apos;t written a description yet.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
            First published
          </dt>
          <dd className="mt-0.5 text-[var(--canvas-dark-ink-strong)]">{fmt(firstPublishedAt)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
            Last updated
          </dt>
          <dd className="mt-0.5 text-[var(--canvas-dark-ink-strong)]">{fmt(lastUpdatedAt)}</dd>
        </div>
      </dl>

      <div
        className="flex items-center gap-4 rounded-[var(--r-row)] p-4"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
        }}
      >
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-[var(--canvas-dark-200)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-comfortaa text-base font-bold text-[var(--canvas-dark-ink-strong)]">
            {author.displayName ?? author.username ?? 'Unknown'}
          </p>
          {author.username && (
            <p className="truncate text-xs text-[var(--canvas-dark-ink-muted)] font-mono">@{author.username}</p>
          )}
        </div>
        {author.username && (
          <Link
            href={`/${locale}/u/${author.username}`}
            className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
          >
            View profile
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/about-section.tsx
git commit -m "$(cat <<'EOF'
feat(reader): add AboutSection (description + dates + author card)

Server component, pure presentational. Full untruncated synopsis split
on blank lines into paragraphs (max-w-prose), 2-col metadata grid (First
published / Last updated), and a tile-gradient author card with avatar
+ display name + @username + View profile link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Restyle `<AccessDenied>`

**Files:**
- Modify: `app/[locale]/(public)/books/_components/access-denied.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
import Link from 'next/link'
import { Lock, Users } from 'lucide-react'

type Props = {
  reason: 'PRIVATE' | 'FRIENDS_ONLY'
  locale: string
}

export function AccessDenied({ reason, locale }: Props) {
  const isFriends = reason === 'FRIENDS_ONLY'
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#262728] px-6">
      <div
        className="max-w-md rounded-[var(--r-card)] p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: '1px solid var(--br-card)',
        }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          {isFriends ? (
            <Users className="h-6 w-6 text-[var(--brand)]" />
          ) : (
            <Lock className="h-6 w-6 text-[var(--brand)]" />
          )}
        </div>
        <h1 className="mb-2 font-comfortaa text-xl font-bold text-[var(--brand)]">
          {isFriends ? "Only the author's friends can read this" : 'This book is private'}
        </h1>
        <p className="mb-6 text-sm text-[var(--canvas-dark-ink)]">
          {isFriends
            ? 'The author has shared this book with their friends only.'
            : 'The author has not shared this book.'}
        </p>
        <Link
          href={`/${locale}/discover`}
          className="inline-block rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
        >
          Discover other books
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/books/_components/access-denied.tsx
git commit -m "$(cat <<'EOF'
style(reader): re-skin AccessDenied to new chrome on #262728

Page bg flipped from #141414 to #262728. Card uses the panel gradient
+ sh-card chrome. Icon chip is tile-gradient with the brand-yellow icon.
Discover CTA is the brand pill (no drop-shadow glow per design system).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Restyle `<SeriesFooter>`

**Files:**
- Modify: `app/[locale]/(public)/_components/series-footer.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SeriesNeighbors } from '@/lib/books/get-series-neighbors'

type Props = {
  neighbors: SeriesNeighbors
  locale: string
}

export function SeriesFooter({ neighbors, locale }: Props) {
  const { previous, next } = neighbors
  if (!previous && !next) return null

  return (
    <section
      className="mt-6 grid grid-cols-1 gap-3 rounded-[var(--r-card)] p-5 sm:grid-cols-2"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div>
        {previous && (
          <Link
            href={`/${locale}/books/${previous.id}`}
            className="flex h-full flex-col gap-1 rounded-[var(--r-row)] p-3 hover:bg-[var(--canvas-dark-300)]"
            style={{ boxShadow: 'var(--sh-tile)' }}
          >
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
              <ChevronLeft size={12} /> Previous in series
            </span>
            <span className="text-sm text-[var(--canvas-dark-ink-strong)]">
              {previous.seriesNumber !== null ? `Book ${previous.seriesNumber}: ` : ''}
              {previous.title}
            </span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link
            href={`/${locale}/books/${next.id}`}
            className="flex h-full flex-col items-end gap-1 rounded-[var(--r-row)] p-3 hover:bg-[var(--canvas-dark-300)]"
            style={{ boxShadow: 'var(--sh-tile)' }}
          >
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
              Next in series <ChevronRight size={12} />
            </span>
            <span className="text-sm text-[var(--canvas-dark-ink-strong)]">
              {next.seriesNumber !== null ? `Book ${next.seriesNumber}: ` : ''}
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(public\)/_components/series-footer.tsx
git commit -m "$(cat <<'EOF'
style(reader): re-skin SeriesFooter to new card chrome

Was a flat 2-col grid with a top hairline. Now a single panel-gradient
card containing two tile-gradient prev/next links. Matches the new
reader page's stacked-section visual rhythm.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Rewrite the page orchestrator

**Files:**
- Modify: `app/[locale]/(public)/books/[bookId]/page.tsx`
- Create: `app/[locale]/(public)/books/_components/reader-page-shell.tsx` (client wrapper that lifts the shared read-set state between BookHero and ChaptersPanel)

The page needs to extend `getPublicBookAction`'s projection (or fetch alongside) to include `book.visibility` (already on `books.visibility`) and `book.createdAt` + a `commentCount`. The simplest path: fetch the raw `books` row alongside the existing `getPublicBookAction` for the extra fields, and `count()` the comments inline.

- [ ] **Step 1: Write the client shell that lifts read-set state**

Create `app/[locale]/(public)/books/_components/reader-page-shell.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { BookHero } from './book-hero'
import { BookTabStrip } from './book-tab-strip'
import { ChaptersPanel } from './chapters-panel'
import type { ComponentProps } from 'react'

type HeroProps = Omit<ComponentProps<typeof BookHero>, 'readCount'>
type ChaptersProps = Omit<ComponentProps<typeof ChaptersPanel>, 'onReadSetChange'>

type Props = {
  hero: HeroProps
  chapters: ChaptersProps
  children: React.ReactNode
}

export function ReaderPageShell({ hero, chapters, children }: Props) {
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set(chapters.initialReadSet))
  const readCount = chapters.chapters.filter((c) => readSet.has(c.binderItemId)).length

  return (
    <>
      <BookHero {...hero} readCount={readCount} />
      <BookTabStrip />
      <ChaptersPanel
        {...chapters}
        onReadSetChange={setReadSet}
      />
      {children}
    </>
  )
}
```

- [ ] **Step 2: Replace the page**

Replace the entire contents of `app/[locale]/(public)/books/[bookId]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { db } from '@/db'
import { books, binderItems, chapters, bookComments, userProfiles } from '@/db/schema'
import { and, eq, asc, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canReadBook } from '@/lib/books/can-read'
import { getSeriesNeighbors } from '@/lib/books/get-series-neighbors'
import { getPublicBookAction, getBookCommentsAction } from '@/lib/actions/discover.actions'
import { getReadingProgressAction } from '@/lib/actions/reading.actions'
import { getUserSocialStateAction } from '@/lib/actions/social.actions'
import { AccessDenied } from '../_components/access-denied'
import { ReaderPageShell } from '../_components/reader-page-shell'
import { CommentsPanel } from '../_components/comments-panel'
import { AboutSection } from '../_components/about-section'
import { SeriesFooter } from '../../_components/series-footer'

type Props = { params: Promise<{ locale: string; bookId: string }> }

export default async function BookReaderPage({ params }: Props) {
  const { locale, bookId } = await params
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  const userId = session?.user?.id ?? null

  const access = await canReadBook(bookId, userId)
  if (!access.ok) {
    if (access.reason === 'NOT_FOUND') notFound()
    return <AccessDenied reason={access.reason} locale={locale} />
  }

  const bookResult = await getPublicBookAction(bookId)
  if (!bookResult.success) notFound()
  const book = bookResult.data
  const isAuthor = userId === book.authorUserId

  // Supplement getPublicBookAction with the fields we need that it doesn't return.
  const [bookExtra] = await db
    .select({
      visibility: books.visibility,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1)
  if (!bookExtra) notFound()

  const [commentCountRow] = await db
    .select({ total: count() })
    .from(bookComments)
    .where(eq(bookComments.bookId, bookId))
  const commentCount = commentCountRow?.total ?? 0

  const chapterRows = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      order: binderItems.order,
      status: chapters.status,
      updatedAt: chapters.updatedAt,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const [commentsResult, progressResult, socialResult, seriesNeighbors, viewerProfileRow] = await Promise.all([
    getBookCommentsAction(bookId, 1),
    userId ? getReadingProgressAction(bookId) : Promise.resolve(null),
    userId ? getUserSocialStateAction(bookId, book.authorUserId) : Promise.resolve(null),
    getSeriesNeighbors({
      currentBook: {
        id: book.id,
        userId: book.authorUserId,
        seriesName: book.seriesName,
        seriesNumber: book.seriesNumber,
      },
      viewerUserId: userId,
    }),
    userId
      ? db
          .select({ avatarUrl: userProfiles.avatarUrl })
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId))
          .limit(1)
      : Promise.resolve(null),
  ])

  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const progress = progressResult?.success ? progressResult.data : null
  const social = socialResult?.success ? socialResult.data : null
  const viewerAvatarUrl = viewerProfileRow?.[0]?.avatarUrl ?? null

  const readerBasePath = `/${locale}/books/${bookId}`
  const backHref = isAuthor ? `/${locale}/studio/${bookId}` : `/${locale}/discover`
  const backLabel = isAuthor ? '← Editor' : '← Discover'

  // Pick a CTA target: continueReading if there's a cursor; else first reader-visible chapter; else null.
  const isChapterVisibleToViewer = (status: typeof chapterRows[number]['status']) =>
    isAuthor || status === 'REVISED' || status === 'FINAL'
  const visibleChapters = chapterRows.filter((c) => isChapterVisibleToViewer(c.status))
  const lastChapter = progress?.lastChapterId
    ? visibleChapters.find((c) => c.chapterId === progress.lastChapterId)
    : null
  const firstVisible = visibleChapters[0] ?? null
  const startReadingHref = firstVisible ? `${readerBasePath}/read/${firstVisible.chapterId}` : null
  const continueReadingHref = lastChapter ? `${readerBasePath}/read/${lastChapter.chapterId}` : null

  // Build the share URL from the inbound request headers (origin) so it works in dev + prod.
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const host = headersList.get('host') ?? 'localhost:3000'
  const shareUrl = `${proto}://${host}${readerBasePath}`

  const visibility = (bookExtra.visibility ?? 'PUBLIC') as 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

  return (
    <div className="min-h-screen bg-[#262728]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link
          href={backHref}
          className="mb-4 inline-block text-sm text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink-strong)]"
        >
          {backLabel}
        </Link>

        <div className="flex flex-col gap-6">
          <ReaderPageShell
            hero={{
              book: { ...book, visibility, commentCount },
              locale,
              shareUrl,
              isAuthor,
              isAuthenticated: !!userId,
              startReadingHref,
              continueReadingHref,
              totalChapters: visibleChapters.length,
              initialLiked: social?.liked ?? false,
              initialBookmarked: social?.bookmarked ?? false,
              initialLikeCount: book.likeCount,
            }}
            chapters={{
              bookId,
              readerBasePath,
              chapters: chapterRows,
              initialReadSet: progress?.readChapterBinderItemIds ?? [],
              isAuthor,
              isAuthenticated: !!userId,
            }}
          >
            <CommentsPanel
              bookId={bookId}
              locale={locale}
              initialComments={comments}
              initialHasMore={commentsHasMore}
              initialCount={commentCount}
              isAuthenticated={!!userId}
              viewerAvatarUrl={viewerAvatarUrl}
            />
            <AboutSection
              locale={locale}
              synopsis={book.synopsis}
              firstPublishedAt={bookExtra.createdAt}
              lastUpdatedAt={bookExtra.updatedAt}
              author={{
                userId: book.authorUserId,
                username: book.authorUsername,
                displayName: book.authorDisplayName,
                avatarUrl: book.authorAvatarUrl,
              }}
            />
            <SeriesFooter neighbors={seriesNeighbors} locale={locale} />
          </ReaderPageShell>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. If the `books.visibility` column is named differently or `bookComments` import path differs from the snippet, adjust to match the actual schema (verify with a quick read of `db/schema/books.ts` + `db/schema/social.ts`).

- [ ] **Step 4: Manual smoke (gated — see Task 13 for the full checklist)**

Boot the dev server and visit `/en/books/<some-public-book-id>` as a logged-in user. Confirm the page renders without runtime errors. Detailed smoke runs in Task 13.

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(public\)/books/[bookId]/page.tsx app/[locale]/\(public\)/books/_components/reader-page-shell.tsx
git commit -m "$(cat <<'EOF'
feat(reader): rewrite public book overview page orchestrator

Centered max-w-5xl on bg-#262728. Stacked sections:
  ← Back
  BookHero (cover + metadata + CTA row)
  BookTabStrip (sticky scroll-spy)
  ChaptersPanel (mark-as-read + progress bar)
  CommentsPanel (composer + flat list + Load more)
  AboutSection (synopsis + dates + author card)
  SeriesFooter (re-skinned card)

New ReaderPageShell client wrapper lifts the shared read-set state
between BookHero and ChaptersPanel so the hero's 'Chapters X/Y read'
stat updates live when a user toggles a checkbox in the chapters panel.

getPublicBookAction's projection doesn't include visibility / createdAt
/ updatedAt — supplemented by a direct books-table fetch alongside.
Comment count via a count(bookComments) query. Viewer's avatar via
userProfiles lookup so the composer shows the right face.

Share URL composed from x-forwarded-proto + host headers so it works
in dev (localhost) and prod (real domain) without env-var coupling.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Audit + delete legacy `_components`

**Files:**
- Audit: `app/[locale]/(public)/_components/chapter-list.tsx`
- Audit: `app/[locale]/(public)/_components/comments-panel.tsx`
- Audit: `app/[locale]/(public)/_components/social-actions.tsx`

- [ ] **Step 1: Audit each file for remaining callers**

```bash
grep -rn "ChapterList\|chapter-list" app --include="*.tsx" --include="*.ts" | grep -v "_components/chapter-list.tsx"
grep -rn "CommentsPanel\|comments-panel" app --include="*.tsx" --include="*.ts" | grep -v "_components/comments-panel.tsx" | grep -v "books/_components/comments-panel"
grep -rn "SocialActions\|social-actions" app --include="*.tsx" --include="*.ts" | grep -v "_components/social-actions.tsx"
```

Expected: each grep returns either zero results or only references that have already been migrated. If a non-migrated caller exists, STOP and update that caller to use the new colocated component instead, before continuing. **If discover-tab pages or any other surface still imports these, do NOT delete — flag in the commit message and leave the legacy files in place.**

- [ ] **Step 2: If zero callers remain, delete the files**

```bash
git rm app/[locale]/\(public\)/_components/chapter-list.tsx
git rm app/[locale]/\(public\)/_components/comments-panel.tsx
git rm app/[locale]/\(public\)/_components/social-actions.tsx
```

- [ ] **Step 3: Typecheck + test**

```bash
npx tsc --noEmit
npm test
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(reader): remove legacy (public)/_components after migration

ChapterList, CommentsPanel, and SocialActions had been superseded by
the new colocated components under (public)/books/_components/. Audit
confirmed no remaining callers; deleted.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

(If Step 1 found remaining callers, skip Steps 2-4 entirely and instead commit a brief note in the AGENTS.md follow-up describing what still depends on each legacy file.)

---

## Task 13: Manual smoke + AGENTS.md update + ship

**Files:**
- Modify: `AGENTS.md` (Resume Here block)

- [ ] **Step 1: Run the dev server and smoke each scenario**

```bash
npm run dev
```

Manual checks (each is its own pass-or-fail):

1. **Logged-in author preview** — visit `/en/books/<my-own-book-id>`. Confirm: `← Editor` back link · hero shows cover + title + brand-yellow `by @me` + series line (if set) + genre/privacy pills · 4-stat row shows real numbers · synopsis line-clamp-3 · `Start Reading →` or `Continue Reading →` CTA · `♥ Favorite` toggles (no-op on own book is fine if backend rejects, sonner toast on fail) · `↗ Share` opens dialog · `Edit in studio →` link is visible.
2. **Share dialog copy flow** — click Share, click Copy. Confirm: button flips to `Copied ✓` for 2s, sonner toast `Link copied`, URL is the page URL.
3. **Privacy notes** — flip the book to PRIVATE via Details Sharing, reload, open Share. Confirm: note reads `Only people you invite can open this link.` with Lock icon. Flip to FRIENDS, reload, open Share. Confirm: note reads `Only your friends can open this link.` with Users icon. Flip back to PUBLIC.
4. **Logged-out viewer on PUBLIC book** — open the page in an incognito window. Confirm: `← Discover` back link · 4-stat `Chapters` shows just total (no `X / Y read`) · chapter rows have no checkbox · clicking Favorite/Bookmark fires sign-in toast · Comments shows `Sign in to leave a comment.` link.
5. **PRIVATE access denied** — open a private book as an unauthenticated user. Confirm: AccessDenied screen shows on `#262728` bg with brand-yellow Lock icon + `← Discover` CTA.
6. **FRIENDS access denied** — same as 5 but a FRIENDS book. Confirm: Users icon + friends copy.
7. **Mark-as-read toggle** — authed reader on a public book. Click an empty circle on a chapter row. Confirm: optimistically flips to brand-yellow CheckCircle2, hero `Chapters X/Y` increments by 1, progress bar fills proportionally. Reload. Confirm: state persists.
8. **Unmark** — click a filled checkmark. Confirm: flips back to empty, hero stat decrements, progress bar shrinks. Reload — state persists.
9. **Toggle middle-chapter** — mark chapter 3 read while 1, 2, 4 are unread. Confirm: only chapter 3 is marked (not 1 + 2 + 3). This is the key behavioral change vs the old linear cursor model.
10. **Tab strip scroll-spy** — scroll the page from top. Confirm: as the Chapters section header crosses the top, the `Chapters` pill highlights. Scroll past it; `Comments` highlights. Past Comments; `About` highlights. Click each pill from the bottom; page smooth-scrolls to that section.
11. **Tab strip stickiness** — scroll past the hero. Confirm: the tab strip stays pinned at top of the viewport, no content bleed-through.
12. **Comment composer + Load more** — post a comment as authed user. Confirm: appears at top of list optimistically, count bumps. If there are more than 20 comments, click `Load more`. Confirm: next page appends, button disappears at end.
13. **Locked chapters for non-author** — view a book with FIRST_DRAFT chapters as a non-author. Confirm: those rows render `Draft — coming soon` italic, no checkbox, not clickable.
14. **Empty-state branches** — view a book with zero chapters as the author. Confirm: ChaptersPanel shows `No chapters yet.` italic.
15. **Author auto-mark still works on chapter reader** — visit `/en/books/<id>/read/<chapterId>` as the author. Return to the overview. Confirm: that chapter is now marked read (the auto-mark in the chapter reader page still fires).
16. **Series footer** — view a book in a series with at least one neighbor. Confirm: prev/next links render in the re-skinned card; click navigates correctly.
17. **No black backgrounds** — sample 6 places (hero, tab strip, chapters card, comments card, about card, series footer). Confirm: none use `#000` or `#141414`. All use `#262728` or the panel/tile gradients.

- [ ] **Step 2: If any smoke item fails, file the fix as a follow-up commit before shipping**

Loop: identify root cause, fix inline, commit with a `fix(reader): ...` prefix, re-smoke that scenario, mark done.

- [ ] **Step 3: Update AGENTS.md Resume Here block**

Replace the current `Current focus`, `Last commit`, and `Next concrete step` fields to reflect the ship. Add a `What Has Been Built` entry below the existing entries with this template (fill in with what actually shipped):

```markdown
### Public Book Reader Page Redesign ✅ COMPLETE (2026-06-02)

[2-4 sentences summarizing what shipped — Resume Here block style. Mention
the chapter_reads table addition, the readSet lifting via ReaderPageShell,
brand-yellow scroll-spy tabs, the share dialog, and the bg-#262728 audit.
Include the SHA range and call out the Patterns now load-bearing:

- chapter_reads is the per-chapter read truth; readingProgress is the
  cursor for Continue Reading. Future read-tracking code must not derive
  reads from the cursor.
- BookTabStrip's IntersectionObserver pattern (rootMargin -80/-60%) is
  reusable for any future stacked-section page that needs scroll-spy.
- ReaderPageShell pattern (client wrapper that lifts shared state across
  sibling sections) is reusable when two stacked sections need to share
  optimistic state.
- ShareBookDialog pattern (shadcn Dialog with copy + sonner toast +
  privacy note) is reusable for any future share affordance.]
```

- [ ] **Step 4: Commit AGENTS.md**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): public book reader page redesign shipped

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push if Chris asks**

Per the working agreement, push happens on Chris's explicit ask. Do NOT push proactively.

---

## Self-Review (filled in during plan write)

**Spec coverage:**
- Hero composition → T4 ✓
- BookTabStrip scroll-spy → T5 ✓
- ChaptersPanel + manual mark-as-read + progress bar → T2 (schema/action) + T6 (UI) ✓
- CommentsPanel flat list + Load more → T7 ✓
- AboutSection → T8 ✓
- ShareBookDialog + copy + privacy note → T3 ✓
- AccessDenied re-skin → T9 ✓
- SeriesFooter re-skin → T10 ✓
- chapter_reads schema → T1 ✓
- Page orchestrator + readSet lifting → T11 ✓
- Legacy cleanup → T12 ✓
- Manual smoke → T13 ✓

**Placeholder scan:** No "TBD" / "implement later" / "add error handling" placeholders. All test code, all action code, all component JSX is in full.

**Type consistency:** `markChapterReadAction(bookId, chapterBinderItemId)` and `unmarkChapterReadAction(bookId, chapterBinderItemId)` agree across T2 + T6. `readingProgress` cursor remains `chapterId`-based (the chapters.id PK) so `getReadingProgressAction`'s `lastChapterId` field doesn't drift. `BookHero` props include `totalChapters` + `readCount` as separate fields and `<ReaderPageShell>` computes `readCount` from the live read-set — types align across T4 + T6 + T11.

**Scope check:** This is a single coherent surface (one page rewrite + one supporting DB change + one action reshape). No decomposition needed.
