import Link from 'next/link'
import { BookOpen, Zap, BookMarked } from 'lucide-react'
import type { FeedItem, NewChapterFeedItem, NewBookFeedItem, NewSparkFeedItem } from '@/lib/types/community'

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

function AuthorRow({ author, locale, label }: { author: FeedItem['author']; locale: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Link href={`/${locale}/u/${author.username}`} className="shrink-0">
        {author.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.image} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[10px] font-bold text-brand">
            {author.username[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </Link>
      <Link href={`/${locale}/u/${author.username}`} className="text-foreground font-medium hover:text-brand truncate">
        @{author.username}
      </Link>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function NewChapterCard({ item, locale }: { item: NewChapterFeedItem; locale: string }) {
  return (
    <Link
      href={`/${locale}/books/${item.bookId}/read/${item.chapterId}`}
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 hover:bg-surface-elevated transition-colors block"
    >
      <div className="flex items-center justify-between">
        <AuthorRow author={item.author} locale={locale} label="published a chapter" />
        <span className="text-[10px] text-muted-foreground">{relTime(item.publishedAt)}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <BookOpen size={14} className="text-foreground/60 shrink-0" />
        <p className="text-sm text-foreground">
          <span className="font-medium">Ch. {item.chapterNumber}: {item.chapterTitle}</span>
          <span className="text-muted-foreground"> in </span>
          <span className="font-medium">{item.bookTitle}</span>
        </p>
      </div>
    </Link>
  )
}

function NewBookCard({ item, locale }: { item: NewBookFeedItem; locale: string }) {
  return (
    <Link
      href={`/${locale}/books/${item.bookId}`}
      className="bg-card border border-border rounded-lg p-4 flex gap-4 hover:bg-surface-elevated transition-colors block"
    >
      <div className="w-16 h-24 rounded bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {item.bookCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.bookCover} alt="" className="w-full h-full object-cover" />
        ) : (
          <BookMarked size={20} className="text-foreground/30" />
        )}
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <AuthorRow author={item.author} locale={locale} label="published a book" />
          <span className="text-[10px] text-muted-foreground shrink-0">{relTime(item.publishedAt)}</span>
        </div>
        <h3 className="text-sm font-semibold text-foreground truncate">{item.bookTitle}</h3>
        {item.synopsis && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.synopsis}</p>
        )}
      </div>
    </Link>
  )
}

function NewSparkCard({ item, locale }: { item: NewSparkFeedItem; locale: string }) {
  const deadlineLabel = item.deadline
    ? (item.deadline.getTime() > Date.now() ? `Ends ${relTime(item.deadline).replace(' ago', '')}` : 'Voting closed')
    : 'No deadline'

  return (
    <Link
      href={`/${locale}/discover/spark/${item.sparkId}`}
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 hover:bg-surface-elevated transition-colors block"
    >
      <div className="flex items-center justify-between">
        <AuthorRow author={item.author} locale={locale} label="started a Spark" />
        <span className="text-[10px] text-muted-foreground">{relTime(item.createdAt)}</span>
      </div>
      <div className="flex items-start gap-2 mt-1">
        <Zap size={14} className="text-brand shrink-0 mt-0.5" />
        <p className="text-sm text-foreground italic">{item.sparkPrompt}</p>
      </div>
      <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 inline-block w-fit">
        {deadlineLabel}
      </span>
    </Link>
  )
}

export function FeedItemRenderer({ item, locale }: { item: FeedItem; locale: string }) {
  switch (item.type) {
    case 'new_chapter': return <NewChapterCard item={item} locale={locale} />
    case 'new_book':    return <NewBookCard item={item} locale={locale} />
    case 'new_spark':   return <NewSparkCard item={item} locale={locale} />
  }
}
