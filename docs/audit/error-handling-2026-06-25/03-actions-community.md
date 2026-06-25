# Error-Handling Audit — Community / Social / Discover Actions (Issue #46)

Scope: 27 server-action files under `lib/actions/` (community, social, friendships, blocks, mutes, notifications, profile, sparks, clubs, reading-lists, discover). Read-only audit. Audited 2026-06-25.

## Convention recap

- Mutations should return `ActionResult<T> = {success:true;data} | {success:false;error:string}` and translate failures to a typed `{success:false,error}` rather than throwing raw.
- `requireAuth()` THROWS `AuthError`. `requirePremium()` THROWS `Error("PREMIUM_REQUIRED:*")`. `assert*` helpers THROW. `FREE_LIMIT_REACHED` is RETURNED as a string.
- The hazard: an action that calls a throwing guard (or `db.transaction`) WITHOUT a surrounding try/catch propagates raw thrown errors to the client (Next.js server-action error → opaque "An error occurred" digest), instead of a typed result the UI can branch on.
- Read-only `get*`/discover/rail/hub fetchers used only in server components are OK to throw (a page error boundary catches), and are marked **OK-IF-SERVER-ONLY**.

### Summary

- **Total exported actions audited:** ~135 across 27 files.
- **Mutations needing fix (NEEDS-FIX):** see table — the dominant class is "mutation calls `requireAuth()` + `db.transaction(...)` with NO try/catch, returns raw thrown error on auth-fail or DB error." This is the prevailing pattern across `social`, `friendships`, `friend-invites`, `blocks`, `mutes`, `notifications`, `book-clubs`, `reading-lists`, `sparks`, `club-progress`. By convention these are *technically* convention-violating but **consistent and low-severity** (guest-calling a mutation is normally impossible from the UI; the raw `AuthError` only surfaces on session-expiry edge cases). Count of mutation actions with NO sentinel translation: **~70**.
- **Read-only fetchers that THROW (no try/catch, will propagate raw):** ~45 — almost all OK-IF-SERVER-ONLY. The notable ones are the three `getFollowing*Action` discover fetchers + `getPublicProfileAction`/profile fetchers that are reachable from client components via the profile/hub surfaces.
- **Genuinely well-handled:** `sparks-rail`, `clubs-rail`, `clubs-suggested`, `reading-lists-hub` (stats/tags/trending), `community-dashboard` — these wrap in try/catch and return `FETCH_FAILED` (or use the `safe()` degradation wrapper).

#### 8 highest-risk mutation gaps (ranked)

1. **`addCommentAction` (social.actions.ts)** — has a try/catch but it ONLY catches `MENTION_CAP_EXCEEDED` and `throw e`-rethrows everything else; `requireAuth()` + the post-tx profile query are outside it. A DB failure inside the tx that isn't the mention sentinel propagates raw. Highest-traffic write surface (book comments).
2. **`toggleBookLikeAction` (social.actions.ts)** — `requireAuth()` + `db.transaction` + post-tx `ensureLikedListAction` all un-try/caught. The most-fired social mutation; any tx error (notification insert, social-activity insert) throws raw to the client.
3. **`createClubAction` (book-clubs.actions.ts)** — large multi-step tx (club insert + member insert + activity + 2 mention fan-outs); `requireAuth()` + tx un-wrapped. A mention-resolution or notification insert failure throws raw mid-create.
4. **`createSparkAction` (sparks.actions.ts)** — returns `FREE_LIMIT_REACHED` correctly but the insert + count queries are un-try/caught; `requireAuth()` raw on guest. Premium-adjacent funnel surface.
5. **`joinClubAction` (book-clubs.actions.ts)** — open-join tx (member insert + count bump) and closed-join tx (request insert + OWNER/MOD notification fan-out) both un-wrapped; notification fan-out failure aborts the join with a raw error.
6. **`claimFriendInviteAction` (friend-invites.actions.ts)** — translates all its own sentinels well (TOKEN_*, BLOCKED, SELF_INVITE) but the final accept `db.transaction` (invite update + friendship insert + notification) is un-try/caught; a partial failure throws raw after sentinels passed.
7. **`submitSparkEntryAction` (sparks.actions.ts)** — tx (entry insert + entryCount bump + activity) un-wrapped; raw error on any insert failure after the ALREADY_SUBMITTED / WORD_LIMIT_EXCEEDED checks pass.
8. **`sendFriendRequestAction` (friendships.actions.ts)** — two tx paths (auto-accept + new-request, each with notification insert) un-wrapped; `throw new Error('FRIENDSHIP_INSERT_FAILED')` inside the tx propagates raw (not a typed result).

