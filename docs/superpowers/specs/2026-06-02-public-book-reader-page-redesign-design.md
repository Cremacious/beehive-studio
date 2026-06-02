# Public Book Reader Page Redesign — Design

**Date:** 2026-06-02
**Target surface:** `app/[locale]/(public)/books/[bookId]/page.tsx` (the public book overview page, not the per-chapter reader at `/read/[chapterId]`)
**Reference:** `C:\Code\personal\beehive-books-online\app\[locale]\(app)\books\[bookId]\page.tsx` (IA inspiration only; not a pixel-truth)

## Goal

Overhaul the public book overview page so it reads as a professional book page that rivals Royal Road / Wattpad / Goodreads in how richly it displays book metadata, while sitting natively inside the existing iOS-inspired dark design system. The current implementation is a cramped 2-col layout on `bg-[#141414]` with a 160px cover hero — it does not match the app's new aesthetic and does not surface enough metadata above the fold.

## Non-Goals

- Touching the per-chapter reader at `/read/[chapterId]` (separate surface, auto-mark behavior stays).
- DB / schema changes.
- New social features (comment threading, per-comment likes, "more by author" grid, native share API).
- Light-mode variant for this page.
- Modifying the existing studio editor or any of its surfaces.

## Page Composition

Centered `max-w-5xl mx-auto`, stacked vertically on `bg-[#262728]`. Sections in order:

1. **Back link** — small muted text link above the hero. Label = `← Editor` when `userId === book.authorUserId`, else `← Discover`. No top-bar chrome (current page has a separate bg-`#1a1a1a` strip — remove).

2. **`<BookHero>`** — rounded card, cover-left / metadata-right grid (`grid-template-columns: 200px 1fr` desktop; stacks on mobile).
   - **Left:** cover image, 2:3 aspect, `var(--r-card)` corners, `var(--sh-card)` shadow. Fallback gradient when no `coverUrl`.
   - **Right:**
     - `book.title` — Comfortaa bold, ~30px, brand-yellow per design system heading rule.
     - Author row — small avatar + `by @{username}` where username is a `<Link>` to `/u/[username]`. Display name preferred when present.
     - Series line (when `seriesName` set) — uses existing `<SeriesLine>` shared component.
     - Pill row — small chips, wrapped: genre · privacy `<Globe|Lock|Users>` icon + label · tags (cap at ~5 visible).
     - 4-stat row — label-above / value-below pattern. Stats: `Chapters X / Y read` (for authed users; just `Y` for guests), `Words` (humanized: `48k` for ≥1000, else raw), `Likes`, `Comments`.
     - Description — truncated visually to 3 lines via `line-clamp-3`; full text lives in About.
     - CTA row, in this left-to-right order: `Start Reading →` or `Continue Reading →` (brand-yellow primary, links to `/read/[chapterId]` using lastReadChapter or first readable chapter) · `♥ Favorite` (toggle, optimistic) · `↗ Share` (opens dialog) · `🔖 Bookmark` (toggle, optimistic) · `Edit in studio →` (text-only secondary, author only).
   - Hero is a **client component** because it owns the share dialog trigger + optimistic state for like/bookmark.

3. **`<BookTabStrip>`** — sticky scroll-jump anchor strip. Three tabs: `Chapters` · `Comments` · `About`. Tab pills sit on a tile-gradient strip with brand-yellow active state. Active tracking via `IntersectionObserver` watching the three section root elements (rootMargin tuned so the active tab updates just before the section header crosses the top). Clicking a tab `scrollIntoView({ behavior: 'smooth', block: 'start' })` with scroll-margin-top to clear the sticky strip itself. Strip stays at `top: 0` of the viewport when scrolled past.

