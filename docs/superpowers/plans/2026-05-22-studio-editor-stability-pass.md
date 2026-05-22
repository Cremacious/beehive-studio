# Studio Editor — Stability Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the studio book editor safe to use — eliminate the hooks-order crash, fix the stuck "saving…" state, prevent edit loss when switching chapters or closing the tab, and add a Cmd+S explicit-save shortcut.

**Architecture:** All five fixes are local to the studio editor surface. Three are React state/lifecycle fixes in existing client components. One is a new `app/api/chapter-save-beacon/route.ts` endpoint that mirrors `saveChapterAction`'s authz, called via `navigator.sendBeacon` from a new `beforeunload` listener in the provider. The last is an editor-scoped Cmd+S keydown handler that flushes the debounce and shows a transient "Saved" flash via a small extension to the existing `ErrorToasts` component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TipTap (`@tiptap/react`), better-auth v1, Drizzle ORM on Neon Postgres, Tailwind v4, Zod, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-22-studio-editor-stability-pass-design.md`](../specs/2026-05-22-studio-editor-stability-pass-design.md)

---

## File Structure

**Modify:**
- `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx` — move early return after all hooks
- `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` — fix stuck save state, flush-on-switch, expose `flushPendingSave` and `flashes` state, add `beforeunload` listener
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — `setContent` with `emitUpdate: false`, Cmd+S handler
- `app/[locale]/(app)/studio/[bookId]/_components/error-toasts.tsx` — render success flashes in addition to errors

**Create:**
- `app/api/chapter-save-beacon/route.ts` — fire-and-forget save endpoint for `beforeunload`
- `tests/api/chapter-save-beacon.test.ts` — schema validation unit test (logic-only; full integration is manual)

**No DB schema changes. No new dependencies.**

---

## Task 1: Fix `BinderTree` hooks-order crash

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/binder/binder-tree.tsx:75-148`

- [ ] **Step 1: Confirm the bug**

Read `binder-tree.tsx`. Verify lines 76–96 are this order:
```
useBookEditor()        // hook 1
useState              // hook 2
if (focusMode) return null    // ← early return BEFORE the next 6 hooks
useMemo  // hook 3 (tree)
useMemo  // hook 4 (flatIds)
useCallback  // hook 5 (toggleCollapsed)
useSensors  // hook 6
useCallback  // hook 7 (handleDragEnd)
useMemo  // hook 8 (ctxValue)
```

This violates the Rules of Hooks. Toggling focus mode at runtime crashes React.

- [ ] **Step 2: Move the early return to after all hooks**

Replace lines 75–80 with:
```tsx
export function BinderTree() {
  const { bookId, bookTitle, locale, binderItems, setBinderItems, focusMode, corkboardMode, toggleCorkboardMode } = useBookEditor()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildTree(binderItems), [binderItems])
