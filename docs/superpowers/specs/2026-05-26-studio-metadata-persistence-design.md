# Studio Editor — Metadata + Persistence

**Date:** 2026-05-26
**Sub-project:** 5 of 6 (Studio Editor Audit)
**Status:** Approved — ready for implementation plan

## Context

The right-side metadata panel
(`app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`,
~340 lines) is the third pane of the studio's 3-column layout. It
shows per-chapter metadata — title, status, synopsis, scene planner,
word count, word goal, notes — plus book-wide publishing details.

Five usability issues emerged from prior audits and design critique:

- A. Save status + word count + word goal compete for space in the
  right panel when they're really *editor-state* concerns (Scrivener
  and Google Docs put them in a bottom bar).
- B. Six different save paths through the panel, none with a visible
  indicator. *(Triaged out — addressed implicitly by A.)*
- C. Word goal is stored in `localStorage` keyed by binder-item id —
  not synced across devices, lost on cache clear.
- D. Publishing details (subtitle, ISBN, publisher, dedication, etc.)
  is book-wide metadata but shown on every chapter's panel without
  any label clarifying its scope. Users edit it expecting it's
  per-chapter.
- E. Scene Planner (Goal / Conflict / Outcome) is shown for Front
  Matter and Back Matter items where it makes no narrative sense.

SP5 fixes A, C, D (label-only variant), and E. SP4's light-mode
plumbing (the React-injected `<style>` tag in
`corkboard-or-editor.tsx`) extends to cover the new bottom status bar.

## Goal

Move editor-state out of the metadata panel into a dedicated bottom
status bar; sync the word goal across devices via the database;
clarify which metadata is per-chapter vs. book-wide; hide irrelevant
sections on Front/Back Matter.

## In Scope

### 1. Bottom status bar in the editor

A new thin bar at the bottom of the editor pane, shown only for the
editable-prose item types (`chapter` / `front_matter` / `back_matter`).

**Component:** `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx`.

