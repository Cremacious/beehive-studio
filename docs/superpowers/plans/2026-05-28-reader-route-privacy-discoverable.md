# SP-A Reader Route + Privacy/Discoverable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public-facing `/[locale]/books/[bookId]` reader route accessible from the studio editor, plus the privacy enum extension (adds FRIENDS), the `discoverable` boolean (reused from existing-but-unused `explorable` column), the `canReadBook()` single-source-of-truth access helper, settings UI in the wizard + Details page, and editor entry points (toolbar Preview button + binder-header title link).

**Architecture:** Three independent axes on a book — `privacy` (who can open the reader, via existing `visibility` column extended with `FRIENDS`), `discoverable` (whether it appears in /discover listings, via renamed `explorable` column), `status` (DRAFT/PUBLISHED, demoted to a pure author label). One helper `canReadBook(bookId, viewerUserId)` gates the new reader page and all reader-write server actions. FRIENDS resolves to author-only until SP-B Friendships ships.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM on Neon Postgres, Zod, Tailwind v4, shadcn/ui, vitest.

**Spec:** [docs/superpowers/specs/2026-05-28-reader-route-privacy-discoverable-design.md](../specs/2026-05-28-reader-route-privacy-discoverable-design.md)

---

### Task 1: Schema migration — rename explorable → discoverable, add FRIENDS, backfill, index

**Files:**
- Modify: `db/schema/books.ts:6` (enum), `db/schema/books.ts:14-35` (books table)
- Migration: applied via `npm run db:push` (drizzle-kit)

- [ ] **Step 1: Update the enum and column in schema**

Edit `db/schema/books.ts`:

```ts
// line 6 — extend enum
export const bookVisibilityEnum = pgEnum('book_visibility', ['PRIVATE', 'PUBLIC', 'FRIENDS'])
```

```ts
// line 22 — rename explorable to discoverable
discoverable: boolean('discoverable').default(false).notNull(),
```

```ts
// line 35 — add composite index for /discover queries
}, (t) => [
  index('books_user_id_idx').on(t.userId),
  index('books_discoverable_visibility_idx').on(t.discoverable, t.visibility),
])
```

- [ ] **Step 2: Apply migration**

Run: `npm run db:push`

Expected output: drizzle reports the enum value addition, column rename (`explorable` → `discoverable`), and new index. Confirm prompt for the rename when shown (drizzle-kit detects renames interactively; pick "rename `explorable` to `discoverable`" rather than "drop + create").

- [ ] **Step 3: Backfill discoverable for already-published public books**

Run via `npm run db:exec` or psql against the Neon DB:

```sql
UPDATE books SET discoverable = true
WHERE visibility = 'PUBLIC' AND status = 'PUBLISHED';
```

Expected: `UPDATE N` where N matches the count of currently-discoverable books on the live `/discover` page.

- [ ] **Step 4: Commit**

```bash
git add db/schema/books.ts drizzle/
git commit -m "feat(schema): add FRIENDS visibility, rename explorable→discoverable, backfill"
```

---

### Task 2: canReadBook helper

**Files:**
- Create: `lib/books/can-read.ts`
- Test: `lib/books/can-read.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/books/can-read.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canReadBook } from './can-read'

vi.mock('@/db', () => ({
  db: { select: vi.fn() },
}))

function mockBook(book: { userId: string; visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS' } | null) {
  const { db } = require('@/db')
  db.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => (book ? [{ id: 'b1', userId: book.userId, visibility: book.visibility }] : []),
      }),
    }),
  })
}

describe('canReadBook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns NOT_FOUND when book missing', async () => {
    mockBook(null)
    const result = await canReadBook('b1', 'viewer')
    expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' })
  })

  it('returns ok when viewer is author', async () => {
    mockBook({ userId: 'u1', visibility: 'PRIVATE' })
    expect(await canReadBook('b1', 'u1')).toEqual({ ok: true })
  })

  it('returns ok for PUBLIC with signed-out viewer', async () => {
    mockBook({ userId: 'u1', visibility: 'PUBLIC' })
    expect(await canReadBook('b1', null)).toEqual({ ok: true })
  })

  it('returns ok for PUBLIC with signed-in stranger', async () => {
    mockBook({ userId: 'u1', visibility: 'PUBLIC' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: true })
  })

  it('returns FRIENDS_ONLY for FRIENDS book viewed by stranger (SP-A: author only)', async () => {
    mockBook({ userId: 'u1', visibility: 'FRIENDS' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'FRIENDS_ONLY' })
  })

  it('returns PRIVATE for PRIVATE book viewed by stranger', async () => {
    mockBook({ userId: 'u1', visibility: 'PRIVATE' })
    expect(await canReadBook('b1', 'u2')).toEqual({ ok: false, reason: 'PRIVATE' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- can-read`
Expected: FAIL with "Cannot find module './can-read'"

- [ ] **Step 3: Implement canReadBook**

Create `lib/books/can-read.ts`:

