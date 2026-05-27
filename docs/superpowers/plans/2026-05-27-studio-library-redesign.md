# Studio Library Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/[locale]/studio` from a bare card grid into a richer "library" surface — Continue-Writing hero + stats header, search/sort/filter controls, hover-overlay cards, refreshed empty state.

**Architecture:** Five atomic tasks foundation-up. Server-side data first (extend `BookSummary` projection + new `getStudioStatsAction`). Then bottom-up component build (BookCard with hover → BookGrid + controls → Header). Then empty state. Then page wire-up + AGENTS.md + push.

**Tech Stack:** Next.js 16 App Router (server component page), Drizzle ORM (aggregate queries), Tailwind v4 (`group-hover` for card overlays), shadcn/Tailwind paper-context + cool-chrome tokens.

**Spec:** [`docs/superpowers/specs/2026-05-27-studio-library-redesign-design.md`](../specs/2026-05-27-studio-library-redesign-design.md)

---

## File Structure

**New (8 files):**
- `lib/books/summarize-status.ts`
- `app/[locale]/(app)/studio/_components/book-card.tsx`
- `app/[locale]/(app)/studio/_components/book-grid.tsx`
- `app/[locale]/(app)/studio/_components/studio-controls.tsx`
- `app/[locale]/(app)/studio/_components/studio-header.tsx`
- `app/[locale]/(app)/studio/_components/continue-writing-hero.tsx`
- `app/[locale]/(app)/studio/_components/studio-stats.tsx`
- `app/[locale]/(app)/studio/_components/studio-empty-state.tsx`

**Modified:**
- `lib/actions/book.actions.ts` (extend `BookSummary` projection + add `getStudioStatsAction`)
- `app/[locale]/(app)/studio/page.tsx` (full rewrite)
- `AGENTS.md`

**No DB schema changes. No new dependencies. No new tests** (UI integration; manual verification).

---

## Task 1: Data layer — extend BookSummary + new getStudioStatsAction

**Files:**
- Modify: `lib/actions/book.actions.ts`
- New: `lib/books/summarize-status.ts`

- [ ] **Step 1: Read current `getUserBooksAction`**

```bash
grep -n "getUserBooksAction\|BookSummary" lib/actions/book.actions.ts | head -10
```