```

(Remove the `if (focusMode) return null` line from position 79.)

Then, just before the JSX `return` at line 148, add:
```tsx
  if (focusMode) return null

  return (
    <BinderTreeContext.Provider value={ctxValue}>
```

- [ ] **Step 3: Manually verify the fix**

Run `npm run dev`. Open a book in the studio. Click the focus-mode toggle in the toolbar (✏ icon at far right). Toggle it on and off 5 times in rapid succession. The page must not crash, blank, or log "Rendered fewer hooks than expected" in the console.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean (no new errors).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/binder/binder-tree.tsx
git commit -m "fix(studio): move BinderTree early return after hook calls

Toggling focus mode crashed the page because the early return changed
the rendered hook count between renders. Hooks must execute in the
same order on every render — moved the focusMode check to after all
hook calls."
```

---

## Task 2: Fix stuck "saving…" state on cache miss

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx:136-168`

- [ ] **Step 1: Locate the bug**

Read the `updateChapterContent` function starting at line 136. Note that inside the `setTimeout` callback:
1. Line 145: `setSaveStatus('saving')` runs first
2. Line 151: if `cachedChapter` is null, the function returns immediately — leaving status stuck on `'saving'`

- [ ] **Step 2: Reset state before early return**

Replace the body of the setTimeout callback (lines 144–167) with:

```tsx
    saveTimerRef.current = setTimeout(async () => {
      const cachedChapter = targetItemId
        ? (chapterCacheRef.current.get(targetItemId) ?? null)
        : null

      if (!cachedChapter) {
        // Nothing to save — return to 'unsaved' so a future keystroke retriggers
        setSaveStatus('unsaved')
        return
      }

      setSaveStatus('saving')

      const result = await saveChapterAction(cachedChapter.id, content)
      if (result.success) {
        setSaveStatus('saved')
        setWordCount(result.data.wordCount)
        setChapterCache(prev => {
          const m = new Map(prev)
          const ch = m.get(targetItemId!)
          if (ch) m.set(targetItemId!, { ...ch, content, wordCount: result.data.wordCount })
          return m
        })
      } else {
        setSaveStatus('unsaved')
        pushError("Couldn't save. Retrying…")
      }
    }, 2000)
```

The key change: the `cachedChapter` check runs **before** `setSaveStatus('saving')`, and the null branch resets to `'unsaved'`.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

Hard to trigger naturally. Open React DevTools, find the `BookEditorProvider`, manually `setChapterCache(new Map())`. Type a character in the editor. After 2 seconds the status indicator must NOT remain on "Saving…" — it should fall back to "Unsaved" or similar. Type again and observe a normal save cycle.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/book-editor-provider.tsx
git commit -m "fix(studio): reset save status when chapter cache is empty mid-debounce

If the chapter cache was cleared while the 2s debounce was pending, the
save timer fired, set status to 'saving', then returned early — leaving
the UI permanently showing 'Saving…'. Check the cache first; only flip
to 'saving' once we know there is content to persist."
```

---

## Task 3: Fix lost edits on chapter switch (data-loss race)

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx:92-96`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx:98-122` (setActiveItemId)

This task has two sub-fixes; commit both together since they only work in combination.

- [ ] **Step 1: Suppress emitUpdate on chapter hydration**

In `chapter-editor.tsx`, replace lines 92–96:

```tsx
  // When chapter data arrives after the async fetch, populate the editor.
  // useEditor initializes with null because activeChapter is always null on first render.
  // Pass emitUpdate: false so hydration does NOT look like a user edit — otherwise
  // it would trigger onUpdate → updateChapterContent and clobber any pending save
  // for the previous chapter.
  useEffect(() => {
    if (!editor || !activeChapter || !editor.isEmpty) return
    editor.commands.setContent(
      activeChapter.content as Parameters<typeof editor.commands.setContent>[0],
      { emitUpdate: false },
    )
    setEditorText(extractPlainText(activeChapter.content))
  }, [activeChapter, editor])
```

- [ ] **Step 2: Extract the save body into a flushable function in the provider**

In `book-editor-provider.tsx`, refactor `updateChapterContent` so the actual save body can be invoked independently of the debounce timer. Replace lines 136–168 with:

```tsx
  // Performs the actual save. Pulled out of updateChapterContent so it can also
  // be invoked synchronously by Cmd+S, by chapter-switch flush, and by beforeunload.
  const performSave = useCallback(async (targetItemId: string, content: unknown) => {
    const cachedChapter = chapterCacheRef.current.get(targetItemId) ?? null
    if (!cachedChapter) {
      setSaveStatus('unsaved')
      return
    }

    setSaveStatus('saving')

    const result = await saveChapterAction(cachedChapter.id, content)
    if (result.success) {
      setSaveStatus('saved')
      setWordCount(result.data.wordCount)
      setChapterCache(prev => {
        const m = new Map(prev)
        const ch = m.get(targetItemId)
        if (ch) m.set(targetItemId, { ...ch, content, wordCount: result.data.wordCount })
        return m
      })
    } else {
      setSaveStatus('unsaved')
      pushError("Couldn't save. Retrying…")
    }
  }, [pushError])

  // Holds the pending save's (targetItemId, content) so we can flush it on demand.
  const pendingSaveRef = useRef<{ itemId: string; content: unknown } | null>(null)

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingSaveRef.current
    if (!pending) return
    pendingSaveRef.current = null
    await performSave(pending.itemId, pending.content)
  }, [performSave])

  const updateChapterContent = useCallback((content: unknown) => {
    setSaveStatus('unsaved')

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    const targetItemId = activeItemId
    if (!targetItemId) return

    pendingSaveRef.current = { itemId: targetItemId, content }

    saveTimerRef.current = setTimeout(async () => {
      const pending = pendingSaveRef.current
      if (!pending) return
      pendingSaveRef.current = null
      await performSave(pending.itemId, pending.content)
    }, 2000)
  }, [activeItemId, performSave])
```

This replaces the inline save logic from Task 2 — supersedes those changes.

- [ ] **Step 3: Flush pending save before switching active item**

In the same file, modify `setActiveItemId` (lines 98–122) to flush first:

```tsx
  const setActiveItemId = useCallback((id: string | null) => {
    // Flush any pending save for the outgoing chapter so its edits aren't lost.
    // Fire-and-forget: the save targets pendingSaveRef's captured itemId, not the
    // new active ID — so it lands on the correct chapter even after this switch.
    void flushPendingSave()

    if (id === null) {
      setActiveItemIdState(null)
      return
    }

    const item = binderItems.find(x => x.id === id)
    if (!item) return

    setActiveItemIdState(id)

    if (!CHAPTER_TYPES.has(item.type)) return

    if (chapterCacheRef.current.has(id)) return

    getChapterAction(item.chapterId!).then(result => {
      if (result.success) {
        setChapterCache(c => new Map(c).set(id, result.data))
      } else {
        pushError(`Couldn't load chapter: ${result.error}`)
      }
    })
  }, [binderItems, pushError, flushPendingSave])
