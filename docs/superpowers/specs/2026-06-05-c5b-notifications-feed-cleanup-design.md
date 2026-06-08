# C5b — Notification Prefs + Feed Ranking + Cleanup Design

> Second of three C5 sub-projects closing the Community phase. C5a @-mentions shipped + smoked; this is the engineering-polish piece before C5d Claude Design handoff finishes the phase.
>
> Bundles three coordinated pieces that share data + sequencing: (1) per-type notification preferences at `/settings/notifications`, (2) friend-first feed ordering in `/community`, (3) a bounded 5-item cleanup pass closing named user-visible follow-ups from C1–C5a.
>
> Inherits all Community phase commitments from [2026-06-04-community-phase-overview.md](2026-06-04-community-phase-overview.md).

## 1. Scope

Three pieces in one sub-project:

1. **Notification preferences** — new `/settings/notifications` route + per-type opt-out + skip-at-write enforcement at every notification write site. Closes Q2-Q3.
2. **Feed prioritization** — `getCommunityFeedAction` ORDER BY tuple gains `isFriend DESC` as the leading sort key. Closes Q4.
3. **5 user-visible cleanup follow-ups** from C1–C5a:
   - **C5a** `?invite_claimed=1` sonner toast handler (shared between C1 friend-invite + C4 club-invite landings).
   - **C4 T13** `ClubSummary.viewerMembership` pending-request widening → unlocks the "Request pending" muted pill currently stubbed out.
   - **C5a T13** mention bell deep-link approximations → replaced with precise per-surface lookup actions (8 new actions).
   - **C2/C3/C4 recurrence** `<VisibilityPicker>` generic-ization → drops `as SparkVisibility` casts at C2/C3/C4 call sites.
   - **C5a v1 trade-off** rename-safe rendering via alias-redirect layer at `/u/[old-name]` (gated on T0 audit confirming username rename is supported).

**Out of scope (deferred to C5d or later):**

- `/settings` hub index page — ships as a one-line `redirect()` stub to `/settings/notifications`. Real hub work waits until 3+ sub-sections exist.
- Locale hardcoded `/en/` in bell + invite components — pre-existing tech debt, not user-visible.
- Legacy `lib/friendships/are-friends.ts` zero-consumer deletion — cosmetic.
- `user_mutes` missing reverse `muted_idx` — flag if EXPLAIN shows seq scan; not blocking today.
- C5a unused `MentionMark` + `useMentionPopover` deletion-vs-preserve decision — defer; future-readiness has value.
- Pagination off-by-block edge cases (C2/C3/C4 discover branches) — hasn't bitten production.
- `jsonb_set` NULL-payload edge case — unreachable per current callers.
- Discover Lists tab Load-more, Liked variant id-prefix brittleness — cosmetic.
- Mass-mention global rate-limiter beyond per-post cap of 5 — defer until evidence of abuse.
- Email / push notification channels — bell only at v1; future channels would layer per-channel preferences on top of the per-type table established here.
- New `notification_type` enum values, new `social_activity_type` enum values, schema changes beyond §2.

## 2. Data Model

