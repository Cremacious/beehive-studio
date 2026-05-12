import { notFound } from 'next/navigation'
import { getBookAction } from '@/lib/actions/book.actions'
import { getBinderTreeAction } from '@/lib/actions/binder.actions'
import { BookEditorProvider } from './_components/book-editor-provider'
import { BinderTree } from './_components/binder/binder-tree'
import { ChapterEditor } from './_components/editor/chapter-editor'
import { MetadataPanel } from './_components/metadata/metadata-panel'

type Props = {
  params: Promise<{ locale: string; bookId: string }>
}

export default async function BookEditorPage({ params }: Props) {
  const { bookId } = await params

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
      initialBinderItems={binderResult!.data}
    >
      <div className="flex h-full overflow-hidden">
        <BinderTree />
        <ChapterEditor />
        <MetadataPanel />
      </div>
    </BookEditorProvider>
  )
}
