# Hive collaboration UX rework — design

**Date:** 2026-06-03
**Status:** Approved (Chris)
**Scope:** Annotation + suggestion visibility in editors, chapter metadata visibility on hive, route + sidebar cleanup.

---

## Summary

Make hive annotations and suggestions discoverable inside both editors (studio + hive chapter view) by auto-opening the collaboration gutter when items exist, and signaling presence with a toolbar badge when the gutter is closed. Expose chapter Status + Synopsis + Scene Planner to hive members through a header strip above the prose. Keep Notes author-private. Collapse navigation by deleting the standalone `/hive/.../annotations` page (the chapter view is canonical) while keeping `/hive/.../suggestions` as the reviewer queue. Add per-chapter activity badges to the chapters index.

The H3 actions, marks, and gutter component are unchanged structurally — this spec rewires WHEN they appear and where the user finds the digest views.

---

## Decisions locked

1. **Annotations live with the prose.** The chapter is the canonical place to see annotations. Mental model: a margin comment attached to a span of text, like Google Docs.
2. **Auto-open gutter on chapter load when count > 0.** Both studio and hive editors. Toolbar toggle still works for manual control after that.
3. **Toolbar gutter button gains a numeric badge** showing total open items (annotations + pending suggestions) when the gutter is closed.
4. **Chapter metadata header on the hive chapter view:** Status pill + Synopsis (line-clamp-3) + collapsible Scene Planner. Hidden when empty.
5. **Notes stays author-private.** Studio metadata-panel label and placeholder unchanged.
6. **`/hive/[hiveId]/annotations` deleted.** Hive sidebar drops from 11 entries to 10.
7. **`/hive/[hiveId]/suggestions` kept, unrenamed.** Stays gated by `canReviewSuggestion`.
8. **`/hive/[hiveId]/chapters` index** gains per-row activity badges: `N annotations` (when > 0) and `M suggestions` (when > 0, brand-yellow when viewer can review).

---

## Out of scope (deferred)

- Real-time updates. User B annotates while User A is mid-edit — User A sees it on next chapter open or full reload, not live.
- Per-user read/unread tracking on individual annotations.
- Cross-chapter annotation digest. The deleted `/annotations` page has no replacement.
- Making Notes hive-visible. If hive members need free-form chapter-level discussion, Discussions surface already exists.
- Renaming `/suggestions` to "Review queue" or adding filter chips.
- Changes to `/community` activity-event firing. `annotation_added` / `suggestion_*` events continue to fire as today.

---

## Editor visibility model

### Studio editor (`/en/studio/[bookId]`)

`chapter-editor.tsx` reads the chapter via `BookEditorProvider`. The provider extends `setActiveItemId` flow:

- After `getChapterAction` resolves for the new item, if the returned `annotationCount + pendingSuggestionCount > 0`, set `gutterOpen = true`. Fire-once per chapter switch — don't reopen if the user closes it on the same chapter.
- Track the last opened chapter in a ref to prevent double-firing on React 19 strict-mode effect re-runs.
- The auto-open is gated additionally on `bookHive !== null` — non-hive books never open the gutter.

The toolbar's gutter button (currently a plain icon toggle) gains a small numeric badge:

- When `gutterOpen === false && totalCount > 0`: render `N` in a brand-yellow pill (small, positioned over the button's top-right corner). Click clears it by opening the gutter.
- When `gutterOpen === true`: no badge.
- When `totalCount === 0`: no badge regardless of gutter state.

### Hive chapter view (`/en/hive/.../chapters/[chapterId]`)

The hive chapter view currently mounts `<CollaborationGutter>` unconditionally — there is no toggle. This spec preserves that behavior: the gutter is always present, no auto-open logic needed, no toolbar badge.

This intentional asymmetry exists because the studio editor's chrome already includes a gutter toggle (the writer chose to hide it), while the hive chapter view's only purpose is collaboration — hiding the gutter there would defeat the surface. The data plumbing (`annotationCount` + `pendingSuggestionCount` from `getHiveChapterView`) is still added for parity with the studio shape and so future spec work can change this if needed, but the hive view does not consume the counts in this spec.

---

## Hive chapter metadata header

New presentational component `chapter-metadata-header.tsx` colocated under `hive-chapter-surface.tsx`'s `_components/` directory.

**Props:**

```ts
type Props = {
  status: 'IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL'
  synopsis: string | null
  scenes: Array<{ id: string; title: string }>  // from binder_items.content
}
```

**Rendered structure (top to bottom):**

1. Title row (existing) — chapter title + status pill on the same row. Status pill uses existing `--status-{LEVEL}` tokens. Uppercase mono small text.
2. Synopsis paragraph — `<p>` with `line-clamp-3`, italic muted ink. Hidden when `synopsis === null || synopsis.trim() === ''`.
3. Scene Planner block — `<details>` with summary `▶ Scene planner · {N} scenes`. Open shows `<ul>` of scene titles, one per row. Hidden entirely when `scenes.length === 0`.
4. Hairline divider — `border-t` muted, ~16px margin top, between the header block and the prose surface.

**Visual position:** between `<ChapterContributionByline>` and the prose `<EditorContent>`. Sits inside the same width column as the prose so the divider aligns.

**Light + dark mode:** uses existing `--canvas-dark-ink*` and `--paper-ink-*` tokens; theme-flip is automatic.

**No mutation on this surface.** It's a pure read view. Status changes / synopsis edits happen in the studio.

---

## Data plumbing

### `lib/actions/chapter.actions.ts::getChapterAction`

Extend `ChapterData` return type with:

```ts
annotationCount: number          // top-level annotations only (parent_id IS NULL)
pendingSuggestionCount: number   // resolved = false AND parent_id IS NULL
```

Implementation: after the existing `assertChapterOwner` lookup, run TWO additional queries:

```ts
const [annCount] = await db
  .select({ count: count() })
  .from(hiveAnnotations)
  .where(and(
    eq(hiveAnnotations.chapterId, chapterId),
    isNull(hiveAnnotations.parentId),
  ))

const [sugCount] = await db
  .select({ count: count() })
  .from(hiveSuggestions)
  .where(and(
    eq(hiveSuggestions.chapterId, chapterId),
    eq(hiveSuggestions.resolved, false),
    isNull(hiveSuggestions.parentId),
  ))
```

Skip both queries entirely when `chapter.bookId`'s hive doesn't exist (the book isn't in a hive — no annotations possible). Use the existing `getBookHive` cache lookup. When skipped, return `annotationCount: 0, pendingSuggestionCount: 0`.

### `lib/actions/hive-content.actions.ts::getHiveChapterView`

Extend return shape with:

```ts
{
  status: ChapterStatus
  synopsis: string | null
  scenes: Array<{ id: string; title: string }>
}
```

- `status` from `chapters.status` (already present on the joined chapter row).
- `synopsis` from `binder_items.content.synopsis` if the chapter's binder item carries it. Read via existing content jsonb access. Null when missing.
- `scenes` from `binder_items.content.scenes` (or whichever key the studio metadata-panel writes for Scene Planner). Confirm exact key during impl by reading `metadata-panel.tsx`'s Scene Planner edit path. Empty array when missing/malformed.

No annotation/suggestion counts here — the hive chapter view's gutter is always mounted and doesn't gate on a count. (The chapter index's per-row badges get counts from `getHiveChapterListAction` instead.)

### `lib/actions/hive-content.actions.ts::getHiveChapterListAction`

Extend per-row projection with:

```ts
annotationCount: number
pendingSuggestionCount: number
```

Implementation: after the existing chapter rows query, run TWO GROUP BY queries:

```ts
const chapterIds = chapters.map(c => c.chapterId)

const annCounts = chapterIds.length === 0 ? [] : await db
  .select({
    chapterId: hiveAnnotations.chapterId,
    count: count(),
  })
  .from(hiveAnnotations)
  .where(and(
    inArray(hiveAnnotations.chapterId, chapterIds),
    isNull(hiveAnnotations.parentId),
  ))
  .groupBy(hiveAnnotations.chapterId)

const sugCounts = chapterIds.length === 0 ? [] : await db
  .select({
    chapterId: hiveSuggestions.chapterId,
    count: count(),
  })
  .from(hiveSuggestions)
  .where(and(
    inArray(hiveSuggestions.chapterId, chapterIds),
    eq(hiveSuggestions.resolved, false),
    isNull(hiveSuggestions.parentId),
  ))
  .groupBy(hiveSuggestions.chapterId)

const annMap = new Map(annCounts.map(r => [r.chapterId, r.count]))
const sugMap = new Map(sugCounts.map(r => [r.chapterId, r.count]))
```

Stitch into existing projection. Constant 2 queries regardless of chapter count.

---

## Sidebar + route restructure

### `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx`

The `NAV_ITEMS` const drops the `Annotations` row. Resulting 10-entry order:

```
Dashboard
Outline
Wiki
Discussions
Chapters
Suggestions
Submissions
Word Goals
Buzz Board
Members
Settings
```

(Order matches current minus the Annotations entry.)

### Deleted files

- `app/[locale]/(app)/hive/[hiveId]/annotations/page.tsx`
- `app/[locale]/(app)/hive/[hiveId]/annotations/_components/*` — entire directory.
- Empty `annotations/` directory is removed.

Note: `lib/actions/hive-annotations.actions.ts` is **NOT** touched. The CRUD actions are still consumed by the gutter component on chapter view + the studio editor.

### `/hive/[hiveId]/suggestions` unchanged

Stays gated by `canReviewSuggestion`. Existing bulk-review UI (per-chapter grouping, accept/reject, inline diff) keeps its current shape.

### `/hive/[hiveId]/chapters/[chapterId]` gains:

- Metadata header block (Section "Hive chapter metadata header").
- Auto-open-gutter behavior (Section "Editor visibility model").

---

## Chapter index activity badges

`/hive/[hiveId]/chapters/page.tsx` renders the chapter list. Each row gets a small badge cluster between the chapter title (left column) and the right meta column.

### Visual

- Layout: inline-flex row of pill badges, small gap.
- Each badge: tile-gradient background, `--r-pill` radius, 10px mono uppercase tracking-wider text, count number then label.
- Annotation badge: `N annotations` (or `1 annotation` singular). Always neutral ink. Hidden when count is 0.
- Suggestion badge: `M suggestions` (or `1 suggestion` singular). Brand-yellow ink + brand-yellow border tint when viewer can review (`canReviewSuggestion(role)` returns true). Neutral when viewer cannot review. Hidden when count is 0.
- When both counts are 0: the entire badge cluster row is omitted — no empty space, no "0 annotations" filler.

### New file

`app/[locale]/(app)/hive/[hiveId]/chapters/_components/chapter-activity-badges.tsx` (or co-located with the existing chapter row component — confirm during impl). Pure presentational, props `{ annotationCount, pendingSuggestionCount, canReview }`.

---

## Edge cases

1. **Chapter in a non-hive book.** Studio editor's `getChapterAction` skips the COUNT queries entirely and returns `0` for both. Provider's auto-open gate fails (count is 0). Toolbar badge hidden. No UI surprise.
2. **Chapter with synopsis but no scenes.** Header strip renders synopsis paragraph; Scene Planner `<details>` omitted entirely.
3. **Chapter with scenes but no synopsis.** Header strip omits the synopsis paragraph; Scene Planner `<details>` renders.
4. **Chapter with no synopsis AND no scenes.** Header strip is just the title + status pill row. The hairline divider still renders (separates header from prose visually).
5. **`scenes` is malformed JSON** (legacy data, hand-edited DB). The metadata-header reads it defensively: if `Array.isArray(scenes) === false` after parse, treats as empty.
6. **Status enum has a value we don't recognize** (post-deploy schema migration races). Status pill renders the raw value uppercased; doesn't crash.
7. **User closes the gutter on a chapter with items, then switches to another chapter with items, then returns.** The "fire-once per chapter switch" ref tracks the active chapter id; switching away and back re-fires the auto-open. Acceptable — the user's "close" intent was per-visit, not per-session.
8. **User in a long editing session — annotation arrives mid-edit.** Out of scope (no real-time). Will appear on next chapter open or page reload.
9. **Chapter with 99 annotations.** Badge shows `99 annotations`. Numeric badge on toolbar shows `99`. No cap at this stage — three-digit counts (100+) still render but tighter. If smoke flags this, cap at `99+` later.
10. **Deleting a chapter that has annotations.** Existing cascade behavior (hive_annotations has `chapter_id` FK to chapters with `onDelete: 'cascade'` per the H3 migration) handles this. Counts are recomputed on next chapter list load. No new code needed.

---

## Test posture

**Surface-shape tests** (vi.mock pattern, 2 cases each — export + arity):

- `getChapterAction` — updated to include the new fields in the return type. Existing test gets revisited but the test pattern stays the same.
- `getHiveChapterView` — new fields in return.
- `getHiveChapterListAction` — new fields in per-row projection.

**No new behavior tests.** Counting logic is exercised by manual smoke. Presentational components (metadata header, activity badges) covered by manual smoke per AGENTS.md preference.

**tsc clean** must hold across the run.

---

## Carry-forward smoke checklist for Chris (post-implementation)

1. User A authors a chapter with no hive activity, opens it in `/studio` → gutter closed by default, toolbar gutter button shows no badge.
2. User B (hive member) opens hive chapter view → status pill + synopsis + collapsed Scene Planner visible above prose. Annotate a span. Confirm gutter card appears on hive side.
3. User A opens same chapter in `/studio` → gutter auto-opens with the new annotation visible. Refresh — still auto-opens.
4. Manually close gutter → toolbar gutter button gains `1` badge. Click button → gutter opens again, badge clears.
5. `/hive/[hiveId]/chapters` → that chapter row shows `1 annotation` badge. Other chapters with zero counts show no badges.
6. User B suggests an edit on a different chapter → that chapter row shows `1 suggestion` badge (brand-yellow if viewer can review).
7. Open `/hive/[hiveId]/suggestions` as OWNER/MOD → both pending suggestions visible. As BETA_READER → permission-denied state.
8. Hive sidebar shows 10 entries, no Annotations row.
9. `/hive/[hiveId]/annotations` returns 404.
10. Studio metadata-panel still shows "Notes" with "Private notes — only you can see these" placeholder.
11. Chapter without synopsis / without scenes on hive side → header block omits those subsections cleanly (no empty space).
12. Chapter without a hive (book has no linked hive) → studio editor opens normally, no counts, no badge, no auto-open.
13. Light + dark mode on the hive metadata header — status pill, synopsis text, scene list all legible.
14. Chapter with 5 annotations + 3 suggestions → toolbar badge shows `8`. Chapter index row shows both badges.
