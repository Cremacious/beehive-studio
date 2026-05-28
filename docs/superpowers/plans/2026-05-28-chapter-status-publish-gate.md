# Chapter Status — Publish-Readiness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chapter status becomes the publish-readiness gate. Chapters at `REVISED` or `FINAL` render to readers; everything below shows a "Draft — coming soon" locked teaser. Author always sees everything. Visible chapters get an "Updated MMM DD, YYYY" freshness label. Binder + metadata panel get author-side surfaces so the gate's behavior is visible at all the points the author already looks.

**Architecture:** Pure `isChapterReaderVisible(status)` helper centralizes the threshold. Reader chapter list and chapter reader page both call it when the viewer is not the author. Author surfaces add a small binder color dot per chapter row + explanatory paragraph and per-pill subtitles in the metadata Status section. No schema or server-action shape changes — `chapters.status` and `chapters.updatedAt` both exist already; chapter projections may need to add the fields to their selects.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Drizzle ORM (read-only changes), vitest.

**Spec:** [docs/superpowers/specs/2026-05-28-chapter-status-publish-gate-design.md](../specs/2026-05-28-chapter-status-publish-gate-design.md)

**Pre-flight findings (from spec-phase audit):**
- `chapters.status` is a `pgEnum` with the 5 values; `chapters.updatedAt` is a `timestamp` with default `now()`.
- `chapter-list.tsx` (the shared `(public)/_components` version) takes `chapters: ChapterItem[]` where `ChapterItem` is `{ binderItemId, chapterId, title, wordCount, order }` — no status or updatedAt yet. Need to widen.
- The book reader page (`books/[bookId]/page.tsx`) currently selects `chapterId, binderItemId, title, wordCount, order` from a join of `binderItems` + `chapters`. Add `status` and `updatedAt` to the select.
- `metadata-panel.tsx` already maps `STATUS_OPTIONS` (line 17) — extend with `description` or render the subtitle alongside.
- `binder-item.tsx` already imports `useBookEditor` — chapter `status` is on `activeChapter` for the active item only. For binder dots we need EVERY chapter's status, which means we need a per-chapter status lookup. Investigate during Task 5: either thread chapter statuses into the existing `binderItems` context, or expose a `chaptersByBinderItemId` map from the provider.

---

### Task 1: `isChapterReaderVisible` helper + unit tests

**Files:**
- Create: `lib/books/is-chapter-reader-visible.ts`
- Create: `lib/books/__tests__/is-chapter-reader-visible.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { isChapterReaderVisible, type ChapterStatus } from '../is-chapter-reader-visible'

describe('isChapterReaderVisible', () => {
  it('REVISED is visible', () => {
    expect(isChapterReaderVisible('REVISED')).toBe(true)
  })
  it('FINAL is visible', () => {
    expect(isChapterReaderVisible('FINAL')).toBe(true)
  })
  it('IDEA is not visible', () => {
    expect(isChapterReaderVisible('IDEA')).toBe(false)
  })
  it('OUTLINE is not visible', () => {
    expect(isChapterReaderVisible('OUTLINE')).toBe(false)
  })
  it('FIRST_DRAFT is not visible', () => {
    expect(isChapterReaderVisible('FIRST_DRAFT')).toBe(false)
  })
})
```

Run: `npm test -- is-chapter-reader-visible`. Expected: FAIL ("Cannot find module").

- [ ] **Step 2: Implement**

```ts
export type ChapterStatus =
  | 'IDEA'
  | 'OUTLINE'
  | 'FIRST_DRAFT'
  | 'REVISED'
  | 'FINAL'

/**
 * Returns true if a non-author viewer of the public reader can read the
 * chapter's prose. Chapters at this threshold (REVISED or FINAL) render
 * fully; everything below renders as a "Draft — coming soon" locked teaser.
 *
 * The author of the book is always able to read every chapter regardless;
 * callers gate by viewer identity BEFORE calling this helper.
 */
export function isChapterReaderVisible(status: ChapterStatus): boolean {
  return status === 'REVISED' || status === 'FINAL'
}
```

- [ ] **Step 3: Run tests + tsc**

