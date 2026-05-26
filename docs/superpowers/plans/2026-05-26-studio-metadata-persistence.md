# Studio Metadata + Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom status bar to the editor; sync the word goal across devices via a new DB column; clarify publishing-details scope; hide Scene Planner on Front/Back Matter.

**Architecture:** One new int column on `chapters` (`wordGoal`). One new server action. One new component (`EditorStatusBar`). One new pure helper (`migrateLegacyWordGoal`). Two trivial edits in the metadata panel. Light-mode flips via SP4's existing `<style>` tag in `corkboard-or-editor.tsx`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Postgres (Neon), Vitest, TipTap CharacterCount extension.

**Spec:** [`docs/superpowers/specs/2026-05-26-studio-metadata-persistence-design.md`](../specs/2026-05-26-studio-metadata-persistence-design.md)

---

## File Structure

**Create:**
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx` — the bottom bar
- `lib/word-goal-migration.ts` — pure helper for `migrateLegacyWordGoal`
- `__tests__/word-goal-migration.test.ts` — Vitest unit tests

**Modify:**
- `db/schema/books.ts` — add `wordGoal` column to `chapters`
- `lib/validations/book.ts` — add `updateChapterWordGoalSchema`
- `lib/actions/chapter.actions.ts` — add `updateChapterWordGoalAction`, extend `ChapterData` type, return `wordGoal` from `getChapterAction` + `saveChapterAction`
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — render `EditorStatusBar` at the bottom of the chapter-render path's `<main>`
- `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx` — remove the save-status + word-count spans from the Status zone (becomes empty / collapsed)
- `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx` — remove "Words" and "Word Goal" sections; add publishing-details subtitle; conditional Scene Planner
- `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` — extend the existing `<style>` tag with `[data-slot="editor-status-bar"]` rules

**Database:**
- Run `npm run db:generate` to create a migration file.
- Run `npm run db:migrate` to apply.

---

## Task 1: DB schema + server action + ChapterData extension

**Files:**
- Modify: `db/schema/books.ts`
- Modify: `lib/validations/book.ts`
- Modify: `lib/actions/chapter.actions.ts`
- Generate + apply Drizzle migration

- [ ] **Step 1: Add the column to the schema**

In `db/schema/books.ts`, find the `chapters` table definition. Add `wordGoal` right after `wordCount`:

```ts
export const chapters = pgTable('chapters', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  binderItemId: text('binder_item_id').references(() => binderItems.id, { onDelete: 'set null' }),
  content: jsonb('content'),
  wordCount: integer('word_count').default(0).notNull(),
  wordGoal: integer('word_goal').default(0).notNull(),   // ← NEW
  status: chapterStatusEnum('status').default('FIRST_DRAFT').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('chapters_book_id_idx').on(t.bookId)])
```

- [ ] **Step 2: Add the validation schema**

In `lib/validations/book.ts`, append:

```ts
export const updateChapterWordGoalSchema = z.object({
  wordGoal: z.number().int().min(0).max(1_000_000),
})
```

- [ ] **Step 3: Extend ChapterData and add the server action**

In `lib/actions/chapter.actions.ts`:

a. Add `wordGoal` to the `ChapterData` type:
```ts
export type ChapterData = {
  id: string
  bookId: string
  binderItemId: string | null
  content: unknown
  wordCount: number
  wordGoal: number                  // ← NEW
  status: 'IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL'
  notes: string | null
  createdAt: Date
  updatedAt: Date
}
```

b. Update `getChapterAction` to return `wordGoal: chapter.wordGoal` in its data object.

c. Add the new action at the bottom of the file:

```ts
/**
 * Updates the chapter's word goal (per-chapter writing target).
 * 0 means "no goal set"; max enforced at 1,000,000.
 */
export async function updateChapterWordGoalAction(
  chapterId: string,
  wordGoal: number,
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateChapterWordGoalSchema.safeParse({ wordGoal })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertChapterOwner(chapterId, userId)

  await db
    .update(chapters)
    .set({ wordGoal: parsed.data.wordGoal, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId))

  return { success: true, data: undefined }
}
```

Add the `updateChapterWordGoalSchema` to the imports at the top of the file (alongside the existing `updateChapterNotesSchema` and `chapterStatusSchema` imports).

- [ ] **Step 4: Generate + apply the migration**

```bash
npm run db:generate
```

Expect a new migration file under `drizzle/` (or wherever the project's migrations live). Read it briefly to confirm it only adds the column with default 0.

```bash
npm run db:migrate
```

If the project uses `db:push` instead for dev, use that. Confirm by checking `package.json` and choosing whichever is established for this environment.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 113 (the migration helper tests land in Task 2).

- [ ] **Step 6: Commit**

```bash
git add db/ lib/ drizzle/ 2>/dev/null || git add db/ lib/
git commit -m "feat(studio): chapters.wordGoal column + server action (SP5 Task 1)

