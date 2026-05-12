import { getBookAction } from '@/lib/actions/book.actions'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ locale: string; bookId: string }>
}

export default async function BookEditorPage({ params }: Props) {
  const { bookId } = await params
  const result = await getBookAction(bookId)
  if (!result.success) notFound()

  const book = result.data

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center px-6 py-20 max-w-lg">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 border border-brand/20 mb-6">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <h1 className="font-comfortaa font-bold text-2xl mb-2">{book.title}</h1>
        <p className="text-white/40 text-sm">
          Book editor coming in Phase 3.
        </p>
      </div>
    </div>
  )
}
