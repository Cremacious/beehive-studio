# Delete Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a delete-book feature with two entry points (library card kebab + `/studio/[bookId]/details` Danger Zone), both invoking a shared `DeleteBookButton` (render-prop wrapper around the existing destructive `ConfirmDialog`). Hard delete, post-success redirect to `/studio` + toast. No schema changes — DB FK cascades already handle binder items / chapters / snapshots / etc.

**Architecture:** Single shared client component owns the dialog state, action call, redirect, and toast. Two thin trigger wrappers (DropdownMenuItem in the kebab, Button in the Danger Zone) plug into the same component via a render-prop. Server action gets a tiny extension to invalidate the library cache.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, sonner (NEW — toast lib added in Task 1), shadcn/ui, vitest.

**Spec:** [docs/superpowers/specs/2026-05-28-delete-book-design.md](../specs/2026-05-28-delete-book-design.md)

**Pre-flight findings (recorded from spec-phase grep):**
- `deleteBookAction` has zero existing callers (only the definition + docs). Safe to add `locale` as a required arg without a backwards-compat shim.
- No toast library is currently installed (no sonner, no shadcn toast). Task 1 lands sonner because the spec calls for toast feedback.

---

### Task 1: Install sonner + mount Toaster

**Files:**
- Modify: `package.json` (new dependency)
- Create: `components/ui/sonner.tsx` (shadcn sonner wrapper — installed via `npx shadcn@latest add sonner`)
- Modify: `app/[locale]/layout.tsx` (mount `<Toaster />`)

- [ ] **Step 1: Install the sonner shadcn component**

```bash
npx shadcn@latest add sonner
```

Expected: installs `sonner` npm dependency, creates `components/ui/sonner.tsx` re-exporting a themed `<Toaster />`. If the CLI prompts about overwriting any existing file, abort and report — nothing in `components/ui/` should already exist with that name.

- [ ] **Step 2: Mount `<Toaster />` in the root layout**

Open `app/[locale]/layout.tsx`. Find the closing `</body>` (or the equivalent return root). Add the import + the component:

```tsx
import { Toaster } from '@/components/ui/sonner'

// inside the return, as a sibling of {children}:
<Toaster />
```

If `app/[locale]/layout.tsx` doesn't exist (the root layout may be at `app/layout.tsx`), mount it there instead. Read the file first to confirm.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/ui/sonner.tsx "app/[locale]/layout.tsx" package.json package-lock.json
git commit -m "chore(ui): install sonner toast + mount Toaster in root layout"
```

If the root layout was at `app/layout.tsx`, adjust the `git add` accordingly.

---

### Task 2: Extend `deleteBookAction` with locale + revalidatePath

**Files:**
- Modify: `lib/actions/book.actions.ts:447-454`

- [ ] **Step 1: Confirm no callers exist**

Run: `grep -rn "deleteBookAction(" app/ lib/ components/`
Expected: zero matches outside the definition. (Spec-phase pre-flight confirmed this, but verify before editing.)

- [ ] **Step 2: Update the signature and add revalidatePath**

In `lib/actions/book.actions.ts`, locate `deleteBookAction` (around line 447). Update:

```ts
import { revalidatePath } from 'next/cache'  // add to existing imports if missing

export async function deleteBookAction(bookId: string, locale: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db.delete(books).where(and(eq(books.id, bookId), eq(books.userId, userId)))

  revalidatePath(`/${locale}/studio`)

  return { success: true, data: undefined }
}
```

The function already has `requireAuth` + `assertBookOwner` — keep those. The DB delete is unchanged. The new lines are: `revalidatePath` import (if not already present in the file), the new `locale: string` parameter, the `revalidatePath` call between delete and return.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean. (No callers exist, so the signature change can't break anything yet.)

- [ ] **Step 4: Commit**

```bash
git add lib/actions/book.actions.ts
git commit -m "feat(books): deleteBookAction takes locale + revalidates /studio"
```

---

### Task 3: Create shared `DeleteBookButton` component

**Files:**
- Create: `components/book/delete-book-button.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteBookAction } from '@/lib/actions/book.actions'

type Props = {
  bookId: string
  bookTitle: string
  locale: string
  /** Render prop — caller renders the trigger (menu item, button, etc.) and wires `onTrigger` to open the confirm dialog. */
  children: (onTrigger: () => void) => React.ReactNode
}

