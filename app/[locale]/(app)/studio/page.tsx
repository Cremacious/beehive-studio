import Link from 'next/link'
import { db } from '@/db'
import { bookTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserBooksAction } from '@/lib/actions/book.actions'
import type { BookSummary } from '@/lib/actions/book.actions'
import { CreateBookModal } from './_components/create-book-modal'

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  const [templates, booksResult] = await Promise.all([
    db
      .select({ id: bookTemplates.id, name: bookTemplates.name, genre: bookTemplates.genre })
      .from(bookTemplates)
      .where(eq(bookTemplates.isSystemTemplate, true))
      .orderBy(bookTemplates.name),
    getUserBooksAction(),
  ])

  const books = booksResult.success ? booksResult.data : []

  if (books.length === 0) {
    return <EmptyState locale={locale} templates={templates} />
  }

  return (
    <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-bold text-2xl">My Books</h1>
        <CreateBookModal locale={locale} templates={templates}>
          <button className="rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2 font-bold font-display bg-[#FFC300] text-[#0a0a0a] shadow-[0_4px_16px_-8px_rgba(255,195,0,0.55)] transition-all duration-150 hover:bg-[#FFD040] hover:-translate-y-px active:bg-[#e0ac01] active:translate-y-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            New Book
          </button>
        </CreateBookModal>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {books.map(book => (
          <BookCard key={book.id} book={book} locale={locale} />
        ))}
      </div>
    </main>
  )
}

function BookCard({ book, locale }: { book: BookSummary; locale: string }) {
  return (
    <Link
      href={`/${locale}/studio/${book.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card hover:border-brand/40 transition-colors overflow-hidden"
    >
      {/* Cover */}
      <div className="aspect-[2/3] bg-surface flex items-center justify-center overflow-hidden">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface">
            <svg viewBox="0 0 60 80" className="w-12 h-16 opacity-20" fill="none">
              <rect x="4" y="4" width="52" height="72" rx="4" stroke="#FFC300" strokeWidth="2" />
              <line x1="14" y1="24" x2="46" y2="24" stroke="#FFC300" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="32" x2="46" y2="32" stroke="#FFC300" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="40" x2="36" y2="40" stroke="#FFC300" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand transition-colors">
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {book.wordCount.toLocaleString()} words
        </p>
      </div>
    </Link>
  )
}

function EmptyState({
  locale,
  templates,
}: {
  locale: string
  templates: { id: string; name: string; genre: string | null }[]
}) {
  return (
    <main className="flex-1 flex items-center justify-center relative min-h-[calc(100vh-3.5rem)]">
      <div
        className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(ellipse_50%_50%_at_50%_45%,black,transparent_70%)]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'><path d='M15 1 L45 1 L60 26 L45 51 L15 51 L0 26 Z' fill='none' stroke='%23FFC300' stroke-opacity='0.05' stroke-width='1'/></svg>\")",
          backgroundSize: '60px 52px',
        }}
      />

      <div className="relative text-center px-6 py-20 max-w-lg">
        <div className="mb-10 inline-flex items-center justify-center animate-[floatUp_4s_ease-in-out_infinite]">
          <div className="relative">
            <svg viewBox="0 0 180 160" className="w-[180px] h-[160px]" fill="none">
              <rect x="30" y="100" width="120" height="18" rx="4" fill="#252525" stroke="#2a2a2a" strokeWidth="1" />
              <rect x="32" y="102" width="3" height="14" rx="1" fill="#3a3a3a" />
              <rect x="40" y="78" width="110" height="18" rx="4" fill="#1c1c1c" stroke="#2a2a2a" strokeWidth="1" />
              <rect x="42" y="80" width="3" height="14" rx="1" fill="#333" />
              <rect x="35" y="56" width="115" height="18" rx="4" fill="rgba(255,195,0,0.15)" stroke="rgba(255,195,0,0.3)" strokeWidth="1" />
              <rect x="37" y="58" width="3" height="14" rx="1" fill="rgba(255,195,0,0.4)" />
              <line x1="48" y1="63" x2="90" y2="63" stroke="rgba(255,195,0,0.2)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="48" y1="68" x2="76" y2="68" stroke="rgba(255,195,0,0.15)" strokeWidth="1.5" strokeLinecap="round" />
              <g transform="translate(90, 28)">
                <path d="M0 -20 L17.3 -10 L17.3 10 L0 20 L-17.3 10 L-17.3 -10 Z" fill="rgba(255,195,0,0.1)" stroke="#FFC300" strokeWidth="1.2" strokeOpacity="0.4" />
                <path d="M0 -8 L7 -4 L7 4 L0 8 L-7 4 L-7 -4 Z" fill="#FFC300" fillOpacity="0.5" stroke="none" />
              </g>
              <circle cx="55" cy="35" r="1.5" fill="#FFC300" fillOpacity="0.3" />
              <circle cx="130" cy="42" r="1" fill="#FFC300" fillOpacity="0.25" />
              <circle cx="145" cy="70" r="1.5" fill="#FFC300" fillOpacity="0.2" />
            </svg>
          </div>
        </div>

        <h1 className="font-display font-bold text-[28px] sm:text-[32px] leading-tight tracking-tight">
          Your stories start here
        </h1>
        <p className="text-white/50 text-[15px] mt-3 leading-relaxed max-w-sm mx-auto">
          Create your first book to open the writing workspace.
        </p>

        <div className="mt-8">
          <CreateBookModal locale={locale} templates={templates}>
            <button className="rounded-full px-7 py-3.5 text-[15px] inline-flex items-center gap-2.5 font-bold font-display bg-[#FFC300] text-[#0a0a0a] shadow-[0_6px_24px_-10px_rgba(255,195,0,0.55)] transition-all duration-150 hover:bg-[#FFD040] hover:-translate-y-px active:bg-[#e0ac01] active:translate-y-0">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" /><path d="M5 12h14" />
              </svg>
              Create your first book
            </button>
          </CreateBookModal>
        </div>
      </div>
    </main>
  )
}
