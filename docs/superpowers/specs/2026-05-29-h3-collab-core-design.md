# H3 — Collaboration Core: Annotations · Suggestions · Submissions · Discussions

**Status:** Draft
**Date:** 2026-05-29
**Sub-project:** H3 of 5 (Hives redesign)
**Predecessors:** H1 (foundation), H2 (mirror model)
**Successors:** H4 (motivation), H5 (dashboard)

---

## Context

H1 + H2 give us a place to put a hive (with the right cardinality, roles, visibility, and entry points) and a shared place to organize worldbuilding (wiki/outline/notes mirrored with the editor binder). H3 is where the actual collaboration happens — where contributors and beta readers act on the prose itself.

Four features come online together because they share infrastructure (TipTap mark extensions, the gutter UI, the permission model):

1. **Annotations** — inline comments on chapter prose, layered (Grammar/Plot/Tone/Continuity/General), threaded.
2. **Edit Suggestions** — range-targeted text replacement proposals, with side-by-side diff and surgical accept.
3. **Submit Chapter** — contributors draft new chapters in a hive-side editor; on approval, they become real chapters in the book with submitter attribution.
4. **Discussions** — topic-tagged threaded forum for everything that isn't anchored to a specific chapter range.

The activity event types these features write to H1's `hive_activity` table land here too, so the /community feed introduced in H1 starts showing real content.

## Goals

- All chapter feedback (annotations + suggestions) anchors to text via TipTap marks so positions survive author edits naturally.
- Annotations are categorized into 5 fixed layers and filterable from the gutter.
- Annotations and suggestions both support threaded replies for back-and-forth.
- Edit suggestions are range-targeted (not whole-chapter), so accepting is surgical.
- Contributors can draft chapters in the hive (DRAFT state), submit when ready, and have approved chapters slot into the book at a chosen position with full author attribution.
- BETA_READER can annotate and suggest but cannot submit new chapters.
- Discussions are topic-tagged (General/Worldbuilding/Feedback/Off-topic) with one-level reply depth.
- Activity events fire from the same transaction as the source-row insert, so /community feed stays consistent.

## Non-goals

- @mention notifications and a real notification center — deferred; cross-cutting feature that should land separately.
- Word goals / per-user word logs → H4.
- Buzz Board → H4.
- Dashboard counts/aggregation → H5.
- Real-time multi-user editing (operational transform, CRDTs) — last-write-wins on the chapter doc; annotation/suggestion rows are independent so the conflict surface is small.
- Suggestion-on-suggestion (proposing edits to a pending suggestion) — one level only.
- Whole-chapter rewrites as a suggestion shape — use Submit Chapter instead.

---

## Data Model

### `hive_comments` → `hive_annotations` (rename + extend)

```sql
ALTER TABLE hive_comments RENAME TO hive_annotations;
ALTER TABLE hive_annotations
  RENAME COLUMN anchor_start TO selection_start;
ALTER TABLE hive_annotations
  RENAME COLUMN anchor_end TO selection_end;

CREATE TYPE annotation_layer
  AS ENUM ('GRAMMAR','PLOT','TONE','CONTINUITY','GENERAL');

ALTER TABLE hive_annotations
  ADD COLUMN layer annotation_layer NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN parent_id uuid REFERENCES hive_annotations(id) ON DELETE CASCADE,
  ADD COLUMN selected_text text,
  ADD COLUMN resolved_by uuid REFERENCES users(id),
  ADD COLUMN resolved_at timestamp;
-- existing 'resolved' bool stays as denorm for cheap reads

CREATE INDEX hive_annotations_chapter_id_idx ON hive_annotations(chapter_id);
CREATE INDEX hive_annotations_parent_id_idx  ON hive_annotations(parent_id);
```

### `hive_suggestions` reshape

Old schema (`originalText` + `suggestedText` + `diff`) modeled whole-chapter suggestions; H3 switches to range-targeted.

