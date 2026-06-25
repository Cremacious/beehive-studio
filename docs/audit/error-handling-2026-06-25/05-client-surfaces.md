# Client-Side Error Handling Audit — Issue #46

Audited: 2026-06-25. READ-ONLY. Scope: client components (`'use client'`) under `app/` and `components/` that call server actions.

### Summary

- **Client call sites found:** ~131 client components; ~140 notable mutation/read call sites reviewed across studio, hive, community (clubs/friends/lists), discover/books/sparks, settings, auth/onboarding, and admin.
- **NEEDS-FIX count:** ~50 call sites (~36 distinct components).
- **The dominant defect:** the studio editor surface (binder + all front/back-matter previews + wiki + notes + outline + character) checks `result.success` but on failure does **nothing** — no toast, no rollback of the optimistic local state. The save silently fails server-side while the UI shows the change as persisted. This is the single biggest "silently fails for a real user" cluster.
- **Second cluster:** admin panels (`user-row`, `code-row`, `delete-content-button`) fire destructive actions (ban, delete user, grant/revoke premium, delete content) with **no success check and no error feedback** — silent failures on irreversible operations.
- **Third pattern:** many community/settings/books toggles roll back silently on failure (no toast) or show a hardcoded generic message instead of `result.error`. Lower severity (state self-corrects) but confusing.
- **Good news:** the clubs area, friends area, reading-lists area, hive submission/discussion/buzz modals, redeem, onboarding, billing, and spark forms are largely **OK** — they check success, surface real errors, disable submit while pending, and roll back optimistic updates.

#### Ranked top-15 highest-priority client components to fix

Ranked by likelihood of a real user hitting a silent failure / crash, weighted toward data-loss and destructive operations.

1. **`admin/users/user-row.tsx`** — `deleteUserAction`, `setBannedAction`, `grantCompPremiumAction`, `revokeCompPremiumAction`: no success check, no error feedback on destructive/irreversible actions.
2. **`studio/[bookId]/_components/book-editor-provider.tsx`** — `saveChapterAction` is the core autosave path; failure handling is fragile (`.then` without explicit `.catch`). Chapter content loss risk.
3. **`studio/[bookId]/_components/binder/binder-item-menu.tsx`** — create/update/`deleteBinderItemAction`: failures go to `console.error` only, no rollback. User deletes a chapter, server rejects, UI shows it gone.
4. **`studio/[bookId]/_components/binder/binder-item.tsx`** — rename via `updateBinderItemAction`: no error handling, no rollback.
5. **`studio/[bookId]/_components/binder/binder-add-menu.tsx`** — `createBinderItemAction` x3: `console.error` only, optimistic add never reconciled on failure.
6. **`studio/[bookId]/_components/binder/binder-tree.tsx`** — `reorderBinderItemsAction`, `updateBookAction`: silent rollback, no toast; reorder appears to work then snaps back unexplained.
7. **`admin/content/delete-content-button.tsx`** — `deleteContentAction`: no success check, no feedback on a destructive admin action.
8. **`admin/promo-codes/code-row.tsx`** — `setPromoActiveAction`, `deletePromoCodeAction`: no success check, no feedback.
9. **`studio/[bookId]/_components/editor/character-profile.tsx`** + all 6 `front-back-matter/*-preview.tsx` + `metadata-panel.tsx` + `notes/note-editor.tsx` + `wiki-entry-editor.tsx` + `wiki-folder-renderer.tsx` + `outline/outline-board.tsx` — shared pattern: `updateBinderItemAction` checked for success but failure is a no-op (no toast, no rollback). Treat as one batch fix.
10. **`hive/[hiveId]/wiki/_components/hive-wiki-entry-editor.tsx`** — `getBinderTreeForHiveAction` + `updateBinderItemAction`: no success check; save silently fails leaving stale state.
11. **`hive/[hiveId]/outline/_components/hive-outline-surface.tsx`** — `updateBinderItemAction` (title + commit): no success check, no error feedback.
12. **`discover/_components/spark-vote-button.tsx`** — `voteSparkEntryAction`: no success check, silent rollback, no error feedback on a contest-affecting action.
13. **`discover/_components/spark-entry-card.tsx`** — `setCreatorChoiceAction`: no error handling at all on a winner-selection action.
14. **`u/[username]/_components/follow-button.tsx`** + **`reading-lists/_components/follow-curator-button.tsx`** — `toggleFollowAction`: optimistic flip with silent rollback, no toast on failure.
15. **`(public)/books/_components/book-hero.tsx`** — `toggleBookLikeAction` / `toggleBookmarkAction`: rolls back but no real error reason and button not disabled during request (double-click race).

