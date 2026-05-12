# Beehive Books v1 — API & Server Actions

> Source app: `C:\Code\personal\beehive-books-online`

The app is **server-actions-first**. Almost every read and every mutation is a `"use server"` function in `lib/actions/*.ts`. Real HTTP route handlers (`app/.../route.ts`) only exist for things that *must* be HTTP endpoints — third-party callbacks, the auth catch-all, and Vercel Cron.

---

## 1) Server actions

All files below export server actions (`"use server"` at the top). Auth is enforced inside each action via `requireAuth()` / `getOptionalUserId()` from `lib/require-auth.ts`. Mutations are rate-limited via `lib/check-action-rate-limit.ts` (which wraps the `actionLimiter` bucket).

### Authentication & onboarding — `lib/actions/auth.actions.ts`
- `checkUsernameAvailableAction(username)` — Validates a username (3–20 chars, alphanumeric + underscore) and checks uniqueness case-insensitively.
- `completeOnboarding(username, imageUrl?)` — Sets username + avatar, marks `onboardingComplete = true`.

### User profile — `lib/actions/user.actions.ts`
- `getCurrentUserAction()` — Returns the signed-in user's full profile.
- `getUserProfileAction(username)` — Returns another user's public profile (books, reading lists, clubs, hives, prompt wins). Respects `PUBLIC` / `FRIENDS` / `PRIVATE` and accepted-friendship status.
- `updateUserAvatarAction(image)` — Updates avatar URL.
- `updateUserBioAction(bio)` — Updates bio (≤200 chars).
- `getCurrentUserImageUrlAction()` — Returns just the avatar URL.
- `deleteUserAccountAction()` — Permanently deletes the user.

### Books, chapters, collections — `lib/actions/book.actions.ts`
**Reads**
- `getUserBooksAction()` — Books owned by the current user.
- `getLikedBooksAction()` — Books the current user has liked.
- `getBookWithChaptersAction(bookId)` — Owner-only book + chapters + collections.
- `getBookForViewAction(bookId)` — Reader view (privacy-aware).
- `getChapterWithContextAction(chapterId)` — Chapter + prev/next nav + comments + read state.
- `getHiveBookAction(bookId)` — Minimal book info for hive linking.
- `getPublicBookAction(bookId)` — Public book with chapters + collections.
- `getRecentWritingAction()` — 3 most recently updated books for the home dashboard.
- `getBookForExportAction(bookId)` — Book + all chapters for EPUB / PDF / DOCX export. **Premium only.**

**Writes**
- `createBookAction(data, coverUrl?, presetId?)` — Creates a book; enforces free-tier 50k-word-per-book limit.
- `updateBookAction(bookId, data, coverUrl?)` — Updates metadata + privacy; awards milestones.
- `deleteBookAction(bookId)` — Deletes book and Cloudinary cover.
- `createChapterAction(bookId, data)` — Creates a chapter; tracks word count and logs words to a linked hive if any.
- `updateChapterAction(bookId, chapterId, data)` — Updates content; tracks word-count delta.
- `deleteChapterAction(bookId, chapterId)` — Deletes a chapter and re-runs book stats.
- `reorderChaptersAction(bookId, orderedIds)` — Reorders chapters.
- `reorderCollectionsAction(bookId, orderedIds)` — Reorders collections.
- `reorderBookItemsAction(bookId, chapterOrders, collectionOrders)` — Atomic reorder of mixed items.
- `createCollectionAction(bookId, name)` — Creates a chapter grouping.
- `updateCollectionAction(bookId, collectionId, name)` — Renames a collection.
- `deleteCollectionAction(bookId, collectionId)` — Deletes a collection (chapters become ungrouped).
- `assignChapterToCollectionAction(bookId, chapterId, collectionId|null)` — Moves a chapter in/out of a collection.

**Comments on chapters**
- `addCommentAction(chapterId, content, parentId?)` — Adds a thread or reply. **Rate limited.**
- `toggleCommentLikeAction(commentId)` — Like / unlike a chapter comment.

**Auth/permissions:** Owner required for mutations; reads enforce per-resource privacy.

### Book likes — `lib/actions/book-like.actions.ts`
- `toggleBookLikeAction(bookId)` — Like/unlike; notifies owner if the liker isn't the owner. **Rate limited.**
- `getBookLikeStatusAction(bookId)` — Returns `{ liked, count }`. Works unauthenticated.

