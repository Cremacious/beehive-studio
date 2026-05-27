import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { CreateBookModal } from './create-book-modal'

type Props = {
  locale: string
  templates: { id: string; name: string; genre: string | null }[]
}

export function StudioEmptyState({ locale, templates }: Props) {
  return (
    <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col items-center text-center py-28 px-6 max-w-lg">
        <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
          <BookOpen className="w-9 h-9 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mainFont mb-2">Your stories start here</h1>
        <p className="text-sm text-muted-foreground mb-7 max-w-sm">
          Write your own book or discover stories from other writers.
        </p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <CreateBookModal locale={locale} templates={templates}>
            <button className="px-5 py-2.5 rounded-full bg-brand text-brand-ink text-sm font-bold mainFont hover:bg-brand-hover transition-colors">
              Start writing
            </button>
          </CreateBookModal>
          <Link
            href={`/${locale}/discover`}
            className="px-5 py-2.5 rounded-full border border-border text-foreground text-sm font-medium hover:border-foreground/50 transition-colors"
          >
            Explore books
          </Link>
        </div>
      </div>
    </main>
  )
}