Read the current projection. Note:
- What fields are currently SELECTed.
- Where `wordCount` comes from (likely a column on `books` OR a SUM from chapters; confirm).
- Whether `genre` is on `books` (per spec §4.5 it should be).
- Whether `publishedAt` is on `books` (per Phase 8 work it's `status='PUBLISHED'` instead — verify).

- [ ] **Step 2: Identify the right fields**

Per the spec, the new `BookSummary` needs:
- existing: `id`, `title`, `coverUrl`, `wordCount`
- new: `genre`, `lastEditedAt`, `chapterCount`, `publishedAt` (or `status === 'PUBLISHED'` equivalent), `status` (computed)

Read `db/schema/books.ts` (or wherever `books` lives) + `db/schema/binder-items.ts` (chapters live there as `type='chapter'`). Confirm field names.

Reminder from Phase 8 P8C: there's NO `books.publishedAt` column. Books have a `status` field (PUBLISHED / DRAFT / etc.) — confirm during read.

- [ ] **Step 3: Build the `summarizeBookStatus` helper**

```ts
// lib/books/summarize-status.ts
export type BookSummaryStatus = 'Drafting' | 'Revised' | 'Published'

type Input = {
  bookStatus: string | null   // from books.status (e.g., 'PUBLISHED' / 'DRAFT')
  chapterStatuses: ('IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL')[]
}

/**
 * Rolls chapter-level statuses up to a single book-level status for the
 * library card overlay + filter chip counts. Same helper drives both so
 * counts and labels stay in sync.
 *
 * - If the book itself is PUBLISHED → 'Published'.
 * - Else if all chapters are REVISED or FINAL (and at least one exists) → 'Revised'.
 * - Else → 'Drafting' (default, includes empty books).
 */
export function summarizeBookStatus({ bookStatus, chapterStatuses }: Input): BookSummaryStatus {
  if (bookStatus === 'PUBLISHED') return 'Published'

  if (chapterStatuses.length > 0) {
    const allRevisedOrFinal = chapterStatuses.every(s => s === 'REVISED' || s === 'FINAL')
    if (allRevisedOrFinal) return 'Revised'
  }

  return 'Drafting'
}
```

- [ ] **Step 4: Extend `BookSummary` type + projection**

In `lib/actions/book.actions.ts`, find the `BookSummary` type definition. Extend:

```ts
export type BookSummary = {
  id: string
  title: string
  coverUrl: string | null
  wordCount: number
  // NEW
  genre: string | null
  lastEditedAt: Date
  chapterCount: number
  status: BookSummaryStatus       // from summarizeBookStatus()
  isPublished: boolean             // shortcut for the hero / filter chip
}
```

Modify `getUserBooksAction` to also project `genre` from `books`, and run a parallel chapter aggregate per book to derive `lastEditedAt`, `chapterCount`, and the array of chapter statuses (or just SELECT them all up front and group in JS).

Cheapest approach:
1. Fetch all the user's books.
2. Fetch all chapters for those books in one query (`WHERE bookId IN (...)`).
3. Zip in JS: per book, count chapters, find max(updatedAt), collect statuses, call `summarizeBookStatus`.

- [ ] **Step 5: Add `getStudioStatsAction`**

```ts
export type StudioStats = {
  totalWords: number
  booksInProgress: number
  wordsThisWeek: number
  chaptersPublished: number
}

/**
 * Aggregate stats for the /studio header strip.
 *
 * wordsThisWeek caveat: sums word counts for CHAPTERS UPDATED in the
 * last 7 days, not "words added this week" (we don't track per-day
 * deltas). Acceptable productivity proxy.
 */
export async function getStudioStatsAction(): Promise<ActionResult<StudioStats>> {
  const userId = await requireAuth()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000)

  // Run 4 aggregates in parallel.
  const [totalWords, booksInProgress, wordsThisWeek, chaptersPublished] = await Promise.all([
    /* SUM(chapters.wordCount) for chapters of user's books */,
    /* COUNT(books) WHERE userId AND status <> 'PUBLISHED' */,
    /* SUM(chapters.wordCount) WHERE chapter.updatedAt > sevenDaysAgo */,
    /* COUNT(chapters) WHERE chapter's book is PUBLISHED */,
  ])

  return {
    success: true,
    data: {
      totalWords: totalWords ?? 0,
      booksInProgress: booksInProgress ?? 0,
      wordsThisWeek: wordsThisWeek ?? 0,
      chaptersPublished: chaptersPublished ?? 0,
    },
  }
}
```

Adapt the Drizzle queries to actual schema. Use `sql<number>` with `count()` and `sum()` from drizzle-orm.

- [ ] **Step 6: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 126.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/book.actions.ts lib/books/summarize-status.ts
git commit -m "feat(studio): extend BookSummary + getStudioStatsAction (Library Task 1)

BookSummary projection adds genre, lastEditedAt (MAX of chapter
updatedAt), chapterCount, status (Drafting/Revised/Published via
new summarizeBookStatus helper), isPublished.

summarizeBookStatus(book) rolls chapter-level statuses to a book-level
label — same helper drives card overlays + filter chip counts so
they stay in sync.

getStudioStatsAction (new): 4 aggregates for the header stats strip
(totalWords / booksInProgress / wordsThisWeek / chaptersPublished).

No DB schema changes."
```

---

## Task 2: BookCard with hover overlay + StudioEmptyState

**Files:**
- New: `app/[locale]/(app)/studio/_components/book-card.tsx`
- New: `app/[locale]/(app)/studio/_components/studio-empty-state.tsx`

- [ ] **Step 1: Build BookCard**

```tsx
// app/[locale]/(app)/studio/_components/book-card.tsx
import Link from 'next/link'
import { BookMarked, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary
  locale: string
}

function statusColor(status: BookSummary['status']): string {
  switch (status) {
    case 'Published': return 'var(--status-final)'
    case 'Revised':   return 'var(--status-revised)'
    case 'Drafting':  return 'var(--status-first-draft)'
  }
}

function formatRelative(d: Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function BookCard({ book, locale }: Props) {
  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-brand/30 transition-colors"
    >
      {/* Cover — paper-warm placeholder */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--paper-100)', color: 'var(--paper-ink-strong)' }}
          >
            <BookMarked size={32} className="opacity-40" />
          </div>
        )}

        {/* Hover overlay — dashboard data */}
        <div
          className="absolute inset-0 flex flex-col justify-end gap-2 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            background: 'linear-gradient(to top, oklch(0 0 0 / 0.85) 0%, oklch(0 0 0 / 0.7) 50%, oklch(0 0 0 / 0) 100%)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-white">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: 'oklch(from ' + statusColor(book.status) + ' l c h / 0.25)',
                color: statusColor(book.status),
                border: `1px solid ${statusColor(book.status)}40`,
              }}
            >
              {book.status}
            </span>
            {book.genre && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-white/15 text-white/90">
                {book.genre}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/85">
            <Clock size={11} />
            <span>{formatRelative(book.lastEditedAt)}</span>
            <span className="text-white/50">·</span>
            <span>{book.chapterCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
          </div>
        </div>
      </div>

      {/* Info — visible at rest */}
      <div className="p-3 flex flex-col gap-0.5">
        <p className={cn(
          'text-sm font-medium text-foreground truncate transition-colors',
          'group-hover:text-brand',
        )}>
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {book.wordCount.toLocaleString()} words
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Build StudioEmptyState**

```tsx
// app/[locale]/(app)/studio/_components/studio-empty-state.tsx
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { CreateBookModal } from './create-book-modal'

type Props = {
  locale: string
  templates: { id: string; name: string; genre: string | null }[]
}

export function StudioEmptyState({ locale, templates }: Props) {
  return (
    <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col items-center text-center py-28 px-6 max-w-lg">
        <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
          <BookOpen className="w-9 h-9 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mainFont mb-2">Your stories start here</h1>
        <p className="text-sm text-muted-foreground mb-7 max-w-sm">
          Write your own book or discover stories from other writers.
        </p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <CreateBookModal locale={locale} templates={templates}>
            <button className="px-5 py-2.5 rounded-full bg-brand text-brand-ink text-sm font-bold mainFont hover:bg-brand-hover transition-colors">
              Start writing
            </button>
          </CreateBookModal>
          <Link
            href={`/${locale}/discover`}
            className="px-5 py-2.5 rounded-full border border-border text-foreground text-sm font-medium hover:border-foreground/50 transition-colors"
          >
            Explore books
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/_components/book-card.tsx" "app/[locale]/(app)/studio/_components/studio-empty-state.tsx"
git commit -m "feat(studio): BookCard with hover overlay + StudioEmptyState (Library Task 2)

BookCard:
- Cover area paper-warm (paper-100 bg + paper-ink-strong icon) for
  the no-cover placeholder; cover image otherwise.
- Title + word count visible at rest.
- group-hover overlay reveals status pill (--status-* tinted), genre
  pill, last-edited relative time, chapter count.
- CSS-only — no JS state.
- Title goes brand-yellow on hover (existing pattern).

StudioEmptyState: rounded-card icon + 'Your stories start here' +
dual CTAs (Start writing / Explore books). Replaces the floating
illustration."
```

---

## Task 3: StudioControls + BookGrid (client component)

**Files:**
- New: `app/[locale]/(app)/studio/_components/studio-controls.tsx`
- New: `app/[locale]/(app)/studio/_components/book-grid.tsx`

- [ ] **Step 1: Build the controls + grid as one client component (state lives in BookGrid)**

The cleanest way: BookGrid owns the search/sort/filter state and renders the controls inline at the top. Single file, simpler than threading callbacks.

```tsx
// app/[locale]/(app)/studio/_components/book-grid.tsx
'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookCard } from './book-card'
import type { BookSummary } from '@/lib/actions/book.actions'

type SortOption = 'recent' | 'title' | 'wordCount'
type StatusFilter = 'all' | 'Drafting' | 'Revised' | 'Published'

type Props = {
  books: BookSummary[]
  locale: string
}

export function BookGrid({ books, locale }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('recent')
  const [filter, setFilter] = useState<StatusFilter>('all')

  // Counts per status (used by the filter chips). Always reflects the full
  // book set, not the filtered/searched view — chips show "how many books
  // I have in each status."
  const counts = useMemo(() => {
    const c = { all: books.length, Drafting: 0, Revised: 0, Published: 0 }
    for (const b of books) c[b.status]++
    return c
  }, [books])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = books
    if (q) {
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        (b.genre ?? '').toLowerCase().includes(q),
      )
    }
    if (filter !== 'all') {
      result = result.filter(b => b.status === filter)
    }
    const sorted = [...result]
    if (sort === 'recent') sorted.sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime())
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'wordCount') sorted.sort((a, b) => b.wordCount - a.wordCount)
    return sorted
  }, [books, query, sort, filter])

  return (
    <div className="flex flex-col gap-5">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title or genre…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-brand/40 transition-colors"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortOption)}
          className="px-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-brand/40 cursor-pointer"
        >
          <option value="recent">Recent</option>
          <option value="title">A → Z</option>
          <option value="wordCount">Word count</option>
        </select>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'Drafting', 'Revised', 'Published'] as const).map(key => {
          const count = counts[key]
          if (key !== 'all' && count === 0) return null
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                active
                  ? 'bg-brand text-brand-ink'
                  : 'bg-card border border-border text-foreground hover:border-foreground/30',
              )}
            >
              {key === 'all' ? 'All' : key}
              <span className={cn(
                'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold',
                active ? 'bg-brand-ink/15 text-brand-ink' : 'bg-brand text-brand-ink',
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map(book => (
            <BookCard key={book.id} book={book} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {query ? `No results for "${query}"` : 'No books match the current filter.'}
          </p>
          <button
            onClick={() => { setQuery(''); setFilter('all') }}
            className="text-sm text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/_components/book-grid.tsx"
git commit -m "feat(studio): BookGrid with search + sort + filter chips (Library Task 3)

Client component owns search/sort/filter state. Renders controls
row (search input + sort dropdown) + filter chip row + responsive
grid (2-5 cols). Counts on chips reflect the full book set, not the
filtered view.

Empty-results-mid-filter shows a 'No results / Clear filters' nudge.

Inline state — no URL persistence at v1 per spec §6 risk 5."
```

---

## Task 4: StudioHeader (Hero + Stats)

**Files:**
- New: `app/[locale]/(app)/studio/_components/studio-header.tsx`
- New: `app/[locale]/(app)/studio/_components/continue-writing-hero.tsx`
- New: `app/[locale]/(app)/studio/_components/studio-stats.tsx`

- [ ] **Step 1: Build StudioStats**

```tsx
// app/[locale]/(app)/studio/_components/studio-stats.tsx
import type { StudioStats } from '@/lib/actions/book.actions'

const FORMATTER = new Intl.NumberFormat('en-US')

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 px-4 rounded-lg bg-card border border-border">
      <span
        className="text-2xl font-bold text-foreground"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
      >
        {FORMATTER.format(value)}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

export function StudioStats({ stats }: { stats: StudioStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile value={stats.totalWords} label="Total words" />
      <StatTile value={stats.booksInProgress} label="Books in progress" />
      <StatTile value={stats.wordsThisWeek} label="Words this week" />
      <StatTile value={stats.chaptersPublished} label="Chapters published" />
    </div>
  )
}
```

- [ ] **Step 2: Build ContinueWritingHero**

```tsx
// app/[locale]/(app)/studio/_components/continue-writing-hero.tsx
import Link from 'next/link'
import { BookMarked } from 'lucide-react'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary
  locale: string
}

export function ContinueWritingHero({ book, locale }: Props) {
  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      className="group relative flex gap-4 rounded-xl border border-border bg-card p-4 hover:border-brand/30 transition-colors"
    >
      {/* Cover thumbnail */}
      <div className="relative w-20 h-28 shrink-0 overflow-hidden rounded-md">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--paper-100)', color: 'var(--paper-ink-strong)' }}
          >
            <BookMarked size={20} className="opacity-40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Continue writing
        </span>
        <h2
          className="text-xl font-bold text-foreground truncate group-hover:text-brand transition-colors"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {book.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {book.wordCount.toLocaleString()} words · {book.chapterCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}
        </p>
        <div className="mt-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand text-brand-ink text-xs font-bold mainFont group-hover:bg-brand-hover transition-colors">
            Resume writing →
          </span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Build StudioHeader (composes both)**

```tsx
// app/[locale]/(app)/studio/_components/studio-header.tsx
import { ContinueWritingHero } from './continue-writing-hero'
import { StudioStats } from './studio-stats'
import type { BookSummary, StudioStats as StudioStatsT } from '@/lib/actions/book.actions'

type Props = {
  recentBook: BookSummary
  stats: StudioStatsT
  locale: string
}

export function StudioHeader({ recentBook, stats, locale }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-6">
      <ContinueWritingHero book={recentBook} locale={locale} />
      <StudioStats stats={stats} />
    </div>
  )
}
```

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/studio/_components/studio-header.tsx" "app/[locale]/(app)/studio/_components/continue-writing-hero.tsx" "app/[locale]/(app)/studio/_components/studio-stats.tsx"
git commit -m "feat(studio): StudioHeader = Hero + Stats (Library Task 4)

ContinueWritingHero: most-recently-edited book — cover thumbnail,
title, word count + chapter count, brand-yellow Resume writing CTA.
Click anywhere on the card navigates into the book.

StudioStats: 4 tiles (Total words / Books in progress / Words this
week / Chapters published) with Comfortaa numbers + muted labels.

StudioHeader composes both in a 3:2 grid that stacks on narrow."
```

---

## Task 5: Wire it all up in page.tsx + AGENTS.md + push

**Files:**
- Modify: `app/[locale]/(app)/studio/page.tsx` (full rewrite)
- Modify: `AGENTS.md`

- [ ] **Step 1: Rewrite page.tsx**

```tsx
// app/[locale]/(app)/studio/page.tsx
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserBooksAction, getStudioStatsAction } from '@/lib/actions/book.actions'
import { CreateBookModal } from './_components/create-book-modal'
import { StudioEmptyState } from './_components/studio-empty-state'
import { StudioHeader } from './_components/studio-header'
import { BookGrid } from './_components/book-grid'

export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [templates, booksResult, statsResult] = await Promise.all([
    db
      .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
      .from(bookTemplates)
      .where(eq(bookTemplates.isSystemTemplate, true))
      .orderBy(bookTemplates.name),
    getUserBooksAction(),
    getStudioStatsAction(),
  ])

  const books = booksResult.success ? booksResult.data : []
  const stats = statsResult.success
    ? statsResult.data
    : { totalWords: 0, booksInProgress: 0, wordsThisWeek: 0, chaptersPublished: 0 }

  if (books.length === 0) {
    return <StudioEmptyState locale={locale} templates={templates} />
  }

  // Most-recently-edited book — sort defensively here so the hero is stable
  // regardless of getUserBooksAction's default ordering.
  const recentBook = [...books].sort(
    (a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime(),
  )[0]

  return (
    <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Library</h1>
        <CreateBookModal locale={locale} templates={templates}>
          <button className="rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2 font-bold font-display bg-brand text-brand-ink shadow-[0_4px_16px_-8px_oklch(from_var(--brand)_l_c_h/0.55)] hover:bg-brand-hover transition-colors">
            <Plus size={16} strokeWidth={2.5} />
            New Book
          </button>
        </CreateBookModal>
      </div>

      <StudioHeader recentBook={recentBook} stats={stats} locale={locale} />

      <BookGrid books={books} locale={locale} />
    </main>
  )
}
```

Note: the page title changed from "My Books" to "Library" to match the bookshelf metaphor. If Chris prefers "My Books," revert during impl.

- [ ] **Step 2: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 126.

- [ ] **Step 3: Manual smoke (Chris does)**

Walk through the 13-item manual checklist from spec §7:
1. New user (zero books) → empty state.
2. Click "Start writing" → CreateBookModal.
3. With books → header + controls + grid render.
4. Hero shows most-recent book; click navigates.
5. Stats show 4 real numbers.
6. Hover card → overlay reveals status / last edited / chapter count / genre.
7. Click card → navigates.
8. Search filters live.
9. Sort dropdown reorders.
10. Filter chips work with counts.
11. New Book → create + appears.
12. Wide vs narrow viewport works.
13. tsc + tests clean.

If any fail, fix before Step 4.

- [ ] **Step 4: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-27
- Current focus: "Studio Library redesign complete. /studio is now a richer bookshelf surface with Continue-Writing hero + stats + hover-overlay cards + search/sort/filter."
- Last commit: `git log -1 --format=%s` after the AGENTS.md commit.
- Next concrete step: "Open for what's next — Phase 9 candidates (referral codes, growth analytics, plan-upgrade nudges, polish), continued post-launch work, or configure the Stripe dashboard webhook for the live monetization flow."

Add a pattern entry alongside existing ones:

> **Studio Library pattern:** `/[locale]/studio` is the user's bookshelf — Continue-Writing hero + 4-stat strip header, search + sort + filter chips, hover-overlay book cards revealing status/last-edited/chapter-count/genre/progress. Hero/stats data via `getStudioStatsAction`; book projection extended with `summarizeBookStatus()` helper that rolls chapter statuses up to a single book label (Drafting/Revised/Published). Same helper drives card overlays AND filter chip counts so they stay in sync. Cards: paper-warm covers on cool gray chrome (the only "warm" element on the page; everything else uses chrome tokens).

Add a "Studio Library Redesign" entry under "What Has Been Built":

```markdown
### Studio Library Redesign ✅ COMPLETE (2026-05-27)
Replaces the bare card grid at `/[locale]/studio` with a richer library surface.

- **Header section:** ContinueWritingHero (most-recently-edited book — cover + title + word count + Resume writing CTA) + StudioStats (4 tiles: Total words / Books in progress / Words this week / Chapters published).
- **Controls row:** search input (filters by title/genre) + sort dropdown (Recent / A→Z / Word count) + filter chips with counts (All / Drafting / Revised / Published).
- **Cards:** minimal at rest (cover + title + word count); hover overlay reveals status pill (--status-* tinted), genre pill, last-edited relative time, chapter count. CSS-only via `group-hover` — no JS state.
- **Paper-warm covers** (paper-100 + paper-ink-strong) on cool gray chrome. Only "warm" element on the page.
- **Empty state:** rounded-card BookOpen icon + "Your stories start here" + dual CTAs (Start writing / Explore books). Replaces the floating illustration.
- **Data shape additions:** `BookSummary` projection extended with `genre`, `lastEditedAt`, `chapterCount`, `status` (computed via new `summarizeBookStatus()` helper). New `getStudioStatsAction` aggregates 4 stats.

No DB schema changes. No new dependencies. 126/126 tests, tsc clean.
```

- [ ] **Step 5: Commit + push**

```bash
git add app/[locale]/(app)/studio/page.tsx AGENTS.md
git commit -m "feat(studio): wire library page composition + close (Library Task 5)

page.tsx full rewrite. Branches: empty → StudioEmptyState; populated
→ Library shell (top bar + StudioHeader + BookGrid). New Book CTA
in the top bar; Library title swaps for the old 'My Books.'

AGENTS.md updated: Studio Library entry under What Has Been Built;
pattern entry in Key Patterns.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 5 atomic commits (Task 1, 2, 3, 4, 5 + AGENTS.md in Task 5).
- All 13 manual tests pass (spec §7).
- `tsc` clean. `npm test` clean (126).
- `BookSummary` projection extended with genre / lastEditedAt / chapterCount / status / isPublished.
- `summarizeBookStatus()` helper used by both card overlays AND filter chip counts.
- `getStudioStatsAction` returns valid 4-stat data.
- ContinueWritingHero, StudioStats, StudioHeader, StudioControls (in BookGrid), BookCard with hover overlay, StudioEmptyState all wired.
- Page renders for empty + populated states.
- AGENTS.md Resume Here + Studio Library entry + pattern entry.
- Pushed to origin/main.
