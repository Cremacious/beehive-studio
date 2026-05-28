# Delete Book

**Date:** 2026-05-28
**Status:** Design approved, ready for plan-phase

## Problem

Users have no way to delete a book they've created. `deleteBookAction(bookId)` exists from Phase 2 but has no UI entry point.

## Scope

Add two UI entry points for deletion, both invoking a shared `DeleteBookButton` component that wraps the existing `ConfirmDialog` (destructive variant). Server action gets a tiny extension to invalidate the library cache. No schema changes — DB-level FK cascades already handle binder items, chapters, snapshots, comments, likes, bookmarks, reading progress.

## 1. Server action

Extend the existing `deleteBookAction` at [lib/actions/book.actions.ts:447](lib/actions/book.actions.ts:447):

```ts
export async function deleteBookAction(bookId: string, locale: string): Promise<ActionResult>
```

Behavior unchanged except: after the DB delete, call `revalidatePath(\`/${locale}/studio\`)` so the library page refreshes when the user lands there. No existing callers reference this action (verified via grep before plan); `locale` becomes a required second arg.

## 2. Shared component — `DeleteBookButton`

New file at `components/book/delete-book-button.tsx`. Render-prop shape so both entry points share the same dialog/action/redirect logic but plug different triggers (DropdownMenuItem vs Button).

```tsx
type Props = {
  bookId: string
  bookTitle: string
  locale: string
  children: (onTrigger: () => void) => React.ReactNode
}
```

Behavior:
- `onTrigger` opens a destructive `ConfirmDialog` with title `Delete "{bookTitle}"?` and copy: `This permanently removes the book and all of its chapters, notes, and snapshots. This cannot be undone.`
- Confirm button label: `Delete book`.
- On success: `toast.success(\`Deleted "${bookTitle}"\`)`, `router.push(\`/${locale}/studio\`)`, `router.refresh()`.
- On failure: `toast.error('Could not delete book')`.
- Uses `sonner` (project toast lib).

## 3. Entry point 1 — Library kebab menu

Modify [book-card-menu.tsx](app/[locale]/(app)/studio/_components/book-card-menu.tsx). Add a third DropdownMenuItem below Edit details, separated visually via `text-destructive`:

```tsx
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

`onSelect` with `e.preventDefault()` keeps the menu open while the dialog mounts (same pattern as binder-item-menu's delete). `BookCardMenu` gets a new required `bookTitle` prop passed from the parent book-card component.

## 4. Entry point 2 — Details page Danger Zone

Add a new non-collapsible "Danger Zone" section at the bottom of `/studio/[bookId]/details`, after the Sharing section, OUTSIDE the form's submit flow so the page Save button can never trigger it:

```tsx
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

## 5. Testing

- **No new unit tests.** `deleteBookAction`'s ownership/auth check already exists; the `revalidatePath` addition has no meaningful unit coverage. `DeleteBookButton` is thin render-prop wiring.
- **Manual verification:**
  1. Library kebab → Delete book → dialog shows the title → Confirm → redirects to `/studio`, toast appears, card gone.
  2. Details page → Danger Zone → Delete this book → same flow.
  3. Cancel from dialog → no change.
  4. Delete a book with chapters/snapshots/comments → confirm the post-delete `/studio` loads without orphan errors (FK cascade smoke test).
  5. tsc + npm test clean before commit.

## 6. Out of scope

- **Soft delete / Undo toast.** Hard delete only. Revisit if loss reports come in.
- **Type-to-confirm.** Simple destructive confirm matches the existing app vocabulary.
- **Bulk delete.** No multi-select on the library.
- **Hive-shared book handling.** Books aren't shared across users yet; revisit if SP-B Friendships or a future shared-edit feature changes that.
