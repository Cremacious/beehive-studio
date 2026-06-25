# Error Handling Audit — Studio Actions (Issue #46)

Date: 2026-06-25 · Scope: 13 studio action files · READ-ONLY audit.

### Summary

- **Total exported actions audited:** 31 (across 13 files).
- **NEEDS-FIX:** 28 (nearly every action). Only `getChapterCommentsCountAction`, `deleteCloudinaryAssetAction`, and the `requireAuth().catch()` path in `checkUsernameAvailableAction` handle thrown sentinels gracefully.
- **Root cause:** ZERO studio actions wrap their body in try/catch. Every `requireAuth()`, `assertBookOwner()`, `assertChapterOwner()`, `assertBinderOwner()`, `requireBinderWritePermission()` / `requireBinderCreatePermission()` throws raw — these propagate to the client as a Next.js server error / unhandled rejection instead of `{ success:false, error }`. Zod and `FREE_LIMIT_REACHED` / `PREMIUM_REQUIRED:*` are handled correctly (returned), but the throwing guards short-circuit before those returns.

**5 highest-risk gaps** (thrown error reaches real user UI most often):

1. **`saveChapterAction` (chapter.actions.ts)** — fires on every autosave keystroke-batch. `assertChapterOwner` throws raw on any stale/expired session; an unguarded DB/tx error mid-save also propagates raw. Highest-frequency call in the app.
2. **`getBinderTreeAction` (binder.actions.ts)** — runs on every studio editor page load. `requireAuth` + `assertBookOwner` throw raw → editor page hard-errors instead of redirecting/graceful state when session lapses.
3. **`getChapterAction` (chapter.actions.ts)** — runs on every chapter open/switch. `assertChapterOwner` throws raw; the extra hive count queries can also throw unguarded.
4. **`createBookAction` (book.actions.ts)** — first action a new user hits from the wizard. Multi-insert transaction has no try/catch; a constraint/DB failure propagates raw to the "Create your book" submit.
5. **`updateBinderItemAction` / `reorderBinderItemsAction` (binder.actions.ts)** — fire on rename + drag-drop reorder. `requireBinderWritePermission` throws raw (NOT_AUTHORIZED for BETA_READER, hive lookups), surfacing as a server error on a routine UI gesture.

---

## book.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `createBookAction` | yes | no | propagates raw (requireAuth) | tx wraps all inserts — rollback safe; importedChapters atomic | yes (first issue msg) | NEEDS-FIX: requireAuth throws raw; tx body errors propagate raw. |
| `getUserBooksAction` | yes | no | propagates raw (requireAuth) | n/a (reads) | n/a | NEEDS-FIX: requireAuth throws raw on lapsed session at studio load. |
| `getStudioStatsAction` | yes | no | propagates raw (requireAuth) | n/a (parallel reads) | n/a | NEEDS-FIX: requireAuth throws raw. |
| `getBookAction` | yes | no | propagates raw (requireAuth) | n/a | n/a | NEEDS-FIX: requireAuth throws raw; not-found handled. |
| `updateBookAction` | yes | no | propagates raw (requireAuth, assertBookOwner) | no tx (single update + read) — fine | yes | NEEDS-FIX: assertBookOwner throws raw instead of `{success:false}`. |
| `publishBookAction` | yes | no | propagates raw (requireAuth, assertBookOwner) | tx wraps update + activity — safe | n/a | NEEDS-FIX: assertBookOwner throws raw. |
| `unpublishBookAction` | yes | no | propagates raw (requireAuth, assertBookOwner) | single update | n/a | NEEDS-FIX: assertBookOwner throws raw. |
| `deleteBookAction` | yes | partial (Cloudinary only) | propagates raw (requireAuth, assertBookOwner) | single delete; Cloudinary cleanup guarded non-fatal | n/a | NEEDS-FIX: assert/auth throw raw; cleanup correctly isolated. |
| `getBookDetailsAction` | yes | no | propagates raw (requireAuth, assertBookOwner) | n/a | n/a | NEEDS-FIX: assertBookOwner throws raw. |
| `updateBookDetailsAction` | yes | partial (Cloudinary only) | propagates raw (requireAuth, assertBookOwner) | tx wraps books + metadata upsert — safe; cleanup non-fatal | yes | NEEDS-FIX: assertBookOwner throws raw before tx. |