4. **`<ChaptersPanel>`** — rounded card. Header row: `Chapters` heading + small `X / Y read` subtitle + thin brand-yellow progress bar on an inset rail filling `readCount / totalCount`. Rows:
   - **Mark-as-read toggle** on the left — empty `<Circle>` (unread) or brand-yellow filled `<CheckCircle2>` (read). Click toggles optimistically; calls `markChapterReadAction` or new `unmarkChapterReadAction`. Hidden for unauthenticated viewers. Rolls back on action failure with a sonner toast.
   - Chapter number + title — title is a `<Link>` to `${readerBasePath}/read/${chapterId}`.
   - Updated label — `Updated MMM DD` from `chapters.updatedAt`, muted text on the right.
   - **No per-row word count.** (Book total word count lives in the hero stats.)
   - Locked chapters (non-author viewing a chapter with `!isChapterReaderVisible(status)`) render as a non-clickable row with `Draft — coming soon` badge in place of the title link. Mark-read toggle hidden.
   - Logged-out viewers see chapter rows without checkboxes.

5. **`<CommentsPanel>`** — rounded card. Header `Comments` + count. Composer at top for authenticated users (small avatar + `<textarea>` + `Post` brand-yellow button). For guests: `<a href="/sign-in?next=...">Sign in to comment</a>` prompt in place of the composer. Flat list of comments below: avatar + `@username` (clickable to profile) + relative time + body. `Load more` button at bottom triggers next page via existing `getBookCommentsAction(bookId, page)`. **No threading, no per-comment likes (v1).**

6. **`<AboutSection>`** — rounded card. Three blocks:
   - Full untruncated `book.synopsis` rendered as prose paragraphs.
   - Metadata strip: `First published <date>` (use `book.createdAt`) · `Last updated <date>` (use `book.updatedAt`).
   - Author card: avatar (medium) + display name (Comfortaa) + `@username` (mono muted) + `View profile →` link to `/u/[username]`.

7. **`<SeriesFooter>`** — existing component, kept. Re-skinned to the new tile-gradient + `var(--r-card)` chrome.

8. **`<AccessDenied>`** screen (PRIVATE / FRIENDS_ONLY) — re-skinned. Centered card on `bg-[#262728]`. Lucide icon (`Lock` for private, `Users` for friends), reason heading, body copy, `← Discover` CTA as a brand-yellow pill.

## Share Dialog

Component: `<ShareBookDialog>`, built on shadcn `Dialog` primitive (chrome is inherited, no new styling work).
- Title: `Share this book`
- Body: read-only `<input>` containing `${origin}/${locale}/books/${bookId}` + `Copy` button on the right.
- Click `Copy` → `navigator.clipboard.writeText(url)` → button label flips to `Copied ✓` for 2 seconds + sonner toast `Link copied`.
- Privacy note rendered below the URL:
  - PUBLIC: no note.
  - FRIENDS: `Only your friends can open this link.`
  - PRIVATE: `Only people you invite can open this link.`
- Dismisses on outside-click / Esc (shadcn Dialog default).

## Design System Compliance

All chrome consumes existing tokens. Zero new tokens.