**Cross-cutting note:** none of the discover/hub/rail Zod-less fetchers validate args, but they take typed object args from trusted server callers, so that is acceptable. The Zod-validated mutations (friendships, blocks, mutes, book-clubs, reading-lists, sparks) all return a clear `INVALID_INPUT` string on parse failure — Zod handling is uniformly good.

---

## community.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getCommunityFeedAction | Read | yes | no | returns INVALID_CURSOR (typed); requireAuth raw on guest | no | no (manual cursor decode in try/catch) | OK-IF-SERVER-ONLY — requireAuth throws raw; feed page is authed server component |
| getSuggestedWritersAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| getMyActiveSparksAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## community-dashboard.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getCommunityDashboardAction | Read | no (returns CommunityDashboardData; EMPTY_DASHBOARD on guest) | via `safe()` per sub-query | degrades each slot to fallback, never throws | no | no | OK — `safe()` wrapper is the model degradation pattern |
| getFriendsDeskNextPageAction | Read | no (returns {rows,nextCursor}) | via `safe()` | degrades to empty | no | no | OK |

## community-dashboard.helpers.ts

Not a `'use server'` file (helpers consumed only by the aggregator above, all wrapped in `safe()`). No exported server actions. The exported helpers (`resolveHeroSignal`, `getViewerPulseStats`, `getHivesPanelRows`, `getSparksPanelRows`, `getListsPanelRows`, `getClubsPanelRows`, `getFriendsDeskRows`, `loadDashboardFallbacks`) throw on DB error but are always called through `safe(fn, fallback)`. Status: **OK** (degradation handled at the aggregator).

## social.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| toggleBookLikeAction | Mut | yes | no | requireAuth raw; tx + ensureLikedList un-wrapped | yes | no | NEEDS-FIX — wrap tx + post-tx call; high-traffic |
| toggleSparkLikeAction | Mut | yes | no | returns AUTH_REQUIRED (getOptionalUserId, good); tx un-wrapped | yes | no | NEEDS-FIX — tx errors propagate raw |
| getSparkLikeStateAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY (also called from client like buttons → minor) |
| toggleBookmarkAction | Mut | yes | no | requireAuth raw | no | no | NEEDS-FIX — auth/DB errors raw |
| toggleFollowAction | Mut | yes | partial | returns CANNOT_FOLLOW_SELF (typed); requireAuth + inserts un-wrapped | no | no | NEEDS-FIX |
| addCommentAction | Mut | yes | partial | catch ONLY handles MENTION_CAP_EXCEEDED, rethrows rest; requireAuth + FORBIDDEN/INVALID_CONTENT typed | yes | yes (INVALID_CONTENT) | NEEDS-FIX — non-mention tx errors rethrown raw |
| getUserSocialStateAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| getCommentBookIdAction | Read | yes (typed) | no | returns NOT_FOUND; requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## friendships.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| sendFriendRequestAction | Mut | yes | no | many typed sentinels (CANNOT_FRIEND_SELF/BLOCKED/ALREADY_*); but tx `throw new Error('FRIENDSHIP_INSERT_FAILED')` raw | yes | yes (INVALID_INPUT) | NEEDS-FIX — tx + internal throw propagate raw |
| acceptFriendRequestAction | Mut | yes | no | NOT_FOUND/NOT_AUTHORIZED/NOT_PENDING typed; tx un-wrapped | yes | yes | NEEDS-FIX — tx error raw |
| rejectFriendRequestAction | Mut | yes | no | typed sentinels | no | yes | NEEDS-FIX — requireAuth/DB raw (low risk) |
| cancelFriendRequestAction | Mut | yes | no | typed sentinels | no | yes | NEEDS-FIX |
| cancelFriendRequestByTargetAction | Mut | yes | no | INVALID_INPUT/NOT_FOUND typed | no | manual | NEEDS-FIX |
| unfriendAction | Mut | yes | no | NOT_FRIENDS/INVALID_INPUT typed | no | yes | NEEDS-FIX |
| getFriendshipStatusAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| listFriendsAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| listPendingFriendRequestsAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| getFriendCountAction | Read | yes | no | none (no auth) | no | no | OK-IF-SERVER-ONLY |
| searchUsersAction | Read | yes | no | INVALID_INPUT typed; requireAuth raw | no | yes | OK-IF-SERVER-ONLY (called from Find-friends client tab → minor: raw on session expiry) |

