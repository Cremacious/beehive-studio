# Phase 6 — Discover Feed Design

**Date:** 2026-05-13
**Status:** Approved

## Overview

Phase 6 adds a public discovery feed at `/discover` where readers and writers can browse published books by genre and sort order, read books in-browser, and interact socially (like, bookmark, follow, comment). No auth is required to browse; social actions require sign-in and show a prompt for guests.

---

## Scope

**In scope:**
- `/discover` feed: genre filter pills, three sort modes (Trending / Popular / New), book card grid, Writers to Follow strip, Load More pagination
- `/discover/book/[bookId]` detail page: cover, synopsis, stats, chapter list with read progress, like/bookmark/follow actions, comments
- `/discover/book/[bookId]/read/[chapterId]` chapter reader: focused reading view, auto-progress tracking, prev/next navigation
- Social server actions: like, bookmark, follow, comment, reading progress
- Discovery server actions: feed query, public book query, comments query

**Out of scope:**
- Notifications (Phase 7)
- Author profile pages (Phase 7)
- Search / full-text search
- Reading font/size settings
- Export from discover (readers use the book's own export if the author enables it)
- Hives and Sparks in the discover feed (Phase 7)

---

## Route Structure

Discover moves from `(app)` to `(public)` so unauthenticated visitors can browse. The existing `app/[locale]/(app)/discover/page.tsx` stub is deleted and replaced.

```
app/[locale]/(public)/discover/page.tsx
app/[locale]/(public)/discover/book/[bookId]/page.tsx
app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx
```

All three pages are server components with server-side data fetching. Social interaction buttons are client components that call server actions.

**URL parameters (feed page):**

| Param | Values | Default |
|---|---|---|
| `sort` | `trending` \| `popular` \| `new` | `trending` |
| `genre` | any genre string from `books.genre` | (none) |
| `page` | integer ≥ 1 | `1` |

---

## Discoverability Contract

A book appears in the feed when `status = 'PUBLISHED'` AND `visibility = 'PUBLIC'`. The existing `publishBookAction` already sets both. No new flag is needed.

---

## Feed Page

### Layout

- **Filter bar:** Trending / Popular / New toggle (pill group) + genre filter pills. Active genre gets brand-yellow highlight with ✕ to clear. Active sort is yellow.
- **Context label:** A one-line description below the filter bar explaining the active sort in plain English (e.g. "Books gaining the most likes and readers this week").
- **Book grid:** 4 columns, 20 books per page. Each card: 2:3 cover image, genre badge, title, author username, word count, like count, bookmark count.
- **Writers to Follow strip:** Horizontal row of 3 author cards below the grid. Shows authors whose books have the most new likes in the last 7 days, one entry per author. Hidden when a genre filter is active.
- **Load More:** Button-based pagination. The grid is wrapped in a `LoadMoreFeed` client component that holds the accumulated book list in state, calls `getDiscoverFeedAction` on each click, and appends results. The initial page's books are passed in as a prop from the server component.

### Sort Algorithms

| Sort | Logic | URL |
|---|---|---|
| **Trending** | Count of likes + bookmarks on the book where `createdAt > now - 7 days`, descending | `?sort=trending` |
| **Popular** | Total likes + bookmarks of all time, descending | `?sort=popular` |
| **New** | `books.publishedAt` descending | `?sort=new` |

Counts are computed live (no cache) from the `bookLikes` and `bookmarks` tables. Page size: 20.

---

## Book Detail Page

### Layout

**Hero section (grid: 160px cover | rest):**
- Cover image (2:3 ratio, gradient placeholder if no cover)
- Title, author username (links to author profile — stub for now), Follow button
- Genre + tag pills
- Stats: Words · Chapters · Likes (no "Readers" stat)
- Synopsis (`books.synopsis`)
- Action row: **Start Reading** (yellow, primary) · **♥ Like** · **🔖 Bookmark**

**Reading progress bar** (shown only after the user has read ≥ 1 chapter):
- Full-width bar below hero, shows `chaptersRead / totalChapters`
- "Continue →" link jumps to last chapter read (`readingProgress.chapterId`)

**Two-column body:**
- Left: Chapter list — number, title, word count, read status (✓ Read / Reading / blank). First 5 shown; "+ N more chapters" expands the rest.
- Right: Comments panel — comment count, add-comment input (requires auth), list of comments (author avatar, username, timestamp, body). "Show N more" loads older comments.

### Chapter List Behavior

Clicking any chapter navigates to `/discover/book/[bookId]/read/[chapterId]`.

"Start Reading" links to chapter 1 for first-time visitors; if `readingProgress` exists for this user + book, it redirects to the last-read chapter instead.

---

## Chapter Reader Page

### Layout

- **Top bar (minimal):** "← Book Title" back-link | chapter X of N progress indicator + mini progress bar | ♥ Like book + 🔖 Bookmark (apply to book, not chapter)
- **Reading column:** 640px max-width, centered, `font-size: 16px`, `line-height: 1.9`. Chapter number + title as heading, then body paragraphs.
- **Footer nav:** ← Previous chapter (subtle border button) | chapter info (word count) | Next chapter → (yellow button)

### Progress Tracking

The chapter reader is a server component. It calls `markChapterReadAction(bookId, chapterId)` directly during render (unauthenticated users get `AUTH_REQUIRED` and the call is a no-op). It upserts a row in `readingProgress`:

```
(userId, bookId, chapterId, lastReadAt)
```

This updates the progress bar on the book detail page and drives the "Continue →" link. No explicit "mark as read" button.

---

## Social Interactions

All social actions are in `lib/actions/social.actions.ts`. Auth is required; unauthenticated callers receive `{ success: false, error: 'AUTH_REQUIRED' }` and the UI shows an inline sign-in prompt.

| Action | Behavior |
|---|---|
| `toggleBookLikeAction(bookId)` | Like if not liked; unlike if already liked |
| `toggleBookmarkAction(bookId)` | Bookmark if not bookmarked; remove if already bookmarked |
| `toggleFollowAction(targetUserId)` | Follow/unfollow a writer |
| `addCommentAction(bookId, content)` | Create comment (max 1000 chars, validated) |

Buttons show immediate optimistic state (toggle class) before the action resolves.

---

## New Server Actions

**`lib/actions/discover.actions.ts`**

```ts
getDiscoverFeedAction(sort: 'trending' | 'popular' | 'new', genre?: string, page?: number)
  → ActionResult<{ books: DiscoverBook[]; hasMore: boolean }>

getPublicBookAction(bookId: string)
  → ActionResult<{ book: PublicBook; author: PublicAuthor; likeCount: number; bookmarkCount: number }>

getBookCommentsAction(bookId: string, page?: number)
  → ActionResult<{ comments: BookComment[]; hasMore: boolean }>
```

**`lib/actions/reading.actions.ts`**

```ts
markChapterReadAction(bookId: string, chapterId: string)
  → ActionResult<void>

getReadingProgressAction(bookId: string)
  → ActionResult<{ lastChapterId: string | null; chaptersRead: string[] }>
```

**`lib/actions/social.actions.ts`**

```ts
toggleBookLikeAction(bookId: string)     → ActionResult<{ liked: boolean }>
toggleBookmarkAction(bookId: string)     → ActionResult<{ bookmarked: boolean }>
toggleFollowAction(targetUserId: string) → ActionResult<{ following: boolean }>
addCommentAction(bookId: string, content: string) → ActionResult<BookComment>
```

---

## Files to Create / Modify

### New
- `app/[locale]/(public)/discover/page.tsx` — feed page (server component)
- `app/[locale]/(public)/discover/book/[bookId]/page.tsx` — book detail (server component)
- `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx` — chapter reader (server component)
- `app/[locale]/(public)/discover/_components/book-card.tsx` — feed card (client component)
- `app/[locale]/(public)/discover/_components/feed-filters.tsx` — sort toggle + genre pills (client component, updates URL)
- `app/[locale]/(public)/discover/_components/writers-strip.tsx` — Writers to Follow row (not rendered server-side when genre filter is active)
- `app/[locale]/(public)/discover/_components/load-more-feed.tsx` — client component holding accumulated book list state
- `app/[locale]/(public)/discover/_components/chapter-list.tsx` — expandable chapter list with read status
- `app/[locale]/(public)/discover/_components/comments-panel.tsx` — comment list + add form
- `app/[locale]/(public)/discover/_components/social-actions.tsx` — like/bookmark/follow buttons with optimistic state
- `lib/actions/discover.actions.ts`
- `lib/actions/reading.actions.ts`
- `lib/actions/social.actions.ts`

### Deleted
- `app/[locale]/(app)/discover/page.tsx` — replaced by (public) version

---

## Error States

| Condition | Behavior |
|---|---|
| Book not found or not public | 404 page |
| Chapter not found or belongs to different book | 404 page |
| Social action while unauthenticated | Inline "Sign in to interact" prompt |
| Feed returns 0 results | Empty state: "No books found for this filter" |
| Comment too long (> 1000 chars) | Inline validation error, not submitted |
| Cover image missing | Gradient placeholder matching genre color |
