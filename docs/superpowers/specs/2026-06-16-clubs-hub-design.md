# Clubs Hub + Card Redesign — Design Spec

**Date:** 2026-06-16
**Surfaces:** `/[locale]/clubs` (the hub), `/[locale]/discover?tab=clubs` + `/discover/clubs/...` sub-routes
**Goal:** Apply the personal-hub pattern (proven on `/sparks`, `/friends`, `/hives`) to `/clubs`. Replace the current card with a Facebook-group-style design: cover image hero, title, description, member count, open/closed pill. Lock dimensions at exactly 340×360 across every state. Introduce `getSuggestedClubsAction` with friend/FoF/trending ranking. Add a `cover_image_url` column to `book_clubs`.

---

## Schema change

**One additive column:**
```sql
ALTER TABLE book_clubs ADD COLUMN cover_image_url text;
```
- Nullable (clubs work without one; render fallback gradient with the club name's first letter).
- Cloudinary-uploaded, same upload flow as book covers + user avatars (existing `/api/upload/cloudinary` route).
- Optional at creation — `CreateClubModal` gets a new "Cover image" upload field with skip/none affordance.

No DDL beyond that one column. No indexes added.

---

## Card design — V2 universal fixed 340×360

Locked from mockup `.superpowers/brainstorm/30856-1781620504/content/clubs-v2-fixed.html`.

### Dimensions (HARD-pinned)
- Card outer: **340w × 360h**, `border-radius: 14px`, `overflow: hidden`.
- Default chrome: `linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))` + `box-shadow: var(--sh-tile)`.
- Suggested chrome: gradient one stop darker + `border: 2px dashed oklch(0.6 0.15 150 / 0.45)`.

### Cover (170h × 340w, top)
- 16:8 aspect (`height: 170px`).
- Image rendered via `background-image: url(coverImageUrl)` with `background-size: cover; background-position: center`.
- Fallback (when `coverImageUrl === null`): gradient `linear-gradient(135deg, oklch(0.4 0.1 200), oklch(0.25 0.06 220))` + first-letter initial (56px white-alpha-45 Comfortaa bold, centered).
- Role pill — absolute top-right (`top: 12px; right: 12px`). Mono uppercase 9px, padding `5px 9px`, backdrop-blur(6px), `rgba(0,0,0,0.55)` background by default. OWNER variant overrides to brand-yellow tint + dark text per the spec.

### Body (190h × 340w, padding 12 vert × 14 horiz)
4 fixed-height slots stacked top-to-bottom:

**Slot 1 — Title row (40h)**
- `flex justify-between items-start gap: 10px overflow: hidden`
- Title: Comfortaa bold 15px, color `var(--canvas-dark-ink-strong)`, `line-clamp-2`, `line-height: 1.2`, flex-1.
- Access pill (right): mono uppercase 9px, padding `3px 7px`, rounded-full. `OPEN` = green tint (`oklch(0.6 0.15 150 / 0.18)` + `oklch(0.75 0.15 150)`); `CLOSED` = muted (`rgba(255,255,255,0.05)` + `var(--canvas-dark-ink-muted)`). Includes 🟢/🔒 glyph.

**Slot 2 — Description / why-suggested row (50h fixed)**
- Default state: description clamps to 3 lines, font 11px, color `var(--canvas-dark-ink-muted)`, `line-height: 1.4`.
- Suggested state: description clamps to **1 line** instead of 3, then a why-suggested pill below (`background: oklch(0.6 0.15 150 / 0.08)`, `border-left: 2px solid oklch(0.6 0.15 150)`, `padding: 4px 8px`, `border-radius: 4px`, font 10px, single-line ellipsis). Total height stays at 50px.
- Markdown `**bold**` parsing for why-suggested text (same regex split helper as the hive card).
- Empty-description fallback: italic muted "No description yet." in the description slot.

**Slot 3 — Member avatars row (28h, top-margin 6)**
- `flex items-center`.
- 24×24 avatar circles, 2px border-color `var(--canvas-dark-250)` (or `var(--canvas-dark-200)` on suggested cards to blend with darker chrome). Overlap `-6px margin-left`.
- Max 4 visible + `+N` overflow chip (same shape, `rgba(255,255,255,0.08)` bg, mono 9px).

**Slot 4 — Footer (28h + 8h top pad + 1px border = ~37h)**
- `display: flex; justify-content: space-between; align-items: center`.
- 1px border-top `rgba(255,255,255,0.05)`, 8px top pad.
- Left: pulse (green 6×6 dot + 3px halo) + `Active {relTime}`. When `lastActivityAt === null`, render `No recent activity` with muted-grey pulse.
- Right: `{N} MEMBER(S)` (uppercase mono 10px).

**Total used:** 40 + 6 + 50 + 6 + 28 + 8 + 1 + 28 = 167h of 190h available (23h breathing room).

### Click target
- `source IN ('yours', 'member')` → `/${locale}/clubs/${id}` (existing detail route).
- `source === 'suggested'` → `/${locale}/clubs/${id}` (PUBLIC clubs are joinable from the detail page).

### `showRolePill` opt-out
Optional prop `showRolePill?: boolean` (default `true`). On `/discover?tab=clubs` consumers, pass `false` to suppress the SUGGESTED pill since the tab itself signals discoverability — matches the hive card pattern from the prior plan.

---

## Hub layout (`/clubs`)

Mirror `/sparks` + `/hives` structure verbatim.

- Outer container: `max-width: 1680px` + `px-6 pt-7 pb-6`.
- 2-col grid: `xl:grid-cols-[minmax(0,1fr)_300px] grid-cols-1 gap-8`.
- Auth gate: guests redirect to `/sign-in?next=/clubs`.
- Header: H1 "Clubs" + subtitle "Read together. Discuss, schedule, and keep up with the current book." + `+ New Club` brand-yellow CTA on the right (use existing `<CreateClubButton>` — adapt to inline, no `headerSlot`).

### Tab strip — 4 buckets

| Tab | Bucket |
|---|---|
| **All** | Union of Yours + Member + Suggested, deduped (yours wins over member, member wins over suggested). |
| **Yours** | `viewerRole === 'OWNER'` from membership. |
| **Member** | `viewerRole IN ('MODERATOR', 'MEMBER')` (clubs have OWNER/MODERATOR/MEMBER per `bookClubMemberRoleEnum`). |
| **Suggested** | From `getSuggestedClubsAction` (friend → FoF → trending). Excludes clubs viewer is already in. |

URL contract: `?tab=all|yours|member|suggested`, default `all`. Drop default param. Legacy URLs: `?filter=mine` → 308 redirect to `?tab=yours` for back-compat with the current `getClubsAction({filter:'mine'})` page.

### Sort

`Most active · Newest · A→Z · Member count`. Default `active`. Same shape as Hives.

### Grid

`grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))` with `gap: 16px` and `align-items: stretch`. Cards are 340×360 fixed; the grid auto-flows them at desktop (3 per row at 1680-300-32 ≈ 1348px main column → 3 cards × 340 + 2 gaps × 16 = 1052 + 32 = 1084 fits 3 comfortably, 4 if margin shrinks).

### Pagination

PAGE_SIZE = 9 (same as sparks + hives). `<ClubsHubPagination>` byte-for-byte clone of `<SparksHubPagination>` with `/clubs` base path.

### Ghost cards (sparse-bucket density)

Mirror the Hives Hub pattern. 6 variants picked dynamically by tab + viewer state. Each ghost = 340×360 dashed card with corner label pill + lucide X dismiss button. localStorage key `'clubs-hub:dismissed-ghosts'`.

| Variant | Trigger | CTA |
|---|---|---|
| **create-club** | always when grid has < 6 | `+ New Club` → opens `<CreateClubModal>` |
| **join-suggested** | when grid has < 6 (trending pulled from rail) | `/clubs/${trendingClubId}` |
| **invite-members** | when `ownCount > 0` AND viewer has a solo-owner club (memberCount = 1) | `/clubs/${smallestOwnedClubId}/members` |
| **set-current-book** | when `ownCount > 0` AND any owned club has `currentBookId === null` | `/clubs/${id}?tab=books` |
| **add-to-queue** | when `ownCount > 0` AND any owned club has empty queue | `/clubs/${id}?tab=books` |
| **start-discussion** | when memberCount-of-any-owned-club > 1 AND no recent discussion (>7d) | `/clubs/${id}?tab=discussions` |

Cap math identical: 5 max OR until total reaches 6, whichever first. Same 0/5, 1/5, 2/4, 3/3, 4/2, 5/1, 6+/0 table.

Per-tab priority arrays:
- **All / Yours:** create-club → set-current-book (if applicable) → invite-members (if applicable) → start-discussion (if applicable) → add-to-queue → join-suggested
- **Member:** join-suggested → create-club → set-current-book → invite-members → start-discussion → add-to-queue
- **Suggested:** create-club → join-suggested (extra slot from priority list) → start-discussion → invite-members → set-current-book → add-to-queue

---

## Right rail (300px sticky)

Mirror Hives' rail. 2 panels:

### Panel 1 — Your club stats
2×2 tile grid:
- **Owned** (brand-yellow value) — count of clubs where viewer is OWNER.
- **Member of** — count of clubs where viewer is MODERATOR or MEMBER.
- **Books finished** — count of `book_club_books` rows where `status='PAST'` across all viewer's clubs.
- **Currently reading** — count of viewer's clubs with `currentBookId !== null`.

### Panel 2 — Trending clubs
`flex: 1` filling remaining viewport height with internal scroll (same pattern as Hives). Limit 12 (was Hives' 3 → 12 bump; clubs starts at 12). Each row: 28×28 cover thumb (or fallback initial circle) + club name + mono meta `N MEMBERS · NOW READING X` or `N MEMBERS · OPEN`. Click → `/clubs/${id}`.

`Active in your network` panel: DEFERRED, same as Hives. Hidden in v1.

Rail collapses below xl viewport (`hidden xl:flex`).

---

## Smart suggested-clubs sourcing

New `lib/actions/clubs-suggested.actions.ts` exporting `getSuggestedClubsAction({ limit })`. Composes 3 tiers, dedupes, slices.

### Tier 1 — Friend-members
Clubs where someone the viewer follows is a member (via `book_club_members`). Excludes clubs viewer is already in.
- ORDER BY `friend_count DESC, MAX(joined_at) DESC`. LIMIT 30.
- `suggestionReason`: `"@{topFriendUsername} is a member"` when `friendCount === 1`; `"{N} friends are members"` when >= 2.

### Tier 2 — Friend-of-friend
Clubs where a user the viewer's follows follow (but the viewer doesn't directly follow) is a member. Excludes Tier 1 ids + viewer's own clubs. Includes `NOT EXISTS` guard so the direct-follow case is filtered out.
- ORDER BY `mutual_count DESC, MAX(joined_at) DESC`. LIMIT 30.
- `suggestionReason`: `"{N} mutuals via @{fofUsername}"`.

### Tier 3 — Trending fallback
Public + discoverable clubs ranked by activity (sum of `book_club_discussions.created_at` + `book_club_members.joined_at` + `book_club_books.added_at` in last 7d). Excludes Tier 1 + 2 ids + viewer's own clubs. LIMIT 30.
- `suggestionReason: null`.

### Stitch + dedupe
Sequential: `await tier1Q` first (need ids for exclusion), then `Promise.all([tier2Q, tier3Q])` with Tier 1 ids interpolated. Concat `[...tier1, ...tier2, ...tier3]`, dedupe by `club.id` (first occurrence wins → Tier 1 always wins), slice to `args.limit ?? 100`.

Returns `SuggestedClub[]` where `SuggestedClub = ClubSummary & { memberPreviews: Array<{userId, avatarUrl}>, lastActiveAt: Date | null, suggestionReason: string | null }`.

---

## Cross-surface: shared `<ClubCard>` component

`components/club/club-card.tsx` — shared V2 card. Consumed by:
1. `/clubs` hub via `<ClubHubCard>` (thin re-export at `app/[locale]/(app)/clubs/_components/club-hub-card.tsx`).
2. `/discover?tab=clubs` grid via `<RailClubCard>` and `<DiscoverClubCard>` (existing components rewritten as thin wrappers with prop adapter, `showRolePill: false`, `source: 'suggested'`).
3. `/discover/clubs/...` sub-routes (cascade through the wrappers above).

Projection widening required on `lib/actions/discover-clubs.actions.ts` to add `memberPreviews` + `coverImageUrl` to the discover-clubs row shape. Same correlated-subquery pattern as the hive redesign T1.

---

## Trending rail extends to viewport

Same pattern as Hives T7. Rail aside `height: calc(100vh - 100px)`, sticky from `top: 80px`. Stats panel natural height. Trending panel `flex: 1 overflow: hidden minHeight: 0` with internal scrollable body. Limit bumped to 12.

---

## CreateClubModal additions

Existing modal at `_components/create-club-modal.tsx` needs:
1. New "Cover image" field — Cloudinary upload with preview, "Remove" affordance, "Use no cover" toggle. Optional (no validation gate).
2. (No other changes — visibility, name, description, tags, rules, openJoin all stay.)

---

## Acceptance criteria

1. New `cover_image_url text` column on `book_clubs`; migration is additive (no DDL on existing rows).
2. Shared `<ClubCard>` at `components/club/club-card.tsx`. Dimensions HARD-pinned at 340×360 regardless of state.
3. Cover image renders via `background-image` when present; fallback gradient with first-letter initial when null.
4. Body slots (40/50/28/footer-37) all fixed-height; description clamps to 3 lines (default) or 1 line + why-suggested (suggested mode). Total card height never grows.
5. Hub tab strip: 4 pills `All · Yours · Member · Suggested`. Last tab named `Suggested` (NOT `Open` — same lesson learned from Hives).
6. Hub layout: 1680px outer, 2-col grid (main + 300px rail), `<ClubsRightRail>` with Stats + Trending (Trending fills viewport).
7. `getSuggestedClubsAction` ranks friend → FoF → trending; returns `suggestionReason: string | null`.
8. Ghost cards fill to total 6 (real + ghost) with 5 max. localStorage dismiss key `'clubs-hub:dismissed-ghosts'`. Per-tab priority arrays per the spec table.
9. PAGE_SIZE = 9. Pagination matches `/discover` chrome.
10. `<CreateClubModal>` accepts an optional cover image upload via Cloudinary.
11. /discover hub + sub-routes adopt the shared `<ClubCard>` via thin wrappers (`showRolePill: false`, `source: 'suggested'`).
12. Trending rail panel fills `calc(100vh - 100px)` with internal scroll; limit 12.
13. Legacy `?filter=mine` URL on `/clubs` 308-redirects to `?tab=yours`.

---

## Out of scope (deferred)

- `Active in your network` panel on the right rail (needs follow-graph join with discussion-thread context — separate follow-up).
- Per-club word-goal-style progress (clubs don't have shared word goals; would need new entity).
- Editing cover image on existing clubs via `<EditClubMetadataDialog>` — scope it in if time, otherwise follow-up.
- Following tab + corresponding rail panel (mirror Hives' deferred work).
- Cloudinary upload abstraction beyond what already exists for book covers/avatars.

---

## Risks

1. **FoF query cost on `book_club_members` double-self-join.** Same risk as Hives' T2 (`hives-suggested.actions.ts`). Mitigation: `LIMIT 30` cap per tier. If perf bites, materialize a "viewer's 2nd-degree follow set" CTE.
2. **`memberCount` denorm staleness.** `book_clubs.member_count` is updated on join/leave actions but could drift. Spec assumes the denorm is reliable; if smoke surfaces stale counts, audit the writers.
3. **Cover image upload widget on `<CreateClubModal>`.** Reuse the existing `<CoverPicker>` from the book creation wizard (`book-creation-form.tsx`). If the component doesn't generalize cleanly, write a clubs-specific variant.
4. **Existing `<ClubCard>` at `_components/club-card.tsx` widely consumed.** Verify all consumers (community feed, profile pages, etc.) accept the new shape OR keep the old component name + reshape its body to render `<ClubCard from 'components/club/club-card'>`.
5. **Card height locks at 360 — overflowing content gets clamped.** Some clubs may have 200+ char descriptions that look truncated mid-sentence. Acceptable v1; the detail page shows the full text.
