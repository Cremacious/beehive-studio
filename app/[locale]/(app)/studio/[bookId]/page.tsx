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

  const [bookResult, binderResult] = await Promise.all([
    getBookAction(bookId),
    getBinderTreeAction(bookId),
  ])

  if (!bookResult.success || !binderResult.success) notFound()

  return (
    <BookEditorProvider
      bookId={bookId}
      bookTitle={bookResult.data.title}
      initialBinderItems={binderResult.data}
    >
      <div className="flex h-[calc(100vh-var(--header-height,0px))] overflow-hidden">
        <BinderTree />
        <ChapterEditor />
        <MetadataPanel />
      </div>
    </BookEditorProvider>
  )
}
