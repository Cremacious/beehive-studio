# C5a — @-Mentions Design

> First of three C5 sub-projects closing the Community phase (C5a mentions → C5b notification prefs + cleanup + friend-feed prioritization → C5d Claude Design pass deferred).
>
> Lands cross-cutting @-mentions across every social text surface — autocomplete-driven entry, block-aware resolution, dedupe-and-cap notifications, render-time clickable links.
>
> Inherits all Community phase commitments from [2026-06-04-community-phase-overview.md](2026-06-04-community-phase-overview.md): Friends+Follows graph, `areFriends`+`isBlocked` canonical privacy helpers, global cascading blocks, `/community`-is-hub-not-index posture, deferred visual design pass.

## 1. Scope + Surfaces

Mentions work in six social text categories spanning twelve surfaces:

1. **Spark** — entry comments + entry comment replies (textareas)
2. **Reading List** — list description (textarea) + per-book commentary (textarea)
3. **Book Club** — club description (textarea) + rules (textarea) + discussion posts (TipTap) + discussion replies (TipTap)
4. **Hive** — discussion posts (TipTap) + discussion replies (TipTap) + buzz posts (TipTap) + annotation body (TipTap) + suggestion rationale (TipTap)
5. **Book** — public-reader comments (textarea)
6. **Profile** — bio (textarea, link-render only — no notifications fire)

**Out of scope (explicit, do not regress):** chapter prose, wiki entries, character sheets, outline beat titles, research notes, hive submissions composer body. The "creative writing surface vs. social surface" split is load-bearing — @-mentions belong in conversations, not prose.

## 2. Data Model

### 2.1 Schema migration

Single additive change via `scripts/migrate-c5a.ts` (idempotent runner mirroring `migrate-c4.ts`):

```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MENTION';
```

No new tables. No new pgEnums. No `social_activity_type` extensions (mentions are notifications-only, never feed events). No new indexes (the `notifications(user_id, created_at DESC)` index from C1 covers the bell-list path; mention de-dupe queries hit the existing primary key path through `(type, actor_id, resource_type, resource_id)` — small surface, no read amplification expected at MVP scale).

Drizzle schema (`db/schema/social.ts`): append `'MENTION'` to the `notificationTypeEnum` array literal so tsc consumers stay in sync.

### 2.2 Storage shape per surface

**TipTap surfaces (8 across categories 3, 4):** a new `MentionMark` extension stores `{ userId: string }` on inline spans inside the existing `content jsonb` columns of `book_club_discussions`, `book_club_discussion_replies`, `hive_discussion_posts`, `hive_buzz_posts`, `hive_annotations.body`, `hive_suggestions.rationale`. No schema changes — the marks ride along in jsonb.

**Textarea surfaces (7 across categories 1, 2, 4 description/rules, 5, 6):** raw `@username` text in the existing string columns. No extraction, no side-table.

**Display username at render time = the snapshot stored alongside the mark / in the textarea text.** Both surfaces accept rename-staleness: a renamed user's mentions in old posts continue to display the OLD username as plain text + stale link. The stored userId attr on TipTap marks (and the resolver's username-to-userId lookup at write time on textareas) makes BELL NOTIFICATIONS rename-safe — the right user always gets pinged at write time — but visual rendering stays cheap and synchronous by skipping render-time userProfiles lookups.

Rationale: making rendering rename-safe requires a batched IN-list query before serialization in both `tiptap-to-html.ts` (currently synchronous) AND every React surface that renders mentions inline. The cost-to-benefit doesn't justify v1 work — renames are rare; the bell notification is the load-bearing semantic; visual staleness is a known acceptable trade-off documented in the smoke checklist (scenarios 12 + 13).

### 2.3 Notification row shape

Reuses the existing `notifications` table from C1. Mention rows take canonical fields:

```
userId: <mentionedUserId>        -- recipient
type: 'MENTION'
actorId: <authorUserId>          -- the writer
resourceType: <surface key>      -- see §3.4 below
resourceId: <surface id>         -- the postId / commentId / etc
```