Honorable mentions (generic-message-only, lower severity): `chapter-comments-panel.tsx`, `comments-panel.tsx`, `spark-entry-comments-panel.tsx`, `notification-preferences-form.tsx`, `privacy-form.tsx`, `friend-status-section.tsx`, `create-code-form.tsx`, `delete-book-button.tsx`.

---

## Findings

Columns: success-check / toast (real reason) / wrapped (try-catch or .catch) / rollback / pending-disable.

### Studio

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `studio/new/_components/book-creation-form.tsx` | createBookAction | yes | yes (real) | yes (try/finally) | n-a | yes | OK |
| `studio/[bookId]/details/_components/book-details-form.tsx` | updateBookDetailsAction | yes | generic (setError, not real reason) | yes | yes | yes | NEEDS-FIX: surface result.error |
| `binder/binder-add-menu.tsx` | createBinderItemAction x3 | yes | no (console.error) | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `binder/binder-item-menu.tsx` | update/delete/createBinderItemAction | yes | no (console.error) | no | no-rollback | n-a | NEEDS-FIX: silent fail on delete |
| `binder/binder-item.tsx` | updateBinderItemAction (rename) | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `binder/binder-tree.tsx` | reorderBinderItemsAction, updateBookAction | yes | no (rollback only) | no | yes | n-a | NEEDS-FIX: no toast on reorder fail |
| `_components/book-editor-provider.tsx` | saveChapterAction, getChapterAction, updateChapterStatusAction, updateChapterNotesAction | yes | pushError (real) | .then no explicit catch | yes | n-a | NEEDS-FIX: autosave needs hardened catch |
| `editor/chapter-editor.tsx` | createBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `editor/character-profile.tsx` | updateBinderItemAction x2 | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `editor/editor-status-bar.tsx` | updateChapterWordGoalAction x3 | yes | no | no | yes | n-a | NEEDS-FIX: no toast |
| `editor/preview-banner.tsx` | restoreSnapshotAction | yes | pushFlash (real) | no | not-optimistic | yes | NEEDS-FIX: wrap throw |
| `editor/version-history-drawer.tsx` | getChapterSnapshotsAction, getSnapshotContentAction | yes | pushFlash (real) | yes (.then+cancelled) | n-a reads | n-a | OK |
| `editor/wiki-entry-editor.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `editor/wiki-folder-renderer.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `front-back-matter/about-author-preview.tsx` | updateBinderItemAction, deleteCloudinaryAssetAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail; cloudinary fire-and-forget |
| `front-back-matter/acknowledgments-preview.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `front-back-matter/copyright-preview.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `front-back-matter/dedication-preview.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `front-back-matter/subtype-picker.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `front-back-matter/title-page-preview.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `import/import-modal.tsx` | commitImportAction | yes | yes (real, setCommitError) | yes (try/finally) | n-a bulk | yes | OK |
| `metadata/metadata-panel.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `notes/note-editor.tsx` | updateBinderItemAction x2 | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `outline/outline-board.tsx` | updateBinderItemAction | yes | no | no | no-rollback | n-a | NEEDS-FIX: silent fail |
| `studio/_components/create-hive-modal.tsx` | createHiveAction | yes | yes (real) | yes (useTransition) | n-a | yes | OK |
| `components/book/delete-book-button.tsx` | deleteBookAction | yes | generic | no | n-a | n-a | NEEDS-FIX: generic toast; wrap throw |
| `components/avatar-uploader.tsx` | updateAvatarAction, deleteAvatarAction | yes | generic | yes (useTransition) | yes | yes | OK (could use real reason) |