export function DeleteBookButton({ bookId, bookTitle, locale, children }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleConfirm() {
    const result = await deleteBookAction(bookId, locale)
    if (!result.success) {
      toast.error('Could not delete book')
      return
    }
    toast.success(`Deleted "${bookTitle}"`)
    router.push(`/${locale}/studio`)
    router.refresh()
  }

  return (
    <>
      {children(() => setOpen(true))}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title={`Delete "${bookTitle}"?`}
        description="This permanently removes the book and all of its chapters, notes, and snapshots. This cannot be undone."
        confirmLabel="Delete book"
        onConfirm={handleConfirm}
      />
    </>
  )
}
```

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean. (No consumers yet — Task 4 adds the first.)

- [ ] **Step 3: Commit**

```bash
git add components/book/delete-book-button.tsx
git commit -m "feat(books): DeleteBookButton shared component (render-prop)"
```

---

### Task 4: Wire library kebab Delete item

**Files:**
- Modify: `app/[locale]/(app)/studio/_components/book-card-menu.tsx`
- Modify: `app/[locale]/(app)/studio/_components/book-card.tsx` (or wherever `BookCardMenu` is used — pass new `bookTitle` prop)

- [ ] **Step 1: Add `bookTitle` prop to `BookCardMenu`**

Read `app/[locale]/(app)/studio/_components/book-card-menu.tsx`. It currently takes `{ locale, bookId }`. Add `bookTitle: string` to Props and destructuring.

```tsx
type Props = {
  locale: string
  bookId: string
  bookTitle: string
}