Adds an int column 'word_goal' on the chapters table with default 0.
Existing rows backfill to 0 (= 'no goal set').

ChapterData type gains 'wordGoal: number'. getChapterAction returns
it. New updateChapterWordGoalAction validates 0..1,000,000 via Zod
and writes via the standard assertChapterOwner authz path.

The bottom status bar (Task 3) will read/write this via the
provider's chapterCache and the new action."
```

---

## Task 2: Word-goal migration helper + Vitest unit tests (TDD)

**Files:**
- Create: `lib/word-goal-migration.ts`
- Create: `__tests__/word-goal-migration.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `__tests__/word-goal-migration.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { migrateLegacyWordGoal } from '@/lib/word-goal-migration'

describe('migrateLegacyWordGoal', () => {
  // In-memory localStorage mock so each test starts clean
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: () => null,
      length: 0,
    })
  })

  it('returns null when no localStorage entry exists', () => {
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })

  it('returns the localStorage value when DB goal is 0 and key exists', () => {
    localStorage.setItem('wcg:item-1', '5000')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(5000)
    expect(localStorage.getItem('wcg:item-1')).toBe(null)
  })

  it('returns null and clears stale localStorage when DB goal is already set', () => {
    localStorage.setItem('wcg:item-1', '5000')
    expect(migrateLegacyWordGoal('item-1', 2000)).toBe(null)
    expect(localStorage.getItem('wcg:item-1')).toBe(null)
  })

  it('returns null when the localStorage value is not a valid number', () => {
    localStorage.setItem('wcg:item-1', 'not-a-number')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })

  it('returns null when the localStorage value is "0"', () => {
    localStorage.setItem('wcg:item-1', '0')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })

  it('returns null when the localStorage value is negative', () => {
    localStorage.setItem('wcg:item-1', '-100')
    expect(migrateLegacyWordGoal('item-1', 0)).toBe(null)
  })
})
```

Run:
```bash
npm test -- word-goal-migration
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement the helper**

Create `lib/word-goal-migration.ts`:

```ts
/**
 * One-shot migration of pre-SP5 word goals from localStorage to DB.
 *
 * Before SP5, word goals were stored in localStorage keyed as
 * `wcg:<binderItemId>`. SP5 moved them to chapters.wordGoal so they
 * sync across devices. On chapter load, we check whether a localStorage
 * value should be ported to the DB.
 *
 * Returns:
 *   - The value to write to DB if migration is needed (caller invokes
 *     updateChapterWordGoalAction with the returned number).
 *   - null if no migration is needed.
 *
 * In all cases where a localStorage key exists, it is removed — even
 * if the DB already has a value (the localStorage value is now stale
 * and cleanup keeps the user's storage tidy).
 *
 * Safe to call multiple times: idempotent because removing the key
 * makes subsequent calls return null.
 */
export function migrateLegacyWordGoal(
  binderItemId: string,
  currentDbGoal: number,
): number | null {
  if (typeof window === 'undefined') return null

  const key = `wcg:${binderItemId}`
  const raw = localStorage.getItem(key)
  if (raw === null) return null

  // Stale key cleanup — happens whether we migrate or not.
  localStorage.removeItem(key)

  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null

  // DB already has a non-zero goal — that wins. Don't overwrite.
  if (currentDbGoal > 0) return null

  return parsed
}
```

Run:
```bash
npm test -- word-goal-migration
```

Expected: all 6 cases pass.

- [ ] **Step 3: Full sweep + commit**

```bash
npx tsc --noEmit
npm test
```

Total tests 113 + 6 = 119.

```bash
git add lib/word-goal-migration.ts "__tests__/word-goal-migration.test.ts"
git commit -m "feat(studio): localStorage→DB word-goal migration helper + tests (SP5 Task 2)

Pure helper that runs on chapter load: if a legacy localStorage key
exists for the chapter's binder-item id and the DB goal is 0, returns
the localStorage value for the caller to write to DB. Always cleans
up the stale localStorage key, even when the DB already has a value.