**Layout:** single horizontal bar:
- Border: `border-t border-border`
- Background: `bg-surface` (flips to light via SP4's `<style>` tag)
- Padding: `px-4 py-1.5`
- Height: ~28px

Content (left → right), separated by middle dots (`·`):
1. **Save status** — `● Saved` / `○ Saving…` / `● Unsaved` — reads
   from `useBookEditor().saveStatus`. Brand-yellow when unsaved.
2. **Word count** — `1,247 words` from
   `editor?.storage.characterCount.words()` (CharacterCount extension
   already installed). Uses `tabular-nums` so the bar doesn't shift
   on each keystroke.
3. **Word goal status** — `42% of 3,000 word goal [edit]` if goal is
   set; `Set word goal` link if not. Clicking `[edit]` (or the link)
   shows an inline number input + Save/Cancel buttons.

When the editor pane is too narrow (under ~600px) the goal section
collapses to just the percentage; word count + save status stay.

**Light-mode** flips via SP4's `<style>` tag in
`corkboard-or-editor.tsx`. Add a `data-slot="editor-status-bar"` on
the bar's outer div, then add rules to the `<style>` tag scoped to
`[data-editor-theme="light"] [data-slot="editor-status-bar"]`.

**Render location:** `<EditorStatusBar />` becomes the last child of
the `<main>` returned by `ChapterEditor` (after the editor content +
analysis panel). Inside the same `<main>` so light-mode covers it.
Only renders when `activeItem?.type` is in CHAPTER_TYPES — never on
research notes, outlines, characters, or the empty state.

### 2. Remove duplicates from the right panel

In `metadata-panel.tsx`, delete the existing "Words" display and
"Word Goal" sections. They're now in the bottom bar.

Also remove the save-status indicator that currently lives in the
toolbar (top-right of the editor). The bottom bar is the single
source of truth for save state. Two indicators in different places
is confusing.

The metadata panel after this change shows: title, status pills,
synopsis, scene planner (chapter-only — see §5), notes, publishing
details.

### 3. Word goal → DB column

**Schema change** in `db/schema/books.ts`:

```ts
export const chapters = pgTable('chapters', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  binderItemId: text('binder_item_id').references(() => binderItems.id, { onDelete: 'set null' }),
  content: jsonb('content'),
  wordCount: integer('word_count').default(0).notNull(),
  wordGoal: integer('word_goal').default(0).notNull(), // ← NEW
  status: chapterStatusEnum('status').default('FIRST_DRAFT').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, ...)
```

Run `npm run db:generate` then `npm run db:migrate`. Single new int
column with default 0 — safe migration on existing data.

**Read path:** `ChapterData` type in `lib/actions/chapter.actions.ts`
gains `wordGoal: number`. `getChapterAction` returns it; the provider's
`chapterCache` carries it.

**Write path:** new server action `updateChapterWordGoalAction` in
`lib/actions/chapter.actions.ts`:

```ts
export async function updateChapterWordGoalAction(
  chapterId: string,
  wordGoal: number,
): Promise<ActionResult>
```

Validates with `z.object({ wordGoal: z.number().int().min(0).max(1_000_000) })`.
Mirrors the existing `assertChapterOwner` authz pattern.

**Validation schema** in `lib/validations/book.ts`:

```ts
export const updateChapterWordGoalSchema = z.object({
  wordGoal: z.number().int().min(0).max(1_000_000),
})
```

### 4. localStorage → DB migration helper

When a chapter loads, if `chapter.wordGoal === 0` AND
`localStorage.getItem('wcg:' + binderItemId)` returns a positive integer,
migrate that value: write it to DB via the new action, then clear the
localStorage key. Idempotent — runs once per chapter per device, then
the localStorage key is gone.

**Helper** in `app/[locale]/(app)/studio/[bookId]/_components/editor/editor-status-bar.tsx`
(or pulled into a small `lib/word-goal-migration.ts` if it grows):

```ts
function migrateLegacyWordGoal(binderItemId: string, currentDbGoal: number): number | null
```

Returns the value to write to DB (and the helper handles
`localStorage.removeItem`), or null if no migration needed.

Three cases the unit test must cover:
- No localStorage entry → returns null
- Entry exists + currentDbGoal === 0 → returns the localStorage value, removes the key
- Entry exists + currentDbGoal > 0 → returns null (DB wins), but ALSO removes the localStorage key (stale data — clean up)

### 5. Publishing details: "applies to whole book" label

In `metadata-panel.tsx`'s `<PublishingSection>` collapsible header,
add a small one-line subtitle below the title text:

```tsx
<button onClick={handleExpand} ...>
  <div className="flex items-center gap-2">
    <span className="text-xs text-[#666]">{expanded ? '▾' : '▸'} Publishing details</span>
    <span className="...">Premium</span>
  </div>
  <span className="text-[10px] text-muted-foreground/70 ml-5 -mt-1">
    Applies to the whole book, not just this chapter
  </span>
  {saving && <span className="text-[9px] text-[#555]">Saving…</span>}
</button>
```

That's the only change to this section. Trivial.

### 6. Hide Scene Planner for non-chapter types

In `metadata-panel.tsx`'s `<ChapterMetadata>`, wrap the entire Scene
Planner block in a conditional:

```tsx
{activeItem?.type === 'chapter' && (
  <div className="flex flex-col gap-1.5">
    {/* Scene Planner button + Goal/Conflict/Outcome textareas */}
  </div>
)}
```

Front Matter / Back Matter items skip the section entirely. They go
straight from Synopsis to Notes.

## Out of Scope

- Unified save indicator inside the metadata panel (item B from
  triage) — redundant once the bottom bar lands.
- Moving Publishing details out of the chapter panel entirely (item
  D-i from triage) — bigger UX restructuring, defer.
- Reordering / regrouping the remaining metadata sections (title /
  status / synopsis / scene planner / notes).
- Visual polish on the bottom bar — Claude Design pass after SP6.
- Word goal celebrations / milestones / animations.
- Per-book word goal (book-level instead of chapter-level).
- Per-binder-item (non-chapter) word goals.
- Mobile / touch sizing for the bottom bar — SP6.
- Migration script for legacy localStorage word goals across all
  chapters (we migrate lazily on-load instead).

## Testing

### Automated (Vitest)

`__tests__/word-goal-migration.test.ts`:
- `migrateLegacyWordGoal('item-1', 0)` with NO localStorage entry → returns null
- `migrateLegacyWordGoal('item-1', 0)` with `localStorage['wcg:item-1'] = '5000'` → returns 5000, key removed afterward
- `migrateLegacyWordGoal('item-1', 2000)` with `localStorage['wcg:item-1'] = '5000'` → returns null (DB wins), key still removed
- `migrateLegacyWordGoal('item-1', 0)` with `localStorage['wcg:item-1'] = 'not-a-number'` → returns null
- `migrateLegacyWordGoal('item-1', 0)` with `localStorage['wcg:item-1'] = '0'` → returns null

Mock localStorage via vitest's standard approach (or a thin
wrapper around an in-memory Map for the test file).

