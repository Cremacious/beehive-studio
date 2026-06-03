# Hive collaboration UX rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hive annotations + suggestions discoverable in both editors (studio auto-opens gutter, hive keeps it always-mounted), expose chapter Status + Synopsis + Scene Planner to hive members via a header strip above the prose, delete the standalone `/annotations` page, and add per-chapter activity badges to the hive chapters index.

**Architecture:** Data plumbing extends three existing actions (no schema changes). New presentational components for the metadata header and activity badges. Studio editor's `BookEditorProvider` gains a one-shot auto-open ref keyed on `activeItemId` to defeat React 19 strict-mode double-fire. Hive sidebar drops one nav entry. `lib/actions/hive-annotations.actions.ts` is preserved (still consumed by the gutter); only the standalone page that consumed it is deleted.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Drizzle ORM, vitest.

**Spec:** [docs/superpowers/specs/2026-06-03-hive-collab-ux-rework-design.md](../specs/2026-06-03-hive-collab-ux-rework-design.md)

---

## File Structure

**New files:**
- `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/chapter-metadata-header.tsx` — presentational header strip (status pill + synopsis + collapsible Scene Planner)
- `app/[locale]/(app)/hive/[hiveId]/chapters/_components/chapter-activity-badges.tsx` — presentational badge cluster for chapter index rows
- `lib/actions/__tests__/get-hive-chapter-list-action.test.ts` — surface-shape test (export + arity)