```ts
import { db } from '@/db'
import { books } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type BookAccess =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'PRIVATE' | 'FRIENDS_ONLY' }

export async function canReadBook(
  bookId: string,
  viewerUserId: string | null,
): Promise<BookAccess> {
  const [book] = await db
    .select({ id: books.id, userId: books.userId, visibility: books.visibility })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1)

  if (!book) return { ok: false, reason: 'NOT_FOUND' }
  if (viewerUserId && book.userId === viewerUserId) return { ok: true }
  if (book.visibility === 'PUBLIC') return { ok: true }
  if (book.visibility === 'FRIENDS') return { ok: false, reason: 'FRIENDS_ONLY' }
  return { ok: false, reason: 'PRIVATE' }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- can-read`
Expected: 6 tests pass.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/books/
git commit -m "feat(books): canReadBook access helper"
```

---

### Task 3: Strip privacy gate from getPublicBookAction; rename queries to use discoverable

**Files:**
- Modify: `lib/actions/discover.actions.ts:127, 175` (replace `status='PUBLISHED'` with `discoverable=true`)

- [ ] **Step 1: Update getDiscoverFeedAction listing query**

In `lib/actions/discover.actions.ts` around line 124-130, replace:

```ts
.where(
  and(
    eq(books.status, 'PUBLISHED'),
    eq(books.visibility, 'PUBLIC'),
    genre ? eq(books.genre, genre) : undefined
  )
)
```

with:

```ts
.where(
  and(
    eq(books.discoverable, true),
    eq(books.visibility, 'PUBLIC'),
    genre ? eq(books.genre, genre) : undefined
  )
)
```

- [ ] **Step 2: Update getPublicBookAction — strip privacy gate**

In `lib/actions/discover.actions.ts` around line 174-176, replace:

```ts
.where(
  and(eq(books.id, bookId), eq(books.status, 'PUBLISHED'), eq(books.visibility, 'PUBLIC'))
)
```

with:

```ts
.where(eq(books.id, bookId))
```

Add a JSDoc above the function:

```ts
/**
 * Returns the book data for the reader page. Does NOT gate by privacy.
 * Callers must gate access with `canReadBook()` before rendering.
 */
```

- [ ] **Step 3: Update any other discover queries to use discoverable**

Search for remaining `status, 'PUBLISHED')` references that should now be `discoverable, true)`:

Run: `grep -rn "status, 'PUBLISHED'" lib/actions/`

For each match in `discover.actions.ts` or `community.actions.ts`: if the query is for "show in a public listing of books", swap to `discoverable=true AND visibility='PUBLIC'`. If the query is for "the author's own published books" (e.g. profile page tabs), leave it — it's a label query, not an access query.

Specifically check `community.actions.ts::getCommunityFeedAction` — feed items for "new book published" events should remain using `status='PUBLISHED'` (that's an author event, not a public listing).

- [ ] **Step 4: Run tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/discover.actions.ts
git commit -m "refactor(discover): use discoverable flag; strip privacy gate from getPublicBookAction"
```

---

### Task 4: Hoist shared reader components from /discover to /(public)

**Files:**
- Move: `app/[locale]/(public)/discover/_components/chapter-list.tsx` → `app/[locale]/(public)/_components/chapter-list.tsx`
- Move: `app/[locale]/(public)/discover/_components/comments-panel.tsx` → `app/[locale]/(public)/_components/comments-panel.tsx`
- Move: `app/[locale]/(public)/discover/_components/social-actions.tsx` → `app/[locale]/(public)/_components/social-actions.tsx`
- Modify: `app/[locale]/(public)/discover/book/[bookId]/page.tsx` (update imports)
- Modify: `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx` (update imports)

- [ ] **Step 1: Create `_components/` directory and move files**

```bash
mkdir -p "app/[locale]/(public)/_components"
git mv "app/[locale]/(public)/discover/_components/chapter-list.tsx" "app/[locale]/(public)/_components/chapter-list.tsx"
git mv "app/[locale]/(public)/discover/_components/comments-panel.tsx" "app/[locale]/(public)/_components/comments-panel.tsx"
git mv "app/[locale]/(public)/discover/_components/social-actions.tsx" "app/[locale]/(public)/_components/social-actions.tsx"
```

- [ ] **Step 2: Update discover-route imports**

In `app/[locale]/(public)/discover/book/[bookId]/page.tsx` lines 6-8, replace:

```ts
import { ChapterList } from '../../_components/chapter-list'
import { CommentsPanel } from '../../_components/comments-panel'
import { SocialActions } from '../../_components/social-actions'
```

with:

```ts
import { ChapterList } from '../../../_components/chapter-list'
import { CommentsPanel } from '../../../_components/comments-panel'
import { SocialActions } from '../../../_components/social-actions'
```