- Panels: `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + `var(--r-card)` + `var(--sh-card)` + `var(--br-card)`.
- Tab strip + inset rails: `var(--canvas-dark-100)` + `var(--sh-inset)`.
- Tile chrome on chapter rows + author card: `linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))` + `var(--r-row)` + `var(--sh-tile)`.
- Brand-yellow restrained to sanctioned uses per the design system map: section headings, primary CTA pill, active tab, active mark-read checkmark, progress bar fill, brand pill `Post` / `Copy` CTAs.
- No `bg-black` or `bg-[#141414]` anywhere on the page.
- Newsreader font is NOT used on this page — book prose lives at `/read/[chapterId]`. Body copy here uses Geist; headings Comfortaa.

## Component Inventory

New, under `app/[locale]/(public)/books/_components/`:

| Component | Type | Responsibility |
|---|---|---|
| `book-hero.tsx` | client | Cover + metadata + CTA row. Owns optimistic favorite + bookmark + opens share dialog. |
| `book-tab-strip.tsx` | client | Sticky scroll-spy strip. IntersectionObserver tracks active section. |
| `chapters-panel.tsx` | client | Chapter list with per-row mark-as-read optimistic toggle + progress bar. |
| `comments-panel.tsx` | client | Composer + flat list + Load more. Replaces the existing right-column comments. |
| `about-section.tsx` | server | Pure presentational. Description + dates + author card. |
| `share-book-dialog.tsx` | client | shadcn Dialog wrapper with Copy button + sonner toast. |

Restyled, kept in place:
- `app/[locale]/(public)/_components/series-footer.tsx` — chrome refresh only, no API change.
- `app/[locale]/(public)/books/_components/access-denied.tsx` — chrome refresh only.

Touched / partially superseded:
- `app/[locale]/(public)/_components/social-actions.tsx` — its favorite + bookmark concerns move inline into `<BookHero>`'s CTA row. Share moves out into the new dialog. After the move, audit whether the component still has callers; if not, delete.
- `app/[locale]/(public)/_components/chapter-list.tsx` — superseded by the new `<ChaptersPanel>` for this surface. Audit other callers (e.g. `/read/[chapterId]` may consume it); if no other callers, delete.
- `app/[locale]/(public)/_components/comments-panel.tsx` — superseded by the new colocated `<CommentsPanel>`. Same delete-audit.

## Server Actions

All existing actions used by the page remain. **One new action added:**

```ts
// lib/actions/reading.actions.ts
export async function unmarkChapterReadAction(
  bookId: string,
  chapterBinderItemId: string,
): Promise<ActionResult<void>>
```

Mirrors `markChapterReadAction`'s gating: `requireAuth` → `canReadBook(bookId, userId)` (return `{success:false, error:'FORBIDDEN'}` if denied) → delete the matching `readingProgress` row(s) for that user + chapter. If `lastChapterId` on `readingProgress` points at the chapter being un-marked, leave it (it's a "last visited" marker, separate from the "read set"). Note: confirm the actual `readingProgress` schema during implementation; the action's exact shape may need adjusting based on whether reads are stored as a join table or an array column.

`markChapterReadAction` keeps its existing behavior (manual mark from this page; auto-mark from `/read/[chapterId]` is intentional and out of scope for this redesign).

## Data Flow

Server `page.tsx` parallel-fetches the same set as today plus the author profile join needed for the About section's author card (if not already on `book`):

```ts
const [book, chapters, comments, progress, social, seriesNeighbors] = await Promise.all([...])
```

Threads:
- `book` → `<BookHero>` + `<AboutSection>` + `<ChaptersPanel>` (for total counts) + `<ShareBookDialog>` (for bookId + privacy)
- `chapters` (normalized + reader-visible-filtered) → `<ChaptersPanel>`
- `progress.readChapterBinderItemIds` → `<ChaptersPanel>` (initial checked state) + `<BookHero>` (X/Y read stat)
- `progress.lastChapterId` → `<BookHero>` (CTA target)
- `social.{liked, bookmarked}` → `<BookHero>` (initial toggle state)
- `comments` + `commentsHasMore` → `<CommentsPanel>`
- `seriesNeighbors` → `<SeriesFooter>`

## Interaction Detail: Mark-as-Read

- Click an unread row's circle → optimistic flip to brand-yellow checkmark → call `markChapterReadAction`. On failure: rollback + sonner toast `Couldn't mark as read`.
- Click a read row's checkmark → optimistic flip to empty circle → call `unmarkChapterReadAction`. On failure: rollback + sonner toast.
- Hero `Chapters X / Y read` stat + chapters-panel progress bar both derive from the same client-side `readSet: Set<string>` state held in `<ChaptersPanel>`. Hero gets the count via a callback prop OR via lifting the read-set state to the page-level client wrapper. **Recommendation:** lift via a tiny client wrapper around the three lower sections so the hero can subscribe — finalized during implementation.
- Authenticated-only; guests don't see the checkboxes and don't see X/Y in the hero stat (just `Y`).

## Interaction Detail: Sticky Tab Strip

- Strip wraps three section roots. Each section root has `id="chapters" | "comments" | "about"` and `scroll-margin-top: <strip height + small gap>`.
- IntersectionObserver with `rootMargin: '-<strip height>px 0px -60% 0px'` watches the three section roots. Most-recently-intersecting id sets the active tab.
- Click a tab → `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- Strip itself uses `position: sticky; top: 0; z-index: 10` and inherits the page bg behind it so it doesn't show content bleeding through.

## Edge Cases

