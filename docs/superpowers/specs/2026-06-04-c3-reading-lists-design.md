# C3 — Reading Lists (Design)

**Status:** Locked 2026-06-04. Awaiting plan-writing.
**Phase:** Third of 5 in the Community phase. See [community-phase-overview.md](2026-06-04-community-phase-overview.md) for the C1–C5 roadmap.
**Goal:** Ship reading lists as the curation layer of the Community phase. Users curate ordered lists of books (Beehive + external) with per-book ratings + commentary + read state, share them at PUBLIC/FRIENDS/PRIVATE visibility, follow others' lists, and surface activity (list created, books added in batch) into the C1 feed. The Liked auto-list ships as a single system list per user derived from `book_likes`.

---

## 1. Locked decisions (from brainstorm)

| # | Decision | Choice |
|---|---|---|
| Q1 | Collaborative lists (multiple owners) | **A — Single owner only.** Hives + (future) Book Clubs cover the "named group around content" niche. No `reading_list_members` table. |
| Q2 | Auto-populated lists | **C — One auto-list: Liked.** Lazy-created at first like; derives books from `book_likes` at read time (no materialized `reading_list_books` rows). |
| Q3 | Books-not-in-Beehive | **B — Beehive + free-text external.** `title` + `author` ALWAYS required text; `book_id` nullable FK is the optional Beehive link; optional `cover_url` text on the row. C4 Book Clubs uses the same row shape. |
| Q4 | Per-book metadata | **C — `isRead` + commentary + 1-5 rating.** Curator's voice + state. Skip the "currently reading" marker (already covered by `readingProgress.lastChapterId` on the reader page). |
| Q5 | Social features (follow + like) | **A — Follow only.** New `reading_list_follows` table + denorm `follower_count`. No likes (less visual clutter; following is the functional relationship that drives feed). |
| Q6 | Activity events | **D — Two events with dedupe:** `reading_list_created` (one-shot) + `books_added_batch` (30min rollup per actor + list — mirrors C1 `book_liked` 6h dedupe pattern). |
| Q7 | Tags | **A — Freeform user-typed.** Max 5 tags × 20 chars. Lowercase + dedup at write. |
| Q8 | List cover image | **None.** List cards are pure metadata (title, description, owner, counts, tags). Per-book `cover_url` field exists for external-entry thumbnails only — not aggregated into a mosaic. |
| Q9 | IA + routes | **A — `/reading-lists` canonical hub.** Two sections (My lists + Lists I follow). Modal-based create flow. Detail at `/reading-lists/[listId]`. Discovery at `/discover?tab=lists` (new fourth Discover tab). |
| — | Privacy | PUBLIC/FRIENDS/PRIVATE + `discoverable` boolean (matches book + hive + spark pattern). 3-layer defense on discoverable. |
| — | Liked list metadata-editable | Owner CAN rename / change description / change visibility / change discoverable on Liked, but CANNOT add/remove books (books derived from `book_likes`) and CANNOT delete the list. |

---

## 2. Data model

### 2.1 New tables (3) + 1 new pgEnum + extensions to existing enum

```
reading_lists
  id              text PRIMARY KEY                                       -- createId
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
  kind            reading_list_kind NOT NULL DEFAULT 'CUSTOM'            -- new enum: CUSTOM | LIKED
  title           text NOT NULL
  description     text
  visibility      book_visibility NOT NULL DEFAULT 'PUBLIC'              -- reuses existing book enum
  discoverable    boolean NOT NULL DEFAULT true
  tags            text[] NOT NULL DEFAULT '{}'                            -- Zod max 5 entries × 20 chars
  book_count      integer NOT NULL DEFAULT 0                              -- denorm; not bumped on LIKED
  follower_count  integer NOT NULL DEFAULT 0                              -- denorm
  created_at      timestamp NOT NULL DEFAULT now()
  updated_at      timestamp NOT NULL DEFAULT now()
  INDEX (user_id, created_at DESC)
  INDEX (discoverable, visibility)                                        -- /discover query
```

```
reading_list_books
  id              text PRIMARY KEY
  list_id         text NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE
  book_id         text REFERENCES books(id) ON DELETE SET NULL            -- nullable; Beehive link
  title           text NOT NULL                                            -- always required
  author          text NOT NULL                                            -- always required
  cover_url       text                                                     -- optional; mostly for external
  is_read         boolean NOT NULL DEFAULT false                           -- curator's read state
  rating          integer                                                  -- nullable 1-5
  commentary      text                                                     -- nullable max 500 chars
  order           integer NOT NULL DEFAULT 0
  added_at        timestamp NOT NULL DEFAULT now()
  INDEX (list_id, order)
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
  CHECK (commentary IS NULL OR length(commentary) <= 500)
```