No payload column. The bell-list copy template reads `actor.username` (from the actor join) + a per-`resourceType` label. Click-handler builds the deep link from `resourceType` + `resourceId`.

## 3. Server Layer

### 3.1 New helper module `lib/mentions/`

**`extract-mentions.ts`** — pure helpers (synchronous, no DB).

```ts
export function extractMentionUserIdsFromTiptap(doc: unknown): string[]
// Walks ProseMirror JSON; collects unique userId attrs from every node.marks[].type === 'mention'
// Sibling pattern to lib/tiptap-extensions/mark-scanning.ts's findMarkRanges.

export function extractMentionUsernamesFromText(text: string): string[]
// Regex /@([a-z0-9_]{3,20})/gi -> array of unique lowercase usernames (matches the userProfiles.username constraint).
// Case-insensitive match; downstream resolver normalizes via lower(username) lookup.
```

**`resolve-mentions.ts`** — single async resolver.

```ts
type ResolvedMention = { userId: string; username: string }
type ResolveError = 'MENTION_CAP_EXCEEDED'

export async function resolveMentionedUsers(opts: {
  tiptapUserIds: string[]
  textUsernames: string[]
  actorId: string
  resourceType: SurfaceType
  resourceId: string
}): Promise<
  | { ok: true; users: ResolvedMention[]; alreadyNotified: Set<string> }
  | { ok: false; error: ResolveError }
>
```

Pipeline:
1. Merge inputs → IN-list query on `userProfiles WHERE id IN (...) OR lower(username) IN (...)`.
2. **Block filter**: for each candidate, call `isBlocked(actorId, candidateId)` — drop if blocked in either direction (mirrors C1 `searchUsersAction` bidirectional filter).
3. **Self-mention filter**: drop candidates where `candidateId === actorId`.
4. **Cap check**: if the DISTINCT pre-filter input list exceeds 5 → return `MENTION_CAP_EXCEEDED`. Zod-level check at action layer also guards against the same; helper enforces defensively.
5. **Dedupe query** (for edit-fire diff): SELECT `userId` FROM `notifications` WHERE `type='MENTION' AND actorId=... AND resourceType=... AND resourceId=... AND createdAt > now() - interval '24 hours'`. Return as `alreadyNotified: Set<string>`.
6. Return `{ ok: true, users, alreadyNotified }`.

The caller decides whether to write notifications for `users \ alreadyNotified`.

**`record-mention-notifications.ts`** — batch writer mirroring C4's multi-row notification fan-out:

```ts
export async function recordMentionNotificationsTx(
  tx: DrizzleTx,
  opts: { actorId: string; mentionedUserIds: string[]; resourceType: SurfaceType; resourceId: string }
): Promise<void>
```

Single `tx.insert(notifications).values(mentionedUserIds.map(...))` batch. Caller is responsible for already-filtered diff (helper does not query — callers pass the post-diff list).

**`surface-types.ts`** — single union covering all 12 surfaces:

```ts
export type SurfaceType =
  | 'spark_entry_comment'
  | 'spark_entry_comment_reply'
  | 'reading_list_description'        // resourceId = listId
  | 'reading_list_book_commentary'    // resourceId = listBookId
  | 'book_club_description'           // resourceId = clubId
  | 'book_club_rules'                 // resourceId = clubId
  | 'book_club_discussion'
  | 'book_club_discussion_reply'
  | 'hive_discussion'
  | 'hive_discussion_reply'
  | 'hive_buzz_post'
  | 'hive_annotation'
  | 'hive_suggestion'
  | 'book_comment'
  | 'profile_bio'                     // resourceId = userId; no notification write
```

### 3.2 New TipTap mark

`lib/tiptap-extensions/mention-mark.ts` — sibling to `HiveAnnotationMark`/`HiveSuggestionMark`.