Do the same update in `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx` for any of those three imports.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(public): hoist shared reader components from discover/_components to _components"
```

---

### Task 5: New /books/[bookId] reader page

**Files:**
- Create: `app/[locale]/(public)/books/[bookId]/page.tsx`
- Create: `app/[locale]/(public)/books/[bookId]/_components/access-denied.tsx`

- [ ] **Step 1: Create the access-denied component**

Create `app/[locale]/(public)/books/[bookId]/_components/access-denied.tsx`:

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
    <div className="min-h-screen bg-[#141414] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center mb-5">
          {isFriends ? (
            <Users className="w-6 h-6 text-[#888]" />
          ) : (
            <Lock className="w-6 h-6 text-[#888]" />
          )}
        </div>
        <h1 className="text-white text-[20px] font-semibold mb-2">
          {isFriends ? "Only the author's friends can read this" : 'This book is private'}
        </h1>
        <p className="text-[#888] text-[14px] mb-6">
          {isFriends
            ? 'The author has shared this book with their friends only.'
            : 'The author has not shared this book.'}
        </p>
        <Link
          href={`/${locale}/discover`}
          className="inline-block px-5 py-2 bg-[#FFC300] text-black font-semibold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
        >
          Discover other books
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the reader page**

Create `app/[locale]/(public)/books/[bookId]/page.tsx`. Use the existing `app/[locale]/(public)/discover/book/[bookId]/page.tsx` as the structural template — the hero + chapter list + comments layout is identical. The only differences are: (a) gate with `canReadBook` instead of relying on `getPublicBookAction`'s old filter; (b) the back-link goes to studio if the viewer is the author, otherwise to /discover; (c) the "Continue Reading" link points at `/[locale]/books/[bookId]/read/[chapterId]`.

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { db } from '@/db'
import { binderItems, chapters } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { canReadBook } from '@/lib/books/can-read'
import { getPublicBookAction, getBookCommentsAction } from '@/lib/actions/discover.actions'
import { getReadingProgressAction } from '@/lib/actions/reading.actions'
import { getUserSocialStateAction } from '@/lib/actions/social.actions'
import { ChapterList } from '../../_components/chapter-list'
import { CommentsPanel } from '../../_components/comments-panel'
import { SocialActions } from '../../_components/social-actions'
import { AccessDenied } from './_components/access-denied'

type Props = { params: Promise<{ locale: string; bookId: string }> }

export default async function BookReaderPage({ params }: Props) {
  const { locale, bookId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
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

  const chapterRows = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      wordCount: chapters.wordCount,
      order: binderItems.order,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const [commentsResult, progressResult, socialResult] = await Promise.all([
    getBookCommentsAction(bookId, 1),
    userId ? getReadingProgressAction(bookId) : Promise.resolve(null),
    userId ? getUserSocialStateAction(bookId, book.authorUserId) : Promise.resolve(null),
  ])

  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const progress = progressResult?.success ? progressResult.data : null
  const social = socialResult?.success ? socialResult.data : null

  const progressPercent = progress && chapterRows.length > 0
    ? Math.round((progress.readChapterBinderItemIds.length / chapterRows.length) * 100)
    : 0

  const lastReadChapter = progress?.lastChapterId
    ? chapterRows.find(ch => ch.chapterId === progress.lastChapterId)
    : null

  const normalizedChapterRows = chapterRows.map(ch => ({ ...ch, wordCount: ch.wordCount ?? 0 }))
  const readerBasePath = `/${locale}/books/${bookId}`
  const backHref = isAuthor ? `/${locale}/studio/${bookId}` : `/${locale}/discover`
  const backLabel = isAuthor ? '← Back to editor' : '← Discover'

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-3 flex items-center gap-3">
        <Link href={backHref} className="text-[#888] text-[13px] hover:text-white transition-colors">
          {backLabel}
        </Link>
      </div>

      <div className="px-6 py-7 grid gap-6 border-b border-[#2a2a2a]" style={{ gridTemplateColumns: '160px 1fr' }}>
        <div className="aspect-[2/3] bg-gradient-to-br from-[#1e1e1e] to-[#2a2a2a] rounded-md relative flex items-end p-2.5 shrink-0">
          {book.coverUrl && (
            <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover rounded-md" />
          )}
          {book.genre && (
            <span className="relative z-10 text-[11px] text-[#aaa] bg-black/60 px-2 py-0.5 rounded">{book.genre}</span>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-white text-[26px] font-semibold leading-tight mb-1">{book.title}</h1>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-6 h-6 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-[11px]">
                {book.authorAvatarUrl ? (
                  <img src={book.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : '✍'}
              </div>
              <span className="text-[#aaa] text-[13px]">
                by <span className="text-[#FFC300]">{book.authorDisplayName ?? book.authorUsername ?? 'Unknown'}</span>
              </span>
            </div>

            {book.tags && book.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3.5">
                {book.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded-full text-[11px]">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex gap-5 mb-4">
              {[
                { label: 'Words', value: book.wordCount >= 1000 ? `${Math.round(book.wordCount / 1000)}k` : book.wordCount },
                { label: 'Chapters', value: book.chapterCount },
                { label: 'Likes', value: book.likeCount },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[#555] text-[10px] uppercase tracking-wide">{label}</p>
                  <p className="text-[#aaa] text-[14px] font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {book.synopsis && <p className="text-[#888] text-[13px] leading-relaxed max-w-xl">{book.synopsis}</p>}
          </div>

          <div className="mt-4 flex items-center gap-2.5 flex-wrap">
            {normalizedChapterRows[0] && (
              <Link
                href={`${readerBasePath}/read/${lastReadChapter?.chapterId ?? normalizedChapterRows[0].chapterId}`}
                className="px-6 py-2.5 bg-[#FFC300] text-black font-bold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
              >
                {lastReadChapter ? 'Continue Reading →' : 'Start Reading →'}
              </Link>
            )}
            <SocialActions
              bookId={bookId}
              authorUserId={book.authorUserId}
              locale={locale}
              initialLiked={social?.liked ?? false}
              initialBookmarked={social?.bookmarked ?? false}
              initialFollowing={social?.following ?? false}
              initialLikeCount={book.likeCount}
              isAuthenticated={!!userId}
            />
          </div>
        </div>
      </div>

      {progress?.lastChapterId && (
        <div className="px-6 py-3 bg-[#181818] border-b border-[#2a2a2a] flex items-center gap-3">
          <span className="text-[#888] text-[12px] shrink-0">Your progress</span>
          <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#FFC300] rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          {lastReadChapter && (
            <Link
              href={`${readerBasePath}/read/${lastReadChapter.chapterId}`}
              className="text-[#888] text-[12px] shrink-0 hover:text-white transition-colors"
            >
              Ch {normalizedChapterRows.findIndex(c => c.chapterId === lastReadChapter.chapterId) + 1} of {normalizedChapterRows.length} · Continue →
            </Link>
          )}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div className="p-6 border-r border-[#2a2a2a]">
          <ChapterList
            bookId={bookId}
            locale={locale}
            chapters={normalizedChapterRows}
            currentChapterId={progress?.lastChapterId ?? null}
            readChapterBinderItemIds={progress?.readChapterBinderItemIds ?? []}
          />
        </div>
        <div className="p-5">
          <CommentsPanel
            bookId={bookId}
            locale={locale}
            initialComments={comments}
            initialHasMore={commentsHasMore}
            isAuthenticated={!!userId}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update ChapterList to use the new reader-base path**

Open `app/[locale]/(public)/_components/chapter-list.tsx`. It currently constructs hrefs like `/${locale}/discover/book/${bookId}/read/${chapterId}`. Change the href base to be passed in as a prop so both routes share it:

Find the line that builds the chapter-read href (search for `/discover/book/`) and replace the hardcoded `/discover/book/${bookId}` with a new prop `readerBasePath: string` that callers supply. Update both call sites:

- In `app/[locale]/(public)/discover/book/[bookId]/page.tsx`, pass `readerBasePath={`/${locale}/discover/book/${bookId}`}` to `<ChapterList>`.
- In the new `app/[locale]/(public)/books/[bookId]/page.tsx`, pass `readerBasePath={`/${locale}/books/${bookId}`}`.

(After Task 7 the discover variant will be a redirect, so this becomes a single caller. Keep the prop anyway — it's the right shape.)

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(public)/books" "app/[locale]/(public)/_components/chapter-list.tsx" "app/[locale]/(public)/discover/book/[bookId]/page.tsx"
git commit -m "feat(reader): /books/[bookId] reader page with canReadBook gate"
```