```
reading_list_follows
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE
  list_id         text NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE
  created_at      timestamp NOT NULL DEFAULT now()
  PRIMARY KEY (user_id, list_id)
  INDEX (list_id)                                                          -- "who follows this list"
```

### 2.2 New pgEnum

```
reading_list_kind ∈ CUSTOM | LIKED
```

### 2.3 `social_activity_type` enum additions (additive)

```
+ reading_list_created
+ books_added_batch
```

### 2.4 Migration

Idempotent runner at `scripts/migrate-c3.ts` mirroring `migrate-c2.ts` shape. ~10 steps:

1. Create `reading_list_kind` enum (DO $$ EXCEPTION WHEN duplicate_object).
2. Create `reading_lists` table + 2 indexes.
3. Create `reading_list_books` table + 1 index + 2 CHECK constraints.
4. Create `reading_list_follows` table + 1 index.
5. `ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'reading_list_created'`.
6. `ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'books_added_batch'`.
7. Verification row counts.

All steps wrapped in `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object` for re-run safety.

### 2.5 Liked auto-list semantics (load-bearing)

- **Lazy creation:** `toggleBookLikeAction` (C1 existing action) extended to call `ensureLikedListAction(userId)` after the like insert. The helper checks for `kind='LIKED'` row for the user; if missing, inserts `{ title: 'Liked', kind: 'LIKED', visibility: 'PUBLIC', discoverable: false }`.
- **Virtual books:** the Liked list's books are NEVER materialized as `reading_list_books` rows. `getListAction` detects `kind='LIKED'` and calls `getLikedListBooks(userId)` which derives books via `SELECT * FROM book_likes WHERE user_id = ?` JOIN `books`.
- **Server-side write guard:** `addBookToListAction` + `removeBookFromListAction` + `reorderListBooksAction` return `{ success: false, error: 'LIKED_LIST_IMMUTABLE' }` if `list.kind === 'LIKED'`.
- **Owner CAN edit metadata:** title / description / visibility / discoverable / tags via `updateListAction`. Cannot delete (`deleteListAction` returns `LIKED_LIST_UNDELETABLE`).
- **Discoverable always false:** even if the user flips the flag via `updateListAction`, the action coerces `discoverable=false` when `kind='LIKED'` (Liked never surfaces in `/discover?tab=lists` — too much per-user noise).

---

## 3. Server actions

### 3.1 Helpers (`lib/reading-lists/`)

**`predicates.ts`** — mirrors `lib/sparks/predicates.ts`:

- `canViewList(viewerId | null, list: { userId, visibility }): Promise<boolean>` — PUBLIC unconditional, FRIENDS via `areFriends`, PRIVATE creator-only, block masquerade via `isBlocked` either direction.
- `canEditList(viewerId, list): boolean` — synchronous; `viewerId === list.userId`. (Used as guard before any mutation.)
- `canFollowList(viewerId | null, list): Promise<boolean>` — `canViewList` AND `viewerId !== list.userId`.

**`liked-list-books.ts`** — `getLikedListBooks(userId, { cursor?, limit? }): Promise<BookRow[]>`. SELECT from `book_likes` WHERE `user_id` JOIN `books` for cover/title/userId; map into the same `BookRow` shape as `reading_list_books` so the UI can render uniformly.

**`ensure-liked-list.ts`** — `ensureLikedListAction(userId): Promise<void>`. Idempotent: insert ON CONFLICT DO NOTHING on a partial unique index `(user_id) WHERE kind='LIKED'`.

### 3.2 Validations (`lib/validations/reading-list.ts`)

```ts
export const createListSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
  discoverable: z.boolean().optional().default(true),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).default([]),
}).transform((d) => ({ ...d, discoverable: d.visibility === 'PUBLIC' ? d.discoverable : false }))

export const updateListSchema = createListSchema.partial().extend({ listId: z.string().min(1) })

export const addBookSchema = z.object({
  listId: z.string().min(1),
  bookId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().max(500).optional(),
  isRead: z.boolean().optional().default(false),
  rating: z.number().int().min(1).max(5).optional(),
  commentary: z.string().trim().max(500).optional(),
})

export const updateListBookSchema = z.object({
  bookRowId: z.string().min(1),
  isRead: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  commentary: z.string().trim().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
})
```

