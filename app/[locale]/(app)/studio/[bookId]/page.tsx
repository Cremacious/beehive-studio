import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getBookAction } from '@/lib/actions/book.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { getBookHive } from '@/lib/hive/get-book-hive'
import { isBookOverflow } from '@/lib/billing/book-overflow'
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
  let bookHive: Awaited<ReturnType<typeof getBookHive>>

  try {
    ;[bookResult, binderResult, bookHive] = await Promise.all([
      getBookAction(bookId),
      getBinderTreeAction(bookId),
      getBookHive(bookId),
    ])
  } catch {
    notFound()
  }

  if (!bookResult!.success || !binderResult!.success) notFound()

  const session = await auth.api.getSession({ headers: await headers() })
  const bookOverflow = session?.user
    ? await isBookOverflow(session.user.id, bookId)
    : false

  return (
    <BookEditorProvider
      bookId={bookId}
      bookTitle={bookResult!.data.title}
      locale={locale}
      initialBinderItems={binderResult!.data}
      bookOverflow={bookOverflow}
      bookHive={bookHive!}
      currentUserId={session?.user?.id ?? null}
    >
      {/* The (app) layout uses min-h-screen (not h-screen), so h-full on a
          flex-1 ancestor resolves to content-height — not viewport. Pin the
          studio columns to viewport-minus-nav (h-14 = 56px) so the binder /
          editor / metadata fill the screen instead of stopping ~80% down. */}
      <div className="flex gap-2 h-[calc(100vh-68px)] overflow-hidden">
        <BinderTree />
        <CorkboardOrEditor />
        <RightPanelSlot />
      </div>
      <ErrorToasts />
    </BookEditorProvider>
  )
}