- Attrs: `{ userId: string, username: string }`. Both stored — `userId` is the rename-safe link target for notifications; `username` is the displayed snapshot for cheap synchronous rendering.
- `inclusive: false`, `excludes: ''`.
- parseHTML on `span[data-mention-user-id]` reads both `data-mention-user-id` and inner text (or `data-mention-username`).
- renderHTML emits `<span class="mention" data-mention-user-id="X" data-mention-username="Y">@Y</span>`. Snapshot username Y is the username at the moment the popover-pick wrote the mark; rename-staleness is the documented v1 trade-off (rare event, cheap rendering).
- Module augmentation on `@tiptap/core` for `setMention({ userId })` + `unsetMention()` commands.
- 4 unit tests via `@tiptap/html` round-trip (single mention, multi-mention coalesce, sibling-marks-preserved, parse-from-HTML).

### 3.3 New client hooks + components

**`lib/hooks/use-mention-popover.ts`** — TipTap hook mirroring C4 `useSelectionPopover`:

```ts
export function useMentionPopover(editor: Editor | null): {
  isActive: boolean
  query: string
  anchorRect: DOMRect | null
  close: () => void
  insertMention: (userId: string, username: string) => void
}
```

Listens to `editor.on('update' | 'selectionUpdate' | 'blur')`. Detects `@` keystroke + open query state via a small reducer: on `@` insertion at a word boundary, opens the popover and tracks subsequent characters as the query until whitespace/Esc/Enter/click-away.

**`components/mentions/mention-popover.tsx`** — floating dropdown component. Props `{ query, anchorRect, isActive, onPick(user), onClose }`. Debounced 300ms calls C1's `searchUsersAction({ query, limit: 6 })`. Arrow-key navigation + Enter pick + Esc dismiss. Renders avatar + @username + display name per result. **`onMouseDown={e => e.preventDefault()}` on the toolbar** to preserve editor focus + selection (C4 SelectionPopover load-bearing pattern).

**`components/mentions/mention-link.tsx`** — render-time mention link. Props `{ username: string; userId?: string }`. Pure synchronous client/server component (no DB lookup at render — `username` is the snapshot from TipTap mark or raw textarea text):
- Renders `<Link href="/u/{username}" className="...">@{username}</Link>` with Q9 styling (`text-[var(--canvas-dark-ink-strong)] font-medium underline decoration-1 underline-offset-2 hover:text-[var(--brand)]`).
- The optional `userId` prop is decorative (data-attr for future debugging / rename-safe migration); rendering doesn't consume it.
- Profile-not-found at /u/{username} is handled by the existing profile route (404). No `<MentionLink>`-side fallback needed.

**Rename behavior**: link target uses the snapshot username, so a rename breaks the link (404 at /u/{old-name}). Future cleanup work can swap this to a `userId`-keyed lookup or add an alias-redirect layer (deferred to C5b cleanup).

**`components/mentions/mentionable-textarea.tsx`** — drop-in replacement for plain `<textarea>`. Props match a `<textarea>` (`value` + `onChange` + standard attrs) plus an internal `<MentionPopover>` that opens on `@` keystroke and inserts the picked `@username` text at caret on selection.

### 3.4 Action-layer wiring pattern

Every CREATE + UPDATE action for an in-scope surface wires the same 5-step pattern:

```ts
// 1. Extract from incoming payload
const tiptapUserIds = extractMentionUserIdsFromTiptap(input.content)  // for TipTap surfaces
const textUsernames = extractMentionUsernamesFromText(input.body)     // for textarea surfaces

// 2. Resolve + filter + dedupe
const resolveResult = await resolveMentionedUsers({
  tiptapUserIds, textUsernames, actorId: userId,
  resourceType: 'book_club_discussion', resourceId: discussionId,
})
if (!resolveResult.ok) return { success: false, error: resolveResult.error }

// 3. Existing insert/update logic runs inside tx
await db.transaction(async (tx) => {
  // ... existing source-row insert/update ...

  // 4. Diff against already-notified
  const toNotify = resolveResult.users
    .filter((u) => !resolveResult.alreadyNotified.has(u.userId))
    .map((u) => u.userId)

  // 5. Fire notifications (skip for profile_bio)
  if (toNotify.length > 0 && resourceType !== 'profile_bio') {
    await recordMentionNotificationsTx(tx, {
      actorId: userId, mentionedUserIds: toNotify, resourceType, resourceId,
    })
  }
})
```