### 3.3 Actions (`lib/actions/reading-lists.actions.ts`)

| Action | Notes |
|---|---|
| `createListAction(input)` | Tx: insert list (`kind='CUSTOM'`) + activity event `reading_list_created` gated `if visibility==='PUBLIC'`. |
| `getListsAction({ filter, cursor?, limit? })` | filter ∈ 'mine' / 'following' / 'discover'. **'mine'** returns viewer's owned lists with `kind='LIKED'` row FIRST (sentinel sort: `ORDER BY (kind = 'LIKED') DESC, createdAt DESC, id DESC`), so the UI always shows Liked at top. **'following'** JOIN `reading_list_follows` on viewer's userId. **'discover'** filters `discoverable=true AND visibility='PUBLIC' AND kind='CUSTOM'` (Liked never surfaces in Discover regardless of flag) + post-filter `isBlocked` on owner. Cursor `(createdAt DESC, id DESC)` tuple. Returns rows + owner profile join + `isFollowing` flag (LEFT JOIN follows for 'discover' filter — irrelevant for 'mine'/'following' but harmless). |
| `getListAction(listId)` | `canViewList` gate → `NOT_FOUND` masquerade. Returns list + owner + viewer's `isFollowing` + books. For `kind='LIKED'`, books from `getLikedListBooks`; for CUSTOM, books from `reading_list_books` JOIN books (for Beehive link enrichment). |
| `updateListAction(input)` | `canEditList` gate. 3-layer discoverable defense. For `kind='LIKED'`, force `discoverable=false` server-side; the edit dialog ALSO disables the discoverable checkbox + visibility picker is unrestricted (Liked can be PUBLIC/FRIENDS/PRIVATE, just never discoverable). |
| `deleteListAction({ listId })` | `canEditList` gate + reject if `kind='LIKED'`. CASCADE drops books + follows. |
| `addBookToListAction(input)` | `canEditList` + reject `kind='LIKED'` (`LIKED_LIST_IMMUTABLE`). Tx: insert book row (compute next `order` = `max(order)+1`) + `UPDATE reading_lists SET book_count = book_count + 1` atomically. When `bookId` is provided, validate via `db.query.books.findFirst` — return `BOOK_NOT_FOUND` if missing or not visible (apply `canReadBook` to ensure linker can see it). **Activity hook with 30min dedupe:** if existing `social_activity` row exists for `(actor_id, type='books_added_batch', subject_id=listId)` within 30min, increment `payload.count` in place via `UPDATE social_activity SET payload = jsonb_set(payload, '{count}', ((payload->>'count')::int + 1)::text::jsonb)` instead of inserting new row. Otherwise insert new row with `payload: { listTitle, count: 1 }`. Gated `if list.visibility === 'PUBLIC'`. |
| `updateListBookAction(input)` | `canEditList` gate. For reorder use `reorderListBooksAction` (bulk). |
| `removeBookFromListAction({ bookRowId })` | `canEditList` + reject `kind='LIKED'`. Tx: delete + decrement `book_count`. |
| `reorderListBooksAction({ listId, orderedIds })` | `canEditList` + bulk update via tx (one UPDATE per id). |
| `followListAction({ listId })` | `canFollowList` gate + tx: insert follow ON CONFLICT DO NOTHING + bump `follower_count` (only when conflict-free). |
| `unfollowListAction({ listId })` | Tx: delete + decrement count. |
| `getListFollowersCountAction(listId)` | Public-readable count from denorm. |
| `getDiscoverableListsAction({ cursor?, limit? })` | Wrapper around `getListsAction({ filter: 'discover' })` — exposed separately so `/discover?tab=lists` consumer is clean. |

### 3.4 Existing action extensions

**`toggleBookLikeAction`** (C1 existing in `lib/actions/social.actions.ts`):
- After like INSERT path commits, call `ensureLikedListAction(userId)` (outside the tx — best-effort; lazy-create failure should not block the like).

### 3.5 Activity hook implementation (`books_added_batch` dedupe)

Pattern in `addBookToListAction`:

```ts
// inside the tx, after the insert + book_count bump:
if (list.visibility === 'PUBLIC') {
  const windowStart = new Date(Date.now() - 30 * 60 * 1000)
  const existing = await tx.query.socialActivity.findFirst({
    where: and(
      eq(socialActivity.actorId, userId),
      eq(socialActivity.type, 'books_added_batch'),
      eq(socialActivity.subjectId, listId),
      gte(socialActivity.createdAt, windowStart),
    ),
  })
  if (existing) {
    await tx.update(socialActivity)
      .set({ payload: sql`jsonb_set(${socialActivity.payload}, '{count}', ((${socialActivity.payload}->>'count')::int + 1)::text::jsonb)` })
      .where(eq(socialActivity.id, existing.id))
  } else {
    await recordSocialActivityTx(tx, {
      actorId: userId,
      type: 'books_added_batch',
      subjectType: 'reading_list',
      subjectId: listId,
      payload: { listTitle: list.title, count: 1 },
    })
  }
}
```

**Note:** this differs from C2's `book_liked` 6h dedupe which simply SKIPS the write. C3's rollup INCREMENTS the count on the existing row — captures the batch semantics in the feed. Worth flagging the new dedupe-with-increment pattern in AGENTS.md.

---

## 4. Routes + UI

### 4.1 New routes at `app/[locale]/(app)/reading-lists/`

- **`page.tsx`** — `/reading-lists` index. Server component. Header (Comfortaa `Reading lists` + "+ New List" CTA). Sections: **My lists** (Liked rendered first with `🤍 Auto` mono pill + custom lists in `createdAt DESC` order, grid 3-col) + **Lists I follow** (compact grid). "Discover more lists →" link bottom. Empty states for each section. Replaces the Coming-Soon stub from C1 T9.

- **`[listId]/page.tsx`** — detail page. Header (title + `<VisibilityPill>` + tags + description + owner card + `<FollowListButton>` + ⋯ kebab for owner with Edit / Delete). Stats strip (`N books · M followers · Created MMM DD`). Books list as `<BookRow>` array (with drag-reorder for owner via dnd-kit). Owner gets "+ Add Book" CTA. NOT_FOUND masquerade for blocked viewers.

### 4.2 New components at `_components/`