`npm test -- is-chapter-reader-visible && npx tsc --noEmit`
Expected: 5 tests pass, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add lib/books/is-chapter-reader-visible.ts lib/books/__tests__/is-chapter-reader-visible.test.ts
git commit -m "feat(books): isChapterReaderVisible helper + tests"
```

---

### Task 2: Thread status + updatedAt through the book reader page

**Files:**
- Modify: `app/[locale]/(public)/books/[bookId]/page.tsx`

- [ ] **Step 1: Add `status` + `updatedAt` to the chapter projection**

Locate the `db.select({...}).from(binderItems).innerJoin(chapters, ...)` query in the book reader page. Extend the select object:

```ts
const chapterRows = await db
  .select({
    binderItemId: binderItems.id,
    chapterId: chapters.id,
    title: binderItems.title,
    wordCount: chapters.wordCount,
    order: binderItems.order,
    status: chapters.status,        // NEW
    updatedAt: chapters.updatedAt,  // NEW
  })
  .from(binderItems)
  .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
  .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
  .orderBy(asc(binderItems.order))
```

- [ ] **Step 2: Compute `isAuthor`**

After the existing `userId = session?.user?.id ?? null` line, add (or use existing):

```ts
const isAuthor = userId === book.authorUserId
```

(Reuse the variable if already defined — verify during implementation.)

- [ ] **Step 3: Pass through to ChapterList**

Update the `<ChapterList ... />` render call:

```tsx
<ChapterList
  bookId={bookId}
  locale={locale}
  readerBasePath={readerBasePath}
  chapters={normalizedChapterRows}
  currentChapterId={progress?.lastChapterId ?? null}
  readChapterBinderItemIds={progress?.readChapterBinderItemIds ?? []}
  isAuthor={isAuthor}
/>
```

`normalizedChapterRows` will need its mapping updated to preserve `status` + `updatedAt` (they pass through unchanged — just ensure they're not stripped).

Note the `getNextChapter` / `Start Reading` / `Continue Reading` button logic at the top of the page — it currently picks the first chapter or last-read. After this change, those should target only reader-visible chapters when the viewer is not the author. Defer the smart-CTA fix to Task 3 or this same task — implementer's call, but keep the buttons working (don't link to a locked chapter from the hero). Simplest: when computing `lastReadChapter` and "Start Reading" target, filter to chapters where `isChapterReaderVisible(ch.status)` for non-authors.

- [ ] **Step 4: Run tsc**

`npx tsc --noEmit`
Expected: clean (ChapterList prop change will surface as a tsc error here if Task 3 isn't done yet — that's OK, Task 3 lands the matching props next).

Actually: TypeScript will complain about the new `isAuthor` prop NOT existing on ChapterList until Task 3. To keep this task standalone-committable, do Task 2 + Task 3 changes in one editing pass before tsc-check, then split into two commits. OR: just stage both, run tsc once at the end of Task 3, and commit both. Implementer's call. Note that the spec calls these out as separate tasks; if doing it as one commit ends up simpler, that's fine — explain in the commit body.

- [ ] **Step 5: Commit (after Task 3, OR as a single combined commit)**

If splitting:
```bash
git add "app/[locale]/(public)/books/[bookId]/page.tsx"
git commit -m "feat(reader): thread chapter status + updatedAt to ChapterList"
```

---

### Task 3: ChapterList — gate by status, render locked badge + freshness label

**Files:**
- Modify: `app/[locale]/(public)/_components/chapter-list.tsx`

- [ ] **Step 1: Widen the `ChapterItem` type**

```ts
type ChapterStatus = 'IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  wordCount: number
  order: number
  status: ChapterStatus
  updatedAt: Date
}