**Edit-fire correctness**: the `alreadyNotified` Set is computed BEFORE the action's UPDATE writes; new mentions added by the edit get notified; removed mentions stay un-notified (no un-notification). Q4's 24h dedupe still applies — re-adding a removed mention within 24h is silent.

**Affected actions (16):**
- `submitSparkEntryCommentAction` + `replyToSparkEntryCommentAction` + `updateSparkEntryCommentAction` (3)
- `createReadingListAction` + `updateReadingListAction` (description) + `updateListBookAction` (commentary) (3)
- `createClubAction` + `updateClubAction` (description/rules) + `createClubDiscussionAction` + `updateClubDiscussionAction` + `replyToClubDiscussionAction` + `updateClubDiscussionReplyAction` (6 — verify `updateClubDiscussionReplyAction` exists; if not, defer)
- `createHiveDiscussionAction` + `updateHiveDiscussionAction` + `replyToHiveDiscussionAction` + `createBuzzPostAction` + `updateBuzzPostAction` + `createHiveAnnotationAction` + `updateHiveAnnotationAction` + `createHiveSuggestionAction` (8)
- `addBookCommentAction` (1) — verify edit exists; book comments may not be editable
- `updateUserProfileAction` (bio) (1)

Action-name verification happens at plan-writing time; this list is illustrative.

## 4. UI Surfaces

### 4.1 TipTap surfaces (5)

Register `MentionMark` in each editor's extension array + mount `<MentionPopover>` inside the editor wrapper, listening to the `useMentionPopover` hook keyed to that editor instance:

- `<DiscussionComposer>` body (C4 club discussions) — `app/[locale]/(app)/clubs/_components/discussion-composer.tsx`
- `<ReplyComposer>` body (C4 club replies) — `app/[locale]/(app)/clubs/_components/reply-composer.tsx`
- Hive discussion composer — `app/[locale]/(app)/hive/[hiveId]/discussions/_components/` (verify path)
- Hive buzz composer — `app/[locale]/(app)/hive/[hiveId]/buzz/_components/`
- Hive annotation + suggestion bodies — `components/hive/collab/` (annotate-modal + suggest-modal)

### 4.2 Textarea surfaces (7)

Swap `<textarea>` for `<MentionableTextarea>` at each site:

- Spark entry comment composer + reply composer
- Reading list create modal description input + edit dialog
- Reading list book commentary (in `<EditBookRowDialog>`)
- Club create modal description + rules inputs + edit metadata dialog
- Book comment composer (public reader page)
- Profile bio editor (`/settings` profile section)

### 4.3 Render path

Every render of a mentions-containing surface uses `<MentionLink>`:

- TipTap render — extend `lib/export/tiptap-to-html.ts`'s mark switch with `mention` → call a `renderMentionLink({ userId, snapshotUsername })` template returning the styled link string. Public reader's `.public-reader` wrapper does NOT need a reset (mentions are legitimate prose links, not collab marks).
- Textarea render — a shared `<RenderMentionsInText text="..." />` server component splits the text on the `@username` regex, IN-list queries userProfiles by username, and renders alternating string + `<MentionLink>` fragments.

### 4.4 Notification bell

`notifications-bell.tsx` LABELS map + click router gain `MENTION` entries:

- Bell copy: `"@{actor.username} mentioned you in {surfaceLabel}"` where `surfaceLabel` switches on `resourceType` (e.g. `"a discussion"`, `"a buzz post"`, `"a book comment"`).
- Click router: per `resourceType`, route to the surface's canonical URL:
  - `book_club_discussion` / `book_club_discussion_reply` → `/clubs/{clubId}/discussions/{discussionId}` (lookup clubId from resourceId via a small server action OR include in notification payload — see "open items" below)
  - `hive_discussion` / `hive_discussion_reply` → `/hive/{hiveId}/discussions/{discussionId}` (same lookup question)
  - `hive_buzz_post` → `/hive/{hiveId}/buzz`
  - `hive_annotation` / `hive_suggestion` → `/hive/{hiveId}/chapters/{chapterId}` (lookup)
  - `book_comment` → `/books/{bookId}?tab=comments`
  - `spark_entry_comment` / `_reply` → `/sparks/{sparkId}/entry/{entryId}`
  - `reading_list_*` → `/reading-lists/{listId}`
  - `book_club_description` / `_rules` → `/clubs/{clubId}` (no specific tab)
  - `profile_bio` — never written, never routed