export function BookCardMenu({ locale, bookId, bookTitle }: Props) {
```

- [ ] **Step 2: Add the Delete menu item wrapped in `DeleteBookButton`**

In the same file, find the `<DropdownMenuContent>` block. After the existing items (Open, Preview, Edit details), add:

```tsx
import { DeleteBookButton } from '@/components/book/delete-book-button'
// add Trash2 to the existing lucide-react import:
// import { MoreHorizontal, Pencil, BookOpen, Eye, Trash2 } from 'lucide-react'

// inside <DropdownMenuContent>, after Edit details:
<DeleteBookButton bookId={bookId} bookTitle={bookTitle} locale={locale}>
  {(onTrigger) => (
    <DropdownMenuItem
      onSelect={(e) => { e.preventDefault(); onTrigger() }}
      className="text-destructive focus:text-destructive cursor-pointer"
    >
      <Trash2 size={14} /> Delete book
    </DropdownMenuItem>
  )}
</DeleteBookButton>
```

`onSelect` with `e.preventDefault()` is critical — without it, Radix closes the menu before the dialog mounts, which would prevent focus from settling on the dialog's confirm button. Same pattern as `binder-item-menu.tsx`'s delete (look there if uncertain).

- [ ] **Step 3: Pass `bookTitle` from `book-card.tsx`**

Read `app/[locale]/(app)/studio/_components/book-card.tsx`. Find the `<BookCardMenu .../>` render call and add `bookTitle={book.title}` (or whatever the title field is named on the local book object).

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/studio/_components/book-card-menu.tsx" "app/[locale]/(app)/studio/_components/book-card.tsx"
git commit -m "feat(studio): Delete book item in library card kebab"
```

---

### Task 5: Wire Details page Danger Zone

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/details/_components/book-details-form.tsx` (or wherever the Details form renders the sections)

- [ ] **Step 1: Locate the Details form**

Run: `grep -rn "updateBookDetailsAction" "app/[locale]/(app)/studio/[bookId]/details/"` and read the form file. Find the closing `</form>` (the Save button's submit form).

- [ ] **Step 2: Add the Danger Zone section OUTSIDE the form**

The Danger Zone must NOT live inside the `<form>` element — otherwise the Delete button's click could be interpreted as a form submission. Place it after the closing `</form>` tag, as a sibling section.

```tsx
import { Trash2 } from 'lucide-react'
import { DeleteBookButton } from '@/components/book/delete-book-button'

// Outside the form, after </form>:
<section className="rounded-lg border border-destructive/30 p-5 mt-6">
  <h2 className="text-destructive text-[15px] font-semibold mb-1">Danger Zone</h2>
  <p className="text-foreground/65 text-[13px] mb-4">
    Permanently delete this book and everything in it.
  </p>
  <DeleteBookButton bookId={book.id} bookTitle={book.title} locale={locale}>
    {(onTrigger) => (
      <Button
        type="button"
        variant="outline"
        onClick={onTrigger}
        className="text-destructive border-destructive/40 hover:bg-destructive/10"
      >
        <Trash2 size={14} className="mr-2" />
        Delete this book
      </Button>
    )}
  </DeleteBookButton>
</section>
```

If the form component receives `book` and `locale` as props, they should already be in scope. Verify by reading the prop signature. If `locale` isn't there, add it as a new required prop and pass it from the parent server-component page.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/(app)/studio/[bookId]/details/_components/book-details-form.tsx"
# plus the details/page.tsx if you had to add a locale prop:
# git add "app/[locale]/(app)/studio/[bookId]/details/page.tsx"
git commit -m "feat(details): Danger Zone with Delete this book"
```

---

### Task 6: Update AGENTS.md "What Has Been Built"

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a Delete Book entry after the SP-A entry**

Open `AGENTS.md`. Find the "What Has Been Built" section, locate the SP-A entry (last entry before "What's Next"). Insert a new entry directly after it:

```markdown
### Delete Book ✅ COMPLETE (2026-05-28)

Adds a delete-book feature with two entry points and one shared dialog flow.

- **Server side:** `deleteBookAction(bookId, locale)` now takes locale + calls `revalidatePath(`/${locale}/studio`)` after the DB delete. FK cascades on `books` already drop binder items / chapters / snapshots / comments / likes / bookmarks / reading progress. No schema changes.
- **Toast infra:** installed `sonner` + mounted `<Toaster />` in the root layout. First toast use; future features can rely on it.
- **Shared component:** `components/book/delete-book-button.tsx` is a render-prop client component. Owns the destructive `ConfirmDialog` state, action call, success/error toast, and post-delete `router.push('/studio') + router.refresh()`.
- **Two entry points:** library card kebab (red Delete item with Trash2 icon, uses `onSelect + preventDefault` to keep menu open while dialog mounts — same pattern as binder-item-menu) + Details page "Danger Zone" section (outlined red Button, sits OUTSIDE the form element so save can't accidentally trigger it).
- **Confirmation:** simple destructive ConfirmDialog with the book title shown ("Delete \"{Title}\"? This permanently removes the book and all of its chapters, notes, and snapshots. This cannot be undone.").

**Out of scope (deferred):** soft-delete with undo toast (real delete only), type-to-confirm (simple confirm matches existing app vocabulary), bulk delete, hive-shared book handling.
```

- [ ] **Step 2: Update the Resume Here block**

Update `Last updated`, `Current focus`, `Last commit`, and `Next concrete step when resuming` to reflect that Delete Book shipped. Keep the SP-A manual verification reminder if it hasn't been completed.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync Resume Here + What Has Been Built — Delete Book shipped"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: 137/137 pass (no new tests added by this plan — see spec §5).

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification (Chris runs)**

1. Library kebab on any book card → Delete book → ConfirmDialog shows the book title → Confirm → redirects to `/studio`, toast appears ("Deleted \"{Title}\""), card is gone.
2. Open a book → Details → scroll to bottom → Danger Zone visible with outlined red Delete this book button → click → same dialog → confirm → ends back at `/studio`.
3. From either path, hit Cancel in the dialog → no state changes; book remains.
4. Delete a book that has chapters, snapshots, and comments → confirm the post-delete `/studio` loads without orphan errors. (Optional DB sanity: `SELECT COUNT(*) FROM chapters WHERE book_id = '<deleted-id>'` returns 0.)
5. If any toast doesn't appear, verify `<Toaster />` is mounted in the rendered root layout.

- [ ] **Step 4: Push to GitHub if Chris asks**

Otherwise stop here — commits live on `main`.

---

## Self-Review

**Spec coverage:**
- §1 Server action → Task 2 ✅
- §2 DeleteBookButton → Task 3 ✅
- §3 Library kebab → Task 4 ✅
- §4 Danger Zone → Task 5 ✅
- §5 Testing strategy (no new unit tests, manual checklist) → Task 7 ✅
- §6 Out of scope → respected (no soft-delete, no type-to-confirm, no bulk delete, no hive-shared handling)
- **Added infra:** Task 1 (sonner install) is required because the spec calls for toast and no toast lib existed. Recording this in the plan rather than the spec because it's implementation infrastructure, not design.

**Placeholder scan:** none. Every step has either code or an exact command.

**Type consistency:** `deleteBookAction(bookId, locale)` signature consistent across Tasks 2/3. `DeleteBookButton`'s `Props` shape consistent across Tasks 3/4/5. `bookTitle` prop addition to `BookCardMenu` consistent across Task 4 steps.

**Task ordering:** Task 1 (sonner) blocks Task 3 (toast import). Task 2 (action signature) blocks Task 3 (action call). Task 3 (component) blocks Tasks 4 and 5 (consumers). Task 6 (docs) and 7 (verification) come last. No cycles.
