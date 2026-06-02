import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  locale: string
  synopsis: string | null
  firstPublishedAt: Date
  lastUpdatedAt: Date
  author: {
    userId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  }
}

function fmt(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function AboutSection({
  locale,
  synopsis,
  firstPublishedAt,
  lastUpdatedAt,
  author,
}: Props) {
  return (
    <section
      id="about"
      className="scroll-mt-20 rounded-[var(--r-card)] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <h2 className="mb-4 font-comfortaa text-lg font-bold text-[var(--brand)]">
        About this book
      </h2>

      {synopsis ? (
        <div className="mb-6 max-w-prose space-y-3 text-sm leading-relaxed text-[var(--canvas-dark-ink)]">
          {synopsis.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm italic text-[var(--canvas-dark-ink-muted)]">
          The author hasn&apos;t written a description yet.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
            First published
          </dt>
          <dd className="mt-0.5 text-[var(--canvas-dark-ink-strong)]">{fmt(firstPublishedAt)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
            Last updated
          </dt>
          <dd className="mt-0.5 text-[var(--canvas-dark-ink-strong)]">{fmt(lastUpdatedAt)}</dd>
        </div>
      </dl>

      <div
        className="flex items-center gap-4 rounded-[var(--r-row)] p-4"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
        }}
      >
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-[var(--canvas-dark-200)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-comfortaa text-base font-bold text-[var(--canvas-dark-ink-strong)]">
            {author.displayName ?? author.username ?? 'Unknown'}
          </p>
          {author.username && (
            <p className="truncate font-mono text-xs text-[var(--canvas-dark-ink-muted)]">
              @{author.username}
            </p>
          )}
        </div>
        {author.username && (
          <Link
            href={`/${locale}/u/${author.username}`}
            className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
          >
            View profile
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  )
}
