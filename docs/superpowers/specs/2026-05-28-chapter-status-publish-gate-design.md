# Chapter Status — Publish-Readiness Gate

**Date:** 2026-05-28
**Status:** Design approved, ready for plan-phase

## Problem

`chapters.status` (`IDEA` / `OUTLINE` / `FIRST_DRAFT` / `REVISED` / `FINAL`) exists as a labeled enum, but the only user-visible consequence is an indirect roll-up to a library-card badge (`Drafting` / `Revised` / `Published`) via `summarizeBookStatus()`. Authors set status without understanding what it does, and nothing in the binder or reader experience reinforces a clear job-to-be-done. Per Chris's framing: "It is not clear what effect those statuses have or why users should bother setting them."

## Decision

Chapter status becomes the **publish-readiness gate** for the public reader. Chapters with `status IN ('REVISED', 'FINAL')` are reader-visible; everything below shows as a locked teaser. This gives status real, immediate user-visible consequences and resolves the "why bother?" problem.

## Mental model

- **Author always sees everything.** The gate only applies to non-author viewers (`viewerUserId !== book.userId`).
- **`canReadBook` still gates the book overall** (privacy: PUBLIC/FRIENDS/PRIVATE). The chapter-status gate sits inside `canReadBook=ok` and decides *which* chapters within an accessible book a reader can open.
- **Status is manual only.** Editing a REVISED or FINAL chapter does NOT auto-demote it. The author controls when readers see what.
- **Freshness signal lives on `chapters.updatedAt`.** Readers see "Updated MMM DD, YYYY" next to reader-visible chapters so they know when polish happened.

## 1. Reader access model

In the chapter list at `/[locale]/books/[bookId]`:

| Chapter status | Reader sees |
|---|---|
| `REVISED` | Title + "Updated MMM DD, YYYY" label. Clickable → full chapter reader. |
| `FINAL` | Same as REVISED. |
| `IDEA` / `OUTLINE` / `FIRST_DRAFT` | Title + "Draft — coming soon" badge. Not clickable, OR clickable but shows a locked-state placeholder. |

Chapter list ordering unchanged — both readable and locked chapters appear in `binderItems.order`. Locked chapters in the middle of the list communicate "more coming."

Direct-URL access to a locked chapter (`/[locale]/books/[bookId]/read/[chapterId]`) — for example via an old reader-bookmark — renders the locked placeholder page:

> **This chapter is still being drafted.**
> The author hasn't published this chapter yet. Check back soon.

Author viewing their own book is unaffected — they always see full content for every chapter regardless of status.

## 2. Author surfaces

### 2.1 Binder dots

Each `type === 'chapter'` row in the binder gets a small status color dot next to its title, using the existing `--status-*` CSS tokens (already defined per AGENTS.md DP2 design tokens):
- `IDEA`, `OUTLINE`, `FIRST_DRAFT` — cooler tones (the existing token palette)
- `REVISED`, `FINAL` — brighter / warmer tones

The dot pairs with the existing chapter icon (FileText). Doesn't replace it; sits adjacent. Other binder item types (parts, research_notes, characters, etc.) are unchanged.

### 2.2 Metadata panel — Status section

Add an explanatory paragraph above the existing status pill bar:

> **Chapter status**
> Set how far along this chapter is. Readers can only see chapters marked **Revised** or **Final** — earlier statuses (Idea / Outline / First Draft) show as a "Draft — coming soon" teaser instead.

Each pill gets a tiny subtitle underneath the existing label clarifying its effect:
- Idea — *Not visible to readers*
- Outline — *Not visible to readers*
- First Draft — *Not visible to readers*
- Revised — *Visible to readers*
- Final — *Visible to readers*

Typography: subtitle is mono uppercase 9px, paper-ink-muted, letter-spaced.

## 3. Pure helper

New helper `lib/books/is-chapter-reader-visible.ts`:

```ts
type ChapterStatus = 'IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL'

export function isChapterReaderVisible(status: ChapterStatus): boolean {
  return status === 'REVISED' || status === 'FINAL'
}
```

Used at every gate site (chapter list, chapter reader page). Centralizing means the threshold is changed in one place if it ever moves again.

## 4. Implementation scope

**Files:**

- Create: `lib/books/is-chapter-reader-visible.ts` (+ test in `lib/books/__tests__/`)
- Modify: `lib/actions/discover.actions.ts` — confirm chapter projection includes `status` and `updatedAt`; add if missing.
- Modify: `app/[locale]/(public)/_components/chapter-list.tsx` — accept an `isAuthor: boolean` prop. For non-authors, gate by `isChapterReaderVisible(chapter.status)`. Render locked chapters with a `Draft — coming soon` badge instead of the clickable link. Reader-visible chapters get an extra `Updated MMM DD, YYYY` label.
- Modify: `app/[locale]/(public)/books/[bookId]/page.tsx` — pass `isAuthor` to ChapterList; pass through `status` + `updatedAt` per chapter.
- Modify: `app/[locale]/(public)/books/[bookId]/read/[chapterId]/page.tsx` — after the existing `canReadBook` gate, if `viewerUserId !== book.userId` and `!isChapterReaderVisible(chapter.status)`, render the locked placeholder instead of the chapter prose.
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-item.tsx` — render a small color dot for chapter-type rows. Source the chapter's status from existing context (verify available during implementation; if not, thread through).
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/metadata/metadata-panel.tsx` — add the explanatory paragraph above the pill bar + per-pill subtitle.

**Schema / migrations:** none. `chapters.status` (enum) and `chapters.updatedAt` (timestamp) both exist.

**Tests:**
- `lib/books/__tests__/is-chapter-reader-visible.test.ts` — 5 cases (IDEA / OUTLINE / FIRST_DRAFT → false; REVISED / FINAL → true).
- No E2E. Manual smoke covers reader gating + author binder visuals.

## 5. Manual verification checklist

1. As author: every chapter is readable regardless of status; binder shows status color dots; metadata panel shows the explanation paragraph + per-pill subtitles.
2. Sign out / incognito to a PUBLIC book whose chapters mix statuses → only REVISED + FINAL chapters are clickable; others show "Draft — coming soon" badge; clicking a locked chapter URL directly lands on the locked placeholder.
3. Reader-visible chapters in the list show "Updated MMM DD, YYYY" — the date matches `chapters.updatedAt`.
4. As author, edit a FINAL chapter → save → re-open as incognito reader → chapter still reader-visible (no auto-demote); updated date reflects the new edit.
5. As author, demote a REVISED chapter to FIRST_DRAFT → incognito reader can no longer open it (now locked).

## 6. Out of scope

- **Auto-demote on edit.** Status only changes by author action.
- **`summarizeBookStatus()` roll-up changes.** Library card status badge logic stays as-is.
- **Notifications when a chapter goes live.** Author-side "your followers see this now" not in scope.
- **Per-chapter publish history / timeline.** Not in scope.
- **Reader-side "notify me when this chapter is ready"** subscription. Not in scope.
- **Bookmark migration on demote.** If a reader's `readingProgress.lastChapterId` later becomes locked, the next visit just lands on the locked teaser. No special handling.
