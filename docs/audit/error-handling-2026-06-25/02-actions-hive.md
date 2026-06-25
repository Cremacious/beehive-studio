# Error-handling audit — hive action files (issue #46)

Audited against: actions should return `ActionResult<T>`, never let thrown sentinels (`AuthError` from `requireAuth()`, `PREMIUM_REQUIRED:<feature>` from `requirePremium()`, raw throws from `assert*` / `requireHive*` permission helpers) propagate raw to the client. `FREE_LIMIT_REACHED` is returned as a string (correct). Zod failures should return a clear error string.

### Summary

- **Total exported server actions audited:** 56
- **NEEDS-FIX:** 33
- **5 highest-risk gaps:**
  1. **`hive.actions.ts` — every `requireAuth()` + `assert*` outside `createHiveAction`/`updateHiveAction`/`getUserHivesView` runs bare.** `getHiveAction`, `deleteHiveAction`, `inviteMemberByUsernameAction`, `generateInviteLinkAction`, `joinHiveByLinkAction`, `acceptHiveInviteAction`, `declineHiveInviteAction`, `removeMemberAction`, `updateMemberRoleAction`, `leaveHiveAction`, `getDiscoverableHivesAction` (11 actions) all throw raw `AuthError` / assert-Error to the client. This is the single densest cluster of the bug.
  2. **`acceptHiveInviteAction` partial-write hazard (`hive.actions.ts`).** Membership + `member_count` increment + activity event commit in a tx, but the durable `recordHiveActivity` call runs AFTER the tx with no try/catch — and the whole action has no try/catch, so a post-commit failure throws raw while the membership already landed. Inconsistent state surfaced as an unhandled error.
  3. **Annotation/suggestion/buzz/discussion mention flow throws raw inside the tx (`throw new Error(mentionResult.error)`).** `createAnnotationAction`, `replyToAnnotationAction`, `createSuggestionAction`, `createBuzzPostAction`, `updateBuzzPostAction`, `createDiscussionPostAction`, `replyToDiscussionPostAction`, `editDiscussionPostAction` — these wrap the mutation in `db.transaction` but have NO outer try/catch, so a thrown mention error (or any tx failure) propagates raw instead of `{ success:false }`. The tx itself rolls back (good), but the client gets a raw throw.
  4. **`hive-content.actions.ts` — the H2 view + task actions run `requireAuth()` / `requireHiveMember()` / `assertHive*` bare.** 14 actions (`getHiveWikiView`, `getHiveWikiEntriesByCategory`, `getHiveOutlineView`, `getHiveOutlineByIdAction`, `getHiveNotesView`, `getBinderTreeForHiveAction`, `getHiveChapterListAction`, `getHiveChapterView`, `getTasksAction`, `createTaskAction`, `updateTaskAction`, `deleteTaskAction`, `createHiveOutlineAction`) throw raw permission errors. `requireHiveMember` throws on non-members, so every guest/non-member hit is an unhandled 500.
  5. **`approveSubmissionAction` is the highest-stakes mutation and has no outer try/catch (`hive-submissions.actions.ts`).** It does privileged multi-table writes (sibling-order shift + binderItem insert + chapter insert + submission update + activity event) in a tx; the tx rolls back on failure, but the thrown error reaches the client raw. Same shape in `submitSubmissionAction` / `rejectSubmissionAction`.

Pattern note: the files split into two camps. **Sentinel-handled camp** (annotations, buzz, discussions, submissions, suggestions, word-goals, word-logs, hub/rail/suggested) wraps `requireHiveMember` in local `try/catch → 'NOT_AUTHORIZED'` and uses `safeParse`, but most still leak the leading `requireAuth()` AuthError and any tx/post-tx throw. **Bare camp** (`hive.actions.ts` legacy actions, `hive-content.actions.ts`) has no protection at all.

---