### Hive

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `buzz/buzz-feed.tsx` | listBuzzPostsAction | yes | generic | yes | no-rollback | yes | OK |
| `buzz/buzz-post-card.tsx` | deleteBuzzPostAction | yes | yes (real) | no | no | n-a | NEEDS-FIX: wrap throw |
| `buzz/compose-buzz-modal.tsx` | createBuzzPostAction | yes | yes (real) | yes | no | yes | OK |
| `buzz/edit-buzz-modal.tsx` | updateBuzzPostAction | yes | yes (real) | yes | no | yes | OK |
| `buzz/like-button.tsx` | toggleBuzzLikeAction | yes | generic | yes | yes | yes | OK |
| `discussions/discussion-compose-modal.tsx` | createDiscussionPostAction | yes | yes (real) | yes | no | yes | OK |
| `discussions/discussion-thread.tsx` (reply/edit) | replyToDiscussionPostAction, editDiscussionPostAction | yes | yes (real) | yes | no | yes | OK |
| `discussions/discussion-thread.tsx` (delete) | deleteDiscussionPostAction | yes | yes (real) | no | no | n-a | NEEDS-FIX: wrap throw |
| `outline/hive-outline-surface.tsx` | updateBinderItemAction (title+commit) | no | no | no | partial | n-a | NEEDS-FIX: no success check, silent |
| `outline/new-outline-cta.tsx` | createHiveOutlineAction | yes | conditional | yes | no | yes | OK |
| `submissions/submission-composer.tsx` | saveSubmissionDraftAction, submitSubmissionAction | yes | yes (real) | yes | no | yes | OK |
| `submissions/submission-review.tsx` | approveSubmissionAction, rejectSubmissionAction | yes | yes (real) | yes | no | yes | OK |
| `suggestions/suggestions-by-chapter.tsx` | accept/rejectSuggestionAction | yes | real/generic | yes | no | n-a | OK |
| `wiki/hive-wiki-category-view.tsx` | createBinderItemAction | yes | yes (real) | yes | no | n-a | OK |
| `wiki/hive-wiki-entry-editor.tsx` | getBinderTreeForHiveAction, updateBinderItemAction | no | no (loadError only) | no | no | n-a | NEEDS-FIX: silent save fail |
| `wiki/hive-wiki-shell.tsx` | createBinderItemAction | yes | yes (real) | yes | no | n-a | OK |
| `word-goals/edit-goal-modal.tsx` | updateWordGoalAction | yes | yes (real) | yes | no | yes | OK |
| `word-goals/goal-card.tsx` | archiveWordGoalAction | yes | yes (real) | no | no | n-a | NEEDS-FIX: wrap throw |
| `word-goals/new-goal-modal.tsx` | createWordGoalAction | yes | yes (real) | yes | no | yes | OK |
| `word-goals/recent-activity-panel.tsx` | getRecentWordLogsAction | yes | no (silent) | yes | no-rollback | n-a | NEEDS-FIX: silent fail on load-more |
| `_components/hive-members.tsx` | removeMemberAction, updateMemberRoleAction | yes | yes (real) | no | yes | n-a | OK (could wrap throw) |
| `_components/hive-settings-form.tsx` | updateHiveAction | yes | yes (real) | implicit | no | yes | OK |
| `_components/hive-settings-form.tsx` | deleteHiveAction | yes | yes (real) | no | no | n-a | NEEDS-FIX: wrap throw on destructive |
| `_components/invite-modal.tsx` | generateInviteLinkAction, inviteMemberByUsernameAction x2 | yes | yes (real) | no | no | n-a | NEEDS-FIX: wrap throw |
| `components/hive/collab/annotate-modal.tsx` | createAnnotationAction | yes | yes (real) | yes | local mark | yes | OK |
| `components/hive/collab/suggest-modal.tsx` | createSuggestionAction | yes | yes (real) | yes | local mark | yes | OK |
| `components/mentions/mention-popover.tsx` | searchUsersAction | yes | silent (read) | yes | no | n-a | OK |

