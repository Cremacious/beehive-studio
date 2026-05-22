# Studio Editor — Stability Pass

**Date:** 2026-05-22
**Sub-project:** 1 of 5 (Studio Editor Audit)
**Status:** Approved — ready for implementation plan

## Context

The studio book editor at `/[locale]/studio/[bookId]` is the core SaaS feature
of Beehive Studio — a writing tool competing with Google Docs and Scrivener.
In its current state it has crash-class bugs, data-loss races, and missing
table-stakes shortcuts that make it unusable for real writing sessions.

The full audit covers ~10 known bugs across five surfaces (binder, editor,
modes, metadata, new features). It has been decomposed into five
sub-projects. This document specifies sub-project 1 only.

## Goal

Make the editor safe to use. After this ships, a writer can:

- Type continuously for an extended session without losing work
- Toggle focus mode without crashing the page
- Switch between chapters with pending unsaved edits without losing them
- Close the browser tab without silently dropping the last few seconds of typing
- Hit Cmd/Ctrl+S to force-save on demand

No visual polish, no missing features beyond the two below, no fixes to
non-critical flows. Those land in sub-projects 2–5.

## In Scope

### Bug 1 — `BinderTree` hooks-order crash

**Location:** `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx:79`

The component does `if (focusMode) return null` before six subsequent hook
calls (`useMemo` × 3, `useCallback` × 2, `useSensors` × 1). This violates
React's Rules of Hooks: toggling `focusMode` changes the rendered hook
count, and React throws "Rendered fewer hooks than expected."

**Fix:** Move the early return to after all hook calls, just before the
returned JSX. Hooks must always execute in the same order on every render.

### Bug 2 — Stuck "saving…" state on cache miss

**Location:** `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx:144-151`

Inside the debounced save timer, `setSaveStatus('saving')` runs before the
`cachedChapter` null guard. If the cache is empty when the timer fires, the
function returns without ever resetting status, leaving the UI permanently
displaying "Saving…".

**Fix:** Reset to `'unsaved'` before the early return, so a subsequent
keystroke can retrigger the save flow.

### Bug 3 — Lost edits when switching chapters mid-debounce (DATA LOSS)

Two compounding problems cause edits to vanish when the user types in
chapter A and then clicks chapter B within the 2s debounce window:

**3a.** `chapter-editor.tsx:94` calls `editor.commands.setContent(...)` to
hydrate a newly-loaded chapter. By default, `setContent` emits an `update`
event, which fires `onUpdate` → `updateChapterContent(newChapter)`. This
clobbers the pending save for the previous chapter because both share
`saveTimerRef`.

**Fix 3a:** Pass `{ emitUpdate: false }` to `setContent` so hydration does
not look like a user edit.

**3b.** Even with 3a fixed, switching chapters within the 2s debounce loses
up to 2s of typing because the debounce timer is never given a chance to
fire before the active chapter changes.

**Fix 3b:** In `setActiveItemId`, before changing the active ID, flush any
pending save by calling the save function synchronously (or clearing the
timer and invoking the save body directly). The active chapter's
`targetItemId` was captured at debounce-start time so the save targets the
right chapter even after the switch — but it must be executed before the
next chapter loads.

### Feature 1 — Save on tab close / window unload

Currently a writer can lose up to 2s of typing by closing the tab during
the debounce window. This is unacceptable for a writing tool.

**Approach:**

1. Add a `beforeunload` listener in `BookEditorProvider`.
2. If `saveStatus !== 'saved'`:
   - Set `e.returnValue` to trigger the browser's native "Leave site?"
     prompt.
   - Fire `navigator.sendBeacon()` to a new route
     `/api/chapter-save-beacon` with the chapter ID and content.
3. The beacon route validates the session cookie via `auth.api.getSession`,
   verifies chapter ownership via the same query path used by
   `saveChapterAction`, and persists the chapter content. It does **not**
   need to return data — beacons are fire-and-forget.

**Why not a server action?** Server actions can't reliably complete during
`beforeunload`. `navigator.sendBeacon` is the only API designed for this —
the browser guarantees the request is sent even as the page unloads.

**Security:** The beacon route MUST mirror `saveChapterAction`'s authz
exactly: `requireAuth` for session, `assertBookOwner` for chapter
ownership. The chapter ID and content arrive in the beacon body and must
be validated with the same Zod schema (`saveChapterSchema` from
`lib/validations/book.ts`).