## hive.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| createHiveAction | yes | yes (full body) | caught & translated to `e.message` | tx for hive+member+activity; standalone book insert is OUTSIDE tx → orphan-book risk if hive insert throws (documented) | safeParse, clear msg | OK — minor: orphan shadow-book on failure is invisible, acceptable. |
| getHiveAction | yes | no | `requireAuth` + `assertHiveMember` throw RAW | read-only | n/a | NEEDS-FIX — wrap; AuthError + assert propagate raw. |
| updateHiveAction | yes | yes (full body) | `.parse()` (not safeParse) + `requireHiveMod` throw INSIDE try → caught | tx, safe | uses `.parse()` → ZodError caught by try, but message is raw Zod stringified | NEEDS-FIX(minor) — works, but `.parse()` surfaces ugly ZodError text; prefer safeParse for clean string. |
| deleteHiveAction | yes | no | `requireAuth` + `assertHiveOwner` throw RAW | single delete | n/a | NEEDS-FIX — no try/catch. |
| inviteMemberByUsernameAction | yes | no | `requireAuth` + `assertHiveAdmin` throw RAW; FREE_LIMIT returned correctly | insert + notification (no tx, non-atomic) | n/a | NEEDS-FIX — wrap; invite+notify not atomic. |
| generateInviteLinkAction | yes | no | `requireAuth` + `assertHiveAdmin` throw RAW | single insert | n/a | NEEDS-FIX — no try/catch. |
| joinHiveByLinkAction | yes | no | `requireAuth` throws RAW; FREE_LIMIT returned correctly | tx (member+count+activity), safe rollback | n/a | NEEDS-FIX — AuthError + any tx throw propagate raw. |
| acceptHiveInviteAction | yes | no | `requireAuth` throws RAW | tx for invite/member/count/activity, THEN `recordHiveActivity` OUTSIDE tx with no guard → partial-write surfaced as raw throw | n/a | NEEDS-FIX (high) — see summary #2. |
| declineHiveInviteAction | yes | no | `requireAuth` throws RAW | single update | n/a | NEEDS-FIX — no try/catch. |
| removeMemberAction | yes | no | `requireAuth` + `assertHiveAdmin` throw RAW | tx (delete+count), safe | n/a | NEEDS-FIX — no try/catch. |
| updateMemberRoleAction | yes | no | `requireAuth` + `assertHiveOwner` throw RAW | single update | n/a | NEEDS-FIX — no try/catch. |
| leaveHiveAction | yes | no | `requireAuth` throws RAW; OWNER guard returned correctly | tx (delete+count), safe | n/a | NEEDS-FIX — AuthError propagates raw. |
| getDiscoverableHivesAction | yes | no | `requireAuth` throws RAW | read-only raw SQL | n/a | NEEDS-FIX — no try/catch; raw SQL failure also leaks. |
| getUserHivesView | yes | yes (full body) | caught & translated | read-only | n/a | OK. |

## hive-activity.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| getHiveActivityFeedAction | yes | yes (full body) | `requireAuth` caught by outer try | read-only | n/a | OK. |

## hive-annotations.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| createAnnotationAction | yes | no (local try only around requireHiveMember) | `requireAuth` RAW; `requireHiveMember` caught→NOT_AUTHORIZED | tx wraps insert+patch+notify; `throw new Error(mentionResult.error)` inside tx propagates raw (rolls back) | safeParse, clear msg | NEEDS-FIX — AuthError + mention/tx throw leak raw. See summary #3. |
| replyToAnnotationAction | yes | no (local try only) | same as above | tx; mention throw raw (rolls back) | safeParse | NEEDS-FIX — AuthError + tx throw leak raw. |
| resolveAnnotationAction (→setAnnotationResolved) | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | two sequential updates (annotation + chapter strip), no tx → minor partial-write | n/a | NEEDS-FIX — AuthError leaks; strip-update not atomic with resolve. |
| unresolveAnnotationAction (→setAnnotationResolved) | yes | no (local try only) | as above | single update | n/a | NEEDS-FIX — AuthError leaks. |
| getChapterAnnotationsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks (requireAuth before try). |
| getAnnotationsForHiveAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks. |
| getAnnotationParentsAction | yes | no | `requireAuth` RAW | read-only | n/a | NEEDS-FIX — no try/catch. |