### 2.1 New table `notification_preferences`

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  opted_out_types text[] NOT NULL DEFAULT '{}',
  updated_at timestamp NOT NULL DEFAULT now()
);
```

**Lazy-create semantics**: rows only exist for users who have opted SOMETHING out. Default state (no row) = all notifications enabled. This keeps the table tiny in practice (most users never customize) and avoids a backfill migration for existing users.

Drizzle schema (`db/schema/social.ts`): append `notificationPreferences` table definition near the existing `notifications` table.

### 2.2 New table `username_aliases` (conditional on T0 audit)

```sql
CREATE TABLE IF NOT EXISTS username_aliases (
  old_username text PRIMARY KEY,
  current_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  renamed_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS username_aliases_user_idx ON username_aliases(current_user_id);
```

**T0 audit step**: verify username rename is supported in the codebase before adding this table. Grep for action names like `updateUsernameAction`, `changeUsernameAction`, `renameUsernameAction`, etc. If usernames are immutable, this table + the rename-safe cleanup item close as N/A; the spec drops T11 entirely.

If renames ARE supported, the rename action gains an in-tx `INSERT INTO username_aliases (old_username, current_user_id) VALUES (...)` after the username update.

### 2.3 No enum changes, no `social_activity_type` extensions, no `notification_type` extensions

The existing `notificationTypeEnum` shipped through C1–C5a has all the values we need. No new types in C5b.

### 2.4 Migration

`scripts/migrate-c5b.ts` — idempotent runner mirroring `migrate-c5a.ts` shape. Two `CREATE TABLE IF NOT EXISTS` + one `CREATE INDEX IF NOT EXISTS` (latter two conditional on T0 audit).

## 3. Server Layer

### 3.1 Notification preferences module `lib/notifications/`

**`check-preferences.ts`** — single canonical write-side gate.

```ts
import { cache } from 'react'

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

`cache()` wrap means within a single request, each user's preferences are fetched at most once even if multiple notification writes target the same recipient. Critical for multi-row fan-outs (C4 club join requests, C5a mention batches).

**`get-preferences.ts`** — auth-gated read for the settings page.

```ts
'use server'
export async function getNotificationPreferencesAction(): Promise<
  ActionResult<{ optedOutTypes: NotificationType[] }>
> {
  const { userId } = await requireAuth()
  const row = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  })
  return { success: true, data: { optedOutTypes: row?.optedOutTypes ?? [] } }
}
```

**`update-preferences.ts`** — auth-gated upsert.

```ts
'use server'
export async function updateNotificationPreferenceAction(input: {
  type: NotificationType
  optedOut: boolean
}): Promise<ActionResult<{ optedOutTypes: NotificationType[] }>> {
  const { userId } = await requireAuth()
  const parsed = updatePreferenceSchema.parse(input)

  return await db.transaction(async (tx) => {
    // Upsert: if no row, create with [type] if optedOut else empty.
    // If row exists, array_append/array_remove.
    const existing = await tx.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    })
    const current = new Set(existing?.optedOutTypes ?? [])
    if (parsed.optedOut) current.add(parsed.type)
    else current.delete(parsed.type)
    const nextArray = Array.from(current)

    await tx
      .insert(notificationPreferences)
      .values({ userId, optedOutTypes: nextArray })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { optedOutTypes: nextArray, updatedAt: new Date() },
      })

    return { success: true, data: { optedOutTypes: nextArray } }
  })
}
```

### 3.2 Audit + wire `shouldSkipNotification` at every notification write site

Single-line check before each existing insert. Multi-row fan-outs filter the recipient list pre-batch.

**Sites to audit (estimated 11-14):**

| Notification type | Write site (C-phase, file) |
|---|---|
| FRIEND_REQUEST | C1 `sendFriendRequestAction` (`lib/actions/friendships.actions.ts`) |
| FRIEND_ACCEPTED | C1 `acceptFriendRequestAction` (same file) — both insert paths + auto-accept path |
| HIVE_INVITE | C1/H-phase `inviteToHiveAction` (`lib/actions/hive.actions.ts`) |
| CLUB_INVITE | C4 `inviteUserToClubAction` (`lib/actions/book-clubs.actions.ts`) |
| CLUB_JOIN_REQUEST | C4 `joinClubAction` closed-join multi-row fan-out (same file) |
| CLUB_JOIN_APPROVED | C4 `respondToJoinRequestAction` accept path (same file) |
| NEW_FOLLOWER | P7 `toggleFollowAction` insert branch |
| NEW_LIKE | P7 `toggleBookLikeAction` insert branch |
| NEW_COMMENT | P7 `addCommentAction` (also fires on spark entry comments via T6 path) |
| SPARK_WIN | C2 `setCreatorChoiceAction` + lazy-finalize in `getSparkAction` |
| MENTION | C5a `recordMentionNotificationsTx` — single point of enforcement; filter `mentionedUserIds` before batch insert via parallel `Promise.all(ids.map((id) => shouldSkipNotification(id, 'MENTION')))` |

**Multi-row fan-out pattern** (C4 `joinClubAction` closed path + C5a mentions): filter recipients pre-batch via parallel checks, then pass the filtered list to the existing batch insert. Single-row writes: one `if (await shouldSkipNotification(recipientId, 'TYPE')) return` early-return before the insert.

**Edge case — skip-and-rollback semantics**: skip-at-write only suppresses the `notifications` row write. It does NOT suppress the underlying source action (e.g. liking the book still increments `like_count`; sending the friend request still creates the friendship row). The skip is purely about the bell ping.

### 3.3 Feed prioritization in `getCommunityFeedAction`

**Sort tuple change**: `(createdAt DESC, id DESC)` → `(isFriend DESC, createdAt DESC, id DESC)`.

`isFriend` is already computed per-row in the existing feed query (C1 T7 projection — friend ids pre-fetched, projected via `isFriend: friendIds.has(actorId)`). The SORT change pushes this from a row attribute to the leading sort key.

**Cursor format extension**: current cursor is base64url JSON `{ createdAt, id }`. New format: `{ isFriend, createdAt, id }`. Pagination predicate becomes a 3-column tuple `WHERE (isFriend, createdAt, id) < (cursor.isFriend, cursor.createdAt, cursor.id)` (descending). Existing in-flight cursors land in a backward-compat branch: if cursor lacks `isFriend` field, treat as `isFriend = false` so older clients paginate predictably (only on the followed-only tail).

**Subject hydration**: unchanged. The grouped IN-list queries on `book`, `book_club`, `reading_list`, `hive` etc. continue to feed projections identically.

**UI**: no React work required. C1's brand-yellow left-edge indicator (`isFriend: true` rows get accent border-left) already differentiates the two streams; the new sort makes that indicator dominant on page 1.

### 3.4 Cleanup item actions + helpers

**Cleanup #1 — invite-claimed toast:**

New shared client component `components/invite-claimed-toast.tsx`. Mounted in two places:
- `/u/[username]/page.tsx` (friend-invite landing target).
- `/clubs/[clubId]/page.tsx` (club-invite landing target).

Reads `?invite_claimed=1` from `useSearchParams`. Fires `sonner.toast.success(<copy>)` once on mount, then `router.replace(<path without param>)` to scrub. Per-surface copy via prop:

```tsx
<InviteClaimedToast
  copy={`You and @${inviterUsername} are now friends.`}
/>
<InviteClaimedToast
  copy={`Welcome to ${clubName}!`}
/>
```

The inviter username + club name come from the page's existing server-fetched data, so the toast component is purely presentational.

**Cleanup #2 — ClubSummary.viewerMembership pending-request widening:**

Current shape: `viewerMembership: { role: BookClubMemberRole | null }`. New shape: `viewerMembership: { role: BookClubMemberRole | null; pendingJoinRequest: boolean }`.

Wiring sites:
- `getClubAction` projection: add a `bookClubJoinRequests` lookup (`WHERE clubId = $1 AND userId = viewerId AND status = 'PENDING' LIMIT 1`) → boolean.
- `getClubsAction` discover branch: same per-row check via batch `inArray(clubIds)` to avoid N+1.
- `<ClubHeader>` smart-CTA: when `viewerRole === null && viewerMembership.pendingJoinRequest === true`, render muted pill "Request pending" + small `<button>` "Cancel request" calling `cancelJoinRequestAction`.

**Cleanup #3 — mention bell deep-link lookup actions:**

~10 new lookup actions in their respective C-phase action files (final count locked at plan-writing — depends on whether replies share parent-lookup actions with their post counterparts). Each takes a resource id (the `notification.resourceId`), returns the parent id(s) needed for the deep-link, gated by the authed viewer being the notification recipient (defense-in-depth).

| Action | Returns | Used for resourceType |
|---|---|---|
| `getDiscussionClubIdAction(discussionId)` | clubId | `book_club_discussion` |
| `getReplyDiscussionAndClubIdAction(replyId)` | `{ discussionId, clubId }` | `book_club_discussion_reply` |
| `getHiveDiscussionParentsAction(discussionId)` | `{ hiveId }` | `hive_discussion` |
| `getHiveReplyParentsAction(replyId)` | `{ discussionId, hiveId }` | `hive_discussion_reply` |
| `getBuzzHiveIdAction(buzzId)` | hiveId | `hive_buzz_post` |
| `getAnnotationParentsAction(annotationId)` | `{ chapterId, hiveId }` | `hive_annotation` |
| `getSuggestionParentsAction(suggestionId)` | `{ chapterId, hiveId }` | `hive_suggestion` |
| `getCommentBookIdAction(commentId)` | bookId | `book_comment` |
| `getListBookCommentaryListIdAction(rowId)` | listId | `reading_list_book_commentary` |
| `getSparkEntryCommentParentsAction(commentId)` | `{ entryId, sparkId }` | `spark_entry_comment`, `spark_entry_comment_reply` |

(Surfaces NOT needing lookup actions because their resourceId IS already the parent id: `book_club_description` + `book_club_rules` → resourceId is clubId; `reading_list_description` → resourceId is listId; `profile_bio` → no notification fires per spec C5a Q8. These 4 surface types route directly without a lookup.)

**Bell click router** in `notifications-bell.tsx` becomes async: `mentionHref` resolves the deep-link via the appropriate lookup action before navigating. UX: click triggers a short loading state on the row; rare cases (deleted parent) fall back to the parent hub gracefully.

Implementation pattern: store the resolved deep-link target post-fetch and use `router.push` (not `window.location.href`). Loading spinner on the row during the lookup.

**Cleanup #4 — `<VisibilityPicker>` generic-ization:**

Current shape: `<VisibilityPicker value: SparkVisibility, onChange: (v: SparkVisibility) => void, ... />`.

New shape: `<VisibilityPicker<T extends string>(props: { value: T; onChange: (v: T) => void; options: VisibilityOption<T>[] })>`.

Each call site provides its own `options` array OR a shared `BOOK_VISIBILITY_OPTIONS` / `CLUB_VISIBILITY_OPTIONS` / `SPARK_VISIBILITY_OPTIONS` const exported from a sibling module. All three call sites (C2 sparks, C3 reading lists, C4 book clubs) drop their `as SparkVisibility` casts.

Move the component from `app/[locale]/(public)/discover/_components/visibility-picker.tsx` to `components/visibility-picker.tsx` since it's now shared across feature areas, not discover-scoped.

**Cleanup #5 — rename-safe alias-redirect:**

**T0 audit gate**: first verify username rename is supported in the codebase. Grep for action names handling username updates. Possible outcomes:
- (a) Rename action exists → wire `username_aliases` writer + `/u/[username]` fallback. Ships.
- (b) No rename action exists, username effectively immutable → close as N/A, remove §2.2 table + T11 from plan, remove from §6 smoke. Document in commit.

If wiring proceeds:
- Rename action (whatever its name) wraps in `db.transaction`: writes new username → inserts `username_aliases (old_username, current_user_id)` row → returns.
- `/u/[username]/page.tsx` server component: existing lookup → null fallback → query `username_aliases WHERE old_username = $1 LIMIT 1`. Hit → `redirect(\`/u/${current.username}\`, 'permanent')` (308). Miss → `notFound()`.
- Chained renames (alice → robert → bob): each rename inserts an alias row. Lookup of "alice" finds robert (the rename direct), redirects to robert; but robert is now renamed to bob — alice's redirect to robert in turn redirects to bob. Two-hop redirect chain. Acceptable; rare in practice; spec accepts it (HTTP supports redirect chains).

### 3.5 Validation schemas

New `lib/validations/notifications.ts`:

```ts
import { z } from 'zod'
import { NOTIFICATION_TYPE_VALUES } from '@/db/schema/social' // export this if not already

export const updatePreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPE_VALUES),
  optedOut: z.boolean(),
})
```

## 4. UI Surfaces

### 4.1 `/settings/notifications` route

`app/[locale]/(app)/settings/notifications/page.tsx` — server component.

Server-fetches `getNotificationPreferencesAction()`. Mounts `<NotificationPreferencesForm initialOptedOutTypes={...} />` client component.

**`<NotificationPreferencesForm>`** — full chrome page with 4 grouped sections per spec §6 Q2 lock. Each section header (Comfortaa bold + brief description). Each row inside:

```
[Type label]           [Description]                          [<Switch>]
FRIEND_REQUEST         "When someone sends you a friend request"   on/off
```

Switch state inverse of opted-out (ON = receiving = NOT in `opted_out_types`). Toggle calls `updateNotificationPreferenceAction({ type, optedOut: !current })` via `useTransition` + optimistic flip + rollback on error + sonner error toast on failure. No save button (immediate persist matches typical settings UX).

Chrome: panel chrome per design system; section headers brand-yellow Comfortaa; type rows tile-gradient with hairline dividers between rows.

### 4.2 `/settings/page.tsx` stub redirect

```tsx
import { redirect } from 'next/navigation'

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/settings/notifications`)
}
```

One-line server component. Closes the dead-URL issue without committing to a real hub.

### 4.3 Nav user-avatar dropdown "Settings" link

Update `components/nav/user-menu-dropdown.tsx` (or wherever the C1 T12 dropdown lives — verify path at impl time). Change the "Settings" entry href from current target to `/${locale}/settings/notifications`. If the entry currently goes elsewhere, document the prior target in the commit message.

### 4.4 `/community` feed (no React work)

No component changes. The C1 T9 `<ActivityEventRow>` already renders a brand-yellow left-edge indicator on `isFriend: true` events. The new sort tuple makes that indicator dominant on page 1. Verify on smoke.

### 4.5 `<InviteClaimedToast>` mount points

- `app/[locale]/(public)/u/[username]/page.tsx` — server-passes the `inviterUsername` (already on profile data) and `?invite_claimed=1` presence to a `<InviteClaimedToast copy={...} />` child. Reads search param via client `useSearchParams` inside the toast component; toast fires once + scrubs param.
- `app/[locale]/(app)/clubs/[clubId]/page.tsx` — same shape, passes `clubName`.

### 4.6 `<ClubHeader>` pending-request pill

Modify `<ClubHeader>` smart-CTA logic. New branch in the CTA matrix:

```ts
if (viewerRole === null && club.openJoin) {
  // existing Join button
} else if (viewerRole === null && !club.openJoin && viewerMembership.pendingJoinRequest) {
  // NEW: muted "Request pending" pill + Cancel request link
} else if (viewerRole === null && !club.openJoin) {
  // existing Request to join button
}
```

Cancel link calls `cancelJoinRequestAction({ clubId, requestId: ??? })`. Wait — current `cancelJoinRequestAction` shape requires `requestId`, but `ClubSummary.viewerMembership` doesn't carry it. Two options at impl time: (a) widen `viewerMembership` further to expose `pendingJoinRequestId`, OR (b) add a new `cancelMyPendingJoinRequestAction({ clubId })` that looks up the viewer's request internally. (b) is cleaner — implement that.

### 4.7 Bell click router (async deep-link resolution)

`notifications-bell.tsx` `mentionHref` function refactors from sync string-builder to async lookup:

```ts
async function navigateToMention(n: NotificationRow) {
  const target = await resolveMentionHref(n)
  router.push(target)
}