type Props = {
  bookId: string
  locale: string
  readerBasePath: string
  chapters: ChapterItem[]
  currentChapterId: string | null
  readChapterBinderItemIds: string[]
  isAuthor: boolean
}
```

- [ ] **Step 2: Import the helper**

```ts
import { isChapterReaderVisible } from '@/lib/books/is-chapter-reader-visible'
```

- [ ] **Step 3: Render gated chapters**

Inside the map, replace the chapter render block with branched logic:

```tsx
{visibleChapters.map((ch, i) => {
  const isRead = readChapterBinderItemIds.includes(ch.binderItemId)
  const isCurrent = currentChapterId === ch.chapterId
  const isVisible = isAuthor || isChapterReaderVisible(ch.status)

  if (!isVisible) {
    return (
      <div
        key={ch.chapterId}
        className="flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] cursor-not-allowed opacity-70"
      >
        <span className="text-[#555] text-[11px] w-5 shrink-0">{i + 1}</span>
        <span className="text-[#666] flex-1 truncate italic">{ch.title}</span>
        <span className="text-[#888] text-[10px] shrink-0 uppercase tracking-wider">
          Draft — coming soon
        </span>
      </div>
    )
  }

  const updatedLabel = formatUpdatedLabel(ch.updatedAt)

  return (
    <Link
      key={ch.chapterId}
      href={`${readerBasePath}/read/${ch.chapterId}`}
      className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
        isCurrent ? 'bg-[#1e1e1e]' : 'hover:bg-[#1a1a1a]'
      }`}
    >
      <span className="text-[#555] text-[11px] w-5 shrink-0">{i + 1}</span>
      <span className="text-[#aaa] flex-1 truncate">{ch.title}</span>
      <span className="text-[#555] text-[11px] shrink-0">
        {ch.wordCount >= 1000 ? `${Math.round(ch.wordCount / 1000)}k` : ch.wordCount}w
      </span>
      {updatedLabel && (
        <span className="text-[#555] text-[10px] shrink-0 hidden sm:inline">
          Updated {updatedLabel}
        </span>
      )}
      {isRead && <span className="text-[#FFC300] text-[10px] shrink-0">✓ Read</span>}
      {isCurrent && !isRead && <span className="text-[#888] text-[10px] shrink-0">Reading</span>}
    </Link>
  )
})}
```

Add the `formatUpdatedLabel` helper near the top of the file (or above the component):

```ts
function formatUpdatedLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
```

- [ ] **Step 4: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean (Task 2's reader-page changes now line up with the new ChapterList props).

- [ ] **Step 5: Commit**

If doing Task 2 + Task 3 together:
```bash
git add "app/[locale]/(public)/books/[bookId]/page.tsx" "app/[locale]/(public)/_components/chapter-list.tsx"
git commit -m "feat(reader): gate chapter list by status; show Updated label on visible chapters"
```

If separate from Task 2:
```bash
git add "app/[locale]/(public)/_components/chapter-list.tsx"
git commit -m "feat(reader): ChapterList gates by status; locked badge + Updated label"
```

---

### Task 4: Chapter reader page — locked placeholder for non-visible chapters

**Files:**
- Modify: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx`

- [ ] **Step 1: Add the import + author check**

After the existing `canReadBook` gate (the page already imports it from Task 8 of the SP-A epic), add the chapter-status check.

```ts
import { isChapterReaderVisible } from '@/lib/books/is-chapter-reader-visible'

// ... after existing canReadBook gate ...

// Pull the chapter's status from its existing chapter query in the file.
// If the page already does `db.select(...).from(chapters).where(eq(chapters.id, chapterId))`,
// add `status: chapters.status` to the select.

const isAuthor = userId === book.userId  // or however book ownership is exposed in this file

if (!isAuthor && !isChapterReaderVisible(chapter.status)) {
  return <LockedChapterPlaceholder bookId={bookId} locale={locale} />
}
```

- [ ] **Step 2: Add the locked placeholder component**

At the bottom of the same file (or as a sibling import — implementer's call):

```tsx
function LockedChapterPlaceholder({ bookId, locale }: { bookId: string; locale: string }) {
  return (
    <main className="min-h-screen bg-[#141414] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center mb-5">
          {/* lucide BookLock or similar */}
        </div>
        <h1 className="text-white text-[20px] font-semibold mb-2">
          This chapter is still being drafted
        </h1>
        <p className="text-[#888] text-[14px] mb-6">
          The author hasn't published this chapter yet. Check back soon.
        </p>
        <Link
          href={`/${locale}/books/${bookId}`}
          className="inline-block px-5 py-2 bg-[#FFC300] text-black font-semibold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
        >
          Back to chapters
        </Link>
      </div>
    </main>
  )
}
```

Use any lucide icon that reads as "locked / in progress" — `Lock`, `Clock`, or `Hourglass` all work; pick one consistent with the rest of the codebase.

- [ ] **Step 3: Run tsc**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx"
git commit -m "feat(reader): locked placeholder for non-visible chapters by direct URL"
```

---

### Task 5: Binder color dots for chapter rows

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx`
- Possibly modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` if the chapter-by-binder-item map needs exposing.

- [ ] **Step 1: Find the per-chapter status source**

Read `book-editor-provider.tsx`. Look for how chapters are loaded and whether their statuses are exposed in the context value. The provider already exposes `binderItems` (per-item rows from `getBinderTreeAction`). Verify whether `BinderItemRow` includes the chapter's `status`, OR if status is only on `activeChapter`.

If `BinderItemRow` doesn't carry `status`:
- Check the `BinderItemRow` type in `lib/actions/binder.actions.ts`. The query already joins `chapters` to populate `chapterId`. Extend it to also pull `status` and surface it on the row (e.g., `chapterStatus: chapters.status`).

If status IS already accessible via context — use that. Don't over-engineer.

- [ ] **Step 2: Render the dot**

In `binder-item.tsx`, after determining the icon/decoration block, render a small status dot ADJACENT to (not replacing) the chapter icon, for `type === 'chapter'` rows only:

```tsx
const STATUS_COLOR: Record<ChapterStatus, string> = {
  IDEA: 'var(--status-idea)',
  OUTLINE: 'var(--status-outline)',
  FIRST_DRAFT: 'var(--status-first-draft)',
  REVISED: 'var(--status-revised)',
  FINAL: 'var(--status-final)',
}

// ... inside the row JSX, alongside the existing icon/decoration:
{node.type === 'chapter' && node.chapterStatus && (
  <span
    className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
    style={{ backgroundColor: STATUS_COLOR[node.chapterStatus as ChapterStatus] }}
    aria-label={`Status: ${node.chapterStatus.toLowerCase().replace('_', ' ')}`}
  />
)}
```

Place the dot AFTER the chapter icon but BEFORE the title text, with a small gap. Tweak placement during implementation to match the binder's visual rhythm.

- [ ] **Step 3: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx"
# Plus any provider/action files touched
git commit -m "feat(binder): per-chapter status color dot for chapter rows"
```

---

### Task 6: Metadata panel — instructions + per-pill subtitles

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx`

- [ ] **Step 1: Extend `STATUS_OPTIONS` with subtitle**

Change the existing array (around line 17) to include a `subtitle`:

```ts
const STATUS_OPTIONS = [
  { value: 'IDEA' as const, label: 'Idea', subtitle: 'Not visible to readers', color: 'var(--status-idea)' },
  { value: 'OUTLINE' as const, label: 'Outline', subtitle: 'Not visible to readers', color: 'var(--status-outline)' },
  { value: 'FIRST_DRAFT' as const, label: 'First Draft', subtitle: 'Not visible to readers', color: 'var(--status-first-draft)' },
  { value: 'REVISED' as const, label: 'Revised', subtitle: 'Visible to readers', color: 'var(--status-revised)' },
  { value: 'FINAL' as const, label: 'Final', subtitle: 'Visible to readers', color: 'var(--status-final)' },
]
```

- [ ] **Step 2: Add the explanatory paragraph**

Find the Status section (around line 99 — the `flex flex-col gap-2.5` div). Add an explanatory paragraph between the section label and the pill bar:

```tsx
<div className="px-[18px] py-[18px] border-b border-[var(--chrome-800)] flex flex-col gap-2.5">
  <span className={labelClass}>Status</span>
  <p className="text-[11px] text-muted-foreground leading-relaxed">
    Set how far along this chapter is. Readers can only see chapters marked{' '}
    <span className="text-foreground/85 font-medium">Revised</span> or{' '}
    <span className="text-foreground/85 font-medium">Final</span> — earlier
    statuses show as a "Draft — coming soon" teaser instead.
  </p>
  <div className="flex flex-wrap gap-1.5">
    {/* existing pills ... */}
  </div>
</div>
```

- [ ] **Step 3: Update the pills to render the subtitle**

Restructure the pill button to include the subtitle below the label:

```tsx
{STATUS_OPTIONS.map(({ value, label, subtitle, color }) => {
  const isActive = activeChapter?.status === value
  return (
    <button
      key={value}
      onClick={() => updateChapterStatus(value)}
      className={cn(
        "inline-flex flex-col items-start gap-0.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors",
        !isActive && "bg-[var(--chrome-800)] text-foreground/80 border-[var(--chrome-700)] hover:text-foreground",
      )}
      style={
        isActive
          ? {
              color,
              backgroundColor: `oklch(from ${color} l c h / 0.18)`,
              borderColor: `oklch(from ${color} l c h / 0.40)`,
            }
          : undefined
      }
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="text-[9px] uppercase tracking-[0.10em] opacity-70 font-mono">
        {subtitle}
      </span>
    </button>
  )
})}
```

Note that the pills change from `rounded-full` to `rounded-md` to accommodate the two-line layout. If Chris prefers keeping the rounded-full + subtitle as separate caption text below the entire pill row (not on each pill), the implementer can offer that variant during a checkpoint — but the spec specifies per-pill subtitles, so default to inline.

- [ ] **Step 4: Run tsc + tests**

`npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx"
git commit -m "feat(metadata): Status section explainer + per-pill visibility subtitle"
```

---

### Task 7: AGENTS.md sync

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add "What Has Been Built" entry**

Insert a new entry after the most recent one:

```markdown
### Chapter Status — Publish-Readiness Gate ✅ COMPLETE (2026-05-28)

Chapter status now controls reader visibility on the public book reader. Readers see full prose only for chapters at `status IN ('REVISED', 'FINAL')`; everything below renders as a "Draft — coming soon" locked teaser. Author always sees full content (gate is bypassed when `viewerUserId === book.userId`).

- **Pure helper** (`lib/books/is-chapter-reader-visible.ts`): `isChapterReaderVisible(status: ChapterStatus): boolean` — true for REVISED/FINAL, false otherwise. 5 unit tests. Single point of truth so the threshold is changed in one place if it ever moves.
- **Reader chapter list** (`(public)/_components/chapter-list.tsx`): accepts `isAuthor: boolean`. Non-author + non-visible chapters render a "Draft — coming soon" badge instead of a clickable link. Visible chapters get an "Updated MMM DD, YYYY" label sourced from `chapters.updatedAt`.
- **Chapter reader page** (`(public)/books/[bookId]/read/[chapterId]/page.tsx`): after the existing `canReadBook` gate, if viewer is not the author AND the chapter is not reader-visible, render a `LockedChapterPlaceholder` ("This chapter is still being drafted") with a back link to the book reader instead of the prose.
- **No auto-demote on edit.** Editing a REVISED/FINAL chapter just bumps `updatedAt` (which the freshness label reflects). Status only changes when the author changes it.
- **Binder color dot per chapter** (`binder/binder-item.tsx`): small dot using `--status-*` tokens next to chapter-type rows. Author scans the binder to see which chapters are reader-visible at a glance.
- **Metadata Status section** (`metadata/metadata-panel.tsx`): explanatory paragraph above the pill bar + per-pill subtitle ("Visible to readers" / "Not visible to readers") below each label. Status pills shifted from rounded-full to rounded-md to accommodate the two-line label.

No DB / schema / server-action shape changes. The chapter projection on the book reader page extended to include `status` + `updatedAt`. The `BinderItemRow` projection may also extend with `chapterStatus` (verify during implementation).
```

- [ ] **Step 2: Update Resume Here**

Bump `Last updated`, refresh `Current focus` summarizing what shipped, update `Last commit`, refresh `Next concrete step when resuming`.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync Resume Here + What Has Been Built — chapter publish-gate shipped"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

`npm test`
Expected: 157 + 5 (new helper) = 162/162 pass.

- [ ] **Step 2: Run tsc**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification (Chris runs)**

1. As author: every chapter is readable regardless of status; binder shows status color dots; metadata panel shows the explanation paragraph + per-pill subtitles.
2. Open a chapter and toggle through statuses → binder dot changes color in real time.
3. Sign out / incognito to a PUBLIC book whose chapters mix statuses → only REVISED + FINAL chapters are clickable; others show "Draft — coming soon" badge.
4. Reader-visible chapters in the list show "Updated MMM DD, YYYY" — date matches `chapters.updatedAt`.
5. As author, edit a FINAL chapter → save → re-open as incognito reader → chapter still visible (no auto-demote); updated date reflects the new edit.
6. As author, demote a REVISED chapter to FIRST_DRAFT → incognito reader can no longer open it (locked badge + locked placeholder on direct URL).
7. Direct URL to a locked chapter in incognito → "This chapter is still being drafted" placeholder + back link.

- [ ] **Step 4: Push if Chris asks**

Otherwise stop — commits live on `main`.

---

## Self-Review

**Spec coverage:**
- §1 Reader access model → Tasks 2, 3, 4 ✅
- §2.1 Binder dots → Task 5 ✅
- §2.2 Metadata Status section → Task 6 ✅
- §3 Pure helper → Task 1 ✅
- §4 Implementation scope → Tasks 1-6 collectively ✅
- §5 Manual verification → Task 8 Step 3 ✅
- §6 Out of scope → respected (no auto-demote, no `summarizeBookStatus` changes, no notifications) ✅

**Placeholder scan:** no TBDs. Every step has either code or an exact command.

**Type consistency:** `ChapterStatus` union type used identically across the helper, ChapterList prop type, binder dot map, and metadata STATUS_OPTIONS. `isChapterReaderVisible(status)` signature consistent across all consumer sites.

**Open implementation question called out:** Task 5 Step 1 flags that the implementer must verify whether `BinderItemRow` already exposes chapter status; if not, extend the projection. This is the only place the plan defers a structural decision to the implementer — the choice is bounded (extend projection vs use existing field) and either path keeps the task self-contained.

**Risk:** Task 2 + Task 3 are tightly coupled (the reader page's ChapterList call site requires the new ChapterList Props shape). Plan calls out the option to combine them into one commit; that's the recommended path.