Vitest tests cover no-key, valid value, stale value with DB set,
non-numeric value, zero value, negative value. localStorage mocked
via vi.stubGlobal."
```

---

## Task 3: EditorStatusBar component

**File:**
- Create: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { CharacterCountStorage } from '@tiptap/extensions'
import { cn } from '@/lib/utils'
import { useBookEditor } from '../book-editor-provider'
import { updateChapterWordGoalAction } from '@/lib/actions/chapter.actions'
import { migrateLegacyWordGoal } from '@/lib/word-goal-migration'

type Props = { editor: Editor }

export function EditorStatusBar({ editor }: Props) {
  const { saveStatus, activeChapter, activeItem } = useBookEditor()
  const [wordGoal, setWordGoal] = useState<number>(activeChapter?.wordGoal ?? 0)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local state when the active chapter changes
  useEffect(() => {
    setWordGoal(activeChapter?.wordGoal ?? 0)
  }, [activeChapter?.id, activeChapter?.wordGoal])

  // Lazy localStorage→DB migration. Runs once per chapter per device.
  useEffect(() => {
    if (!activeChapter || !activeItem) return
    const migrated = migrateLegacyWordGoal(activeItem.id, activeChapter.wordGoal)
    if (migrated !== null) {
      setWordGoal(migrated)
      void updateChapterWordGoalAction(activeChapter.id, migrated)
    }
  }, [activeChapter?.id, activeChapter?.wordGoal, activeItem])

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const charCount = editor.storage.characterCount as CharacterCountStorage | undefined
  const wordCount = charCount?.words() ?? 0
  const percent = wordGoal > 0 ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : 0

  async function commit() {
    if (!activeChapter) return
    const raw = inputRef.current?.value ?? '0'
    const next = Math.max(0, Math.min(1_000_000, parseInt(raw, 10) || 0))
    setEditing(false)
    if (next === wordGoal) return
    setWordGoal(next) // optimistic
    const result = await updateChapterWordGoalAction(activeChapter.id, next)
    if (!result.success) {
      // Revert on failure
      setWordGoal(activeChapter.wordGoal)
    }
  }

  return (
    <div
      data-slot="editor-status-bar"
      className="flex items-center justify-between gap-3 px-4 py-1.5 border-t border-border bg-surface text-xs text-foreground/60 tabular-nums"
    >
      <div className="flex items-center gap-3">
        {/* Save status */}
        <span
          className={cn(
            'inline-flex items-center gap-1',
            saveStatus === 'unsaved' && 'text-brand',
            saveStatus === 'saving' && 'text-foreground/40 animate-pulse',
          )}
          title="All edits autosave"
        >
          {saveStatus === 'saved' && '● Saved'}
          {saveStatus === 'saving' && '○ Saving…'}
          {saveStatus === 'unsaved' && '● Unsaved'}
        </span>

        <span className="text-foreground/30">·</span>

        {/* Word count */}
        <span>{wordCount.toLocaleString()} words</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Word goal */}
        {editing ? (
          <>
            <input
              ref={inputRef}
              type="number"
              min={0}
              max={1_000_000}
              defaultValue={wordGoal}
              className="w-20 bg-surface-inset border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none focus:border-brand/40"
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <button
              onClick={commit}
              className="text-xs text-brand hover:text-brand-hover"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </>
        ) : wordGoal > 0 ? (
          <>
            <span>{percent}% of {wordGoal.toLocaleString()} word goal</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              edit
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Set word goal
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx"
git commit -m "feat(studio): EditorStatusBar component (SP5 Task 3)

New thin bar to live at the bottom of the editor pane. Reads
saveStatus from useBookEditor, word count from
editor.storage.characterCount, and word goal from
activeChapter.wordGoal.

Inline edit for the word goal: click 'Set word goal' (or 'edit') →
number input + Save/Cancel buttons. Enter commits, Escape cancels.
Optimistic local state with rollback on server failure.

Lazy localStorage→DB migration runs once per chapter on mount via
the helper from Task 2. Carries SP3-B's save-status semantics
('● Saved' / '○ Saving…' / '● Unsaved') with brand-yellow when unsaved.

Not wired into chapter-editor yet — Task 4 does that."
```

---

## Task 4: Wire status bar + remove duplicates from toolbar/metadata-panel

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-toolbar.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/corkboard-or-editor.tsx` — extend `<style>` tag

- [ ] **Step 1: Render EditorStatusBar in chapter-editor**

In `chapter-editor.tsx`, add the import at the top:
```tsx
import { EditorStatusBar } from './editor-status-bar'
```

Find the chapter-render path's `<main>` block (the one with `className="flex-1 flex flex-col overflow-hidden relative"`). It currently looks roughly:
```tsx
<main className="flex-1 flex flex-col overflow-hidden relative">
  {editor && <EditorToolbar ... />}
  {findOpen && editor && <FindReplace ... />}
  <div className="flex flex-1 overflow-hidden">
    <div ref={editorContainerRef} ...>
      <EditorContent ... />
    </div>
    {analysisOpen && <WritingAnalysis ... />}
  </div>
  <SprintTimer ... />