## binder.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `getBinderTreeAction` | yes | no | propagates raw (requireAuth, assertBookOwner) | n/a | n/a | NEEDS-FIX: throws raw on every editor load when session lapses. |
| `createBinderItemAction` | yes | no | propagates raw (requireAuth, requireBinderCreatePermission) | tx wraps binderItem + chapter insert — safe | yes | NEEDS-FIX: permission helper throws raw; FREE_LIMIT returned OK. |
| `updateBinderItemAction` | yes | no | propagates raw (requireAuth, getBinderItemBook, requireBinderWritePermission) | single update | yes | NEEDS-FIX: write-permission + missing-item throw raw on rename. |
| `deleteBinderItemAction` | yes | no | propagates raw (requireAuth, requireBinderWritePermission) | NO tx — child + chapter + item deletes are sequential, **partial-write risk if mid-loop failure leaves orphans** | n/a | NEEDS-FIX: no try/catch AND multi-delete not wrapped in tx. |
| `reorderBinderItemsAction` | yes | no | propagates raw (requireAuth, requireBinderWritePermission) | Promise.all of updates, NO tx — partial reorder possible on failure | yes | NEEDS-FIX: throws raw on drag-drop; non-atomic batch. |

## chapter.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `getChapterAction` | yes | no | propagates raw (requireAuth, assertChapterOwner) | n/a (reads) | n/a | NEEDS-FIX: throws raw on every chapter open. |
| `saveChapterAction` | yes | no | propagates raw (requireAuth, assertChapterOwner) | tx wraps chapter+book update; snapshot + hive-log outside tx (intentional, hive-log self-swallows) | content shape checked | NEEDS-FIX: highest-freq action, autosave; assert + tx errors raw. |
| `updateChapterStatusAction` | yes | no | propagates raw (requireAuth, assertChapterOwner) | tx wraps status + activity + notification fan-out — safe | yes | NEEDS-FIX: assert throws raw; notification fan-out errors propagate raw. |
| `updateChapterNotesAction` | yes | no | propagates raw (requireAuth, assertChapterOwner) | single update | yes | NEEDS-FIX: assertChapterOwner throws raw. |
| `updateChapterWordGoalAction` | yes | no | propagates raw (requireAuth, assertChapterOwner) | single update | yes | NEEDS-FIX: assertChapterOwner throws raw. |

## chapter-comments.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `getChapterCommentsAction` | yes | no | uses getOptionalUserId (no throw on no-auth); FORBIDDEN/NOT_FOUND returned | n/a | n/a | NEEDS-FIX (minor): auth-safe via getOptionalUserId, but raw DB errors still propagate; no body try/catch. |
| `addChapterCommentAction` | yes | partial (tx only, for MENTION_CAP) | requireAuth throws raw; tx re-throws non-cap errors raw | tx wraps comment + notifications — safe; MENTION_CAP caught & translated | yes (INVALID_CONTENT) | NEEDS-FIX: requireAuth raw; tx re-throws unexpected errors raw past the catch. |
| `getChapterCommentsCountAction` | no (returns raw `number`) | no | n/a (no auth call) | n/a | n/a | NEEDS-FIX (convention): returns bare number, not ActionResult; unguarded DB error propagates raw. |

## snapshot.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `getChapterSnapshotsAction` | yes | no | propagates raw (requireAuth, assertChapterOwner); PREMIUM_REQUIRED returned | n/a | n/a | NEEDS-FIX: requireAuth + assertChapterOwner throw raw; premium check OK. |
| `getSnapshotContentAction` | yes | no | propagates raw (requireAuth); ownership returned as `{success:false}` | n/a | n/a | NEEDS-FIX: requireAuth throws raw; rest handled inline. |
| `restoreSnapshotAction` | yes | no | propagates raw (requireAuth); ownership returned inline | tx wraps undo-snapshot + restore — safe | n/a | NEEDS-FIX: requireAuth throws raw; tx error propagates raw. |