- **`<CreateListModal>`** — shadcn Dialog. Fields: title (required) / description (textarea, optional) / tags (chip input with Enter-to-add, max 5) / `<VisibilityPicker>` (reused from C2) / discoverable checkbox with `useEffect` force-clear when visibility≠PUBLIC. Submit → `createListAction` → router.push to detail.
- **`<ListCard>`** — Props: list + `isFollowing` + `viewerIsOwner`. Layout: title (Comfortaa bold) + owner avatar/handle + 2-line description excerpt + tag chips (first 3 + "+N more") + meta row (`N books · M followers`). `<VisibilityPill>` if not PUBLIC. Liked variant shows `🤍 Auto` pill. Click → detail.
- **`<AddBookModal>`** — Tabbed Dialog. Tab 1 = **Search Beehive**: debounced 300ms input → calls `searchBooksAction({ query, limit: 10 })` (new action — see §3.3 extension) → renders results with cover + title + author + Pick button. Tab 2 = **Add external**: title + author + coverUrl fields. Both tabs share a "Your notes" block below the picker: rating (1-5 star input) + commentary (textarea) + isRead checkbox. Submit → `addBookToListAction`.
- **`<BookRow>`** — Single row. Props: book + `isOwner`. Layout: thumb (cover_url or book's cover or placeholder) + title/author + isRead checkbox (owner-editable) + 1-5 star rating display + commentary excerpt with "Show more" toggle. Click → if `bookId` set → `/${locale}/books/${bookId}`; else inert. ⋯ kebab for owner (Edit Metadata / Remove).
- **`<EditBookRowDialog>`** — small Dialog for editing isRead / rating / commentary on an existing row.
- **`<EditListMetadataDialog>`** — pre-filled `<CreateListModal>`-shaped Dialog. Triggered from detail page ⋯ kebab.
- **`<FollowListButton>`** — optimistic flip + rollback + sonner toast (mirrors existing `<FollowButton>`).

### 4.3 Discover integration

- `app/[locale]/(public)/discover/page.tsx` gains a **fourth tab**: Lists. Tab strip stays at `?tab=books|sparks|hives|lists`. Calls `getDiscoverableListsAction({ limit: 24 })`. Renders `<ListCard>` grid + cursor pagination via Load More.

### 4.4 Community section rail

- `<SectionRail>` Lists tile: no href change needed (already `/reading-lists` per C1 T9). Count badge wires through the existing parallel fetch on `/community` — extend with `getMyListsCountAction()` returning a single int (queries `reading_lists` WHERE `user_id = ? AND kind = 'CUSTOM'` count + add 1 for Liked).

### 4.5 Profile page integration (`/u/[username]/page.tsx`)

- New section "Lists" between existing sections. Server-fetches `getUserPublicListsAction(userId, viewerId, limit: 5)` which returns the user's lists filtered through `canViewList` (PUBLIC always; FRIENDS only when viewer is friend; PRIVATE never to non-self). Liked list excluded by default (`kind='CUSTOM'` filter) — Liked is personal even if PUBLIC-visible, surfacing it as just "Liked" on every profile is noise. Horizontal `<ListCard>` row (no "See all →" link for v1 — `/reading-lists?user={username}` is a C5 polish item).

### 4.6 Activity feed integration

`<ActivityEventRow>` (existing in `community/_components/`) gains 2 verb-map entries:

- `reading_list_created` → "@{actor} created a list **{subject.title}**"
- `books_added_batch` → "@{actor} added {payload.count} {payload.count === 1 ? 'book' : 'books'} to **{payload.listTitle}**"

Subject hydration in `getCommunityFeedAction` (C1 T7) extends with `subjectType='reading_list'` — IN-list query on `reading_lists` for title + visibility. `books_added_batch` subject also `'reading_list'`.

### 4.7 New search action

**`searchBooksAction({ query, limit })`** in `lib/actions/discover.actions.ts` (or `book.actions.ts`):

- ILIKE on `books.title` OR `userProfiles.displayName` of the author (OR-match on either field). Filter to `visibility='PUBLIC' AND discoverable=true`. Apply `isBlocked` filter on author. Returns top `limit` (default 10) with cover + title + author username + bookId.

---

## 5. Privacy + block enforcement summary

| Surface | Gate |
|---|---|
| `/reading-lists` (mine) | Authed only; viewer's own lists. |
| `/reading-lists` (following) | Authed only; lists the viewer follows. |
| `/reading-lists/[id]` detail | `canViewList` → NOT_FOUND masquerade on block/denied. |
| `/discover?tab=lists` | `discoverable=true AND visibility='PUBLIC'` + `isBlocked` filter on owner. |
| `addBookToListAction` etc. | `canEditList` (owner only) + Liked-list immutability guard. |
| `followListAction` | `canFollowList`. |
| Activity events | Gated at write time `if list.visibility === 'PUBLIC'`. |
| Profile lists section | Per-row `canViewList`. |

Block masquerade everywhere — same posture as C1 books + C2 sparks.

---

## 6. Test posture

Following AGENTS.md convention:

- **Unit tests:**
  - `lib/reading-lists/__tests__/predicates.test.ts` — full visibility × block matrix for `canViewList` + `canEditList` (synchronous) + `canFollowList` cases.
  - `lib/reading-lists/__tests__/liked-list-books.test.ts` — derives books from mock `book_likes` rows; respects limit/cursor.
  - `lib/reading-lists/__tests__/ensure-liked-list.test.ts` — idempotent insert; no-op on existing.
  - `lib/actions/__tests__/reading-lists-actions.test.ts` — surface-shape (typeof + arity) for all 14 actions. Mirrors `reading-actions.test.ts`.

- **Manual smoke** per spec §8 carry-forward checklist.

---

## 7. Implementation phasing (preview)

Suggested 16-task decomposition for the implementation plan:

| Task | Title |
|---|---|
| T1 | Schema migration + enum additions + Liked partial-unique index |
| T2 | Helpers — `predicates.ts` + `liked-list-books.ts` + `ensureLikedListAction` + unit tests |
| T3 | Validations + `createListAction` + `getListsAction` + `getListAction` |
| T4 | `updateListAction` + `deleteListAction` + Liked-list metadata coercion |
| T5 | `addBookToListAction` (with dedupe-increment activity hook) + `updateListBookAction` + `removeBookFromListAction` + `reorderListBooksAction` |
| T6 | `followListAction` + `unfollowListAction` + `getListFollowersCountAction` + `getDiscoverableListsAction` |
| T7 | `searchBooksAction` (new for AddBookModal Beehive search tab) |
| T8 | `toggleBookLikeAction` extension to call `ensureLikedListAction` |
| T9 | Replace `/reading-lists/page.tsx` Coming-Soon stub with index page (header + My lists + Following sections + empty states) |
| T10 | `/reading-lists/[listId]/page.tsx` detail page (header + stats + books list + drag-reorder for owner) |
| T11 | `<CreateListModal>` + `<EditListMetadataDialog>` (shared shape) |
| T12 | `<AddBookModal>` (Beehive search tab + external add tab + shared metadata block) + `<EditBookRowDialog>` |
| T13 | `<ListCard>` + `<BookRow>` + `<FollowListButton>` |
| T14 | `/discover?tab=lists` integration (4th tab + grid) |
| T15 | `<ActivityEventRow>` verb-map additions + `getCommunityFeedAction` subject hydration for `reading_list` + profile page Lists section |
| T16 | Smoke + AGENTS.md ship-summary + ship |

Wave shape suggestion (mirrors C2 pattern):
- W1 = T1 alone
- W2 = T2 alone
- W3 = T3+T4+T5+T6+T7+T8 server-action wave (one shared file `reading-lists.actions.ts` + one extension to `social.actions.ts` → likely run combined-single per Wave 3 C2 precedent OR distribute carefully)
- W4 = T9+T10 routes
- W5 = T11+T12+T13+T14+T15 UI parallel
- W6 = T16

---

## 8. Out of scope (deferred to C5 or later)

| Item | Defer to |
|---|---|
| Likes on lists (separate from follow) | C5 polish if users ask |
| Comments on lists | C5 polish |
| Per-list cover image | Probably never (mosaic auto-render was rejected; not enough value for manual upload) |
| `/reading-lists?user={username}` filter | C5 polish — for v1, profile page is the canonical "this user's lists" surface |
| External book cover image upload (vs URL paste) | Future Cloudinary integration |
| Collaborative lists (multi-owner) | Never unless explicitly requested |
| "Currently reading" marker on list | Never — duplicates `readingProgress.lastChapterId` |
| Tag-based discovery surface | C5 polish |
| `/reading-lists/new` standalone create page | Modal-only for v1 |
| Want-to-read system list | Never — users create their own |

---

## 9. Carry-forward smoke checklist for Chris (after T16)

(Mirrors C1 §13 / C2 §16 patterns.)

1. Create a PUBLIC+discoverable list with title + description + 3 tags → appears on /reading-lists "My lists" + /discover Lists tab + community section rail count badge increments.
2. Add Beehive book to list via search tab → appears in detail with thumb + click routes to /books/[id].
3. Add external book (title + author + cover_url) → appears with custom cover; click is inert.
4. Add book without cover_url → placeholder thumb renders.
5. Set rating + commentary → display correctly on viewer side.
6. Toggle isRead → reflects in list.
7. Drag-reorder books → order persists on reload.
8. Follow another user's PUBLIC list → appears in your "Lists I follow"; follower_count increments visibly.
9. Unfollow → drops out + count decrements.
10. Create FRIENDS list → visible to friends; NOT visible to non-friends.
11. PRIVATE list → only creator sees.
12. Discoverable checkbox auto-disables when visibility≠PUBLIC.
13. Liked auto-list appears at top of My lists with `🤍 Auto` pill after first like; non-deletable; rename via Edit Metadata works.
14. Liked list books reflect `book_likes` — like a book → appears; unlike → disappears.
15. Try to add a book to Liked list manually via the UI → no "+ Add Book" CTA visible. Try via direct API → `LIKED_LIST_IMMUTABLE` error.
16. Try to delete Liked → no Delete in kebab. Try via API → `LIKED_LIST_UNDELETABLE`.
17. Activity feed: friend creates a PUBLIC list → `reading_list_created` event in /community feed.
18. Activity feed batch: friend adds 5 books to same list within 30min → ONE `books_added_batch` event with `count: 5`. Add 6th book after 35min → SECOND event.
19. FRIENDS list activity does NOT flow to feed (gated at write time).
20. Block flow: A creates PUBLIC list; B blocks A → list disappears from B's /discover; direct URL `/reading-lists/[id]` returns 404 masquerade.
21. Profile page `/u/[username]` Lists section shows only lists the viewer can see (PUBLIC + FRIENDS-when-friend).
22. `/discover?tab=lists` shows discoverable PUBLIC lists; filtered through `isBlocked` on owner.

If any scenario fails → file `fix(c3): ...`.

---

*End of C3 spec. Next step: writing-plans skill to produce the 16-task plan.*