### Manual checklist

1. Open a chapter. The editor pane shows the toolbar at top, prose
   in the middle, and a new thin status bar at the bottom reading
   `● Saved · N words · Set word goal`.
2. Right panel no longer shows "Words" or "Word Goal" sections.
3. Save indicator that used to be in the top-right of the toolbar is
   gone; bottom bar is the only place.
4. Click `Set word goal` in the bottom bar. Inline input appears.
   Enter `3000`. Save. Bar now reads `… · 0% of 3,000 word goal [edit]`.
5. Type some prose. Word count increments. Percentage tracks.
6. Reload the page → goal persists.
7. Open the same book in a private/incognito browser tab (or after
   clearing localStorage) → goal still shows.
8. Pre-existing user simulation: manually set
   `localStorage.setItem('wcg:<binderItemId>', '5000')` for a chapter
   whose DB `wordGoal` is 0. Reload that chapter. Bar should show
   `0% of 5,000 word goal` and the localStorage key should be gone.
9. View a Front Matter item — right panel shows title / status /
   synopsis / notes / publishing details. NO scene planner.
10. Open the Publishing details expander on any chapter — small
    subtitle "Applies to the whole book, not just this chapter" is
    visible.
11. Light-mode toggle (SP4) — bottom bar flips to light too. Status
    text and word count are readable on the light bg.
12. `npm test` clean (existing 113 + new migration helper tests).
13. `npx tsc --noEmit` clean.

## Risks

- **DB migration**: only one new column with a default, so existing
  rows get `0`. Safe. The migration runs via
  `npm run db:generate` + `npm run db:migrate` (or `db:push` for dev).
  Verify no other schema drift before running.
- **Migration helper edge case**: if a user has localStorage values
  across multiple browsers AND has been setting goals in each
  independently, the first browser to load after this feature ships
  wins. Other browsers' values get discarded. Acceptable trade — they
  were never synced anyway, and the user can re-set the goal.
- **Word goal at 0 vs. unset**: the schema default is 0, which the UI
  treats as "no goal set" (shows `Set word goal` link). A user can't
  meaningfully set a goal of literally 0. The Zod schema allows 0 so
  the UI can clear the goal by setting it back to 0.
- **Status bar height** (~28px) eats a little editor vertical real
  estate. With SP4's `h-[calc(100vh-56px)]` plus toolbar (~36px) plus
  status bar (~28px), the editor has ~viewport-120px to render prose.
  Acceptable.
- **No toolbar save indicator** after removal — users who looked
  there will look there again briefly. Mitigate via tooltip on the
  bottom bar's save status: hover shows "All edits autosave".

## Definition of Done

- Schema migration applied; `chapters.wordGoal` exists with default 0.
- Bottom status bar rendered on chapter / front_matter / back_matter;
  not rendered on other types.
- Save status + word count + word goal all live in the bottom bar.
  Right panel no longer shows them. Toolbar's old save indicator gone.
- Word goal reads from / writes to DB via the new server action.
  localStorage migration helper ports legacy values lazily on chapter
  load.
- Publishing details expander shows the "applies to the whole book"
  subtitle.
- Scene Planner only renders for `type === 'chapter'`.
- All 13 manual checklist items pass.
- `npm test` clean (~117 with new migration tests).
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here block reflects SP5 complete, points to SP6
  as next.