**Open item — parent-id resolution**: for nested resources like discussions (need clubId to build the URL) or hive surfaces (need hiveId), the bell click handler needs a way to resolve the parent. Two options resolved at plan-writing time:
1. Lookup actions per surface type (e.g. `getDiscussionClubIdAction(discussionId)`).
2. Extend `notifications` schema with a small `parent_resource_id` text column (additive, nullable).

Option 1 is simpler (no schema change, no migration); Option 2 is faster (no round-trip on click). Default to Option 1 for the spec; plan can revisit if smoke shows bell-click latency is bad.

## 5. Implementation Phasing

Indicative task decomposition (final count + ordering comes out of writing-plans):

- **T1** — schema migration + idempotent runner adding `MENTION` to `notificationTypeEnum`. Drizzle schema sync.
- **T2** — `lib/mentions/` helpers + ~15 unit tests (extract Tiptap × 4, extract text × 4, resolve happy/block/self/dedupe/cap × 5, recordTx × 2).
- **T3** — `MentionMark` TipTap extension + 4 unit tests + global `.mention` CSS (minimal — most styling lives on `<MentionLink>`).
- **T4** — `useMentionPopover` hook + `<MentionPopover>` shared component (no tests; smoke covers).
- **T5** — `<MentionLink>` + `<MentionableTextarea>` + `<RenderMentionsInText>` shared components.
- **T6** — wire C2 sparks action layer (3 actions).
- **T7** — wire C3 reading lists action layer (3 actions).
- **T8** — wire C4 book clubs action layer (~6 actions).
- **T9** — wire hive action layer (~8 actions).
- **T10** — wire book comments + profile bio (~2 actions); bio path explicitly skips `recordMentionNotificationsTx`.
- **T11** — UI: TipTap surface wiring (5 surfaces).
- **T12** — UI: textarea surface wiring (7 surfaces).
- **T13** — notification bell copy + click router for `MENTION`; per-surface deep-link template; parent-id resolver actions per Option 1 above.
- **T14** — tiptap-to-html render extension + RenderMentionsInText hookup at every consumer site.
- **T15** — 18-scenario manual smoke + AGENTS.md ship summary + ship.

Suggested waves: W1=T1; W2=T2; W3=T3+T4+T5 parallel (3 isolated component files); W4=T6+T7+T8+T9+T10 parallel (5 separate action files — minor race risk on shared imports but low); W5=T11+T12+T13+T14 parallel (4 isolated surface scopes); W6=T15.

## 6. Manual Smoke Checklist (for T15)

18-scenario checklist baked into the spec; T15 owns:

1. **TipTap discussion mention happy path** — open club discussion composer, type `@`, popover opens, type partial username, pick → mark inserted, `@username` styled in body, submit → mentioned user gets notification + click-through to discussion thread.
2. **Reply mention** — same in club reply composer; mentioned user gets notification with copy `"@actor mentioned you in a discussion reply"`.
3. **Textarea mention happy path** — spark entry comment composer, type `@user`, popover opens at caret, pick → text becomes `@user` literal, submit → mentioned user gets notification.
4. **Profile bio mention** — edit own profile bio to "Thanks to @alice for the cover art" → save → @alice's profile shows the bio rendered with @alice as a clickable link, NO notification fires.
5. **Block-aware autocomplete** — A blocks B; A opens composer, types `@B-username` → popover does NOT show B as a result.
6. **Block-aware raw text mention** — A pastes `@B-username` literal as plain text, submits → B does NOT get a notification, text renders as inert `@B-username` (no link).
7. **Self-mention** — A types `@A-self` in any composer → popover suggests self; pick → mark/text inserted (renders as link to /u/me); NO notification fires.
8. **Per-post cap** — try to submit a post with 6 distinct mentions → action returns `MENTION_CAP_EXCEEDED` + sonner error toast.
9. **24h dedupe (same surface)** — A mentions @B in discussion → B gets one notification → A edits to add same @B again → no second notification within 24h.
10. **Edit-add-mention** — A posts discussion mentioning @B; 1 minute later A edits to ADD @C → @C gets a fresh notification.
11. **Edit-remove-mention** — A posts with @B + @C; edits to remove @C → @C does NOT get an un-notification; B and C's prior notifications stay in bell.
12. **Rename staleness (TipTap)** — B is mentioned in an old TipTap post; B renames B→robert → old post still displays "@B" as the snapshot AND links to `/u/B` (broken — 404). Documented v1 trade-off. NEW mentions of robert work fine.
13. **Rename staleness (textarea)** — same scenario but in a textarea (book comment) → old text still says "@B" verbatim; clicking → either no link (inert) OR broken link to `/u/B`. New posts work fine.
14. **Bell click-through** — bell shows `"@A mentioned you in a discussion"` → click navigates to `/clubs/{clubId}/discussions/{discussionId}` correctly.
15. **Cross-surface deep links** — verify each of the 8 surface types in §4.4 routes correctly from bell.
16. **Deleted user** — mentioned user deletes account → render shows inert `@former-username` (snapshot for TipTap, original text for textarea); no broken link.
17. **Popover behavior** — type `@`, arrow keys navigate, Enter picks, Esc closes; clicking outside closes; typing whitespace ends the query.
18. **No regressions** — discussions/replies/buzz posts WITHOUT mentions submit cleanly; no extra notifications; tsc clean; all existing tests green.

## 7. Out of Scope (deferred)

- **`MENTION` notification opt-out** — handled by C5b's `/settings/notifications` page.
- **Per-surface deep-link FRAGMENTS** (`#comment-{id}` scroll-to-anchor) — works without; nice-to-have polish.
- **Mass-mention attack mitigation beyond per-post cap of 5** — global rate-limiter per actor (e.g. 50 mentions/day) deferred until evidence of abuse.
- **Mention inbox UI** at `/notifications/mentions` — bell-only per Q10.
- **Mention rendering in `/community` feed event copy** — feed shows surface metadata (e.g. discussion title), not mention-resolved body text; mentions inside the underlying content render correctly when the user clicks through to the surface.
- **Backfill of pre-C5a posts** — old textareas get retro-rendering automatically via the `<RenderMentionsInText>` parser (no migration needed); old TipTap posts have no `mentionMark` so they don't get retro-mentions, but their plain `@username` text in a paragraph stays plain. Accepted.
- **Rename-safe rendering** — v1 renders snapshot usernames; rename breaks visual + link target. Future cleanup work can add async render-time lookup OR a `/u/[id]` alias redirect; userId attr is preserved on every TipTap mark to make that migration straightforward. Likely belongs in C5b cleanup or a later polish phase.
- **Mentions in chapter prose / wiki / character / outline** — locked out by Q1 scope.
- **C5b notification preferences, C5b cleanup follow-ups, C5b friend-feed prioritization** — separate sub-project.
- **C5d Claude Design pass** — separate sub-project, deferred after C5b ships.

## 8. Cross-cutting commitments preserved

- `isBlocked` is the only canonical block helper (no parallel implementations).
- `searchUsersAction` from C1 is the only canonical user-search action (popover consumes verbatim).
- `notifications` table shape unchanged — no `payload` column added (C1 lesson).
- `recordSocialActivityTx` NOT called for mentions (mentions are not feed events).
- TipTap mark pattern matches C4 precedent (`MentionMark` sibling to `HiveAnnotationMark`/`HiveSuggestionMark`).
- `'use server'` modules only export async functions — pure helpers go in `lib/mentions/` non-`'use server'` modules.