- **No chapters at all:** chapters panel shows `<EmptyState>` (existing studio component or inline equivalent) `No chapters yet`. Hero's `Start Reading` CTA is hidden. Hero stat `Chapters` shows `0`.
- **All chapters drafts, viewer is non-author:** no readable chapters; CTA hidden; all rows show `Draft — coming soon`.
- **Logged-out viewer:** no composer (sign-in prompt instead), no checkboxes, no `X / Y read` (just `Y`), no Favorite/Bookmark (rendered but click prompts sign-in via existing `SocialActions` behavior, kept).
- **PRIVATE / FRIENDS denial:** never reaches the new layout — `canReadBook` short-circuits to `<AccessDenied>`.
- **NOT_FOUND:** `notFound()`.
- **Author preview:** sees the full page exactly as a reader would, plus the `Edit in studio →` link in the hero CTA row. Mark-as-read toggles work for the author too (they're tracking their own re-read progress).

## Accessibility

- Tab strip uses `<nav>` + `<a href="#chapters">` semantics; active state via `aria-current="page"`.
- Mark-as-read toggle is a `<button>` with `aria-pressed={isRead}` and `aria-label={\`Mark "${title}" as ${isRead ? 'unread' : 'read'}\`}`.
- Share dialog inherits shadcn Dialog a11y (focus trap, Esc, focus return).
- Copy button announces state change via `aria-live="polite"` on the `Copied ✓` text.
- Cover `<img>` has `alt={book.title}`.

## Testing Strategy

Pure-unit tests:
- `unmarkChapterReadAction` — happy path, FORBIDDEN, last-chapter pointer preservation.
- Any progress-percent helper extracted from the page (lift `Math.round(read / total * 100)` into a tested helper if it grows beyond inline).

Manual smoke (Chris's preference; documented in plan):
- Render as author / authed reader / logged-out reader.
- Mark / unmark chapters and verify hero stat + progress bar update in real time.
- Share dialog: copy URL on each privacy mode, verify note text.
- Tab strip: click each tab, scroll-spy updates active state correctly.
- AccessDenied screen for PRIVATE + FRIENDS without auth.
- Series footer renders for books with seriesName + at least one neighbor.

## Files Touched (Implementation Scope)

| Path | Change |
|---|---|
| `app/[locale]/(public)/books/[bookId]/page.tsx` | Full rewrite (server component; orchestrates new components). |
| `app/[locale]/(public)/books/_components/book-hero.tsx` | New. |
| `app/[locale]/(public)/books/_components/book-tab-strip.tsx` | New. |
| `app/[locale]/(public)/books/_components/chapters-panel.tsx` | New. |
| `app/[locale]/(public)/books/_components/comments-panel.tsx` | New. |
| `app/[locale]/(public)/books/_components/about-section.tsx` | New. |
| `app/[locale]/(public)/books/_components/share-book-dialog.tsx` | New. |
| `app/[locale]/(public)/books/_components/access-denied.tsx` | Restyle. |
| `app/[locale]/(public)/_components/series-footer.tsx` | Restyle. |
| `app/[locale]/(public)/_components/chapter-list.tsx` | Audit + delete if no other callers (else leave). |
| `app/[locale]/(public)/_components/comments-panel.tsx` | Audit + delete if no other callers. |
| `app/[locale]/(public)/_components/social-actions.tsx` | Audit + delete if no other callers. |
| `lib/actions/reading.actions.ts` | Add `unmarkChapterReadAction`. |

## Out of Scope (Deferred)

- Comment threading + per-comment likes.
- "More by this author" grid in About.
- `navigator.share()` mobile fallback.
- Author bio surfacing beyond name + avatar.
- Light-mode variant.
- Read-time estimate / language metadata.
- Reading lists / collections / "lists featuring this book".

## Open Items for Implementation Plan

- Confirm `readingProgress` schema shape (join table vs array column) and finalize `unmarkChapterReadAction` body accordingly.
- Decide the exact lifting strategy for the shared `readSet` state between `<BookHero>` and `<ChaptersPanel>` (page-level client wrapper vs callback prop).
- Audit the three superseded `(public)/_components/` files for non-page callers before deleting.
- Confirm `book.synopsis` is present on `getPublicBookAction`'s return; if not, add it to the projection.