## publishing.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `getPublishingMetadataAction` | yes | no | propagates raw (requireAuth, assertBookOwner) | n/a | n/a | NEEDS-FIX: assert/auth throw raw; defaults handled. |
| `updatePublishingMetadataAction` | yes | no | propagates raw (requireAuth, assertBookOwner); PREMIUM_REQUIRED returned | single upsert | yes | NEEDS-FIX: assertBookOwner throws raw after premium gate. |
| `getExportPresetsAction` | yes | no | propagates raw (requireAuth) | n/a | n/a | NEEDS-FIX: bare `await requireAuth()` throws raw. |

## reading.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `markChapterReadAction` | yes | no | propagates raw (requireAuth); FORBIDDEN returned via canReadBook | two sequential upserts, NO tx — read-set + cursor could diverge on mid-failure (low impact, idempotent) | n/a | NEEDS-FIX: requireAuth throws raw. |
| `unmarkChapterReadAction` | yes | no | propagates raw (requireAuth); FORBIDDEN returned | single delete | n/a | NEEDS-FIX: requireAuth throws raw. |
| `getReadingProgressAction` | yes | no | propagates raw (requireAuth); FORBIDDEN returned | n/a | n/a | NEEDS-FIX: requireAuth throws raw. |

## library.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `getBookmarkedBooksAction` | yes | no | propagates raw (requireAuth) | n/a (batched reads) | n/a | NEEDS-FIX: requireAuth throws raw; per-row canReadBook is awaited unguarded (a throw aborts the whole Promise.all raw). |
| `getBookmarksEmptySuggestionsAction` | yes | no | propagates raw (requireAuth) | n/a | n/a | NEEDS-FIX: requireAuth throws raw. |

## account.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `deleteOwnAccountAction` | no (custom `{success,error?}`) | partial (Stripe + Cloudinary guarded) | propagates raw (requireAuth); side-effects non-fatal | single cascade delete; Stripe/Cloudinary best-effort | n/a | NEEDS-FIX: requireAuth + final `db.delete` throw raw; `error?` field never populated. |

## settings.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `updateProfileAction` | custom `{success,error?}` | no | propagates raw (requireAuth) | single update | yes | NEEDS-FIX: requireAuth throws raw; username-taken returned OK. |
| `updatePrivacySettingAction` | custom | no | propagates raw (requireAuth) | single upsert | NO Zod on `value`/`key` | NEEDS-FIX: no validation, requireAuth throws raw. |
| `getPrivacySettingsAction` | custom (data) | no | propagates raw (requireAuth) | n/a | n/a | NEEDS-FIX: requireAuth throws raw. |
| `updatePreferencesAction` | custom | no | propagates raw (requireAuth) | single upsert | yes (+ genre check) | NEEDS-FIX: requireAuth throws raw. |
| `getPreferencesAction` | custom (data) | no | propagates raw (requireAuth) | n/a | n/a | NEEDS-FIX: requireAuth throws raw. |

## onboarding.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `checkUsernameAvailableAction` | custom `{available,error?}` | partial (`requireAuth().catch(()=>null)`) | AuthError caught gracefully | n/a | yes | OK: auth handled via .catch; raw DB error on findFirst still possible but low risk. |
| `completeOnboardingAction` | custom `{success,error?}` | no | propagates raw (requireAuth) | insert+upsert + separate users.update, NO tx — partial-write if image update fails after profile insert | yes (+ mention cap) | NEEDS-FIX: requireAuth throws raw; 2-step write not atomic. |

## avatar.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `updateAvatarAction` | custom `{success,error?}` | partial (Cloudinary only) | propagates raw (requireAuth) | upsert + users.update, NO tx — minor divergence risk | none (URL not validated) | NEEDS-FIX: requireAuth throws raw; no URL validation. |
| `deleteAvatarAction` | custom | partial (Cloudinary only) | propagates raw (requireAuth) | upsert + users.update, NO tx | n/a | NEEDS-FIX: requireAuth throws raw. |

## cloudinary-cleanup.actions.ts

| Action | Returns ActionResult | try/catch | Sentinel handling | Tx/partial-write | Zod | Status+note |
|---|---|---|---|---|---|---|
| `deleteCloudinaryAssetAction` | custom `{success}` | yes (auth + delete both wrapped) | AuthError caught → `{success:false}`; folder-whitelisted | n/a | n/a | OK: fully guarded; auth + delete in try/catch, folder allow-list enforced. |