### Book-level comments — `lib/actions/book-comments.actions.ts`
- `getBookCommentsAction(bookId)` — Threads + replies + like counts + per-comment delete permission.
- `addBookCommentAction(bookId, content, parentId?)` — Top-level or reply; only allowed if comments are enabled on the book. **Rate limited.**
- `deleteBookCommentAction(commentId)` — Author or book owner only.
- `likeBookCommentAction(commentId)` — Like/unlike; notifies the comment's author (if not self).

### Friends & connections — `lib/actions/friend.actions.ts`
- `getFriendshipStatusAction(targetUserId)` — Returns `NONE` / `PENDING_SENT` / `PENDING_RECEIVED` / `FRIENDS`.
- `getMyFriendsDataAction()` — Friends list with each friend's book count, latest book, and recent activity.
- `searchUsersAction(query)` — Search by username/email; includes current friendship status.
- `sendFriendRequestAction(addresseeId)` — Sends and notifies.
- `cancelFriendRequestAction(friendshipId)` — Cancels pending outgoing.
- `acceptFriendRequestAction(friendshipId)` — Accepts and notifies.
- `rejectFriendRequestAction(friendshipId)` — Declines silently.
- `removeFriendAction(friendshipId)` — Removes accepted friend.
- `getSuggestedUsersAction()` — Returns 12 suggestions, prioritized: shared clubs → shared hives → shared genres → public books.

### Book clubs — `lib/actions/club.actions.ts`
**Club CRUD**
- `createClubAction(data, invitedIds?)` — Create + optional invites.
- `getClubAction(clubId)` — Club with the current user's membership role; privacy-aware.
- `getAllUserClubsAction()` — All clubs the user belongs to.
- `searchClubsAction(query)` — `PUBLIC` clubs + `FRIENDS` clubs of accepted friends.
- `updateClubAction(clubId, data)` / `deleteClubAction(clubId)` — Owner only.

**Membership**
- `requestToJoinClubAction(clubId)` — Privacy-aware; for `FRIENDS` clubs requires friendship with the owner.
- `leaveClubAction(clubId)` — Anyone but the owner.
- `removeMemberAction(clubId, targetUserId)` — Mod+.
- `updateMemberRoleAction(clubId, targetUserId, role)` — Owner only (`MODERATOR` / `MEMBER`).
- `getClubMembersAction(clubId)` — Sorted `OWNER` → `MODERATOR` → `MEMBER`.

**Currently reading + progress**
- `updateClubBookAction(clubId, currentBook, currentBookAuthor)` — Mod+ sets the current title.
- `updateClubProgressAction(clubId, currentPage, totalPages)` — Logs reading progress.

**Discussions + replies**
- `createClubDiscussionAction(clubId, data)` — **Rate limited.** Notifies all members.
- `getClubDiscussionsAction(clubId, page?)` — Paginated; pinned first.
- `getClubDiscussionByIdAction(clubId, discussionId)` — Discussion + nested replies (2 levels).
- `deleteClubDiscussionAction(clubId, discussionId)` — Author or mod+.
- `toggleDiscussionLikeAction(discussionId)`
- `pinDiscussionAction(clubId, discussionId, pin)` — Mod+.
- `createDiscussionReplyAction(clubId, discussionId, content, parentId?)` — **Rate limited.** Notifies author and parent author.
- `deleteDiscussionReplyAction(clubId, replyId)` — Author or mod+.
- `toggleReplyLikeAction(replyId)`

**Reading list (per club)**
- `getClubReadingListAction(clubId)` — Books with status `IN_PROGRESS` / `NOT_STARTED` / `COMPLETED`.
- `addBookToClubListAction(clubId, title, author)`
- `removeBookFromClubListAction(clubId, bookId)` — Mod+.
- `updateBookStatusAction(clubId, bookId, status)` — Only one `IN_PROGRESS` per club; updates `club.currentBook`.
- `suggestClubBookAction(clubId, title, author)` — Member submission.
- `getClubBookSuggestionsAction(clubId)` — Mod+ queue.
- `approveClubBookSuggestionAction(suggestionId, clubId)` / `dismissClubBookSuggestionAction(suggestionId, clubId)` / `resolveClubBookSuggestionAction(suggestionId, clubId, action)`