```

- [ ] **Step 4: Add `flushPendingSave` to the context value**

In the same file, add `flushPendingSave` to:
1. The `BookEditorContextValue` type around line 26 (add `flushPendingSave: () => Promise<void>`)
2. The `value` object passed to the provider around line 230 (include `flushPendingSave`)
3. The dependency array of `useMemo` around line 256 (include `flushPendingSave`)

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Manual verification**

Critical test for data loss:
1. Open a book with two chapters, both with some existing text.
2. Click chapter A. Type "DATALOSS TEST A" at the end. Do NOT wait for autosave.
3. Within 1 second, click chapter B. Type "DATALOSS TEST B".
4. Wait 5 seconds.
5. Click chapter A. The phrase "DATALOSS TEST A" must be present.
6. Click chapter B. The phrase "DATALOSS TEST B" must be present.

If either is missing, the fix is incomplete — do not commit.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/editor/chapter-editor.tsx app/[locale]/\(app\)/studio/[bookId]/_components/book-editor-provider.tsx
git commit -m "fix(studio): prevent edit loss when switching chapters mid-debounce

Two compounding issues caused typed edits to vanish:
1. setContent on chapter hydration emitted an update event, which fired
   onUpdate → updateChapterContent and clobbered the pending save for
   the previous chapter. Pass emitUpdate:false on hydration.
2. The 2s debounce timer was simply cleared on chapter switch, losing
   up to 2s of typing. Extract a performSave function, hold the pending
   (itemId, content) in a ref, and flush it synchronously before
   changing the active chapter ID."
```

---

## Task 4: Create `/api/chapter-save-beacon` route

**Files:**
- Create: `app/api/chapter-save-beacon/route.ts`
- Create: `tests/api/chapter-save-beacon.test.ts` (schema-only unit test)

- [ ] **Step 1: Write the schema test**

Create `tests/api/chapter-save-beacon.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { beaconSaveSchema } from '@/app/api/chapter-save-beacon/schema'

describe('beaconSaveSchema', () => {
  it('accepts a valid TipTap doc payload', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: 'abc123',
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing chapterId', () => {
    const result = beaconSaveSchema.safeParse({
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty chapterId', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: '',
      content: { type: 'doc', content: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-doc content', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: 'abc',
      content: 'not an object',
    })
    expect(result.success).toBe(false)
  })

  it('rejects content without type:doc', () => {
    const result = beaconSaveSchema.safeParse({
      chapterId: 'abc',
      content: { type: 'paragraph' },
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- chapter-save-beacon`
Expected: FAIL — module `@/app/api/chapter-save-beacon/schema` not found.

