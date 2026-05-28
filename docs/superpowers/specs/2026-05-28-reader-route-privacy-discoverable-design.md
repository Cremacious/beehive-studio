# SP-A — Reader Route + Privacy/Discoverable

**Date:** 2026-05-28
**Status:** Design approved, ready for plan-phase
**Sub-project of:** Book Reader + Friends epic (SP-A of A/B/C)
**Follow-on:** SP-B Friendships subsystem (separate spec)

## Problem

From the studio editor, an author has no way to see how their book presents to a reader. Today the only public reader surface is `/[locale]/discover/book/[bookId]`, which is gated to `status='PUBLISHED' AND visibility='PUBLIC'` — authors can't preview drafts, and there's no concept of sharing a private book with a specific audience (e.g. friends).

This spec lands a dedicated reader route plus the privacy/discoverable plumbing it depends on. It does NOT land the friendship system — `FRIENDS` visibility is settable but resolves to "author only" until SP-B ships.

## Mental model

Three independent axes on a book:

| Setting | Values | Controls |
|---|---|---|
| `privacy` (renamed from `visibility`-as-concept; column stays `visibility`) | `PUBLIC` / `PRIVATE` / `FRIENDS` | Who can open the reader |
| `discoverable` (new) | `true` / `false` | Whether it appears in `/discover` listings |
| `status` (existing) | `DRAFT` / `PUBLISHED` | Author's "I consider this finished" label — display only |

Key invariant: `discoverable=true` is only allowed when `visibility='PUBLIC'`. Server-coerces to false otherwise.

## 1. Schema changes

Single migration via `npm run db:push`:

- `book_visibility` enum: add `'FRIENDS'` value.
- `books` table: add `discoverable boolean NOT NULL DEFAULT false`.
- Backfill: `UPDATE books SET discoverable=true WHERE visibility='PUBLIC' AND status='PUBLISHED'` (preserves who's currently in /discover).
- New index: `books_discoverable_visibility_idx ON (discoverable, visibility)`.
- `books.status` is unchanged in schema; stops being referenced in access queries.

## 2. Access model — single source of truth

New helper `lib/books/can-read.ts`:

```ts
export type BookAccess =
  | { ok: true }
  | { ok: false, reason: 'NOT_FOUND' | 'PRIVATE' | 'FRIENDS_ONLY' }

export async function canReadBook(
  bookId: string,
  viewerUserId: string | null,
): Promise<BookAccess>
```

Resolution order:
1. Load book (`id`, `userId`, `visibility`). Missing → `NOT_FOUND`.
2. Viewer is author → `ok`.
3. `visibility='PUBLIC'` → `ok` (any viewer, signed in or not).
4. `visibility='FRIENDS'` → `FRIENDS_ONLY` (SP-B will flip this to `ok` when a friendship exists).
5. `visibility='PRIVATE'` → `PRIVATE`.

Every reader-route page and reader-write server action calls this exactly once. No privacy logic duplicated in components or actions.

`/discover` listing is a separate SQL-level gate: `discoverable=true AND visibility='PUBLIC'`. Independent of `canReadBook`.

## 3. Route structure

New routes under `app/[locale]/(public)/books/[bookId]/`:

- **`page.tsx`** — book overview. Server component. Calls `canReadBook()`; on failure renders an access-denied surface:
  - `NOT_FOUND` → `notFound()`
  - `PRIVATE` → "This book is private"
  - `FRIENDS_ONLY` → "Only the author's friends can read this"

  On success renders the same hero + chapter list + comments layout that lives at `/discover/book/[bookId]` today.

- **`read/[chapterId]/page.tsx`** — chapter reader. Same `canReadBook` gate. Same TipTap-prose rendering as today's discover reader.

**Component reuse:** `ChapterList`, `CommentsPanel`, `SocialActions` move from `app/[locale]/(public)/discover/_components/` up to `app/[locale]/(public)/_components/` so both routes import the same instances.

**Redirects:** old discover-reader URLs 308-redirect to the new path:
- `/[locale]/discover/book/[bookId]` → `/[locale]/books/[bookId]`
- `/[locale]/discover/book/[bookId]/read/[chapterId]` → `/[locale]/books/[bookId]/read/[chapterId]`

**Server actions affected:**
- `getPublicBookAction` — privacy/status check stripped. Becomes a pure "fetch this book's reader data" function; the page gates via `canReadBook`. `/discover` listing helpers (`getDiscoverBooksAction`, sparks, etc.) still apply `discoverable=true AND visibility='PUBLIC'` directly.
- `markChapterReadAction`, reading-progress writes — gated by `canReadBook` (you can't mark-read a chapter you can't read).
- `addCommentAction`, `getCommentsAction` — gated by `canReadBook`. Comments stay enabled for all privacy levels — private books just have one viewer (author).

## 4. Settings UI

**Create wizard (`/studio/new`)** — new step between template-pick and submit:
- Privacy: three-card radio (Private / Friends / Public), default Private. Friends card shows a "Requires a friend on Beehive (coming soon)" hint until SP-B ships.
- Discoverable: toggle switch with helper copy. Disabled when privacy ≠ PUBLIC.

**Details page (`/studio/[bookId]/details`)** — add a fifth collapsible section **"Sharing"** (after Basics / Discovery / Structure / Publishing). Same two controls.

**Server validation rule** (in `updateBookDetailsSchema` + `createBookSchema`): if `visibility !== 'PUBLIC'` → coerce `discoverable` to `false`. Belt and suspenders with the UI disable.

## 5. Editor entry points

Two new clickable surfaces routing to `/[locale]/books/[bookId]`:

- **Preview button in the editor toolbar.** lucide `Eye` icon in the VIEW zone next to corkboard toggle. Uses `tbtnClass()`. aria-label: "Preview as reader". Same-tab navigation.
- **Binder header book title becomes a Link.** Currently plain text; becomes a Next.js `<Link>` with subtle hover underline. aria-label: "Preview as reader".

No changes to studio library card click (still opens editor) or kebab menu.

## 6. Reader behavior

- All `binderItems.type='chapter'` rows shown, ordered by `binderItems.order`. No status filter.
- Empty chapters render with a placeholder ("This chapter is empty"), don't crash, don't hide.
- Chapter `status` (`IDEA` → `FINAL`) NOT displayed — writer-facing concept.
- Only `type='chapter'` items appear. FM/BM, outline, character, notes binder items are excluded (matches today's reader).
- Mark-as-read works for the author too — they're a viewer when on the reader. Progress writes go through `canReadBook`.
- Comments visible to anyone who can read the book.

## 7. Testing strategy

- **`canReadBook` unit tests** (DB mocked): 6 cases — NOT_FOUND, author wins, PUBLIC+signed-out, PUBLIC+stranger, FRIENDS (returns FRIENDS_ONLY pre-SP-B), PRIVATE+stranger.
- **Schema validation tests:** `updateBookDetailsSchema` + `createBookSchema` coerce `discoverable=false` when visibility ≠ PUBLIC.
- **Migration smoke test:** SQL assertion after `db:push` confirms existing PUBLIC+PUBLISHED books got `discoverable=true`, others got `false`.
- **No E2E.** Project convention is vitest unit + `tsc --noEmit`. Reader page is a thin composition of existing-and-tested components.
- **Manual verification checklist:**
  - Create PRIVATE book → /books/[id] shows it for author, "This book is private" for stranger.
  - Flip to PUBLIC → stranger can read.
  - Flip to FRIENDS → stranger sees FRIENDS_ONLY message (no friends yet).
  - Toggle discoverable on while PUBLIC → appears in /discover.
  - Toggle discoverable off → vanishes from /discover, but `/books/[id]` URL still works for anyone.
  - Old `/discover/book/[id]` URL 308s to `/books/[id]`.
  - Editor toolbar Preview button + binder-header title both open the reader.

## 8. Out of scope

Deferred to separate sub-projects:

- **Friendships subsystem (SP-B)** — `friendships` table, request/accept/decline, friends list, "Add friend" UI, friend-request notifications.
- **Library card click → reader.** Current behavior preserved (click = editor).
- **"Share" popover in editor toolbar** — one-click privacy/discoverable flip without leaving editor.
- **Friend-aware /discover or /community rows** — depends on SP-B.
- **OG share-card metadata** for PUBLIC book URLs — polish pass.