**Invites + join requests**
- `getClubFriendsForInviteAction(clubId)` — Friends not already in the club.
- `getClubPendingInvitedFriendsAction(clubId)` — Friends with pending invites.
- `inviteToClubAction(clubId, friendId)` — Mod+; notifies.
- `getPendingClubInvitesAction()` — Invites for the current user.
- `acceptClubInviteAction(inviteId)` / `declineClubInviteAction(inviteId)`
- `checkClubJoinRequestStatusAction(clubId)`
- `getPendingJoinRequestsAction(clubId)` / `approveJoinRequestAction(requestId)` / `rejectJoinRequestAction(requestId)` — Mod+.

### Hives — `lib/actions/hive.actions.ts`
**Hive CRUD**
- `createHiveAction(data, invitedIds?)` — Optionally links/creates a book.
- `getHiveAction(hiveId)` — Hive + current user's role; includes the linked book's word/chapter counts.
- `getAllUserHivesAction()`
- `searchHivesAction(query)` — `PUBLIC` + `FRIENDS` hives.
- `updateHiveAction(hiveId, data)` / `deleteHiveAction(hiveId)` — Owner only.
- `completeHiveAction(hiveId)` — Owner marks `COMPLETED`.

**Membership** (parallel to clubs)
- `requestToJoinHiveAction(hiveId)` / `checkHiveJoinRequestStatusAction(hiveId)`
- `leaveHiveAction(hiveId)`
- `inviteMemberAction(hiveId, targetUserId, role?)` — Mod+; roles `CONTRIBUTOR` / `BETA_READER`.
- `acceptHiveInviteAction(inviteId)` / `declineHiveInviteAction(inviteId)`
- `getPendingHiveInvitesAction()`
- `getHiveFriendsForInviteAction(hiveId)` / `getHivePendingInvitedFriendsAction(hiveId)`
- `removeMemberFromHiveAction(hiveId, targetUserId)` — Mod+.
- `updateMemberRoleAction(hiveId, targetUserId, role)` — Owner only.
- `getHiveMembersAction(hiveId)` — Sorted by role.
- `getPendingHiveJoinRequestsAction(hiveId)` / `approveHiveJoinRequestAction(requestId)` / `rejectHiveJoinRequestAction(requestId)` — Mod+.

**Book linking**
- `linkBookToHiveAction(hiveId, bookId)` — Owner only.
- `unlinkBookFromHiveAction(hiveId)` — Owner only.
- `createAndLinkBookAction(hiveId, title, author)` — Owner only.

**Milestones**
- `getHiveMilestonesAction(hiveId)` — Backfills new milestones based on linked-book state.

> Many feature-specific hive actions live in `lib/actions/hive-*.actions.ts` (about 11 files). They cover: beta-reader features, claiming chapters, milestones, outlines, in-hive prompts, style guides, version snapshots, word goals, buzz tracking, chat, inline comments, polls, sprints, wiki, forum, submissions, suggestions, activity. Same auth model — membership-required for reads, role checks for writes.

### Reading progress — `lib/actions/reading.actions.ts`
- `toggleChapterReadAction(chapterId)` — Mark read/unread.
- `getBookReadStatusAction(bookId)` — Returns chapter IDs the user has read.
- `trackChapterOpenAction(bookId, chapterId)` — Logs an open event for "continue reading" (best-effort, errors silently).
- `getContinueReadingAction()` — 5 most recently opened chapters.

### Reading lists — `lib/actions/reading-list.actions.ts`
- `getUserReadingListsAction()` / `getLikedReadingListsAction()`
- `getReadingListAction(listId)` — Privacy-aware; includes follow + like state.
- `getListFollowStatusAction(listId)` — Works unauthenticated.
- `followListAction(listId)` — Follow / unfollow.
- `likeListAction(listId)` — Like / unlike.
- `createReadingListAction(data, initialBooks, currentlyReadingIdx?)` — Enforces creation limit.
- `updateReadingListAction(listId, data)` / `deleteReadingListAction(listId)` — Owner only.
- `addBookToListAction(listId, bookData)` — Notifies followers.
- `removeBookFromListAction(listId, bookId)` — Adjusts "currently reading" if needed.
- `toggleBookReadStatusAction(listId, bookId, isRead)`
- `setCurrentlyReadingAction(listId, bookId|null)`
- `updateBookCommentaryAction(listId, bookId, commentary, rating?)`
- `searchBooksForListAction(query)` — `PUBLIC` + `FRIENDS` books.
- `getListsFeaturingBookAction(bookId)` — `PUBLIC` lists containing a given book.

### Prompts / sparks — `lib/actions/prompt.actions.ts`
Large file (~200+ lines). Key actions:
- `getMyPromptsAction()` — Created prompts + invitations + own entries.
- `getPromptAction(promptId)` — Prompt + invites + status transitions.
- Plus actions for entries, voting, leaderboards, accept/decline invites. **Creation and entry submission are rate-limited.**