- [ ] **Step 3: Create the schema module**

Create `app/api/chapter-save-beacon/schema.ts`:

```ts
import { z } from 'zod'

export const beaconSaveSchema = z.object({
  chapterId: z.string().min(1),
  content: z
    .object({ type: z.literal('doc') })
    .passthrough(),
})

export type BeaconSavePayload = z.infer<typeof beaconSaveSchema>
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- chapter-save-beacon`
Expected: PASS — all 5 cases.

- [ ] **Step 5: Create the route**

Create `app/api/chapter-save-beacon/route.ts`:

```ts
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { books, chapters } from '@/db/schema'
import { extractWordCount } from '@/lib/tiptap-utils'
import { beaconSaveSchema } from './schema'

// Fire-and-forget endpoint called via navigator.sendBeacon during beforeunload.
// Mirrors saveChapterAction's authz exactly: session check + chapter ownership
// via the parent book's userId. Snapshots are NOT created here — the user is
// closing the tab; the periodic in-session save flow handles snapshots.
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return new Response(null, { status: 401 })
    }
    const userId = session.user.id

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response(null, { status: 400 })
    }

    const parsed = beaconSaveSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(null, { status: 400 })
    }
    const { chapterId, content } = parsed.data

    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
      with: { book: { columns: { userId: true } } },
    })
    if (!chapter || chapter.book.userId !== userId) {
      return new Response(null, { status: 404 })
    }

    const wordCount = extractWordCount(content)

    await db.transaction(async (tx) => {
      await tx
        .update(chapters)
        .set({ content, wordCount, updatedAt: new Date() })
        .where(eq(chapters.id, chapterId))
      await tx
        .update(books)
        .set({ updatedAt: new Date() })
        .where(eq(books.id, chapter.bookId))
    })

    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 500 })
  }
}
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Smoke-test the route**

Run `npm run dev`. From the browser console while signed into a real book, run:

```js
fetch('/api/chapter-save-beacon', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chapterId: '<real chapter id>',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'beacon smoke test' }] }] },
  }),
}).then(r => console.log('status:', r.status))
```

Expected: `status: 204`. Reload the book — the chapter should now end with "beacon smoke test".

Also test the negative case: replace `<real chapter id>` with `not-a-real-id` and expect `status: 404`.

- [ ] **Step 8: Commit**

```bash
git add app/api/chapter-save-beacon/ tests/api/chapter-save-beacon.test.ts
git commit -m "feat(studio): add /api/chapter-save-beacon for unload-time saves

server actions don't reliably complete during beforeunload — only
navigator.sendBeacon is designed for it. This route is the beacon
target. Authz mirrors saveChapterAction exactly: better-auth session
check + chapter ownership via the parent book's userId. Skips snapshot
creation (the user is closing the tab; snapshots are handled by the
in-session save flow)."
```

---

## Task 5: Add `beforeunload` save flush

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx`

- [ ] **Step 1: Add the `useEffect` for beforeunload**

After the existing `useCallback` definitions in `BookEditorProvider` (after `flushPendingSave`, around the same area where other hooks live), add:

```tsx
  // Save-on-unload safety net: if there's a pending save when the user closes
  // the tab, fire it via sendBeacon (the only API that reliably completes
  // during unload) AND show the browser's native "Leave site?" prompt.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const pending = pendingSaveRef.current
      if (!pending) return

      // Fire-and-forget beacon. The browser guarantees this is sent.
      const blob = new Blob(
        [JSON.stringify({ chapterId: chapterCacheRef.current.get(pending.itemId)?.id, content: pending.content })],
        { type: 'application/json' },
      )
      navigator.sendBeacon('/api/chapter-save-beacon', blob)

      // Trigger the browser's "Leave site?" prompt.
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
```

You will need to add `useEffect` to the imports at the top of `book-editor-provider.tsx`.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification**

1. Open a book. Type "BEACON UNLOAD TEST" in a chapter.
2. Immediately (within 2 seconds) close the browser tab.
3. The browser MUST show the "Leave site?" / "Changes you made may not be saved" prompt.
4. Confirm leave.
5. Reopen the same book. "BEACON UNLOAD TEST" must be present in the chapter.

