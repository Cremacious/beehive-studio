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
      <div>
        <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-2">Hive</p>
        <h1 className="text-2xl font-medium text-foreground">Welcome to {hive.name}</h1>
        {hive.description && (
          <p className="text-sm text-muted-foreground mt-2">{hive.description}</p>
        )}
        {isShadow && (
          <p className="text-xs text-muted-foreground mt-2 italic">Standalone hive (no linked book)</p>
        )}
      </div>

      {showBookCard && book && (
        <div className="bg-card border border-border rounded-lg p-4 flex gap-4">
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
              <h2 className="text-lg font-medium text-foreground truncate">{book.title}</h2>
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

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            Members
          </p>
          <p className="text-2xl font-medium text-foreground mt-1">{members.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last active</p>
          <p className="text-2xl font-medium text-foreground mt-1">{lastActive ? relTime(lastActive) : '—'}</p>
        </div>
      </div>
    </div>
  )
}