## hive-buzz.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| createBuzzPostAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx; mention `throw` raw (rolls back) | safeParse, clear msg | NEEDS-FIX — AuthError + tx throw leak. |
| updateBuzzPostAction | yes | no (local try only) | as above | tx; mention `throw` raw | safeParse | NEEDS-FIX — AuthError + tx throw leak. |
| deleteBuzzPostAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | single delete | n/a | NEEDS-FIX — AuthError leaks. |
| listBuzzPostsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | safeParse | NEEDS-FIX — AuthError leaks. |
| toggleBuzzLikeAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx (like row + denorm count), safe; readback after tx | safeParse | NEEDS-FIX — AuthError + tx throw leak raw. |
| getBuzzHiveIdAction | yes | no | `requireAuth` RAW | read-only | n/a | NEEDS-FIX — no try/catch. |

## hive-content.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| getHiveWikiView | yes | no | `requireAuth` + `requireHiveMember` throw RAW | read-only | n/a | NEEDS-FIX — bare. |
| getHiveWikiEntriesByCategory | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getHiveOutlineView | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getHiveOutlineByIdAction | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getHiveNotesView | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getBinderTreeForHiveAction | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getHiveChapterListAction | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getHiveChapterView | yes | no | `requireAuth` + `requireHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| getTasksAction | yes | no | `requireAuth` + `assertHiveMember` RAW | read-only | n/a | NEEDS-FIX — bare. |
| createTaskAction | yes | no | `requireAuth` + `assertHiveMember` RAW | insert + notify (no tx, non-atomic) | safeParse | NEEDS-FIX — bare; insert+notify not atomic. |
| updateTaskAction | yes | no | `requireAuth` + `assertHiveMember` RAW | update + notify (no tx) | safeParse | NEEDS-FIX — bare. |
| deleteTaskAction | yes | no | `requireAuth` + `assertHiveAdmin` RAW | single delete | n/a | NEEDS-FIX — bare. |
| createHiveOutlineAction | yes | no | `requireAuth` + `requireHiveMember` RAW; canEditOutline returned | single insert | n/a | NEEDS-FIX — bare. |

## hive-discussions.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| createDiscussionPostAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx; mention `throw` raw (rolls back) | safeParse, clear msg | NEEDS-FIX — AuthError + tx throw leak. |
| replyToDiscussionPostAction | yes | no (local try only) | as above; depth guard returned | tx; mention `throw` raw | safeParse | NEEDS-FIX — AuthError + tx throw leak. |
| editDiscussionPostAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx; mention `throw` raw | safeParse | NEEDS-FIX — AuthError + tx throw leak. |
| deleteDiscussionPostAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | single delete (FK cascade) | n/a | NEEDS-FIX — AuthError leaks. |
| listDiscussionPostsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | safeParse | NEEDS-FIX — AuthError leaks. |
| getDiscussionThreadAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks. |
| getHiveDiscussionParentsAction | yes | no | `requireAuth` RAW | read-only | n/a | NEEDS-FIX — no try/catch. |
| getHiveReplyParentsAction | yes | no | `requireAuth` RAW | read-only | n/a | NEEDS-FIX — no try/catch. |

## hive-submissions.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| saveSubmissionDraftAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | single insert/update | safeParse, clear msg | NEEDS-FIX — AuthError leaks. |
| submitSubmissionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx (status + activity + notify fan-out), rollback-safe; any tx throw leaks raw | safeParse | NEEDS-FIX — AuthError + tx throw leak. |
| approveSubmissionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | privileged multi-table tx (order shift + binderItem + chapter + submission + activity), rollback-safe; throw leaks raw | safeParse | NEEDS-FIX (high) — see summary #5. |
| rejectSubmissionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx (status + activity), safe; throw leaks raw | safeParse | NEEDS-FIX — AuthError + tx throw leak. |
| getSubmissionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a (positional id) | NEEDS-FIX — AuthError leaks. |
| listHiveSubmissionsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks. |

## hive-suggestions.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| createSuggestionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx (insert+patch+notify); mention `throw` raw (rolls back) | safeParse, clear msg | NEEDS-FIX — AuthError + tx throw leak. |
| replyToSuggestionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | single insert | safeParse | NEEDS-FIX — AuthError leaks. |
| acceptSuggestionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx (chapter+book+suggestion+activity), rollback-safe; snapshot OUTSIDE tx unguarded → post-commit throw leaks raw | n/a (positional id) | NEEDS-FIX — AuthError + post-tx snapshot throw leak. |
| rejectSuggestionAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | tx (suggestion + strip + activity), safe; throw leaks raw | safeParse | NEEDS-FIX — AuthError + tx throw leak. |
| getChapterSuggestionsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks. |
| getPendingSuggestionsForHiveAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks. |
| getSuggestionParentsAction | yes | no | `requireAuth` RAW | read-only | n/a | NEEDS-FIX — no try/catch. |

## hive-word-goals.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| createWordGoalAction | yes | yes (around tx, catches 23505) | `requireAuth` RAW; `requireHiveMember` caught | tx (archive-then-insert), 23505 race → GOAL_ALREADY_ACTIVE; non-unique errors re-thrown raw | safeParse, clear msg | NEEDS-FIX(minor) — AuthError leaks (before try); non-23505 tx error re-thrown raw via `throw err`. |
| updateWordGoalAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | single update | safeParse | NEEDS-FIX — AuthError leaks. |
| archiveWordGoalAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught; empty-id returned | single update | manual id check | NEEDS-FIX — AuthError leaks. |
| listHiveWordGoalsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | lazy-archive update + select (no tx, acceptable) | manual id check | NEEDS-FIX — AuthError leaks. |
| getWordGoalProgressAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | manual id check | NEEDS-FIX — AuthError leaks. |
| getActiveWordGoalSummaryAction | yes | no (local try only, cached) | `requireAuth` RAW; `requireHiveMember` caught | read-only | manual id check | NEEDS-FIX — AuthError leaks. |

## hive-word-logs.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| getRecentWordLogsAction | yes | no (local try only) | `requireAuth` RAW; `requireHiveMember` caught | read-only | n/a | NEEDS-FIX — AuthError leaks (requireAuth before the local try); DB throw also leaks. |

## hives-hub.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| getCommunityHivesAction | yes | partial | `requireAuth` wrapped in try, `AuthError`→UNAUTHORIZED, other re-thrown; delegates to safe sub-actions | read-only (aggregator) | n/a | NEEDS-FIX(minor) — AuthError handled; but a non-AuthError from `requireAuth` is re-thrown raw, and the Promise.all sub-fetches aren't wrapped (a DB throw from getUserHivesView body is caught there, but suggested errors are tolerated). Mostly OK; tighten the re-throw. |

## hives-rail.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| getViewerHiveStatsAction | yes | yes (around queries) | `requireAuth` RAW (before try) | read-only | n/a | NEEDS-FIX(minor) — query errors caught→FETCH_FAILED, but `requireAuth` AuthError leaks (called before the try). |
| getTrendingHivesForRailAction | yes | yes (around compute) | no auth call (public) | read-only cached | n/a | OK — DB errors caught→FETCH_FAILED, no sentinel surface. |

## hives-suggested.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| getSuggestedHivesAction | yes | yes (around queries) | `requireAuth` RAW (before try) | read-only | n/a | NEEDS-FIX(minor) — query errors caught→FETCH_FAILED, but `requireAuth` AuthError leaks (called before the try). |

---

### Cross-cutting recommendation

The cleanest fix for the dominant pattern is to move `const userId = await requireAuth()` INSIDE the outer try/catch (or wrap the whole body), translating `AuthError` to a stable `'UNAUTHORIZED'` string — exactly what `getCommunityHivesAction` already does. For the "local try only" actions, the `requireHiveMember` guard is already correct; they just need (a) `requireAuth` inside a try and (b) an outer catch around the `db.transaction` / post-tx side-effects so mention throws and snapshot/activity throws return `{ success:false }` instead of propagating raw. `hive.actions.ts` legacy actions and all of `hive-content.actions.ts` need try/catch added from scratch.