Test the no-pending-save case too:
1. Open a book, do not type anything.
2. Close the tab. There must be NO "Leave site?" prompt — clean exit.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/book-editor-provider.tsx
git commit -m "feat(studio): flush pending saves via sendBeacon on tab close

Previously a writer could lose up to 2 seconds of typing by closing the
tab during the autosave debounce window. Now beforeunload fires
sendBeacon to /api/chapter-save-beacon with the pending content AND
triggers the browser's 'Leave site?' prompt as a belt-and-suspenders
guarantee."
```

---

## Task 6: Add Cmd+S explicit save + "Saved" flash

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` — add `flashes` state and `pushFlash`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/error-toasts.tsx` — render flashes
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` — Cmd+S handler

- [ ] **Step 1: Add `flashes` to the provider**

In `book-editor-provider.tsx`, add to the context value type (around line 26):

```tsx
  flashes: string[]
  pushFlash: (msg: string) => void
```

In the component body, after the `errors` state declaration, add:

```tsx
  const [flashes, setFlashes] = useState<string[]>([])

  const pushFlash = useCallback((msg: string) => {
    setFlashes(prev => [...prev, msg])
    // Auto-dismiss after 1.5 seconds
    setTimeout(() => {
      setFlashes(prev => prev.slice(1))
    }, 1500)
  }, [])
```

Include `flashes` and `pushFlash` in the `value` object and its dependency array.

- [ ] **Step 2: Render flashes in `ErrorToasts`**

Replace the contents of `error-toasts.tsx`:

```tsx
'use client'

import { useBookEditor } from './book-editor-provider'

export function ErrorToasts() {
  const { errors, dismissError, flashes } = useBookEditor()

  if (errors.length === 0 && flashes.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm">
      {flashes.map((msg, i) => (
        <div
          key={`flash-${i}`}
          className="flex items-center gap-2 bg-brand/10 border border-brand/30 text-brand rounded-lg px-4 py-2 text-sm shadow-lg"
        >
          <span>● {msg}</span>
        </div>
      ))}
      {errors.map((error, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm shadow-lg"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={() => dismissError(i)}
            className="text-destructive/60 hover:text-destructive transition-colors mt-0.5 leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add Cmd+S handler in the chapter editor**

In `chapter-editor.tsx`, locate the existing `useEffect` around line 79 that handles Cmd+F. Replace it with this expanded version that handles BOTH Cmd+F and Cmd+S:

```tsx
  const { activeItemId, activeItem, activeChapter, updateChapterContent, updateBinderItem, wordCount, typewriterMode, flushPendingSave, pushFlash } =
    useBookEditor()

  // ... (other code unchanged) ...

  // Keyboard shortcuts: Cmd/Ctrl+F (find), Cmd/Ctrl+S (force save)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key === 'f' && editor) {
        e.preventDefault()
        setFindOpen(f => !f)
        return
      }

      if (e.key === 's' && editor) {
        e.preventDefault()
        // Push current editor content into the pending-save ref via updateChapterContent's
        // debounce, then flush immediately.
        const json = editor.getJSON()
        updateChapterContent(json)
        void flushPendingSave().then(() => pushFlash('Saved'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor, updateChapterContent, flushPendingSave, pushFlash])
```

Note: this REPLACES the existing Cmd+F handler — do not leave both.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification**

1. Open a book, click into a chapter, type a sentence.
2. Press Cmd+S (Mac) or Ctrl+S (Windows).
3. Browser's "Save Page As" dialog must NOT appear.
4. Within ~300ms, the toolbar status must flip to "Saving…" then "Saved", and a "● Saved" toast must appear bottom-right, auto-dismissing after 1.5s.
5. Reload the page. The sentence must persist (proves the save actually committed).
6. Cmd+F still toggles the find panel.

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/book-editor-provider.tsx app/[locale]/\(app\)/studio/[bookId]/_components/error-toasts.tsx app/[locale]/\(app\)/studio/[bookId]/_components/editor/chapter-editor.tsx
git commit -m "feat(studio): Cmd+S explicit save with 'Saved' toast

Cancels the autosave debounce and forces an immediate save, showing a
transient brand-colored flash via the existing ErrorToasts component.
Cmd+F find toggle preserved in the same keydown handler."
```

---

## Task 7: Verify Cmd+B / Cmd+I / Cmd+U work

**No files modified unless a binding is missing.**

- [ ] **Step 1: Manual test**

Open a chapter. Select a few words. Press each shortcut in turn:
- Cmd/Ctrl+B → should toggle bold
- Cmd/Ctrl+I → should toggle italic
- Cmd/Ctrl+U → should toggle underline

These are bound by TipTap StarterKit (B, I) and the Underline extension (U), both of which are loaded in `chapter-editor.tsx:55-62`. Expected: all three work out of the box.

- [ ] **Step 2: If any shortcut fails**

If Cmd+B or Cmd+I fails: check that StarterKit's defaults aren't overridden. If Cmd+U fails: confirm `Underline` is imported and listed in the extensions array. Patch by adding `Underline.configure({})` or fixing the offending override. Add a one-line comment explaining the fix.

- [ ] **Step 3: If all three work**

No commit needed — verification only. Note in the PR description that bindings were confirmed.

---

## Task 8: Final verification + Resume Here update

- [ ] **Step 1: Run the full spec test checklist**

Re-run every test from the spec's "Manual test checklist" section in order:
- Hooks crash: toggle focus mode 5×
- Stuck save state: cache miss recovery
- Lost edits on switch: type-switch-type-wait-verify
- Save on close: type-close-prompt-leave-reopen-verify
- Cmd+S: type-Cmd+S-toast-reload-verify
- Cmd+B / Cmd+I / Cmd+U: each toggles its format

All six MUST pass. If any fail, do not proceed — diagnose and fix.

- [ ] **Step 2: Run automated checks**

```bash
npm test
npx tsc --noEmit
```

Expected: tests pass (existing 45 + new beacon schema tests), no type errors.

- [ ] **Step 3: Update AGENTS.md Resume Here block**

In `AGENTS.md`, update the Resume Here block to mark sub-project 1 complete:

```markdown
> **Last updated:** <today's date in YYYY-MM-DD format>
>
> **Current focus:** Studio Editor Audit — sub-project 2 (Binder UX) — not started
> **Active branch:** `main`
> **Last commit:** <auto-fill via git log>
>
> **The audit** is a 5-sub-project effort to make the book editor at
> `/[locale]/studio/[bookId]` fully operational. Sequence (Option A):
>
> 1. ~~Stability Pass~~ — DONE. See `docs/superpowers/specs/2026-05-22-studio-editor-stability-pass-design.md` and `docs/superpowers/plans/2026-05-22-studio-editor-stability-pass.md`.
> 2. **Binder UX** (next) — drag-drop edges, book-title rename.
> 3. Editor toolbar + modes — toolbar visual bugs, remove ambient sounds, find/replace scope.
> 4. Metadata + persistence — synopsis/scene-planner/notes/word-goal/status/publishing-details correctness.
> 5. New surfaces — Snapshot UI, Outline editor, mobile/tablet responsive.
>
> **Next concrete step when resuming:** Run /brainstorming to spec sub-project 2 (Binder UX).
```

- [ ] **Step 4: Commit the AGENTS.md update**

```bash
git add AGENTS.md
git commit -m "docs: mark studio editor stability pass complete (sub-project 1/5)

All five fixes verified manually and via npm test + tsc. Next:
sub-project 2 (Binder UX)."
```

- [ ] **Step 5: Final log review**

Run:
```bash
git log --oneline -10
```

You should see ~6 commits from this plan (Tasks 1, 2, 3, 4, 5, 6, and the AGENTS.md update). Task 7 has no commit. Confirm each commit message is clear and the order is sensible.

---

## Definition of Done

- All 8 tasks complete; all manual tests in Task 8 Step 1 pass.
- `npm test` passes.
- `npx tsc --noEmit` clean.
- AGENTS.md Resume Here block reflects sub-project 1 complete.
- ~6 atomic commits on `main` (or a feature branch ready to merge — your call based on the project's branching style).