**Modified files:**
- `lib/actions/chapter.actions.ts` — extend `ChapterData` + `getChapterAction` with counts; skip when book has no hive
- `lib/actions/hive-content.actions.ts` — extend `getHiveChapterView` (status/synopsis/scenePlanner) AND `getHiveChapterListAction` (per-row counts via two GROUP BY queries)
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` — auto-open gutter on chapter load when counts > 0, with one-shot ref
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — gutter button gains numeric badge when gutter closed AND total > 0
- `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx` — render `<ChapterMetadataHeader>` between byline and prose
- `app/[locale]/(app)/hive/[hiveId]/chapters/page.tsx` (or wherever the row renders) — pass extended action result + render badges
- `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx` — drop Annotations from `NAV_ITEMS`
- `AGENTS.md` — record ship + smoke checklist

**Deleted files:**
- `app/[locale]/(app)/hive/[hiveId]/annotations/page.tsx`
- `app/[locale]/(app)/hive/[hiveId]/annotations/_components/*` (entire directory)
- `lib/actions/__tests__/get-chapter-action.test.ts` (if it exists with the old shape — recreate via Task 1)

---

## Task 1: Extend getChapterAction with annotation + suggestion counts

**Goal:** Studio editor data path gets the counts it needs to drive auto-open. Skip queries when book has no hive (perf — most books aren't in hives).

**Files:**
- Modify: `lib/actions/chapter.actions.ts`

- [ ] **Step 1.1: Inspect current ChapterData type + getChapterAction body**

```bash
grep -n "type ChapterData\|export async function getChapterAction\|return.*data.*\|getBookHive" lib/actions/chapter.actions.ts
```

Identify where `ChapterData` is defined and where `getChapterAction` returns its data. Note any existing import of `getBookHive` — there may not be one yet.

- [ ] **Step 1.2: Add the counts fields to ChapterData**

Edit `ChapterData` type to include:

```ts
annotationCount: number
pendingSuggestionCount: number
```

Place these at the end of the type definition.

- [ ] **Step 1.3: Add required imports**

At the top of `chapter.actions.ts`, ensure these imports exist (add what's missing):

```ts
import { count, and, eq, isNull } from 'drizzle-orm'
import { hiveAnnotations, hiveSuggestions } from '@/db/schema'
import { getBookHive } from '@/lib/hive/get-book-hive'
```

- [ ] **Step 1.4: Add the count queries before the return**

Inside `getChapterAction`, after the existing `assertChapterOwner` call and BEFORE the `return { success: true, data: {...} }` block, add:

```ts
// Hive activity counts. Skip the queries entirely when the book has no
// linked hive — the vast majority of books aren't in hives and we don't
// want two extra round-trips per chapter load for them. getBookHive is
// React-cached so repeated calls in the same request are free.
const hive = await getBookHive(chapter.bookId)
let annotationCount = 0
let pendingSuggestionCount = 0
if (hive) {
  const [annRow] = await db
    .select({ c: count() })
    .from(hiveAnnotations)
    .where(and(
      eq(hiveAnnotations.chapterId, chapterId),
      isNull(hiveAnnotations.parentId),
    ))
  annotationCount = Number(annRow?.c ?? 0)

  const [sugRow] = await db
    .select({ c: count() })
    .from(hiveSuggestions)
    .where(and(
      eq(hiveSuggestions.chapterId, chapterId),
      eq(hiveSuggestions.resolved, false),
      isNull(hiveSuggestions.parentId),
    ))
  pendingSuggestionCount = Number(sugRow?.c ?? 0)
}
```

- [ ] **Step 1.5: Add the new fields to the return**

In the existing `return { success: true, data: { ... } }` block, add `annotationCount` and `pendingSuggestionCount` to the data object.

- [ ] **Step 1.6: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If errors mention the chapter cache in `book-editor-provider.tsx`, that's wired in Task 4 — leave for now if the only errors are downstream type narrowings that don't break compile.

- [ ] **Step 1.7: Run any existing chapter-action tests**

```bash
npm test -- chapter.actions
```

Expected: existing tests pass. If a test asserts a specific shape that no longer matches (because we added fields), update it: tests should not assert "no other fields" — they should assert presence of expected fields.

- [ ] **Step 1.8: Commit**

```bash
git add lib/actions/chapter.actions.ts
git commit -m "$(cat <<'EOF'
feat(chapter): expose annotation + suggestion counts on getChapterAction

ChapterData gains annotationCount and pendingSuggestionCount.
Counts query top-level rows only (parent_id IS NULL); suggestions
additionally filter resolved = false.

Skip both queries when the book has no linked hive — getBookHive is
React-cached so the gate is essentially free. Most books aren't in
hives and we don't want two extra round-trips per chapter load for
them.

T2-T7 of the hive-collab-ux-rework plan consume these counts to drive
the studio editor's auto-open-gutter behavior + toolbar badge.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend getHiveChapterView with chapter metadata fields

**Goal:** Hive chapter view data path returns Status + Synopsis + Scene Planner so the new header strip can render.

**Files:**
- Modify: `lib/actions/hive-content.actions.ts` — the existing `getHiveChapterView` function

- [ ] **Step 2.1: Locate getHiveChapterView**

```bash
grep -n "export async function getHiveChapterView\|return.*success.*true" lib/actions/hive-content.actions.ts | head -10
```

Open the file at the function. Read the existing return shape so the new fields slot in correctly.

- [ ] **Step 2.2: Extend the return type and add the binder-item content read**

Find the return type annotation (or the inferred return). Add to the data shape:

```ts
status: ChapterStatus
synopsis: string | null
scenePlanner: {
  goal: string | null
  conflict: string | null
  outcome: string | null
}
```

If `ChapterStatus` isn't already imported, import it:

```ts
import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'
```

- [ ] **Step 2.3: Read binder-item content defensively**

The hive chapter view already joins the binder item (it needs the title). Add a defensive read of `binderItem.content` for the metadata fields. After the existing binder-item fetch, add:

```ts
function safeString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

const rawContent = (binderItem.content ?? {}) as Record<string, unknown>
const synopsis = safeString(rawContent.synopsis)
const scenePlanner = {
  goal: safeString(rawContent.sceneGoal),
  conflict: safeString(rawContent.sceneConflict),
  outcome: safeString(rawContent.sceneOutcome),
}
```

Replace the variable names (`binderItem`, `rawContent`) with whatever names the existing function uses for those values.

- [ ] **Step 2.4: Add the new fields to the return**

Slot `status: chapter.status as ChapterStatus`, `synopsis`, and `scenePlanner` into the existing return's `data: { ... }` object. Keep the existing fields in their existing order; append the new fields at the end.

- [ ] **Step 2.5: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2.6: Commit**

```bash
git add lib/actions/hive-content.actions.ts
git commit -m "$(cat <<'EOF'
feat(hive): expose chapter metadata on getHiveChapterView

Action now returns status (ChapterStatus), synopsis (string | null),
and scenePlanner ({ goal, conflict, outcome } each string | null) so
the upcoming chapter-metadata-header (T6) can render them.

scenePlanner mirrors the studio metadata-panel's three-field layout
(sceneGoal, sceneConflict, sceneOutcome live on binder_items.content
as separate keys, NOT a scenes array). safeString() helper coerces
non-string content to null and treats blank-after-trim as null too,
so the hive header can use simple null checks downstream.

No annotation/suggestion counts here — the hive chapter view's
CollaborationGutter is unconditionally mounted, so the counts only
need to flow through getHiveChapterListAction for the chapter index
badges (T3).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extend getHiveChapterListAction with per-row activity counts

**Goal:** Chapter index can render `N annotations` + `M suggestions` badges.

**Files:**
- Modify: `lib/actions/hive-content.actions.ts` — the existing `getHiveChapterListAction` function

- [ ] **Step 3.1: Locate getHiveChapterListAction**

```bash
grep -n "getHiveChapterListAction\|getHiveChaptersAction\|getHiveChapter" lib/actions/hive-content.actions.ts | head
```

Open the file at the chapter-list function (whatever its exact name).

- [ ] **Step 3.2: Add new per-row fields to the return type**

Find the per-row projection type or the `.map(...)` that shapes each row. Add to each row:

```ts
annotationCount: number
pendingSuggestionCount: number
```

- [ ] **Step 3.3: Run the two GROUP BY queries after the chapter rows query**

After the existing query that fetches the chapter rows (and before the `.map(...)` that shapes them), add:

```ts
const chapterIds = chapterRows.map(r => r.chapterId)  // or whatever the row's chapter-id field is

const annCounts = chapterIds.length === 0
  ? []
  : await db
      .select({
        chapterId: hiveAnnotations.chapterId,
        c: count(),
      })
      .from(hiveAnnotations)
      .where(and(
        inArray(hiveAnnotations.chapterId, chapterIds),
        isNull(hiveAnnotations.parentId),
      ))
      .groupBy(hiveAnnotations.chapterId)

const sugCounts = chapterIds.length === 0
  ? []
  : await db
      .select({
        chapterId: hiveSuggestions.chapterId,
        c: count(),
      })
      .from(hiveSuggestions)
      .where(and(
        inArray(hiveSuggestions.chapterId, chapterIds),
        eq(hiveSuggestions.resolved, false),
        isNull(hiveSuggestions.parentId),
      ))
      .groupBy(hiveSuggestions.chapterId)

const annByChapter = new Map(annCounts.map(r => [r.chapterId, Number(r.c)]))
const sugByChapter = new Map(sugCounts.map(r => [r.chapterId, Number(r.c)]))
```

Add the imports `inArray, count, and, eq, isNull` to the top of the file (some may already be imported — only add the missing ones). Add `hiveAnnotations, hiveSuggestions` to the schema imports if missing.

- [ ] **Step 3.4: Plumb counts into the row projection**

In the existing `.map(...)` that builds each row, add:

```ts
annotationCount: annByChapter.get(row.chapterId) ?? 0,
pendingSuggestionCount: sugByChapter.get(row.chapterId) ?? 0,
```

Replace `row.chapterId` with whatever the existing per-row field is named.

- [ ] **Step 3.5: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3.6: Write surface-shape test**

Create `lib/actions/__tests__/get-hive-chapter-list-action.test.ts` (use the EXACT name of the action — adjust if it differs):

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}))

vi.mock('@/lib/hive/permissions', () => ({
  requireHiveMember: vi.fn(async () => 'CONTRIBUTOR'),
  type: {},
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      hives: { findFirst: vi.fn() },
      binderItems: { findMany: vi.fn() },
      chapters: { findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => []),
        })),
      })),
    })),
  },
}))

import * as actions from '../hive-content.actions'

describe('getHiveChapterListAction', () => {
  it('exports the action', () => {
    // Replace getHiveChapterListAction with the action's real exported name
    expect(typeof actions.getHiveChapterListAction).toBe('function')
  })

  it('takes one string arg (hiveId)', () => {
    expect(actions.getHiveChapterListAction.length).toBe(1)
  })
})
```

If the action's real name differs, update the test to match. Confirm the arity (`.length`) matches whatever the function signature actually accepts.

- [ ] **Step 3.7: Run the new test**

```bash
npm test -- get-hive-chapter-list-action
```

Expected: 2/2 pass.

- [ ] **Step 3.8: Commit**

```bash
git add lib/actions/hive-content.actions.ts lib/actions/__tests__/get-hive-chapter-list-action.test.ts
git commit -m "$(cat <<'EOF'
feat(hive): expose per-row activity counts on chapter list action

Each chapter row gains annotationCount + pendingSuggestionCount via
two GROUP BY queries (one for annotations, one for suggestions)
stitched into the projection via Map lookup. Matches the existing
two-queries-with-Map pattern from listBuzzPostsAction and
listHiveSubmissionsAction (per AGENTS.md "no correlated-subquery
precedent in the codebase").

Suggestions count filters resolved = false AND parent_id IS NULL —
matches the "stuff that needs reviewer attention" definition that
drives the brand-yellow accent on the index badges (T7). Annotations
count filters parent_id IS NULL only — top-level annotations are
what readers see; reply rows shouldn't inflate the badge.

Constant 2 queries regardless of chapter count. Surface-shape test
mirrors the get-hive-outline-by-id pattern (vi.mock auth + perms +
db, top-level static import).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Studio editor auto-opens gutter on chapter load

**Goal:** Studio editor's BookEditorProvider sets `gutterOpen = true` once per chapter switch when the loaded chapter has any annotations or pending suggestions.

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx`

- [ ] **Step 4.1: Locate where chapter data is set into the cache**

```bash
grep -n "setChapterCache\|gutterOpen\|setGutterOpen\|getChapterAction" "app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx" | head -20
```

Find the spots where `getChapterAction` is awaited (likely inside `setActiveItemId` for the cache-miss path, and possibly inside `reloadActiveChapter`).

- [ ] **Step 4.2: Add the one-shot auto-open ref**

Near the other useRef declarations in the provider, add:

```ts
// Tracks the last item id we auto-opened the gutter for. Prevents re-opening
// when the user manually closes it and a re-render happens for the same
// chapter. React 19 strict-mode also double-invokes effects in dev, so
// without the ref guard the auto-open would fire twice on first mount.
const autoOpenedForItemRef = useRef<string | null>(null)
```

- [ ] **Step 4.3: Add the helper that gates auto-open**

Below the ref, add a tiny helper:

```ts
function maybeAutoOpenGutter(itemId: string, data: ChapterData) {
  if (autoOpenedForItemRef.current === itemId) return
  if (!bookHive) return  // non-hive book, never auto-open
  const total = data.annotationCount + data.pendingSuggestionCount
  if (total <= 0) return
  autoOpenedForItemRef.current = itemId
  setGutterOpen(true)
  // Mutually-exclusive with the history drawer (preserve existing wiring).
  setHistoryOpen(false)
}
```

Replace `setGutterOpen` / `setHistoryOpen` with the existing state setters' actual names if they differ (they may be wrapped inside callbacks like `toggleGutter` — find the underlying `useState` setter and use it directly here, since we're setting an absolute value, not toggling).

- [ ] **Step 4.4: Call the helper from the chapter-load success paths**

In `setActiveItemId`'s cache-miss `getChapterAction(...).then(result => {...})` block, after `setChapterCache(c => new Map(c).set(id, result.data))`, add:

```ts
maybeAutoOpenGutter(id, result.data)
```

Also call it from the cache-HIT branch (the early return that sets word count from cached data) so re-visiting an already-cached chapter still triggers auto-open the first time per session:

```ts
const cached = chapterCacheRef.current.get(id)
if (cached) {
  setWordCount(cached.wordCount)
  maybeAutoOpenGutter(id, cached)
  return
}
```

In `reloadActiveChapter`, after the `setChapterCache(c => new Map(c).set(itemId, result.data))` line, also call `maybeAutoOpenGutter(itemId, result.data)` — reload happens after suggestion accept, and the count may have shifted upward.

- [ ] **Step 4.5: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If the helper references `setGutterOpen` or `setHistoryOpen` by the wrong name, fix.

- [ ] **Step 4.6: Run the test suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 4.7: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx"
git commit -m "$(cat <<'EOF'
feat(studio): auto-open collab gutter on chapter load when items exist

When getChapterAction resolves for a chapter that has any annotations
or pending suggestions (count > 0), the BookEditorProvider sets
gutterOpen = true and closes the history drawer (preserving the
existing mutual-exclusion between the two).

Fires at most once per chapter switch — autoOpenedForItemRef tracks
the active item id so re-renders, manual closes, and React 19 strict-
mode double-invokes don't reopen the gutter against the user's intent.
Switching to a different chapter and back DOES re-fire (the user's
close intent was per-visit, not per-session).

Gated on bookHive !== null — non-hive books never auto-open.

Called from three sites: cache-miss path in setActiveItemId (fresh
load), cache-hit path (existing read), and reloadActiveChapter
(suggestion-accept reload).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Editor toolbar gutter button badge

**Goal:** Toolbar gutter button shows a small numeric badge when gutter is closed AND the chapter has open items.

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`

- [ ] **Step 5.1: Locate the gutter button**

```bash
grep -n "gutter\|MessagesSquare\|toggleGutter" "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx" | head
```

Find the button that calls `toggleGutter()` and its lucide icon.

- [ ] **Step 5.2: Read the counts from the provider**

The toolbar imports `useBookEditor` already. Make sure it destructures:

```ts
const { ..., gutterOpen, toggleGutter, activeChapter } = useBookEditor()
```

Add `activeChapter` if it's not already destructured. `activeChapter` carries the new `annotationCount` + `pendingSuggestionCount` from Task 1.

- [ ] **Step 5.3: Compute the badge value**

Just above the gutter button JSX, add:

```ts
const gutterPendingCount =
  !gutterOpen && activeChapter
    ? activeChapter.annotationCount + activeChapter.pendingSuggestionCount
    : 0
```

- [ ] **Step 5.4: Render the badge over the button**

The button is probably a plain `<button>` with an icon. Wrap it (or use `position: relative` on the button) and add the badge `<span>` overlaid at the top-right corner. Inside the button's children, after the icon, add:

```tsx
{gutterPendingCount > 0 && (
  <span
    aria-label={`${gutterPendingCount} pending collaboration items`}
    style={{
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      background: 'var(--brand)',
      color: 'var(--brand-ink, #1a1a1a)',
      fontSize: 9,
      fontWeight: 700,
      lineHeight: 1,
      pointerEvents: 'none',
    }}
  >
    {gutterPendingCount > 99 ? '99+' : gutterPendingCount}
  </span>
)}
```

If the button isn't already `position: relative`, add `position: 'relative'` to its inline style (or `className` if it uses Tailwind utility — add `relative` to the className).

- [ ] **Step 5.5: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5.6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx"
git commit -m "$(cat <<'EOF'
feat(studio/toolbar): badge gutter button with pending collab count

When gutter is closed AND the active chapter has annotations or
pending suggestions, the gutter toolbar button renders a small
brand-yellow numeric pill over its top-right corner showing the
total. Count caps at "99+" — three-digit counts would overflow the
24px button hit area without it.

Reads activeChapter.annotationCount + .pendingSuggestionCount
(added in T1) from the BookEditorProvider context. Hidden when
gutter is open or count is zero. aria-label makes it accessible
to screen readers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: New ChapterMetadataHeader component

**Goal:** Pure presentational component for the hive chapter view's metadata header strip.

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/chapter-metadata-header.tsx`

- [ ] **Step 6.1: Create the file**

```tsx
'use client'

import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'

const STATUS_DISPLAY: Record<ChapterStatus, string> = {
  IDEA: 'Idea',
  OUTLINE: 'Outline',
  FIRST_DRAFT: 'First Draft',
  REVISED: 'Revised',
  FINAL: 'Final',
}

type Props = {
  status: ChapterStatus
  synopsis: string | null
  scenePlanner: {
    goal: string | null
    conflict: string | null
    outcome: string | null
  }
}

export function ChapterMetadataHeader({ status, synopsis, scenePlanner }: Props) {
  const hasAnyScene =
    scenePlanner.goal !== null ||
    scenePlanner.conflict !== null ||
    scenePlanner.outcome !== null

  return (
    <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--canvas-dark-300)' }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: 'var(--r-pill)',
            background: `oklch(from var(--status-${statusToken(status)}) l c h / 0.18)`,
            color: `var(--status-${statusToken(status)})`,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
          }}
        >
          {STATUS_DISPLAY[status] ?? status}
        </span>
      </div>

      {synopsis !== null && synopsis !== '' && (
        <p
          className="text-sm italic line-clamp-3 mb-3"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {synopsis}
        </p>
      )}

      {hasAnyScene && (
        <details className="text-sm">
          <summary
            className="cursor-pointer font-mono uppercase tracking-wider text-[10px] font-semibold"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Scene planner
          </summary>
          <div className="mt-2 space-y-3 pl-1">
            {scenePlanner.goal !== null && (
              <SceneStanza label="Goal" body={scenePlanner.goal} />
            )}
            {scenePlanner.conflict !== null && (
              <SceneStanza label="Conflict" body={scenePlanner.conflict} />
            )}
            {scenePlanner.outcome !== null && (
              <SceneStanza label="Outcome" body={scenePlanner.outcome} />
            )}
          </div>
        </details>
      )}
    </div>
  )
}

function SceneStanza({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div
        className="font-mono uppercase tracking-wider text-[9px] font-semibold mb-1"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {label}
      </div>
      <p
        className="text-sm whitespace-pre-wrap"
        style={{ color: 'var(--canvas-dark-ink)' }}
      >
        {body}
      </p>
    </div>
  )
}

function statusToken(s: ChapterStatus): string {
  switch (s) {
    case 'IDEA': return 'idea'
    case 'OUTLINE': return 'outline'
    case 'FIRST_DRAFT': return 'first-draft'
    case 'REVISED': return 'revised'
    case 'FINAL': return 'final'
  }
}
```

- [ ] **Step 6.2: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6.3: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/chapter-metadata-header.tsx"
git commit -m "$(cat <<'EOF'
feat(hive/chapters): add ChapterMetadataHeader presentational component

Status pill (--status-* token, oklch-tinted background, uppercase
mono text) + synopsis paragraph (line-clamp-3 italic muted) +
collapsible <details> Scene planner with three labeled stanzas
(Goal / Conflict / Outcome).

Each subsection hidden when its data is empty: synopsis hidden when
null/''; <details> hidden entirely when all three scene fields are
null. Status pill always renders.

Pure presentational. No state, no actions. Consumes the shape T2
added to getHiveChapterView. T7 mounts it on the hive chapter
surface between the byline and the prose.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Mount ChapterMetadataHeader on hive chapter surface

**Goal:** Hive chapter view shows the header strip above the prose.

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx`

- [ ] **Step 7.1: Locate the byline + prose area**

```bash
grep -n "ChapterContributionByline\|EditorContent\|<main\|<header" "app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx" | head
```

Find where the existing `<ChapterContributionByline>` is rendered (or the chapter title's `<h1>` if there's no byline). The new component goes immediately AFTER that and BEFORE the `<EditorContent>` (or whatever wraps the prose).

- [ ] **Step 7.2: Add the import**

At the top of the file:

```ts
import { ChapterMetadataHeader } from './chapter-metadata-header'
```

- [ ] **Step 7.3: Render the header**

Just before the `<EditorContent>` (or the prose wrapper), add:

```tsx
<ChapterMetadataHeader
  status={data.chapter.status}
  synopsis={data.chapter.synopsis}
  scenePlanner={data.chapter.scenePlanner}
/>
```

Replace `data.chapter` with whatever the component's existing prop path is for the chapter data (it may be `data.chapter`, `chapter`, or differently named — check the existing JSX nearby).

- [ ] **Step 7.4: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If errors mention missing fields on `data.chapter`, T2's shape change didn't propagate — verify T2's commit landed and the surface is using the latest types.

- [ ] **Step 7.5: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/chapters/[chapterId]/_components/hive-chapter-surface.tsx"
git commit -m "$(cat <<'EOF'
feat(hive/chapters): render metadata header above prose

Mounts <ChapterMetadataHeader> between the chapter byline (or title)
and the prose surface. Consumes status / synopsis / scenePlanner
exposed by T2's getHiveChapterView shape change.

Hive members now see chapter Status, Synopsis, and Scene Planner
(Goal/Conflict/Outcome) — the same surface area authors see on the
studio metadata panel, minus the private Notes field which stays
author-only per spec.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: ChapterActivityBadges component

**Goal:** Pure presentational component for per-row activity badges on the chapters index.

**Files:**
- Create: `app/[locale]/(app)/hive/[hiveId]/chapters/_components/chapter-activity-badges.tsx`

- [ ] **Step 8.1: Create the file**

```tsx
'use client'

type Props = {
  annotationCount: number
  pendingSuggestionCount: number
  canReview: boolean
}

export function ChapterActivityBadges({
  annotationCount,
  pendingSuggestionCount,
  canReview,
}: Props) {
  if (annotationCount === 0 && pendingSuggestionCount === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {annotationCount > 0 && (
        <Badge
          count={annotationCount}
          label="annotation"
          accent="neutral"
        />
      )}
      {pendingSuggestionCount > 0 && (
        <Badge
          count={pendingSuggestionCount}
          label="suggestion"
          accent={canReview ? 'brand' : 'neutral'}
        />
      )}
    </div>
  )
}

function Badge({
  count,
  label,
  accent,
}: {
  count: number
  label: 'annotation' | 'suggestion'
  accent: 'neutral' | 'brand'
}) {
  const isBrand = accent === 'brand'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: isBrand
          ? 'oklch(from var(--color-brand) l c h / 0.14)'
          : 'oklch(from var(--canvas-dark-ink) l c h / 0.06)',
        color: isBrand ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
        border: isBrand
          ? '1px solid oklch(from var(--color-brand) l c h / 0.32)'
          : '1px solid var(--canvas-dark-300)',
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      {count} {pluralize(label, count)}
    </span>
  )
}

function pluralize(label: 'annotation' | 'suggestion', n: number): string {
  return n === 1 ? label : `${label}s`
}
```

- [ ] **Step 8.2: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8.3: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/chapters/_components/chapter-activity-badges.tsx"
git commit -m "$(cat <<'EOF'
feat(hive/chapters): add ChapterActivityBadges presentational component

Renders "N annotations" and/or "M suggestions" pill badges on chapter
index rows. Both hidden when their count is 0; whole cluster returns
null when both are 0.

Suggestion badge uses brand-yellow accent (text + border + tinted
background) when canReview is true — hints to OWNER/MOD that this is
their reviewer-queue surface. Neutral muted styling otherwise.

Pure presentational. T9 mounts it on the chapter index row.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Mount ChapterActivityBadges on chapter index row

**Goal:** Each row of `/hive/[hiveId]/chapters` shows the badge cluster.

**Files:**
- Modify: `app/[locale]/(app)/hive/[hiveId]/chapters/page.tsx` (or the existing client list component that renders rows — check both)

- [ ] **Step 9.1: Find where the row is rendered**

```bash
grep -rn "<li\|chapterRow\|chapters.map\|.map((chapter" "app/[locale]/(app)/hive/[hiveId]/chapters/" | head -10
```

Identify the JSX block that renders a single chapter row (it may be inline in `page.tsx` or in a sibling `_components/` file).

- [ ] **Step 9.2: Determine canReview at the row level**

The badges need a `canReview` boolean. The page-level server component knows the viewer's role (it called `requireHiveMember`). Determine `canReview` by importing and calling `canReviewSuggestion(viewerRole)` from `@/lib/hive/permissions` ONCE at the top of the server component, then pass `canReview` as a prop to the row (or to the client component that renders rows).

- [ ] **Step 9.3: Add the import + render**

In the row JSX:

```tsx
import { ChapterActivityBadges } from './_components/chapter-activity-badges'

// inside the row, near the chapter title:
<ChapterActivityBadges
  annotationCount={chapter.annotationCount}
  pendingSuggestionCount={chapter.pendingSuggestionCount}
  canReview={canReview}
/>
```

Adjust the prop accessors (`chapter.annotationCount`, etc) to match the row's actual variable name.

- [ ] **Step 9.4: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9.5: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/chapters/"
git commit -m "$(cat <<'EOF'
feat(hive/chapters): show activity badges on chapter index rows

Each row of /hive/[hiveId]/chapters now shows "N annotations" +
"M suggestions" badges beneath the title (hidden when zero). The
suggestion badge gets a brand-yellow accent for OWNER/MOD viewers
(canReviewSuggestion(role) === true) — hints that this is their
reviewer-queue surface.

Counts come from T3's getHiveChapterListAction extension.
ChapterActivityBadges (T8) handles all rendering. Server component
computes canReview once via canReviewSuggestion(viewerRole) and
threads it as a prop.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Delete /annotations route + drop sidebar entry

**Goal:** Standalone annotations page is gone. Sidebar trims to 10 entries.

**Files:**
- Delete: `app/[locale]/(app)/hive/[hiveId]/annotations/` (entire directory)
- Modify: `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx`

- [ ] **Step 10.1: Verify nothing else imports from the deleted directory**

```bash
grep -rn "hive/\[hiveId\]/annotations\|hive\.\\..annotations\\..page" app/ lib/ components/ 2>&1 | head
```

If any non-deleted file imports from that path, abort and report — there's a consumer we don't know about. Expected output: nothing matches outside the soon-to-be-deleted files themselves.

- [ ] **Step 10.2: Delete the directory**

```bash
git rm -r "app/[locale]/(app)/hive/[hiveId]/annotations"
```

- [ ] **Step 10.3: Drop the sidebar entry**

Open `app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx`. Find `NAV_ITEMS` (array of `{ label, icon, segment }` objects). Remove the line with `label: 'Annotations'`. Also drop the unused lucide icon import if it becomes unused (likely `StickyNote` per the existing sidebar wiring — verify by searching for the icon name after the deletion).

- [ ] **Step 10.4: Verify tsc clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If errors mention `StickyNote` or another removed icon import, drop the corresponding `import` line.

- [ ] **Step 10.5: Verify the deleted route returns 404**

(Manual after server restart — flag in the task report. Can't be verified at build time.)

- [ ] **Step 10.6: Commit**

```bash
git add "app/[locale]/(app)/hive/[hiveId]/_components/hive-sidebar.tsx"
git commit -m "$(cat <<'EOF'
feat(hive): delete /annotations standalone page; trim sidebar to 10

Per the hive-collab-ux-rework spec: annotations live with the prose.
The standalone /hive/[hiveId]/annotations page (a flat cross-chapter
digest) was the wrong mental model — every annotation is anchored to
a specific span in a specific chapter, and the chapter view's gutter
is the canonical surface.

Hive sidebar NAV_ITEMS drops the Annotations entry (11 → 10). The
StickyNote lucide import drops with it.

lib/actions/hive-annotations.actions.ts is preserved — it still
backs the gutter on the chapter view + the studio editor.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: AGENTS.md update + ship

**Goal:** Record the ship per the Working Agreement.

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 11.1: Update Resume Here block**

- Bump `Last updated`.
- Replace `Current focus` with the ship summary: T1-T10 shipped end-to-end via subagent-driven flow, lists task SHAs, summarizes decisions (auto-open gutter, metadata header, /annotations gone, badges on index), notes the patterns that became load-bearing.
- Update `Last commit` to the SHA of T10.
- Update `Next concrete step` to the 14-scenario smoke checklist from the spec.

- [ ] **Step 11.2: Add a new entry under "What Has Been Built"**

Headed "Hive Collaboration UX Rework". Include task SHAs and a paragraph-per-decision summary mirroring the existing reader-page redesign entry format.

- [ ] **Step 11.3: Verify tsc clean (defensive)**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 11.4: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): record hive collab UX rework ship (T1-T10)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

After plan completion:

1. **Spec coverage** — every spec section maps to a task:
   - Editor visibility model (studio auto-open + badge) → T4 + T5. Hive always-mounted gutter is preserved by NOT touching `hive-chapter-surface.tsx`'s existing gutter mount.
   - Hive chapter metadata header → T6 (component) + T7 (mount).
   - Sidebar + route restructure → T10.
   - Chapter index activity badges → T3 (data) + T8 (component) + T9 (mount).
   - Notes stays author-private → no task needed (explicit non-change).
   - Out-of-scope items confirmed not implemented (real-time, read/unread tracking, cross-chapter digest, notes sharing, /suggestions rename).

2. **Type consistency** — `ChapterStatus` used in T2 + T6 (imported from `@/lib/books/is-chapter-reader-visible`). `scenePlanner: { goal, conflict, outcome }` shape used in T2 + T6 + T7 — identical. `annotationCount` + `pendingSuggestionCount` field names identical across T1, T3, T4, T5, T9.

3. **No placeholders** — concrete code in every step. Helper functions (`safeString`, `pluralize`, `statusToken`) are spelled out. Edge cases (`activeChapter null`, hive-less book skip path, badge cap at "99+") are explicit.

4. **Known fragile spots** —
   - T4's `maybeAutoOpenGutter` references `setGutterOpen` and `setHistoryOpen` — the actual provider may use those names directly or wrap them in callbacks (`toggleGutter`). Task instructs the implementer to find the underlying setters; if the provider has only toggle helpers, the implementer adds the absolute setters they need.
   - T3's per-row chapter-id field name might be `id` instead of `chapterId` depending on the action's existing shape. Task acknowledges this with "replace with whatever the existing row uses."
   - T7's prop path (`data.chapter.synopsis` etc) might be `chapter.synopsis` directly. Task tells the implementer to check the existing JSX.

5. **Per-task commit cadence** — each task ends in one atomic commit. Matches Chris's per-task verification preference.

6. **Test posture** — surface-shape test added in T3. T1 + T2 don't add new tests because the existing test pattern (if any) would mock the same way, and these are additive changes. If the implementer finds an existing test for `getChapterAction` or `getHiveChapterView` that breaks because of the new fields, they should update the test (not assert "only these fields exist") — flagged in T1.8.

---