</main>
```

Add `<EditorStatusBar editor={editor} />` after the `<div className="flex flex-1 overflow-hidden">` block, just before `<SprintTimer />`:

```tsx
{editor && <EditorStatusBar editor={editor} />}
<SprintTimer ... />
```

Only render when `editor` exists (avoid null editor on cache miss).

- [ ] **Step 2: Remove the save-status + word-count spans from the toolbar**

In `editor-toolbar.tsx`, find the STATUS zone (the `<span data-slot="editor-status">` block). DELETE it entirely. The toolbar's three-zone layout becomes effectively two-zone (Format + View) — the single `flex-1` spacer between them stays.

While there, remove `saveStatus`, `wordCount` from the `useBookEditor()` destructure (no longer used in this file). Also remove the `charCount` access if it's only used by the now-deleted span — confirm with a quick grep.

Update the corresponding light-mode CSS in `corkboard-or-editor.tsx`'s `<style>` tag — remove the two rules targeting `[data-slot="editor-status"]` (they target a no-longer-rendered element).

- [ ] **Step 3: Remove the "Words" and "Word Goal" sections from metadata-panel**

In `metadata-panel.tsx`'s `<ChapterMetadata>`, find and delete:
- The block rendering `{wordCount > 0 && (...)` for the Words display
- The entire block rendering the Word Goal — the `<div>` containing the input, progress bar, and label

Remove the corresponding `wordGoal` localStorage state at the top of `<ChapterMetadata>` (no longer needed; the bottom bar owns word goal now).

- [ ] **Step 4: Add light-mode CSS for the status bar**

In `corkboard-or-editor.tsx`'s `<style>` tag, add rules alongside the existing ones:

```css
[data-editor-theme="light"] [data-slot="editor-status-bar"] {
  background-color: #f4f4ee;
  border-top-color: #e0e0d8;
  color: rgba(26, 26, 26, 0.7);
}
[data-editor-theme="light"] [data-slot="editor-status-bar"] button {
  color: rgba(26, 26, 26, 0.7);
}
[data-editor-theme="light"] [data-slot="editor-status-bar"] button:hover {
  color: #1a1a1a;
}
[data-editor-theme="light"] [data-slot="editor-status-bar"] input {
  background-color: #fcfcfa;
  border-color: #d0d0c8;
  color: #1a1a1a;
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 119 (Task 2's migration helper tests).

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/"
git commit -m "feat(studio): wire status bar + remove duplicates from toolbar & panel (SP5 Task 4)

EditorStatusBar now renders at the bottom of the chapter-editor's
<main>, between the editor body and the SprintTimer. Single source
of truth for save status, word count, and word goal.

Removed from the toolbar:
- The 'STATUS zone' span (save indicator + word count)
- saveStatus/wordCount usage in editor-toolbar.tsx
- The light-mode CSS rules for [data-slot='editor-status']

Removed from metadata-panel.tsx:
- The 'Words' display section
- The entire 'Word Goal' section (input + progress bar + localStorage)
- The wordGoal local state and related helpers

Added light-mode CSS for [data-slot='editor-status-bar'] in the
corkboard-or-editor <style> tag — flips bar background, text colors,
button colors, and the inline-edit input to match light theme."
```

---

## Task 5: Publishing-details label + Scene Planner conditional

**File:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`

Both changes are trivial; combining into one commit.

- [ ] **Step 1: Add "applies to the whole book" subtitle**

Read `metadata-panel.tsx`. Find the `<PublishingSection>` component's collapse button. It currently has a header line with the title + Premium badge. Restructure to add a subtitle below:

```tsx
<button
  onClick={handleExpand}
  className="flex w-full items-start justify-between px-4 py-3 text-left hover:bg-[#1a1a1a] transition-colors"
>
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#666]">
        {expanded ? '▾' : '▸'} Publishing details
      </span>
      <span className="rounded-sm bg-[#1f1a00] px-1.5 py-0.5 text-[9px] font-semibold text-[#FFC300] border border-[#3a2e00]">
        Premium
      </span>
    </div>
    <span className="text-[10px] text-muted-foreground/70 ml-5">
      Applies to the whole book, not just this chapter
    </span>
  </div>
  {saving && <span className="text-[9px] text-[#555]">Saving…</span>}
</button>
```

(The structural change: header div now has `flex-col gap-0.5`, with the title row and subtitle row stacked. The Saving indicator stays on the right via the outer button's `justify-between`.)

- [ ] **Step 2: Hide Scene Planner for non-chapter types**

In the same file, find the Scene Planner block — the `<div>` containing the toggleable "Scene Planner" button and the Goal/Conflict/Outcome textareas. Wrap the entire block in a conditional:

```tsx
{activeItem?.type === 'chapter' && (
  <div className="flex flex-col gap-1.5">
    {/* Scene Planner button + collapsible content */}
  </div>
)}
```

Front Matter and Back Matter items will skip the section entirely.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
npm test
```

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx"
git commit -m "feat(studio): publishing-details scope label + Scene Planner only on chapters (SP5 Task 5)

Two small UX clarifications in the metadata panel:

1. Publishing details expander now shows a small subtitle:
   'Applies to the whole book, not just this chapter'. Users were
   editing per-chapter expecting each chapter's publishing data
   was independent — this clarifies it's book-wide.

2. Scene Planner (Goal / Conflict / Outcome) is hidden when
   activeItem.type !== 'chapter'. Front Matter and Back Matter
   items now go straight from Synopsis to Notes — no more confusing
   scene-structure prompts on a copyright page or acknowledgments."
```

---

## Task 6: Final verification + Resume Here

- [ ] **Step 1: Manual checklist** (from spec §Testing)

1. Open a chapter. The editor pane shows the toolbar at top, prose in the middle, and a new thin status bar at the bottom reading `● Saved · N words · Set word goal`.
2. Right panel no longer shows "Words" or "Word Goal" sections.
3. Save indicator that used to be in the top-right of the toolbar is gone; bottom bar is the only place.
4. Click `Set word goal` in the bottom bar. Inline input + Save/Cancel appear. Enter `3000`, click Save. Bar now reads `… · 0% of 3,000 word goal [edit]`.
5. Type some prose. Word count increments. Percentage tracks.
6. Reload the page → goal persists.
7. Open the same book in a private/incognito browser tab → goal still shows (proves DB sync).
8. Pre-existing user simulation: manually set `localStorage.setItem('wcg:<binderItemId>', '5000')` for a chapter whose DB `wordGoal` is 0. Reload that chapter. Bar should show `0% of 5,000 word goal` and the localStorage key should be gone.
9. View a Front Matter item — right panel shows title / status / synopsis / notes / publishing details. NO scene planner.
10. Open the Publishing details expander on any chapter — small subtitle "Applies to the whole book, not just this chapter" is visible.
11. Light-mode toggle (SP4) — bottom bar flips to light too. Status text + word count + word goal all readable on the light bg.
12. `npm test` clean (119 tests with the migration helper).
13. `npx tsc --noEmit` clean.

If any test fails, fix before proceeding to Step 2.

- [ ] **Step 2: Update AGENTS.md Resume Here**

Replace the Resume Here block to mark SP5 complete and point at SP6:

```markdown
> **Last updated:** <today YYYY-MM-DD>
>
> **Current focus:** SP6 New surfaces — not started
> **Active branch:** `main` (pushed to origin/main)
> **Last commit:** <git log -1 --format=%s>
>
> 1. ~~SP1 Stability~~ DONE.
> 2. ~~SP2 Binder UX~~ DONE.
> 3. ~~SP3 Specialized Editors~~ DONE.
> 4. ~~SP4 Toolbar + modes~~ DONE.
> 5. ~~SP5 Metadata + persistence~~ DONE — bottom status bar (save / word count / word goal), word goal moved to DB column, publishing-details scope label, Scene Planner hidden on Front/Back Matter.
> 6. **SP6 New surfaces (NEXT)** — Snapshot UI, mobile/tablet responsive, accessibility audit (aria-labels, contrast, ? keyboard cheatsheet).
>
> After SP6: Claude Design redesigns visually, mechanical import. Then Phase 8 (Stripe monetization) resumes.
>
> **Next concrete step when resuming:** invoke `/brainstorming` for SP6 (New surfaces).
```

- [ ] **Step 3: Commit AGENTS.md + push**

```bash
git add AGENTS.md
git commit -m "docs: close SP5 Metadata + persistence, point Resume Here at SP6"
git push origin main
```

---

## Definition of Done

- DB migration applied; `chapters.wordGoal` column exists with default 0.
- Bottom status bar renders on chapter / front_matter / back_matter.
- Word goal reads from / writes to DB. Lazy localStorage migration ports legacy values.
- Publishing-details subtitle visible.
- Scene Planner hidden on Front/Back Matter.
- All 13 manual checklist items pass.
- `npm test` clean (~119).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here reflects SP5 complete, SP6 next.
- ~6 atomic commits on `main`, pushed to origin.