### Community — Clubs

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `clubs/.../club-discussion-thread.tsx` | reply/toggleLike(x2)/pin/delete(x2) | yes | generic | yes (transition) | yes (likes) | yes | OK |
| `clubs/.../discussions-list.tsx` | listClubDiscussionsAction | yes | generic | yes | no-rollback | yes | OK |
| `clubs/.../queue/queue-manager.tsx` | reorder/setCurrent/remove/updateClubBookAction | yes | generic | yes | yes (reorder) | yes | OK |
| `clubs/.../settings/detail-sections.tsx` | updateClubAction x5 | yes | generic | yes | no-rollback | yes | OK |
| `clubs/.../settings/rules-editor.tsx` | updateClubAction | yes | generic | yes | no-rollback | yes | OK |
| `clubs/.../club-currently-reading.tsx` | updateGroupProgress/clear/toggleMemberOnTrackAction | yes | generic | yes | yes (toggle) | yes | OK |
| `clubs/.../club-empty-ctas.tsx` | updateClubAction | yes | generic | yes | no-rollback | yes | OK |
| `clubs/.../club-page-hero.tsx` | join/leave/cancelMyPendingJoinRequestAction | yes | partial (enum) | yes | no-rollback | yes | OK |
| `clubs/.../club-reading-cell.tsx` | updateGroupProgress/clear/toggleMemberOnTrackAction | yes | generic | yes | yes (toggle) | yes | OK |
| `clubs/.../join-requests-badge.tsx` | respondToJoinRequestAction | yes | specific | yes | yes (snapshot) | per-item | OK |
| `clubs/_components/add-book-to-club-modal.tsx` | searchBooksAction, addClubBookAction | yes | specific | yes | no-rollback | yes | OK |
| `clubs/_components/add-schedule-item-modal.tsx` | add/updateScheduleItemAction | yes | enum | yes | no-rollback | yes | OK |
| `clubs/_components/club-book-row.tsx` | setCurrent/remove/updateClubBookAction | yes | specific | yes | no-rollback | yes | OK |
| `clubs/_components/club-header.tsx` | join/leave/delete/cancelPendingAction | yes | generic | yes | no-rollback | yes | OK |
| `clubs/_components/club-members-panel.tsx` | listClubMembers/removeClubMember/leaveClubAction | yes | generic | yes | partial (silent) | n-a | NEEDS-FIX: silent rollback on remove fail |
| `clubs/_components/create-club-modal.tsx` | createClubAction | yes | specific | yes | no-rollback | yes | OK |
| `clubs/_components/discussion-composer.tsx` | createClubDiscussionAction | yes | specific | yes | no-rollback | yes | OK |
| `clubs/_components/invite-by-username-input.tsx` | searchUsersAction, inviteUserToClubAction | yes | specific | yes | no-rollback | per-user | OK |
| `clubs/_components/invite-link-dialog.tsx` | createClubInviteTokenAction | yes | generic | yes | no-rollback | no (stuck "Generating…") | NEEDS-FIX: button not reset on error |
| `clubs/_components/like-button.tsx` | toggleClubDiscussion/ReplyLikeAction | yes | generic | yes | yes | yes | OK |
| `clubs/_components/pin-toggle.tsx` | pinClubDiscussionAction | yes | generic | yes | yes | yes | OK |
| `clubs/_components/reply-composer.tsx` | replyToClubDiscussionAction | yes | generic | yes | no-rollback | yes | OK |
| `clubs/_components/role-change-dialog.tsx` | changeClubMemberRoleAction | yes | generic | yes | no-rollback | yes | OK |
| `clubs/_components/transfer-ownership-dialog.tsx` | transferClubOwnershipAction | yes | generic | yes | no-rollback | yes | OK |