async function resolveMentionHref(n: NotificationRow): Promise<string> {
  const rid = n.resourceId ?? ''
  switch (n.resourceType) {
    case 'book_club_discussion': {
      const result = await getDiscussionClubIdAction(rid)
      if (!result.success) return `/${locale}/clubs`
      return `/${locale}/clubs/${result.data.clubId}/discussions/${rid}`
    }
    // ... 8 more cases
  }
}
```

Click handler displays a brief inline loading state on the row during the lookup. Fall-back to parent hub on lookup miss (deleted parent).

## 5. Implementation Phasing

Indicative task decomposition (final from writing-plans):

- **T0** — audit: verify username rename is supported in codebase (grep for `updateUsername`, `changeUsername`, `renameUsername` action names). Output: confirmed YES/NO. Gates T11 + §2.2 table.
- **T1** — schema migration: `notification_preferences` table + (conditional) `username_aliases` table + idempotent runner.
- **T2** — `lib/notifications/` helpers + ~10 unit tests (getOptedOutTypes cache behavior + shouldSkipNotification truth-table per type + update upsert + cap-edge cases).
- **T3** — audit + wire `shouldSkipNotification` at every notification write site (11-14 sites). Single-line check per site; multi-row fan-out filters list pre-batch.
- **T4** — `/settings/notifications` page + `<NotificationPreferencesForm>` client.
- **T5** — `/settings/page.tsx` stub redirect + nav dropdown "Settings" link update.
- **T6** — `getCommunityFeedAction` sort tuple + cursor format change.
- **T7** — `<InviteClaimedToast>` shared client component + mount on profile + club detail.
- **T8** — `ClubSummary.viewerMembership.pendingJoinRequest` widening (+ `getClubAction`/`getClubsAction` projection updates) + `<ClubHeader>` pending pill wiring + `cancelMyPendingJoinRequestAction` server action.
- **T9** — ~10 mention deep-link lookup actions + bell `mentionHref` async refactor + per-row loading state.
- **T10** — `<VisibilityPicker>` generic-ization + drop casts at C2/C3/C4 call sites + move to `components/visibility-picker.tsx`.
- **T11** — (gated on T0 = YES) username rename action gains `username_aliases` writer + `/u/[username]` server component alias fallback + 308 redirect.
- **T12** — `/settings/notifications` smoke verification.
- **T13** — `/community` feed-ordering smoke verification.
- **T14** — 5-cleanup-items smoke verification.
- **T15** — AGENTS.md ship summary + close C5b.

Suggested waves: W1=T0+T1, W2=T2, W3=T3+T4 parallel (helpers wiring + UI build), W4=T5+T6+T7+T8 parallel (4 isolated scopes), W5=T9+T10+T11 parallel (3 isolated scopes — provided T0 confirmed rename support; otherwise W5=T9+T10), W6=T12+T13+T14+T15 (smoke + ship).

## 6. Carry-forward smoke checklist for Chris (T12 + T13 + T14)

**Notification preferences (T12) — 6 scenarios:**

1. **Settings page render** — visit `/settings/notifications` while authed → 4 grouped sections render with all switches ON (default state, no row in `notification_preferences` table yet).
2. **Toggle off → write check** — toggle `NEW_LIKE` OFF → optimistic flip → row inserted in `notification_preferences` with `['NEW_LIKE']` array → friend B likes your book → no `NEW_LIKE` notification appears in your bell.
3. **Toggle on again → re-enable** — toggle `NEW_LIKE` back ON → row's `opted_out_types` array becomes `[]` (or row stays with empty array) → friend B likes again → `NEW_LIKE` notification appears.
4. **Multi-type opt-out** — toggle `NEW_LIKE` + `NEW_FOLLOWER` OFF → array becomes `['NEW_LIKE', 'NEW_FOLLOWER']` → trigger both → neither appears in bell.
5. **MENTION opt-out (multi-row fan-out)** — toggle MENTION OFF → user A mentions you AND two friends in same post → you don't get notification; the two friends still do (per-recipient filtering works).
6. **`/settings` redirect** — visit `/settings` → redirected to `/settings/notifications` cleanly.

**Feed prioritization (T13) — 4 scenarios:**

7. **Friend events lead** — friend A posts a discussion (1 hour ago). Followed-only stranger B posts a buzz (5 minutes ago). Open `/community` → A's older event appears ABOVE B's newer event on page 1.
8. **Brand-yellow indicator** — A's row has the brand-yellow left-edge indicator (C1 stays meaningful under new sort).
9. **Cursor pagination** — scroll Load more → page 2 continues from where page 1 left off, no duplicate rows; followed-only tail surfaces cleanly.
10. **Backward-compat cursor** — verify that any old cursor format (if present in browser tabs from before deploy) doesn't crash — should treat absent `isFriend` field as `false` and resume sensibly on the followed tail.

**Cleanup items (T14) — 8 scenarios:**

11. **Friend invite claim toast** — accept a friend invite link → land on `/u/[inviter]?invite_claimed=1` → sonner toast "You and @inviter are now friends." appears → URL strips the param via `router.replace`.
12. **Club invite claim toast** — same flow for club invite → "Welcome to <ClubName>!" toast → URL scrubbed.
13. **Club pending-request pill** — request to join a closed-join club → reload club detail page → ClubHeader shows muted "Request pending" pill + "Cancel request" link → click Cancel → request canceled, CTA flips back to "Request to join".
14. **Mention bell deep links** — User A mentions you in a book club discussion → click the bell row → routes to `/clubs/[clubId]/discussions/[discussionId]` (precise) NOT `/clubs` (v1 approximate). Repeat for each of the 9 mention surface types.
15. **VisibilityPicker no-cast** — open create-spark + create-list + create-club modals → visibility picker renders identically → underlying TypeScript shouldn't need `as` casts (verify via grep that `as SparkVisibility` is gone).
16. **Rename-safe alias redirect (T0 = YES path)** — rename @bob → @robert → visit `/u/bob` → 308-redirected to `/u/robert` → existing mentions of @bob in old posts still navigate via the redirect.
17. **Two-hop rename chain (T0 = YES path)** — rename @alice → @bob → then @bob → @carol → `/u/alice` redirects to `/u/bob` redirects to `/u/carol`. Browser handles the chain transparently.
18. **No regressions** — every C1-C5a smoke scenario still passes; tsc clean; full test suite green.

## 7. Cross-cutting commitments preserved

- `isBlocked` + `areFriends` remain the only canonical privacy helpers (no parallel implementations).
- `recordSocialActivityTx` NOT called for notification preferences or bell-prefs (preferences are user-settings, not feed events).
- `notifications` table shape unchanged — no `payload` column added (C1 lesson).
- TipTap mark pattern preserved — no new marks in C5b.
- `'use server'` modules only export async functions — pure helpers in non-`'use server'` modules.
- 12-place brand-yellow usage map preserved.
- `/community` is a hub, not an index — sub-systems live at own routes (no Settings duplication).
- Visual design pass remains deferred to C5d.