## friend-invites.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| createFriendInviteAction | Mut | yes | no | requireAuth raw; insert un-wrapped | no | no | NEEDS-FIX |
| claimFriendInviteAction | Mut | yes | no | rich typed sentinels (TOKEN_*/BLOCKED/SELF_INVITE) but accept tx un-wrapped | yes | yes (INVALID_INPUT) | NEEDS-FIX — accept tx error raw after sentinels pass |

## blocks.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| blockUserAction | Mut | yes | no | INVALID_INPUT/SELF_BLOCK typed; tx un-wrapped | yes | yes | NEEDS-FIX — tx (3 deletes/inserts) error raw |
| unblockUserAction | Mut | yes | no | INVALID_INPUT typed; delete un-wrapped | no | yes | NEEDS-FIX (low risk) |
| getBlockedUsersAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## mutes.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| muteUserAction | Mut | yes | no | INVALID_INPUT/SELF_MUTE typed; insert un-wrapped | no | yes | NEEDS-FIX (low risk) |
| unmuteUserAction | Mut | yes | no | INVALID_INPUT typed | no | yes | NEEDS-FIX (low risk) |
| getMutedUsersAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## notifications.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getNotificationsAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY (bell is client-mounted but feeds from server fetch) |
| markNotificationReadAction | Mut | yes | no | requireAuth raw; update un-wrapped | no | no | NEEDS-FIX (low risk) |
| markAllNotificationsReadAction | Mut | yes | no | requireAuth raw; update un-wrapped | no | no | NEEDS-FIX (low risk) |

## user-profile.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getPublicProfileAction | Read | yes | partial (try/catch only around the isFollowing requireAuth, correctly swallowed) | NOT_FOUND typed; main queries un-wrapped (throw raw on DB error) | no | no | OK-IF-SERVER-ONLY (profile page is server component; isFollowing auth correctly handled) |
| getProfileBooksAction | Read | yes | no | none (no auth) | no | no | OK-IF-SERVER-ONLY |
| getProfileSparksAction | Read | yes | no | getOptionalUserId (safe) | no | no | OK-IF-SERVER-ONLY |
| getProfileActivityAction | Read | yes | no | none | no | no | OK-IF-SERVER-ONLY |
| getUserPublicClubsAction | Read | yes | no | getOptionalUserId (safe) | no | no | OK-IF-SERVER-ONLY |

## sparks.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getSparksAction | Read | yes | no | getOptionalUserId; sweepSparkStatuses un-wrapped | no | no | OK-IF-SERVER-ONLY |
| getSparkAction | Read | yes | no | NOT_FOUND typed; lazy-finalize tx un-wrapped | yes (lazy) | no | OK-IF-SERVER-ONLY — but the finalize tx can throw raw on a read; flag |
| createSparkAction | Mut | yes | no | FREE_LIMIT_REACHED/INVALID_INPUT typed; requireAuth + insert un-wrapped | no | yes | NEEDS-FIX — funnel surface, DB error raw |
| getSparkForEditAction | Read | yes | no | NOT_FOUND typed; requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| updateSparkAction | Mut | yes | no | NOT_FOUND/NOT_AUTHORIZED/INVALID_INPUT typed; update un-wrapped | no | yes | NEEDS-FIX |
| getSparkEntriesAction | Read | yes | partial (requireAuth swallowed) | n/a | no | no | OK-IF-SERVER-ONLY |
| getSparkEntryAction | Read | yes | partial (requireAuth swallowed) | NOT_FOUND typed | no | no | OK-IF-SERVER-ONLY |
| submitSparkEntryAction | Mut | yes | no | NOT_ALLOWED/ALREADY_SUBMITTED/WORD_LIMIT typed; tx un-wrapped | yes | yes | NEEDS-FIX — tx error raw |
| updateSparkEntryAction | Mut | yes | no | NOT_OWNER/SPARK_NOT_OPEN/etc typed; update un-wrapped | no | yes | NEEDS-FIX |
| voteSparkEntryAction | Mut | yes | no | NOT_ALLOWED/CANNOT_VOTE_OWN typed; tx un-wrapped | yes | no | NEEDS-FIX — tx error raw |
| setCreatorChoiceAction | Mut | yes | no | typed sentinels; tx (notification + activity) un-wrapped | yes | no | NEEDS-FIX |
| getSparkEntryCommentsAction | Read | yes | no | none | no | no | OK-IF-SERVER-ONLY |
| addSparkEntryCommentAction | Mut | yes | no | INVALID_CONTENT/NOT_FOUND/MENTION_CAP typed; tx `throw new Error(mentionResult.error)` propagates raw | yes | yes | NEEDS-FIX — mention throw inside tx not translated |
| replyToSparkCommentAction | Mut | yes | no | rich typed sentinels; tx `throw new Error(mentionResult.error)` raw | yes | yes | NEEDS-FIX — same mention-throw issue |
| getSparkEntryCommentParentsAction | Read | yes (typed) | no | NOT_FOUND typed; requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## sparks-hub.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getCommunitySparksAction | Read | yes | no | takes viewerId arg (no throw); projectToSparkCards/canViewSpark un-wrapped | no | no | OK-IF-SERVER-ONLY — never returns success:false; DB error propagates raw |

