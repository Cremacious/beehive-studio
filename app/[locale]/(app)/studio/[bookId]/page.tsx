import { notFound } from 'next/navigation'
import { getBookAction } from '@/lib/actions/book.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { BookEditorProvider } from './_components/book-editor-provider'
import { BinderTree } from './_components/binder/binder-tree'
import { CorkboardOrEditor } from './_components/corkboard-or-editor'
import { RightPanelSlot } from './_components/right-panel-slot'
import { ErrorToasts } from './_components/error-toasts'

type Props = {
  params: Promise<{ locale: string; bookId: string }>
}

export default async function BookEditorPage({ params }: Props) {
  const { bookId, locale } = await params

  let bookResult: Awaited<ReturnType<typeof getBookAction>>
  let binderResult: Awaited<ReturnType<typeof getBinderTreeAction>>

  try {
    ;[bookResult, binderResult] = await Promise.all([
      getBookAction(bookId),
      getBinderTreeAction(bookId),
    ])
  } catch {
    notFound()
  }

  if (!bookResult!.success || !binderResult!.success) notFound()

  return (
    <BookEditorProvider
      bookId={bookId}
      bookTitle={bookResult!.data.title}
      locale={locale}
      initialBinderItems={binderResult!.data}
    >
      {/* The (app) layout uses min-h-screen (not h-screen), so h-full on a
          flex-1 ancestor resolves to content-height — not viewport. Pin the
          studio columns to viewport-minus-nav (h-14 = 56px) so the binder /
          editor / metadata fill the screen instead of stopping ~80% down. */}
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        <BinderTree />
        <CorkboardOrEditor />
        <RightPanelSlot />
      </div>
      <ErrorToasts />
    </BookEditorProvider>
  )
}
