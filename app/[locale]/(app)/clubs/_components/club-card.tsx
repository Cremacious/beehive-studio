import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { ClubSummary } from '@/lib/actions/book-clubs.actions'
import { VisibilityPill } from '@/app/[locale]/(public)/discover/_components/visibility-pill'

type Props = {
  club: ClubSummary
  locale: string
}

/**
 * T13 enriched: visibility pill (non-PUBLIC), tag chips first 3 + "+N more",
 * owner avatar/handle, current-book line, member count.
 */
export function ClubCard({ club, locale }: Props) {
  const tags = club.tags ?? []
  const visibleTags = tags.slice(0, 3)
  const extraTagCount = tags.length - visibleTags.length
  const owner = club.owner

  return (
    <Link
      href={`/${locale}/clubs/${club.id}`}
      className="block p-4 rounded-[var(--r-card)] border border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)] transition-colors"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <div className="flex items-start gap-2 mb-1">
        <h3
          className="font-bold text-[var(--canvas-dark-ink-strong)] flex-1 min-w-0 truncate"
          style={{ fontFamily: 'var(--font-comfortaa)' }}
        >
          {club.name}
        </h3>
        {club.visibility !== 'PUBLIC' && (
          <span className="shrink-0">
            <VisibilityPill visibility={club.visibility} />
          </span>
        )}
      </div>

      {club.description && (
        <p className="text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-2 mb-2">
          {club.description}
        </p>
      )}

      {owner?.username && (
        <div className="flex items-center gap-2 mb-2">
          {owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.avatarUrl}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <div
              className="h-5 w-5 rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
              }}
            />
          )}
          <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
            by @{owner.username}
          </span>
        </div>
      )}

      {visibleTags.length > 0 && (
        <ul className="flex flex-wrap gap-1 mb-2">
          {visibleTags.map((tag) => (
            <li
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
            >
              {tag}
            </li>
          ))}
          {extraTagCount > 0 && (
            <li className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]">
              +{extraTagCount} more
            </li>
          )}
        </ul>
      )}

      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] flex items-center gap-1">
        <span>{club.memberCount} members</span>
        {club.currentBook && (
          <>
            <span aria-hidden="true">·</span>
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            <span className="truncate normal-case tracking-normal italic">
              Reading {club.currentBook.title}
            </span>
          </>
        )}
      </p>
    </Link>
  )
}