### Community — Friends / Lists / Feed / Notifications

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `community/bookmarks/bookmarks-grid.tsx` | toggleBookmarkAction | yes | generic | no | yes | yes | OK |
| `community/feed/activity-feed-full.tsx` | getFriendsDeskNextPageAction | no | n-a read | no | no | n-a | OK |
| `community/_components/friends-desk-panel.tsx` | getFriendsDeskNextPageAction | no | n-a read | no | no | n-a | OK |
| `friends/find-tab.tsx` | searchUsers/sendFriendRequest/createFriendInviteAction | yes | real | no | yes (send) | yes (invite) | OK |
| `friends/friends-list-tab.tsx` | mute/unfriend/blockUserAction | yes | real | no | yes | n-a | OK |
| `friends/friends-suggested-rail.tsx` | sendFriendRequestAction | yes | real | no | yes | n-a | OK |
| `friends/invite-link-dialog.tsx` | createFriendInviteAction | yes | real | no | no | yes | OK |
| `friends/pending-tab.tsx` | accept/reject/cancelFriendRequestAction | yes | real | no | yes | n-a | OK |
| `friends/suggested-tab.tsx` | sendFriendRequestAction | yes | real | no | yes | n-a | OK |
| `friends/user-search.tsx` | searchUsersAction | yes | n-a read | no | no | n-a | OK |
| `reading-lists/add-book-modal.tsx` | searchBooks/addBookToListAction | yes | real | no | no | yes | OK |
| `reading-lists/book-list.tsx` | reorderListBooksAction | yes | real | no | yes | n-a | OK |
| `reading-lists/book-row.tsx` | update/removeBookFromListAction | yes | real | no | yes | yes | OK |
| `reading-lists/create-list-modal.tsx` | createListAction | yes | real | no | no | yes | OK |
| `reading-lists/edit-book-row-dialog.tsx` | updateListBookAction | yes | real | no | no | yes | OK |
| `reading-lists/edit-list-metadata-dialog.tsx` | updateListAction | yes | real | no | no | yes | OK |
| `reading-lists/follow-curator-button.tsx` | toggleFollowAction | yes | no (silent) | no | yes | n-a | NEEDS-FIX: silent rollback |
| `reading-lists/follow-list-button.tsx` | follow/unfollowListAction | yes | real | no | yes | yes | OK |
| `reading-lists/list-detail-header.tsx` | deleteListAction | yes | real | no | no | n-a | OK |
| `_components/notifications-bell.tsx` | get/markAll/markNotificationReadAction | yes | generic | yes (try/catch) | yes | n-a | OK |
| `components/friendship/friend-button.tsx` | send/cancel/accept/reject/unfriendAction | yes | real (humanize) | no | no | yes | OK |
| `components/community/spark-like-button.tsx` | toggleSparkLikeAction | yes | real+contextual | no | yes | yes | OK |

### Discover / Books / Sparks

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `books/read/.../chapter-comments-panel.tsx` | addChapterComment/getChapterCommentsAction | yes | generic | no | yes | yes | NEEDS-FIX: generic, not real reason |
| `books/_components/book-hero.tsx` | toggleBookLike/toggleBookmarkAction | yes | generic | no | yes | no (no disable, race) | NEEDS-FIX: generic + no disable |
| `books/_components/chapters-panel.tsx` | mark/unmarkChapterReadAction | yes | generic | no | yes | n-a | NEEDS-FIX: generic |
| `books/_components/comments-panel.tsx` | addCommentAction | yes | generic | no | yes | yes | NEEDS-FIX: generic |
| `community/sparks/spark-form.tsx` | create/updateSparkAction | yes | specific | no | not-optimistic | yes | OK |
| `discover/create-spark-modal.tsx` | createSparkAction | yes | specific | no | not-optimistic | yes | OK |
| `discover/spark-entry-card.tsx` | setCreatorChoiceAction | no | no | no | not-optimistic | yes | NEEDS-FIX: no error handling on winner pick |
| `discover/spark-entry-comments-panel.tsx` | addSparkEntryComment/replyToSparkCommentAction | yes | generic / specific | partial | yes | yes | NEEDS-FIX: add comment generic |
| `discover/spark-submit-panel.tsx` | submitSparkEntryAction | yes | specific | no | not-optimistic | yes | OK |
| `discover/spark-vote-button.tsx` | voteSparkEntryAction | no | no | no | yes (silent) | yes | NEEDS-FIX: no feedback on vote fail |
| `pricing/plan-card.tsx` | createCheckoutSessionAction | yes | generic/caught | yes (try/catch) | not-optimistic | yes | OK |
| `u/[username]/follow-button.tsx` | toggleFollowAction | no | no (silent) | no | yes (silent) | yes | NEEDS-FIX: silent fail |
| `u/[username]/friend-status-section.tsx` | mute/unmute/blockUserAction | yes | generic | no | not-optimistic | n-a (transition only) | NEEDS-FIX: generic |