---

### Task 6: New /books/[bookId]/read/[chapterId] chapter reader

**Files:**
- Create: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx`

- [ ] **Step 1: Create the chapter reader page**

Use the existing `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx` as the structural template. Apply two changes: (a) gate with `canReadBook` (call once at the top); (b) update internal links from `/discover/book/${bookId}` to `/books/${bookId}`.

```tsx
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { canReadBook } from '@/lib/books/can-read'
import { AccessDenied } from '../../_components/access-denied'

// ... existing imports for chapter reader UI ...

type Props = { params: Promise<{ locale: string; bookId: string; chapterId: string }> }

export default async function ChapterReaderPage({ params }: Props) {
  const { locale, bookId, chapterId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const access = await canReadBook(bookId, userId)
  if (!access.ok) {
    if (access.reason === 'NOT_FOUND') notFound()
    return <AccessDenied reason={access.reason} locale={locale} />
  }

  // ... rest of the existing chapter reader body, with hrefs swapped from
  //     `/${locale}/discover/book/${bookId}/...` to `/${locale}/books/${bookId}/...`
}
```

Copy the body of the existing discover chapter reader, but replace every internal href that points at `/discover/book/${bookId}` with `/books/${bookId}`.

- [ ] **Step 2: Hoist access-denied component path**

The chapter reader imports `AccessDenied` from `../../_components/access-denied`. Move the access-denied component up one level so both pages can share it:

```bash
git mv "app/[locale]/(public)/books/[bookId]/_components/access-denied.tsx" "app/[locale]/(public)/books/_components/access-denied.tsx"
mkdir -p "app/[locale]/(public)/books/_components"
```

Update the import in `app/[locale]/(public)/books/[bookId]/page.tsx` from `./_components/access-denied` to `../_components/access-denied`.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(public)/books/"
git commit -m "feat(reader): /books/[bookId]/read/[chapterId] chapter reader page"
```

---

### Task 7: 308 redirects from /discover/book/* to /books/*

**Files:**
- Modify: `app/[locale]/(public)/discover/book/[bookId]/page.tsx` (replace body with redirect)
- Modify: `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx` (replace body with redirect)

- [ ] **Step 1: Replace discover book page with redirect**

Replace the entire body of `app/[locale]/(public)/discover/book/[bookId]/page.tsx` with:

```tsx
import { permanentRedirect } from 'next/navigation'

type Props = { params: Promise<{ locale: string; bookId: string }> }

export default async function DiscoverBookRedirect({ params }: Props) {
  const { locale, bookId } = await params
  permanentRedirect(`/${locale}/books/${bookId}`)
}
```

- [ ] **Step 2: Replace discover chapter reader with redirect**

Replace the entire body of `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx` with:

```tsx
import { permanentRedirect } from 'next/navigation'

type Props = { params: Promise<{ locale: string; bookId: string; chapterId: string }> }

export default async function DiscoverChapterReaderRedirect({ params }: Props) {
  const { locale, bookId, chapterId } = await params
  permanentRedirect(`/${locale}/books/${bookId}/read/${chapterId}`)
}
```

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(public)/discover/book/"
git commit -m "feat(reader): 308 redirect old /discover/book URLs to /books"
```

---

### Task 8: Gate reader-write server actions with canReadBook

**Files:**
- Modify: `lib/actions/reading.actions.ts` (markChapterRead + getReadingProgress)
- Modify: `lib/actions/social.actions.ts` (addComment)

- [ ] **Step 1: Add canReadBook gate to markChapterReadAction**

Open `lib/actions/reading.actions.ts`. In `markChapterReadAction`, after the `requireAuth()` call but before the write, add:

```ts
import { canReadBook } from '@/lib/books/can-read'

// ... inside markChapterReadAction, after auth check, before DB write:
const access = await canReadBook(bookId, userId)
if (!access.ok) return { success: false, error: 'FORBIDDEN' }
```

Do the same in `getReadingProgressAction`:

```ts
const access = await canReadBook(bookId, userId)
if (!access.ok) return { success: false, error: 'FORBIDDEN' }
```

- [ ] **Step 2: Add canReadBook gate to addCommentAction and getCommentsAction**

Open `lib/actions/social.actions.ts` (and any sibling that owns `addCommentAction` / `getCommentsAction` — confirm location via `grep -rn "addCommentAction\|getCommentsAction" lib/actions/`).

In each action, after the auth check (for write) or at the top (for read), add:

```ts
const access = await canReadBook(bookId, userId)
if (!access.ok) return { success: false, error: 'FORBIDDEN' }
```

For `getCommentsAction` which may not have an authenticated user, pass `userId ?? null` — `canReadBook` handles null viewers correctly.

- [ ] **Step 3: Run tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/
git commit -m "feat(reader): gate reader-write actions with canReadBook"
```

---

### Task 9: Schema/validation — add FRIENDS + discoverable to create + update schemas, with coercion

**Files:**
- Modify: `lib/validations/book.ts:3-24` (createBookSchema), `lib/validations/book.ts:26-33` (updateBookSchema), `lib/validations/book.ts:39-59` (updateBookDetailsSchema)
- Modify: `lib/actions/book.actions.ts::createBookAction` (insert visibility + discoverable)
- Modify: `lib/actions/book.actions.ts::updateBookDetailsAction` (persist visibility + discoverable)

- [ ] **Step 1: Add fields + coercion to validation schemas**

Edit `lib/validations/book.ts`:

```ts
// Extend createBookSchema (add to the existing object after the existing fields):
export const createBookSchema = z.object({
  // ... existing fields ...
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']).default('PRIVATE'),
  discoverable: z.boolean().default(false),
}).transform((data) => ({
  ...data,
  // Server-side belt-and-suspenders: discoverable only allowed when PUBLIC
  discoverable: data.visibility === 'PUBLIC' ? data.discoverable : false,
}))

// Extend updateBookSchema:
export const updateBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  genre: z.string().max(50).optional().nullable(),
  synopsis: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']).optional(),
  discoverable: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  coverUrl: z.string().url().optional().nullable(),
})

// Extend updateBookDetailsSchema:
export const updateBookDetailsSchema = z.object({
  // ... existing fields ...
  // Sharing (new section)
  visibility: z.enum(['PRIVATE', 'PUBLIC', 'FRIENDS']),
  discoverable: z.boolean(),
}).transform((data) => ({
  ...data,
  discoverable: data.visibility === 'PUBLIC' ? data.discoverable : false,
}))
```

- [ ] **Step 2: Write schema coercion test**

Add to `lib/validations/book.test.ts` (create if missing):

```ts
import { describe, it, expect } from 'vitest'
import { updateBookDetailsSchema, createBookSchema } from './book'

describe('book schema discoverable coercion', () => {
  const validDetails = {
    title: 'T', synopsis: null, coverUrl: null,
    genre: null, subgenre: null, tags: [], targetAudience: null,
    contentWarnings: [], compTitles: [], language: null,
    seriesName: null, seriesNumber: null, subtitle: null,
  }

  it('updateBookDetailsSchema: PRIVATE + discoverable=true coerces to false', () => {
    const parsed = updateBookDetailsSchema.parse({
      ...validDetails, visibility: 'PRIVATE', discoverable: true,
    })
    expect(parsed.discoverable).toBe(false)
  })

  it('updateBookDetailsSchema: FRIENDS + discoverable=true coerces to false', () => {
    const parsed = updateBookDetailsSchema.parse({
      ...validDetails, visibility: 'FRIENDS', discoverable: true,
    })
    expect(parsed.discoverable).toBe(false)
  })

  it('updateBookDetailsSchema: PUBLIC + discoverable=true keeps true', () => {
    const parsed = updateBookDetailsSchema.parse({
      ...validDetails, visibility: 'PUBLIC', discoverable: true,
    })
    expect(parsed.discoverable).toBe(true)
  })

  it('createBookSchema: PRIVATE + discoverable=true coerces to false', () => {
    const parsed = createBookSchema.parse({
      title: 'T', visibility: 'PRIVATE', discoverable: true,
    })
    expect(parsed.discoverable).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail then implement**

Run: `npm test -- book`
Expected: 4 new tests FAIL.

Once schemas in Step 1 are saved, re-run: `npm test -- book`
Expected: 4 new tests PASS.

- [ ] **Step 4: Persist new fields in createBookAction and updateBookDetailsAction**

In `lib/actions/book.actions.ts::createBookAction`, in the `db.insert(books).values({...})` call, add:

```ts
visibility: parsed.visibility,
discoverable: parsed.discoverable,
```

In `lib/actions/book.actions.ts::updateBookDetailsAction`, in the inner transactional `db.update(books).set({...})` call, add:

```ts
visibility: parsed.visibility,
discoverable: parsed.discoverable,
```

Also update `getBookDetailsAction` to return `visibility` and `discoverable` so the form can read them on load. Confirm the select shape includes those columns.

- [ ] **Step 5: Run tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all passing.

- [ ] **Step 6: Commit**

```bash
git add lib/validations/book.ts lib/validations/book.test.ts lib/actions/book.actions.ts
git commit -m "feat(books): visibility(FRIENDS) + discoverable in create/update schemas with coercion"
```

---

### Task 10: Wizard — new "Sharing" step

**Files:**
- Modify: `app/[locale]/(app)/studio/new/page.tsx` (or the wizard's client component — confirm path with `grep -rn "createBookSchema\|step.*wizard" app/`)
- Create: `app/[locale]/(app)/studio/new/_components/sharing-step.tsx`

- [ ] **Step 1: Locate the wizard step structure**

Run: `grep -rn "useState.*step\|currentStep" app/[locale]/[(]app[)]/studio/new/`
The wizard uses a stepped client component. Find the file that owns the step state.

- [ ] **Step 2: Create the Sharing step component**

Create `app/[locale]/(app)/studio/new/_components/sharing-step.tsx`:

```tsx
'use client'

import { Lock, Users, Globe } from 'lucide-react'

type Visibility = 'PRIVATE' | 'PUBLIC' | 'FRIENDS'

type Props = {
  visibility: Visibility
  discoverable: boolean
  onChange: (next: { visibility?: Visibility; discoverable?: boolean }) => void
}

const OPTIONS: Array<{ value: Visibility; title: string; description: string; icon: typeof Lock; hint?: string }> = [
  { value: 'PRIVATE', title: 'Private', description: 'Only you can read this book.', icon: Lock },
  { value: 'FRIENDS', title: 'Friends only', description: 'You and your friends on Beehive.', icon: Users, hint: 'Requires a friend on Beehive (coming soon)' },
  { value: 'PUBLIC', title: 'Public', description: 'Anyone with the link can read this book.', icon: Globe },
]

export function SharingStep({ visibility, discoverable, onChange }: Props) {
  const isPublic = visibility === 'PUBLIC'
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-[20px] font-semibold mb-1">Sharing</h2>
        <p className="text-[#888] text-[14px]">Who can read your book? You can change this anytime.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(opt => {
          const Icon = opt.icon
          const selected = visibility === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ visibility: opt.value })}
              className={`text-left p-4 rounded-lg border transition-colors ${
                selected ? 'bg-[#FFC300]/10 border-[#FFC300]' : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-[#FFC300]' : 'text-[#888]'}`} />
              <div className="text-white text-[14px] font-semibold mb-0.5">{opt.title}</div>
              <div className="text-[#888] text-[12px]">{opt.description}</div>
              {opt.hint && <div className="text-[#666] text-[11px] mt-1.5">{opt.hint}</div>}
            </button>
          )
        })}
      </div>

      <div className={`p-4 rounded-lg border ${isPublic ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-[#161616] border-[#222]'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={discoverable && isPublic}
            disabled={!isPublic}
            onChange={(e) => onChange({ discoverable: e.target.checked })}
            className="mt-1"
          />
          <div className="flex-1">
            <div className={`text-[14px] font-semibold ${isPublic ? 'text-white' : 'text-[#555]'}`}>
              Discoverable
            </div>
            <div className={`text-[12px] ${isPublic ? 'text-[#888]' : 'text-[#555]'}`}>
              {isPublic
                ? 'Show this book on the Discover page so other writers can find it.'
                : 'Only public books can be discoverable.'}
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the step into the wizard**

In the wizard's main client component (located in Step 1):
1. Add state: `const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC' | 'FRIENDS'>('PRIVATE')` and `const [discoverable, setDiscoverable] = useState(false)`.
2. Insert a new step in the step array between the existing "structure/publishing" step and the final submit. Render `<SharingStep visibility={visibility} discoverable={discoverable} onChange={({ visibility: v, discoverable: d }) => { if (v !== undefined) setVisibility(v); if (d !== undefined) setDiscoverable(d) }} />`.
3. Pass `visibility` and `discoverable` to the `createBookAction` payload on submit.

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/new"
git commit -m "feat(wizard): Sharing step (privacy + discoverable)"
```

---

### Task 11: Details page — new "Sharing" collapsible section

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/details/` form client component (locate via `grep -rn "updateBookDetailsAction" app/`)

- [ ] **Step 1: Locate the Details form**

Run: `grep -rn "updateBookDetailsAction" app/[locale]/[(]app[)]/studio/`
Open the file that contains the four collapsible sections (Basics / Discovery / Structure / Publishing).

- [ ] **Step 2: Add Sharing section**

Add a fifth collapsible section after "Publishing", structured identically. Reuse the `SharingStep` component from Task 10 (move it from `studio/new/_components/` to a shared location like `components/book/sharing-controls.tsx` if it isn't already shared; otherwise import from the wizard path). Provide initial values from the loaded book.

```tsx
import { SharingStep } from '@/components/book/sharing-controls' // post-move location

// Inside the form component, add state for the two fields initialized from the loaded book:
const [visibility, setVisibility] = useState(book.visibility)
const [discoverable, setDiscoverable] = useState(book.discoverable)

// Add to the dirty-state tracking that fires the Save button.

// Add a fifth <CollapsibleSection title="Sharing">:
<CollapsibleSection title="Sharing">
  <SharingStep
    visibility={visibility}
    discoverable={discoverable}
    onChange={({ visibility: v, discoverable: d }) => {
      if (v !== undefined) setVisibility(v)
      if (d !== undefined) setDiscoverable(d)
    }}
  />
</CollapsibleSection>

// Add visibility + discoverable to the updateBookDetailsAction payload on save.
```

- [ ] **Step 3: Move SharingStep to shared location**

```bash
mkdir -p components/book
git mv "app/[locale]/(app)/studio/new/_components/sharing-step.tsx" components/book/sharing-controls.tsx
```

Rename the export from `SharingStep` to `SharingControls` (more accurate; it's not wizard-specific anymore). Update the wizard import.

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/book "app/[locale]/(app)/studio/"
git commit -m "feat(details): Sharing section on /studio/[bookId]/details"
```

---

### Task 12: Editor toolbar — Preview button

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

- [ ] **Step 1: Add the Preview button**

Open the editor toolbar. Find the VIEW zone (the right cluster) — locate the corkboard toggle button as an anchor. Add the Preview button next to it.

Confirm imports include `Eye` from `lucide-react` and `Link` from `next/link`, and access to `locale` + `bookId` (likely already in scope via `useBookEditor()` or props).

```tsx
import Link from 'next/link'
import { Eye } from 'lucide-react'

// Inside the VIEW zone JSX, next to the corkboard toggle:
<Link
  href={`/${locale}/books/${bookId}`}
  aria-label="Preview as reader"
  title="Preview as reader"
  className={tbtnClass(false)}
>
  <Eye className="w-4 h-4" />
</Link>
```

If `locale` isn't already available in this toolbar, get it via:

```ts
import { useParams } from 'next/navigation'
const params = useParams<{ locale: string; bookId: string }>()
const locale = params?.locale ?? 'en'
const bookId = params?.bookId ?? ''
```

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "feat(editor): Preview button in toolbar opens /books/[bookId]"
```

---

### Task 13: Binder header book title becomes a Link

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx` (around line 206)

- [ ] **Step 1: Wrap the book title display in a Link**

Open `binder-tree.tsx`. Find the JSX around line 206-215 where `isRenamingBook` branches between the input and the displayed title. The displayed title is the `else` branch.

Currently the title is a `<span>` or `<div>` with `onDoubleClick={() => setIsRenamingBook(true)}`. Wrap the visible title in a `<Link>` to the reader, preserving the double-click rename:

```tsx
import Link from 'next/link'
import { useParams } from 'next/navigation' // if not already imported

// In the displayed-title branch (else of isRenamingBook):
<Link
  href={`/${locale}/books/${bookId}`}
  onDoubleClick={(e) => {
    e.preventDefault()
    setIsRenamingBook(true)
  }}
  aria-label="Preview as reader"
  className="text-white text-[14px] font-semibold truncate hover:underline"
>
  {localBookTitle}
</Link>
```

Notes:
- The `onDoubleClick` handler calls `e.preventDefault()` to stop the Link navigation when double-clicking to rename.
- Single click → reader navigation.
- Double click → enters rename mode (preserves existing behavior).
- Preserve any existing className styling — the example shows the common shape but you should keep whatever classes were on the original element and just add `hover:underline`.

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx"
git commit -m "feat(binder): book title in header links to reader"
```

---

### Task 14: Update AGENTS.md Resume Here block

**Files:**
- Modify: `AGENTS.md` (Resume Here block + What Has Been Built section)

- [ ] **Step 1: Add SP-A entry to "What Has Been Built"**

Edit `AGENTS.md`. After the "Studio Library Redesign" section, add a new "### SP-A — Reader Route + Privacy/Discoverable ✅ COMPLETE (YYYY-MM-DD)" section that summarizes the shipped work in the same level of detail as existing entries: schema changes (FRIENDS enum + explorable→discoverable + index + backfill), `canReadBook` helper, new routes, redirects, settings UI, editor entry points, test count.

- [ ] **Step 2: Update Resume Here block**

Bump `Last updated`, refresh `Current focus` to summarize SP-A and signal SP-B Friendships as next, update `Last commit` to match the most recent commit, refresh `Next concrete step when resuming` to point at SP-B brainstorming.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync Resume Here — SP-A reader route shipped"
```

---

### Task 15: Full-suite verification + manual checklist

- [ ] **Step 1: Run tests**

Run: `npm test`
Expected: all tests pass. New tests added: 6 in `can-read.test.ts` + 4 in `book.test.ts` = 10. Total should be 136 (was 126).

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification (Chris runs this — write findings into commit message of any fix commits)**

- Create a new PRIVATE book via the wizard. Confirm the Sharing step appears. Confirm `/[locale]/books/[bookId]` shows the reader for the author.
- Sign out (or open incognito). Visit `/[locale]/books/[bookId]` — confirm "This book is private" screen.
- Flip the book to PUBLIC via /studio/[bookId]/details Sharing section. Confirm incognito viewer can now read.
- Flip to FRIENDS. Incognito viewer should see "Only the author's friends can read this." Author still sees it.
- Toggle `discoverable=true` while PUBLIC. Confirm it appears on `/[locale]/discover`. Toggle off. Confirm it disappears from /discover but `/books/[bookId]` URL still works.
- Visit old URL `/[locale]/discover/book/[bookId]` — confirm 308 redirect to `/[locale]/books/[bookId]`.
- In the editor: click the Eye button in the toolbar → opens reader. Click the book title in the binder header → opens reader. Double-click the title → enters rename mode (does NOT navigate).
- Mark a chapter as read from the reader as the author. Reopen reader — progress bar reflects it.

- [ ] **Step 4: Fix any issues found, then push**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**
- §1 Schema → Task 1 ✅
- §2 canReadBook → Task 2 ✅
- §3 Route structure → Tasks 4, 5, 6, 7 ✅
- §4 Settings UI → Tasks 9, 10, 11 ✅
- §5 Editor entry points → Tasks 12, 13 ✅
- §6 Reader behavior → covered by Tasks 5, 6 (component reuse from existing reader which already implements §6 semantics) ✅
- §7 Testing → Task 2 unit tests + Task 9 schema tests + Task 15 manual checklist ✅
- §8 Out of scope → respected (no friendships, no library card change, no share popover, no friend-aware surfaces, no OG cards) ✅

**Migration smoke test note:** the spec mentions a SQL assertion smoke test after `db:push`. Task 1 Step 3 runs the backfill SQL directly; a separate assertion query (`SELECT COUNT(*) FROM books WHERE discoverable=true`) can be eyeballed against the pre-migration count of books that satisfied `status='PUBLISHED' AND visibility='PUBLIC'`. Treated as part of Task 1 verification rather than a separate task.

**Placeholder scan:** no TBDs, no "implement later," no "handle edge cases." Every step has either code or an exact command.

**Type consistency:** `canReadBook` returns `BookAccess` consistently across Tasks 2/5/6/8. `SharingControls`/`SharingStep` rename handled explicitly in Task 11 Step 3.

**Note on Task 11 import path:** Task 10 creates `studio/new/_components/sharing-step.tsx`; Task 11 Step 3 moves it to `components/book/sharing-controls.tsx`. The wizard's import in Task 10 will need to be updated when the move happens — handle that in Task 11 Step 3 as part of the `git mv` followup.