### Feature 2 — Cmd/Ctrl+S explicit save

**Approach:**

Add an editor-scoped `keydown` listener in `chapter-editor.tsx` that:

1. Catches `(metaKey || ctrlKey) && key === 's'`.
2. Calls `e.preventDefault()` to suppress the browser's "Save page" dialog.
3. Cancels the pending debounce timer via the provider.
4. Immediately invokes `saveChapterAction` with current editor JSON.
5. On success, shows a small "Saved" toast.

**Toast infrastructure:** Reuse `ErrorToasts` with a new success variant,
or add a minimal toast primitive. Pick whichever requires fewer new
abstractions — this is plumbing, not a feature.

### Verification task — Cmd+B / Cmd+I / Cmd+U work

TipTap StarterKit binds `Mod-B` (bold) and `Mod-I` (italic) by default; the
Underline extension binds `Mod-U`. These should already work, but the
audit has not confirmed it. Five-minute check: open the editor, press each
shortcut, confirm the format toggles. If any fail, patch and document.

## Out of Scope

Deferred to later sub-projects:

- Three text-align toolbar buttons all rendering the identical `≡` glyph
  → sub-project 3 (Editor toolbar + modes)
- Find/replace `⌘F` global listener leaks focus to editor when typing
  elsewhere → sub-project 3
- Snapshot/version-history UI → sub-project 5
- Outline editor for `outline` binder type → sub-project 5
- Book-level title rename from the binder header → sub-project 2
- Mobile/tablet responsive layout → sub-project 5
- Removal of ambient sounds feature → sub-project 3
- Any visual/UX polish → Claude Design pass after sub-project 5

## Testing

This code path is interactive and largely resistant to unit testing.
Manual verification is the primary gate.

### Manual test checklist

- **Hooks crash:** Open a book. Toggle focus mode at least 5 times via the
  toolbar. The page must not crash, blank, or throw React errors.
- **Stuck save state:** With dev tools open, clear the chapter cache via
  React DevTools (or rapidly switch chapters to force a cache miss).
  Confirm "Saving…" never persists indefinitely.
- **Lost edits on switch:** Type ~5 words in chapter A. Within 2s, click
  chapter B. Wait 3s. Click back to chapter A. The 5 words must be there.
- **Save on close:** Type a sentence. Immediately close the tab. The
  browser must prompt "Leave site?". After confirming leave, reopen the
  book — the sentence must be present.
- **Cmd+S:** Type a few words. Press Cmd+S (Ctrl+S on Windows). The
  "Saved" toast must appear within 200ms. No browser save dialog opens.
- **Cmd+B / Cmd+I / Cmd+U:** Select text. Each shortcut must toggle its
  respective format.

### Automated checks

- `npm test` — all existing tests pass.
- `npx tsc --noEmit` — clean (no new type errors).

## Risks and Trade-offs

- **Beacon route as a new authz surface.** Mitigation: route reuses
  `requireAuth` + the same ownership check as `saveChapterAction`; ID and
  content validated with the same Zod schema. No new code paths to forget
  to secure.
- **Chapter switch slightly slower.** Flushing the debounce on switch adds
  one save round-trip (~100–300ms) before the new chapter loads. Acceptable
  trade-off — losing edits is worse than a brief loading state.
- **`beforeunload` prompt fatigue.** Browsers may suppress or style the
  prompt aggressively. The beacon fires regardless, so even if the user
  bypasses the prompt their work is saved. The prompt is a belt; the
  beacon is suspenders.
- **TipTap shortcut bindings can be overridden by the document-level Cmd+S
  handler.** Confirm the global `keydown` listener doesn't accidentally
  swallow shortcuts the editor is supposed to receive. Scope it carefully
  (return early if the event target is not inside the editor container, or
  attach to the editor's DOM root instead of `window`).

## Definition of Done

- All six manual tests pass on macOS Chrome and Windows Chrome.
- `npm test` passes (45/45 or higher).
- `npx tsc --noEmit` clean.
- `AGENTS.md` "Resume Here" block updated to mark sub-project 1 complete
  and point to sub-project 2 as the next step.
- All changes committed in a single feature branch, ready for the
  implementation plan to land.