### Settings / Auth-Onboarding

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `settings/account/delete-account-section.tsx` | deleteOwnAccountAction | yes | specific (real) | state-set | not-optimistic | yes | OK |
| `settings/account/profile-form.tsx` | updateProfileAction | yes | specific (real) | no | not-optimistic | yes | OK |
| `settings/billing/manage-button.tsx` | createBillingPortalSessionAction | yes | generic (real) | state reset | not-optimistic | yes | OK |
| `settings/notifications/notification-preferences-form.tsx` | updateNotificationPreferenceAction | yes | generic | no | yes | yes | NEEDS-FIX: generic, ignores real reason |
| `settings/preferences/preferences-form.tsx` | updatePreferencesAction | yes | specific (real) | no | not-optimistic | yes | OK |
| `settings/privacy/privacy-form.tsx` | updatePrivacySettingAction | yes | generic | no | yes | yes | NEEDS-FIX: generic, ignores result.error |
| `(auth)/onboarding/onboarding-flow.tsx` | checkUsernameAvailable/completeOnboardingAction | yes | specific (real) | no | not-optimistic | yes | OK |

### Admin

| Component | Actions | success-check | toast | wrapped | rollback | pending-disable | Status + note |
|---|---|---|---|---|---|---|---|
| `(app)/redeem/redeem-form.tsx` | redeemPromoCodeAction | yes (result.ok) | specific (real) | no | not-optimistic | yes | OK |
| `admin/login/login-form.tsx` | adminLoginAction | yes (result.ok) | specific (real) | no | not-optimistic | yes | OK |
| `admin/wipe/wipe-form.tsx` | wipeDatabaseAction | yes (result.ok) | specific (real) | no | not-optimistic | yes | OK |
| `admin/content/delete-content-button.tsx` | deleteContentAction | no | no | no | not-optimistic | yes | NEEDS-FIX: no feedback on destructive |
| `admin/promo-codes/code-row.tsx` | setPromoActive/deletePromoCodeAction | no | no | no | not-optimistic | yes | NEEDS-FIX: no feedback |
| `admin/promo-codes/create-code-form.tsx` | createPromoCodeAction | yes (result.ok) | generic ("Failed.") | no | not-optimistic | yes | NEEDS-FIX: generic |
| `admin/users/user-row.tsx` | grantComp/revokeComp/setBanned/deleteUserAction | no | no | no | not-optimistic | yes | NEEDS-FIX: silent on destructive x4 |

---

## Cross-cutting recommendations

1. **Studio editor save batch (biggest win):** the `updateBinderItemAction` callers (character/notes/outline/wiki/metadata/all front-back-matter previews + binder mutation menus) share one defective shape — success checked, failure ignored. A shared `saveBinderItem` helper that toasts `result.error` and rolls back the optimistic local state on failure would fix ~18 components at once. Precedent for rollback exists in the editor read-set + like/bookmark buttons.
2. **Admin destructive actions:** wrap `deleteUserAction`/`setBannedAction`/`deleteContentAction`/`deletePromoCodeAction` etc. in `try/catch` + `toast.error(result.error)` + `router.refresh()`. These are irreversible and currently silent.
3. **Surface real reasons:** replace hardcoded generic strings with `result.error` in books comments, book-hero, settings privacy/notifications, friend-status-section, create-code-form.
4. **Wrap throwing actions:** several handlers (`delete-book-button`, hive delete/invite/goal-card/buzz delete, friend-button) call actions without try/catch — a thrown (non-`{success:false}`) error becomes an unhandled rejection. Add `.catch`/try-catch defensively, matching `plan-card.tsx`'s precedent.
5. **Pending-disable gaps:** `book-hero` like/bookmark and `invite-link-dialog` (clubs) leave buttons clickable / stuck during the request — wire `isPending`.