### Notifications — `lib/actions/notification.actions.ts`
- `getNotificationsAction()` — 30 most recent + unread count.
- `getNotificationsPageAction(page, perPage = 25)` — Paginated.
- `pruneOldNotificationsAction()` — Drops notifications older than 30 days.
- `markAllReadAction()`

### Feedback — `lib/actions/feedback.actions.ts`
- `submitFeedbackAction(data)` — Public; type can be feature/bug/general/content concern.
- `updateFeedbackStatusAction(feedbackId, status)` — Admin only.
- `getFeedbackAdminAction(page?, perPage?, status?)` — Admin only.
- `deleteFeedbackAdminAction(id)` — Admin only.

### Admin — `lib/actions/admin.actions.ts`
**Stats / charts**
- `getAdminStatsAction()` — Lifetime + last-30-day totals (users, books, chapters, clubs, hives, prompts).
- `getSignupChartDataAction()` — 30-day signup trend.
- `getCleanupStatsAction()` — Stale invites, old notifications, pending requests counts.

**Users**
- `getAllUsersAdminAction(page, search?)`
- `updateUserRoleAction(id, role)` — `member` / `moderator` / `admin`.
- `toggleUserPremiumAction(id)`
- `banUserAction(userId, reason?)` — Bans + deletes their sessions.
- `unbanUserAction(userId)`
- `deleteUserAdminAction(userId)` — Cannot delete self.

**Content moderation** (each domain has list + delete pairs)
- Books: `getAllBooksAdminAction`, `deleteBookAdminAction`
- Chapters: `getAllChaptersAdminAction`
- Clubs: `getAllClubsAdminAction`, `deleteClubAdminAction`
- Discussions / replies: `getAllDiscussionsAdminAction`, `deleteDiscussionAdminAction`, `getAllDiscussionRepliesAdminAction`, `deleteDiscussionReplyAdminAction`
- Hives: `getAllHivesAdminAction`, `deleteHiveAdminAction`
- Prompts / entries: `getAllPromptsAdminAction`, `deletePromptAdminAction`, `getAllPromptEntriesAdminAction`, `deletePromptEntryAdminAction`
- Notifications: `getAllNotificationsAdminAction`

**Announcements**
- `getAnnouncementsAction()` — Public read; filters out user-dismissed ones.
- `dismissAnnouncementAction(announcementId)`
- `getAllAnnouncementsAdminAction()` / `createAnnouncementAction(...)` / `updateAnnouncementAction(...)` / `toggleAnnouncementActiveAction(id)` / `deleteAnnouncementAdminAction(id)`

**Reports + audit**
- `createReportAction(targetType, targetId, reason)` — User-facing report. **Rate limited.**
- `getContentReportsAction(page, perPage?, status?)` — Admin queue.
- `dismissReportAction(reportId)` — No content action.
- `removeReportedContentAction(reportId)` — Deletes content + marks reviewed.
- `getPendingReportsCountAction()`
- `getAdminAuditLogAction(page, perPage?)`

### Other specialised action files
- `lib/actions/cloudinary.actions.ts` — `deleteImageAction(publicId)` removes a Cloudinary asset.
- `lib/actions/epub.actions.ts` — EPUB export pipeline (premium).
- `lib/actions/docx.actions.ts` — DOCX export pipeline (premium).
- `lib/actions/export.actions.ts` — PDF export pipeline (premium).
- `lib/actions/import.actions.ts` — Import books from external files.
- `lib/actions/onboarding.actions.ts` — Onboarding helpers.
- `lib/actions/cleanup.actions.ts` — `runCleanupAction()` — Called by `/api/cron/cleanup`.
- `lib/actions/explore.actions.ts` — Discover-page queries (trending, recommendations).
- `lib/actions/feed.actions.ts` — Home-page activity feed.
- `lib/actions/hive-*.actions.ts` — Hive feature surface (see Hives section above).

---

## 2) API route handlers

Reserved for cases that **can't** be server actions: webhooks, the auth catch-all, and cron.