## sparks-rail.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getTrendingSparksForRailAction | Read | yes | yes | returns FETCH_FAILED on catch (good); cached body | no | no | OK |
| getViewerSparkStatsAction | Read | yes | yes | requireAuth OUTSIDE try (raw on guest); 4-count body returns FETCH_FAILED | no | no | OK-IF-SERVER-ONLY — note requireAuth precedes the try, so guest AuthError still raw |

## clubs-hub.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getCommunityClubsAction | Read | yes | partial (try/catch around requireAuth → returns UNAUTHORIZED, good) | UNAUTHORIZED typed; propagates mineR.error; getClubsAction/getSuggestedClubsAction failures bubble as their own results | no | no | OK — best-handled hub aggregator; auth translated |

## clubs-rail.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getViewerClubStatsAction | Read | yes | yes | requireAuth OUTSIDE try (raw on guest); body returns FETCH_FAILED | no | no | OK-IF-SERVER-ONLY |
| getTrendingClubsForRailAction | Read | yes | yes | returns FETCH_FAILED; cached body | no | no | OK |

## clubs-suggested.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getSuggestedClubsAction | Read | yes | yes | requireAuth OUTSIDE try (raw on guest); 3-tier body returns FETCH_FAILED | no | no | OK-IF-SERVER-ONLY |

## club-progress.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getClubProgressAction | Read | yes | no | NOT_FOUND (incl. canView masquerade) typed | no | no | OK-IF-SERVER-ONLY |
| updateGroupProgressAction | Mut | yes | no | NOT_FOUND/NOT_AUTHORIZED/INVALID_INPUT typed; update un-wrapped; requireAuth raw | no | no (manual validation, no Zod) | NEEDS-FIX — DB error raw |
| clearGroupProgressAction | Mut | yes | no | NOT_AUTHORIZED typed; update un-wrapped | no | no | NEEDS-FIX (low risk) |
| toggleMemberOnTrackAction | Mut | yes | no | NOT_FOUND/NO_CURRENT_BOOK/NOT_MEMBER typed; upsert un-wrapped | no | no | NEEDS-FIX |

## book-clubs.actions.ts

