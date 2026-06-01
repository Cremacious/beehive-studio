import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, ExternalLink, Users } from 'lucide-react'
import { getHiveAction } from '@/lib/actions/hive.actions'
import { requireAuth } from '@/lib/require-auth'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function HiveDashboardPage({ params }: { params: Promise<{ locale: string; hiveId: string }> }) {
  const { locale, hiveId } = await params
  const viewerId = await requireAuth()
  const result = await getHiveAction(hiveId).catch(() => null)
  if (!result?.success) notFound()

  const { hive, members, book } = result.data
  const lastActive = hive.updatedAt
  const isShadow = book?.status === 'STANDALONE_HIVE_SHADOW'
  const isAuthor = book?.userId === viewerId
  const showBookCard = book && !isShadow

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <section
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="p-6"
      >
        <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Hive</p>
        <h1
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa font-bold text-2xl mb-2"
        >
          Welcome to {hive.name}
        </h1>
        {hive.description && (
          <p className="text-sm text-muted-foreground mt-2">{hive.description}</p>
        )}
        {isShadow && (
          <p className="text-xs text-muted-foreground mt-2 italic">Standalone hive (no linked book)</p>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs font-mono" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
          <span>·</span>
          <span>Last active {lastActive ? relTime(lastActive) : '—'}</span>
        </div>
      </section>

      {showBookCard && book && (
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-tile)',
            border: 'var(--br-card)',
          }}
          className="p-5 flex gap-4"
        >
          <div className="flex-shrink-0">
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-20 h-28 object-cover rounded border border-border"
              />
            ) : (
              <div className="w-20 h-28 rounded border border-border bg-muted flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div>
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Book</p>
              <h2
                style={{ color: 'var(--brand)' }}
                className="font-comfortaa font-bold text-lg truncate"
              >
                {book.title}
              </h2>
              {book.authorUsername && (
                <p className="text-xs text-muted-foreground mt-0.5">by @{book.authorUsername}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              <Link
                href={`/${locale}/books/${book.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand text-brand-ink hover:bg-brand/90 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Read the book
              </Link>
              {isAuthor && (
                <Link
                  href={`/${locale}/studio/${book.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-surface-elevated transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in studio
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {isShadow && (
        <div
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-tile)',
            border: 'var(--br-card)',
          }}
          className="p-5"
        >
          <h2
            style={{ color: 'var(--brand)' }}
            className="font-comfortaa font-bold text-lg mb-1"
          >
            Standalone hive
          </h2>
          <p className="text-sm text-muted-foreground">No book linked to this hive.</p>
        </div>
      )}
    </div>
  )
}