| Route | File | Methods | Purpose | Why not a server action |
|---|---|---|---|---|
| `/api/auth/[...all]` | `app/api/auth/[...all]/route.ts` | `GET`, `POST` | better-auth catch-all — handles sign-up, sign-in, OAuth callbacks, email verification, password reset, session retrieval. | better-auth requires a catch-all HTTP handler to run its protocol. |
| `/api/stripe/webhook` | `app/api/stripe/webhook/route.ts` | `POST` | Handles Stripe lifecycle events (`checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_succeeded`, `invoice.payment_failed`). Updates `users.premium`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`. | External callbacks need a stable HTTP endpoint and **raw body** to verify the Stripe signature. |
| `/api/stripe/checkout` | `app/api/stripe/checkout/route.ts` | `POST` | Creates a Stripe Checkout session for the current user; creates a Stripe customer if needed; returns the checkout URL. | Returns a JSON URL for client-side redirect. |
| `/api/stripe/portal` | `app/api/stripe/portal/route.ts` | `POST` | Creates a Stripe Customer Portal session for managing/cancelling a subscription; returns the portal URL. | Same as checkout — JSON URL response. |
| `/api/cron/cleanup` | `app/api/cron/cleanup/route.ts` | `GET` | Triggered by Vercel Cron. Validates `Authorization: Bearer ${CRON_SECRET}`, then calls `runCleanupAction()` to drop declined invites > 90 days, rejected join requests > 90 days, and read notifications > 30 days. | Cron requires an HTTP entry point. |

---

## 3) Supporting libs

Files in `lib/` that the action layer depends on.

**Auth / sessions**
- `lib/auth.ts` — better-auth config (Drizzle adapter, providers, session policy, custom user fields, email templates).
- `lib/auth-client.ts` — Client SDK (`signIn`, `signUp`, `signOut`, `useSession`).
- `lib/require-auth.ts` — `requireAuth()` returns the user ID or throws; `getOptionalUserId()` returns id-or-null. Both check ban status.

**Rate limiting**
- `lib/rate-limit.ts` — Upstash limiters: `signUpLimiter` (20/hr), `signInLimiter` (10/15m), `checkoutLimiter` (5/hr), `apiLimiter` (60/min), `actionLimiter` (20/min mutations), `searchLimiter` (60/min), `pageLimiter` (200/min).
- `lib/check-action-rate-limit.ts` — Wrapper around `actionLimiter` for use inside server actions; returns an error message string or `null`.

**Billing / monetization**
- `lib/stripe.ts` — Stripe SDK initialization.
- `lib/premium.ts` — `checkCreateLimit()` enforces creation caps (free vs premium).

**External services**
- `lib/email.ts` — Resend transport + branded templates (verification, password reset). Sender: `Beehive Books <noreply@beehive-books.app>`.
- `lib/cloudinary.ts` — Cloudinary URL builders + `publicId` generation.

**Domain helpers**
- `lib/notifications.ts` — `insertNotification()` writes a notification with metadata.
- `lib/milestones.ts` — `awardMilestoneIfNew()` idempotently grants achievements; `MILESTONES` array defines ~10+ achievements (`FIRST_WORD`, `FIRST_CHAPTER`, `FINISHED`, etc.).
- `lib/query-keys.ts` — TanStack Query key factories.
- `lib/utils.ts` — `cn()` and other helpers.

**Database**
- `db/schema.ts` (and `db/schema/` split files) — Drizzle ORM schema with relations.
- `db/index.ts` — Neon serverless client.
- `lib/validations/` — Zod schemas per domain (book, chapter, club, hive, prompt, reading-list, etc.).

**Types**
- `lib/types/` — TypeScript type exports referenced by both action files and components (`ClubFormData`, `HiveFormData`, `PromptCard`, `NotificationItem`, etc.).

---

## Patterns to keep / change in v2

**Worth keeping**
- Server-actions-first — minimal API surface, easy to reason about auth.
- Centralised `requireAuth()` so every action has one consistent gate.
- Rate-limit wrapper that returns a string instead of throwing — easy to surface in forms.
- Privacy enforced inside actions, not at the route layer — actions own their permission rules.

**Worth changing**
- ~50 action files with overlapping naming (`book.actions.ts` vs `book-like.actions.ts` vs `book-comments.actions.ts`) — collapse into per-domain folders with a clear public surface.
- Hive features split across ~11 files — a `hive/` folder with subdomain modules would scale better.
- Three different "exception to server actions" patterns (webhooks, auth catch-all, cron) all live next to each other under `app/api/` — fine, but in v2 give each its own folder convention.
- Rate limit imports are sprinkled through actions — consider a decorator or middleware wrapper.
- Admin actions in one file (`admin.actions.ts`) is large; split by domain (`admin/users.ts`, `admin/content.ts`, etc.).