All mutations call `requireAuth()` + `v.*Schema.safeParse` (returns INVALID_INPUT) and most run un-wrapped `db.transaction`. Zod handling is uniformly good (INVALID_INPUT). The shared gap: no try/catch → tx error or guest AuthError propagates raw.

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| createClubAction | Mut | yes | no | MENTION_CAP/INVALID_INPUT typed | yes | yes | NEEDS-FIX — large tx un-wrapped |
| getClubsAction | Read | yes | no | UNAUTHORIZED/INVALID_INPUT typed | no | yes | OK-IF-SERVER-ONLY |
| getClubAction | Read | yes | no | NOT_FOUND typed | no | no | OK-IF-SERVER-ONLY |
| updateClubAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED/MENTION_CAP typed; cloudinary in try/catch | yes | yes | NEEDS-FIX — tx un-wrapped |
| deleteClubAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED typed; cloudinary try/catch | no | yes | NEEDS-FIX |
| joinClubAction | Mut | yes | no | ALREADY_MEMBER/NOT_FOUND/REQUEST_ALREADY_PENDING typed; 2 tx paths un-wrapped | yes | yes | NEEDS-FIX — notification fan-out failure raw |
| leaveClubAction | Mut | yes | no | NOT_MEMBER/OWNER_CANNOT_LEAVE typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| removeClubMemberAction | Mut | yes | no | rich typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| changeClubMemberRoleAction | Mut | yes | no | typed sentinels; update un-wrapped | no | yes | NEEDS-FIX |
| transferClubOwnershipAction | Mut | yes | no | typed sentinels; tx (3 updates) un-wrapped | yes | yes | NEEDS-FIX |
| inviteUserToClubAction | Mut | yes | no | rich typed sentinels (USER_NOT_FOUND masquerade etc); tx un-wrapped | yes | yes | NEEDS-FIX |
| respondToClubInviteAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED/NOT_PENDING typed; accept tx un-wrapped | yes | yes | NEEDS-FIX |
| cancelClubInviteAction | Mut | yes | no | typed sentinels; update un-wrapped | no | yes | NEEDS-FIX |
| createClubInviteTokenAction | Mut | yes | no | NOT_ALLOWED typed; insert un-wrapped | no | yes | NEEDS-FIX |
| claimClubInviteTokenAction | Mut | yes | no | TOKEN_*/BLOCKED/ALREADY_MEMBER typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| respondToJoinRequestAction | Mut | yes | no | NOT_FOUND/NOT_PENDING/NOT_ALLOWED typed; accept tx un-wrapped | yes | yes | NEEDS-FIX |
| cancelJoinRequestAction | Mut | yes | no | typed sentinels; delete un-wrapped | no | yes | NEEDS-FIX |
| cancelMyPendingJoinRequestAction | Mut | yes | no | INVALID_INPUT/REQUEST_NOT_FOUND typed | no | manual | NEEDS-FIX (low risk) |
| addClubBookAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED/BOOK_NOT_FOUND typed; tx (deriveCurrentBookTx) un-wrapped | yes | yes | NEEDS-FIX |
| updateClubBookAction | Mut | yes | no | typed sentinels; update un-wrapped | no | yes | NEEDS-FIX |
| setCurrentBookAction | Mut | yes | no | typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| removeClubBookAction | Mut | yes | no | NOT_FOUND/CANNOT_REMOVE_CURRENT typed; delete un-wrapped | no | yes | NEEDS-FIX |
| reorderClubQueueAction | Mut | yes | no | NOT_ALLOWED typed; tx loop un-wrapped | yes | yes | NEEDS-FIX |
| getClubBooksAction | Read | yes | no | NOT_FOUND typed | no | yes | OK-IF-SERVER-ONLY |
| addScheduleItemAction | Mut | yes | no | NOT_ALLOWED/BOOK_NOT_IN_CLUB typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| updateScheduleItemAction | Mut | yes | no | typed sentinels; update un-wrapped | no | yes | NEEDS-FIX |
| removeScheduleItemAction | Mut | yes | no | typed sentinels; delete un-wrapped | no | yes | NEEDS-FIX |
| getClubScheduleAction | Read | yes | no | NOT_FOUND typed | no | no | OK-IF-SERVER-ONLY |
| createClubDiscussionAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED/MENTION_CAP typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| updateClubDiscussionAction | Mut | yes | no | typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| deleteClubDiscussionAction | Mut | yes | no | typed sentinels; delete un-wrapped | no | yes | NEEDS-FIX |
| pinClubDiscussionAction | Mut | yes | no | typed sentinels; update un-wrapped | no | yes | NEEDS-FIX |
| replyToClubDiscussionAction | Mut | yes | no | typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| deleteClubDiscussionReplyAction | Mut | yes | no | typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| toggleClubDiscussionLikeAction | Mut | yes | no | NOT_FOUND typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| toggleClubReplyLikeAction | Mut | yes | no | NOT_FOUND typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| listClubDiscussionsAction | Read | yes | no | NOT_FOUND/INVALID_INPUT typed | no | yes | OK-IF-SERVER-ONLY |
| getClubDiscussionAction | Read | yes | no | NOT_FOUND typed | no | no | OK-IF-SERVER-ONLY |
| getMyClubsCountAction | Read | yes | no | requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| listClubMembersAction | Read | yes | no | NOT_FOUND/INVALID_INPUT typed | no | yes | OK-IF-SERVER-ONLY |
| listClubPendingInvitesAction | Read | yes | no | NOT_AUTHORIZED/INVALID_INPUT typed; requireAuth raw | no | yes | OK-IF-SERVER-ONLY |
| listClubJoinRequestsAction | Read | yes | no | NOT_AUTHORIZED/INVALID_INPUT typed | no | yes | OK-IF-SERVER-ONLY |
| getDiscussionClubIdAction | Read | yes (typed) | no | NOT_FOUND typed; requireAuth raw | no | no | OK-IF-SERVER-ONLY |
| getReplyDiscussionAndClubIdAction | Read | yes (typed) | no | NOT_FOUND typed; requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## reading-lists.actions.ts