```sql
ALTER TABLE hive_suggestions
  DROP COLUMN original_text,
  DROP COLUMN suggested_text,
  DROP COLUMN diff,
  ADD COLUMN selection_start integer NOT NULL,
  ADD COLUMN selection_end integer NOT NULL,
  ADD COLUMN original_excerpt text NOT NULL,
  ADD COLUMN suggested_text text NOT NULL,
  ADD COLUMN parent_id uuid REFERENCES hive_suggestions(id) ON DELETE CASCADE,
  ADD COLUMN resolved_by uuid REFERENCES users(id),
  ADD COLUMN resolved_at timestamp,
  ADD COLUMN accepted_at timestamp;

CREATE INDEX hive_suggestions_chapter_id_idx ON hive_suggestions(chapter_id);
CREATE INDEX hive_suggestions_parent_id_idx  ON hive_suggestions(parent_id);
```

### `hive_submissions` reshape

Old schema referenced `chapterId` (which doesn't exist yet for new chapters). New schema carries the draft content inline.

```sql
ALTER TABLE hive_submissions
  DROP COLUMN chapter_id,
  DROP COLUMN status,
  DROP COLUMN reviewer_note,
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN content jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN word_count integer NOT NULL DEFAULT 0,
  ADD COLUMN target_chapter_order integer,
  ADD COLUMN draft_status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT | PENDING | APPROVED | REJECTED
  ADD COLUMN created_chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_by uuid REFERENCES users(id),
  ADD COLUMN reviewed_at timestamp,
  ADD COLUMN review_note text;

-- After backfill (see Migration Plan), enforce the enum-as-text:
ALTER TABLE hive_submissions
  ADD CONSTRAINT draft_status_check
  CHECK (draft_status IN ('DRAFT','PENDING','APPROVED','REJECTED'));
```

### `chapters` gains author attribution

```sql
ALTER TABLE chapters
  ADD COLUMN author_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
-- NULL = attributed to book owner (default for all existing chapters)
-- Non-null = attributed to submitter (set on submission approval)
```

### `hive_discussion_posts` topic tagging

```sql
CREATE TYPE discussion_topic
  AS ENUM ('GENERAL','WORLDBUILDING','FEEDBACK','OFF_TOPIC');

ALTER TABLE hive_discussion_posts
  ADD COLUMN topic discussion_topic;

ALTER TABLE hive_discussion_posts
  ADD CONSTRAINT topic_only_on_top_level
  CHECK ((parent_id IS NULL AND topic IS NOT NULL)
      OR (parent_id IS NOT NULL AND topic IS NULL));
```

### Drop unused

```sql
DROP TABLE hive_chapter_locks;
-- No concurrent chapter writes in this model:
-- the author has sole write; contributors propose via submission/suggestion.
```

### Permission predicates (extend `lib/hive/permissions.ts`)

```ts
canSubmitChapter(role): boolean           // CONTRIBUTOR only (BETA_READER cannot)
canAnnotate(role): boolean                // all members
canSuggestEdits(role): boolean            // all members
canPostDiscussion(role): boolean          // all members
canReviewSubmission(role): boolean        // OWNER or MODERATOR
canReviewSuggestion(role): boolean        // OWNER or MODERATOR
canResolveAnnotation(
  annotation: { authorId: string },
  viewerRole: HiveRole,
  viewerId: string,
  bookOwnerId: string
): boolean                                // viewerId === bookOwnerId OR viewerId === annotation.authorId
canEditDiscussionPost(
  post: { authorId: string },
  viewerRole: HiveRole,
  viewerId: string
): boolean                                // viewerId === post.authorId OR viewerRole IN ('OWNER','MODERATOR')
```

---

## TipTap Extensions

Two new marks in `lib/tiptap-extensions/`:

```ts
// hive-annotation-mark.ts
HiveAnnotationMark: Mark.create({
  name: 'hiveAnnotation',
  attrs: {
    annotationId: { default: null },
    layer: { default: 'GENERAL' },
  },
  inclusive: false,   // doesn't extend when user types at the boundary
  parseHTML / renderHTML using <span data-annotation-id data-layer>,
})

// hive-suggestion-mark.ts
HiveSuggestionMark: Mark.create({
  name: 'hiveSuggestion',
  attrs: { suggestionId: { default: null } },
  inclusive: false,
  parseHTML / renderHTML using <span data-suggestion-id>,
})
```

Both marks are added to the TipTap config used by `chapter-editor.tsx` AND the new hive-side chapter view. Marks ride along with the doc on save; drift is automatic.

The author's `saveChapterAction` does not strip these marks — they're part of the doc now.

---

## In-Chapter Overlays (Annotations + Suggestions)

### Creating an annotation

1. Hive member with `canAnnotate(role)` selects text in chapter view.
2. Selection popover: **Annotate** / **Suggest edit** buttons.
3. **Annotate** → modal: 5 layer radio cards · body textarea · Submit.
4. `createAnnotationAction({ hiveId, chapterId, layer, body, selectionStart, selectionEnd, selectedText })`:
   - Inserts the `hive_annotations` row.
   - Patches the chapter doc to add a `hiveAnnotation` mark over the range, carrying the new row's id and layer.
   - Writes `hive_activity` event `annotation_added`.
   - All three in one DB transaction.

### Creating a suggestion

1. Same popover → **Suggest edit** → inline replacement form (strikethrough preview of selected text + textarea for replacement).
2. `createSuggestionAction({ hiveId, chapterId, selectionStart, selectionEnd, originalExcerpt, suggestedText })`:
   - Inserts the `hive_suggestions` row.
   - Patches the chapter doc to add a `hiveSuggestion` mark over the range with the new row's id.
   - Writes `hive_activity` event `suggestion_proposed`.

### Right-gutter UI

- Fixed-width gutter on the right side of the prose column, collapsible.
- Items anchored to the line of the first range character (computed via TipTap's `coordsAtPos`).
- **Annotation card:** author avatar · layer color dot · first 2 lines of body · reply count · resolve check (visible to `canResolveAnnotation`).
- **Suggestion card:** author avatar · "→" replacement preview · accept/reject buttons (visible to OWNER/MOD) · reply count.
- Click → expands inline (full body, full diff for suggestions, threaded replies, reply input).

### Filter strip

Pills above gutter: **All · Grammar · Plot · Tone · Continuity · General · Suggestions · Resolved**.
- Multi-select.
- "Resolved" off by default.
- State persists per-user per-chapter in localStorage.

### Resolution + threading

- Resolve: `resolveAnnotationAction(annotationId)` — permission via `canResolveAnnotation`; row updates `resolved=true`, `resolvedBy`, `resolvedAt`.
- Reply: `replyToAnnotationAction({ parentId, body })` — same table, `parentId` set; no own range (inherits parent); rendered as nested under parent card.
- Suggestions: identical `replyToSuggestionAction` shape.

### Accepting a suggestion (OWNER/MOD only)

`acceptSuggestionAction(suggestionId)`:
1. Load chapter doc, find `hiveSuggestion` mark with this id, compute current range (may have drifted thanks to the mark).
2. Server-side TipTap helper: `deleteRange({ from, to })` + `insertContentAt(from, suggestion.suggestedText)`.
3. Update suggestion: `resolved=true`, `resolvedBy`, `resolvedAt`, `acceptedAt`.
4. Chapter `contentJson` updates; word count recomputed; snapshot taken (60s throttle still applies).
5. `hive_activity` event `suggestion_accepted`.

### Rejecting

`rejectSuggestionAction(suggestionId)` — mark resolved without touching the chapter. Activity event `suggestion_rejected`.

### Orphan detection

Detected server-side in `getChapterAnnotationsAction` / `getChapterSuggestionsAction` by scanning the doc for mark ids and comparing to the rows. Orphans surface in an "Orphaned (N)" pill at the bottom of the gutter; clicking expands a list showing the original `selectedText` + body with no anchor and a Dismiss button.

---

## Submit Chapter Flow

### Routes

- `/hive/[hiveId]/submissions` — list (3 sections)
- `/hive/[hiveId]/submissions/new` — compose new draft
- `/hive/[hiveId]/submissions/[submissionId]` — read/edit one (review for OWNER/MOD; read-only for others)

### Submitter side

**Compose screen:**
- Title input · target-chapter-order dropdown ("Beginning", "After Chapter N", "End") · TipTap editor (same extension set as studio chapter editor, MINUS the hive-overlay marks) · word count chip · save status badge · Submit button.
- Auto-save: `saveSubmissionDraftAction({ submissionId?, title, content, targetChapterOrder })` debounced. First call creates the row with `draft_status='DRAFT'`.
- Submitter can leave and resume indefinitely.
- Submit button: `submitSubmissionAction(submissionId)` flips DRAFT → PENDING; locks the row from submitter edits.

**Submissions list (3 sections):**
1. **My drafts** — submitter's own DRAFT rows.
2. **My submissions** — submitter's PENDING/APPROVED/REJECTED rows.
3. **All in this hive** — OWNER/MOD only; PENDING first.

### Reviewer side (OWNER/MOD)

- Header: submitter · timestamp · target order · word count.
- Body: rendered TipTap content (read-only, normal chapter prose styling).
- Footer: **Approve** / **Reject** + review note textarea (required for reject).

**`approveSubmissionAction(submissionId)`:**
1. Permission check `canReviewSubmission(role)`.
2. Create `chapters` row: `contentJson=submission.content`, `title=submission.title`, `wordCount=submission.wordCount`, `authorUserId=submission.userId`, `bookId=book.id`.
3. Create `binderItems` row of type `chapter` parented under binder root (or under containing part at `targetChapterOrder`).
4. Shift `binder_items.order` of subsequent siblings by +1.
5. Update submission: `draft_status='APPROVED'`, `created_chapter_id`, `reviewed_by`, `reviewed_at`, `review_note`.
6. `hive_activity` event `chapter_submitted_approved`.

**`rejectSubmissionAction(submissionId, reviewNote)`:**
1. Permission check.
2. Update submission: `draft_status='REJECTED'`, `reviewed_by`, `reviewed_at`, `review_note`.
3. `hive_activity` event `chapter_submitted_rejected`.

### Reader UI sub-byline

In `/[locale]/books/[bookId]/read/[chapterId]` (SP-A reader): when `chapters.author_user_id IS NOT NULL`, render sub-byline:
> *Written by @submitter — chapter contribution to* Book Title *by @bookAuthor*

---

## Edit Suggestions Reviewer Flow

No dedicated reviewer page — the gutter UI from In-Chapter Overlays IS the reviewer flow. Specifically:

- OWNER/MOD opens any chapter (editor or `/hive/[hiveId]/chapters/[chapterId]`) → every pending suggestion shows in the right gutter with Accept/Reject buttons inline.
- **Bulk-review surface:** `/hive/[hiveId]/suggestions` — list of all pending suggestions grouped by chapter; each shows the diff inline; click expands into the chapter at the suggestion's range.

### New hive chapter view

`/hive/[hiveId]/chapters/[chapterId]` — read-only chapter prose with the full annotation/suggestion gutter. Lands BETA_READER and CONTRIBUTOR here when they click a chapter in the hive (chapter prose is read-only; they leave annotations and suggest edits via the gutter).

Reuses the public reader's TipTap render component, wrapped in `HiveChapterSurface` with the gutter + selection popover wired up.

---

## Discussions UI

### Routes

- `/hive/[hiveId]/discussions` — list
- `/hive/[hiveId]/discussions/[postId]` — thread

### List page

- Header: title · **+ New Post**.
- Topic filter chip strip: **All · General · Worldbuilding · Feedback · Off-topic** (multi-select, color-coded).
- Feed: top-level posts reverse-chron. Row: avatar · topic pill · title (first 80 chars of body, bolded) · body excerpt · reply count · last-activity timestamp.

### Compose modal

Topic picker (4 radio chips, **General** default) · title input (optional, derived from first 80 chars if empty) · TipTap body (StarterKit, no headings).

### Thread page

- Top post in full.
- Reply input at top of replies.
- Replies chronological, **one level deep** (replies-to-replies flatten — Reddit-style flat-with-context). Reply button → puts cursor in main reply input with `@username` prepended.

### Permissions

- `canPostDiscussion(role)`: all members.
- Edit/delete: post author OR OWNER/MOD via `canEditDiscussionPost`.

---

## Activity Event Wiring

H3 writes the following event types into H1's `hive_activity` table from server actions, in the same transaction as the source-row insert:

| Event type                       | Written by action                    |
| -------------------------------- | ------------------------------------ |
| `chapter_submitted`              | `submitSubmissionAction` (DRAFT → PENDING flip) |
| `chapter_submitted_approved`     | `approveSubmissionAction`            |
| `chapter_submitted_rejected`     | `rejectSubmissionAction`             |
| `annotation_added`               | `createAnnotationAction` (top-level only) |
| `suggestion_proposed`            | `createSuggestionAction` (top-level only) |
| `suggestion_accepted`            | `acceptSuggestionAction`             |
| `suggestion_rejected`            | `rejectSuggestionAction`             |
| `discussion_posted`              | `createDiscussionPostAction` (top-level only) |

`payload` jsonb denormalizes the fields the feed renderer needs (title/excerpt/topic/etc.) so the feed query doesn't have to join 6 tables.

Replies don't emit events (would flood the feed).

---

## Server Actions Summary

**New files:**
- `lib/actions/hive-annotations.actions.ts` — createAnnotationAction, replyToAnnotationAction, resolveAnnotationAction, getChapterAnnotationsAction
- `lib/actions/hive-suggestions.actions.ts` — createSuggestionAction, replyToSuggestionAction, acceptSuggestionAction, rejectSuggestionAction, getChapterSuggestionsAction, getPendingSuggestionsForHiveAction
- `lib/actions/hive-submissions.actions.ts` — saveSubmissionDraftAction, submitSubmissionAction, approveSubmissionAction, rejectSubmissionAction, getSubmissionAction, listHiveSubmissionsAction

**Existing file extended:**
- `lib/actions/hive-discussions.actions.ts` — createDiscussionPostAction (now takes `topic`), replyToDiscussionPostAction, editDiscussionPostAction, deleteDiscussionPostAction, listDiscussionPostsAction (gains topic filter param)

---

## Migration Plan

Single migration `db/migrations/0xxx_h3_collab_core.sql` + runner `scripts/db/apply-h3-migration.ts`.

**Steps in order:**

1. Create enums `annotation_layer`, `discussion_topic`.
2. Rename + extend `hive_comments → hive_annotations` (all ALTERs above).
3. Reshape `hive_suggestions` (drop old text columns, add range columns + threading + resolution).
4. Reshape `hive_submissions` (drop chapter_id/status/reviewer_note, add title/content/word_count/target_chapter_order/draft_status/created_chapter_id/reviewed_by/reviewed_at/review_note).
5. Add `chapters.author_user_id`.
6. Add `hive_discussion_posts.topic` + CHECK constraint.
7. Drop `hive_chapter_locks`.
8. Add new indexes (annotations and suggestions by `chapter_id` and `parent_id`).

**Data backfill:**

- `hive_annotations`: legacy rows get `layer='GENERAL'`, `selected_text=NULL`. Orphan detector surfaces drifted rows.
- `hive_suggestions`: legacy rows are degenerate — zero-out `selection_start`/`selection_end`, write old whole-chapter content into `original_excerpt`/`suggested_text`. Renderer flags as "Legacy whole-chapter suggestion (read-only, please re-submit as range edits)." Acceptable for dev; if production data existed, would need richer handling.
- `hive_submissions`: legacy rows get `draft_status` mapped from old `status` (PENDING→PENDING etc.), `title='Imported submission'`, `content='{}'`, `target_chapter_order=NULL`. Old `chapter_id` discarded (no contribution flow had landed).
- `hive_discussion_posts`: top-level posts (parent_id IS NULL) get `topic='GENERAL'` backfill; the CHECK constraint is added LAST after backfill completes.

---

## Test Plan

**Unit:**
- Annotation layer enum coercion; invalid layer rejection.
- TipTap mark serialization round-trip for both marks.
- Orphan detection: doc with mark ids not matching rows → flagged; vice versa → orphan.
- Permission predicates: `canResolveAnnotation`, `canEditDiscussionPost`, `canSubmitChapter`, `canReviewSubmission`.
- Topic CHECK constraint enforcement (replies can't have topic; top-level must).

**Action:**
- `createAnnotationAction` happy path + permission denied.
- `acceptSuggestionAction` applies range replacement correctly when mark hasn't drifted.
- `acceptSuggestionAction` handles drifted mark (range moved by N chars due to upstream edit).
- `approveSubmissionAction` creates chapter + binderItem + shifts orders correctly.
- `submitSubmissionAction` requires `canSubmitChapter` (BETA_READER blocked).
- Topic filter on `listDiscussionPostsAction` returns the right subset.

**Manual smoke (per Chris's preference):**
1. BETA_READER selects text → leaves Plot annotation → author replies, resolves.
2. CONTRIBUTOR selects text → "Suggest edit" → author accepts → chapter prose changes at exactly that range, nothing else.
3. CONTRIBUTOR drafts a chapter, saves, leaves, returns, finishes, submits → author approves with target order "After Chapter 2" → chapter slots in at position 3, subsequent chapters shift, reader page shows "Written by @contributor" sub-byline.
4. Author edits a chapter, deletes a paragraph that had an annotation → annotation appears in "Orphaned" pill; dismiss removes it.
5. Layer filter: chapter with annotations across all 5 layers → toggle filters → gutter shows only selected layers.
6. Discussion post in Worldbuilding → another member replies → filter to Worldbuilding → post appears; switch to General → it disappears.
7. BETA_READER navigates to `/hive/X/submissions/new` → server rejects (permission denied; redirect to /submissions list).
8. /community feed shows `annotation_added`, `chapter_submitted`, `discussion_posted` events from a hive the viewer is a member of.

---

## Risks & Trade-offs

- **TipTap mark serialization grows `chapters.contentJson` proportionally to mark density.** Acceptable; same approach used by Google Docs / Notion; size impact is small compared to prose.
- **`acceptSuggestionAction` does a TipTap-server-side mutation on the chapter.** Failure mid-flight: transaction-safe via `saveChapterAction` wrapper; both writes wrapped in a DB transaction.
- **Reply threads don't get their own marks.** Deleting a parent annotation's marked text orphans the parent AND all replies together. Acceptable — replies belong to the thread, not the text.
- **No @mention notifications.** Mentions render as styled spans but don't fire notifications. Deferred to a cross-cutting notification pass.
- **`hive_chapter_locks` is dropped without ceremony.** No callers in active code (was only used by a feature that never landed).

---

## Out of Scope (Explicit)

- @mention notifications + notification center → deferred (cross-cutting; should land as its own thing)
- Word goals / per-user word logs → H4
- Buzz Board → H4
- Dashboard aggregation of counts → H5
- Real-time mark synchronization → not in scope (last-write-wins on doc; annotations are independent rows)
- Suggestion-on-suggestion → not supported (one level only)
- Whole-chapter rewrites as suggestions → use Submit Chapter