Same shared pattern as book-clubs: every mutation is Zod-validated (INVALID_INPUT) + rich typed sentinels, but `db.transaction` / `requireAuth` are un-wrapped (no try/catch) so tx errors / guest AuthError propagate raw.

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| createListAction | Mut | yes | no | MENTION_CAP/INVALID_INPUT typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| getListsAction | Read | yes | no | UNAUTHORIZED typed | no | no | OK-IF-SERVER-ONLY |
| getListAction | Read | yes | no | NOT_FOUND typed | no | no | OK-IF-SERVER-ONLY |
| updateListAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED/MENTION_CAP typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| deleteListAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED/LIKED_LIST_UNDELETABLE typed; delete un-wrapped | no | yes | NEEDS-FIX |
| addBookToListAction | Mut | yes | no | typed sentinels (BOOK_NOT_FOUND masquerade); tx un-wrapped | yes | yes | NEEDS-FIX |
| updateListBookAction | Mut | yes | no | typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| removeBookFromListAction | Mut | yes | no | typed sentinels; tx un-wrapped | yes | yes | NEEDS-FIX |
| reorderListBooksAction | Mut | yes | no | typed sentinels; tx loop un-wrapped | yes | yes | NEEDS-FIX |
| followListAction | Mut | yes | no | NOT_FOUND/NOT_ALLOWED typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| unfollowListAction | Mut | yes | no | INVALID_INPUT typed; tx un-wrapped | yes | yes | NEEDS-FIX |
| getListFollowersCountAction | Read | yes | no | none | no | no | OK-IF-SERVER-ONLY |
| getDiscoverableListsAction | Read | yes | no | delegates to getListsAction | no | no | OK-IF-SERVER-ONLY |
| getUserPublicListsAction | Read | yes | no | getOptionalUserId (safe) | no | no | OK-IF-SERVER-ONLY |
| getListBookCommentaryListIdAction | Read | yes (typed) | no | NOT_FOUND typed; requireAuth raw | no | no | OK-IF-SERVER-ONLY |

## reading-lists-hub.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getCommunityListsAction | Read | yes | no | takes viewerId arg (no throw); projection un-wrapped | no | no | OK-IF-SERVER-ONLY — never returns success:false |
| getViewerListStatsAction | Read | yes | yes | returns FETCH_FAILED; cached() | no | no | OK |
| getTopListTagsAction | Read | yes | yes | returns FETCH_FAILED; cached() | no | no | OK |
| getTrendingListsForRailAction | Read | yes | yes | returns FETCH_FAILED; unstable_cache | no | no | OK |

## discover.actions.ts

All read-only fetchers. `getFollowingFeedAction` calls `requireAuth()` (raw on guest — JSDoc says callers wrap + hide rail). No try/catch anywhere; DB errors propagate raw (acceptable for server-component rails). Zod only on the legacy `searchBooksAction` (INVALID_INPUT).

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getFeaturedFreshBookAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getTrendingBooksAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getRisingStarsBooksAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getRecentlyUpdatedBooksAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getNewReleasesBooksAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getBestOngoingBooksAction | Read | yes | no | getOptionalUserId; unstable_cache median (no catch) | no | no | OK-IF-SERVER-ONLY |
| getFollowingFeedAction | Read | yes | no | requireAuth raw (documented; callers .catch + hide rail) | no | no | OK-IF-SERVER-ONLY |
| getBackfillBooksAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| searchBooksDiscoverAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getGenreBookCountsAction | Read | yes | no | unstable_cache (no catch → throws on cache/DB error) | no | no | OK-IF-SERVER-ONLY |
| getPublicBookAction | Read | yes | no | NOT_FOUND typed | no | no | OK-IF-SERVER-ONLY |
| getBookCommentsAction | Read | yes | no | FORBIDDEN typed (canReadBook gate) | no | no | OK-IF-SERVER-ONLY (called from client CommentsPanel → DB error raw, minor) |
| getMoreByAuthorAction | Read | yes | no | none | no | no | OK-IF-SERVER-ONLY |
| searchBooksAction | Read | yes | no | INVALID_INPUT typed | no | yes | OK-IF-SERVER-ONLY |

## discover-home-mixed.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| searchHomeMixedAction | Read | yes | no | fans out to 5 entity actions; each `.success` checked + degrades that slice to `[]` (good per-source degradation) | no | no | OK — never returns success:false; failed sub-fetchers degrade silently |

## discover-clubs.actions.ts / discover-hives.actions.ts / discover-sparks.actions.ts

All read-only fetchers. None has try/catch. All return `ActionResult<T>` except `projectToSparkCards` (returns `Promise<SparkCard[]>`, exported projection helper). Each file's `getFollowing*Action` calls `requireAuth()` outside any try/catch (raw AuthError on guest — JSDoc: "callers wrap + hide rail"). The `*GenreCountsAction` wrap `unstable_cache` but do NOT catch → throw on cache/DB error. `getForYou*Action` take `viewerId` arg and guard empty string → empty payload (safe).

| Action (per file, same shape) | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| getFeatured{Club,Hive,Spark}Action | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getTrending/Active/New/etc *Action (all guest-safe variants) | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getFollowing{Clubs,Hives,Sparks}Action | Read | yes | no | requireAuth raw (documented) | no | no | OK-IF-SERVER-ONLY |
| get{Club,Hive,Spark}BackfillAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| search{Clubs,Hives,Sparks}DiscoverAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| get{Club,Hive,Spark}GenreCountsAction | Read | yes | no | unstable_cache, no catch → throws raw | no | no | OK-IF-SERVER-ONLY (consider FETCH_FAILED for parity with rail/hub) |
| getForYou{Clubs,Hives,Sparks}Action | Read | yes | no | viewerId arg, empty-string guard | no | no | OK-IF-SERVER-ONLY |
| projectToSparkCards (discover-sparks) | Read | NO (returns SparkCard[]) | no | n/a — exported projection helper | no | no | OK-IF-SERVER-ONLY |

## discover-for-you-books.actions.ts

| Action | Mut/Read | ActionResult | try/catch | Sentinel | Tx | Zod | Status |
|---|---|---|---|---|---|---|---|
| hasAnyDiscoverySignalAction | Read | NO (returns `Promise<boolean>`) | no | viewerId arg; React cache() | no | no | OK-IF-SERVER-ONLY — note: not ActionResult-shaped |
| getPopularBooksAction | Read | yes | no | getOptionalUserId | no | no | OK-IF-SERVER-ONLY |
| getForYouBooksAction | Read | yes | no | viewerId arg; NO empty-string guard (runs queries with empty id) | no | no | OK-IF-SERVER-ONLY (flag: missing empty-viewerId guard that the other getForYou* have) |

---

## Recommendation (for the fix phase, not done here)

The cleanest fix is a single shared wrapper for mutations, e.g. `withAction(async () => {...})` that runs `requireAuth`-throwing code inside try/catch and maps `AuthError → {success:false, error:'UNAUTHORIZED'}`, `Error('PREMIUM_REQUIRED:*') → that code`, and any other throw → `{success:false, error:'INTERNAL_ERROR'}` (with server-side logging). Apply to the ~70 NEEDS-FIX mutations. The two mention-throw cases in `sparks.actions.ts` (`addSparkEntryCommentAction`, `replyToSparkCommentAction`) and the `addCommentAction` partial-catch in `social.actions.ts` should additionally translate the rethrown mention error rather than `throw e`. Read-only fetchers can stay as-is (server-component error boundaries cover them), optionally adding `FETCH_FAILED` to the `*GenreCountsAction` trio for parity with the already-wrapped rail/hub fetchers.
