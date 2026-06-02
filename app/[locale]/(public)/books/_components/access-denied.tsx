import Link from 'next/link'
import { Lock, Users } from 'lucide-react'

type Props = {
  reason: 'PRIVATE' | 'FRIENDS_ONLY'
  locale: string
}

export function AccessDenied({ reason, locale }: Props) {
  const isFriends = reason === 'FRIENDS_ONLY'
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#262728] px-6">
      <div
        className="max-w-md rounded-[var(--r-card)] p-8 text-center"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: '1px solid var(--br-card)',
        }}
      >
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          {isFriends ? (
            <Users className="h-6 w-6 text-[var(--brand)]" />
          ) : (
            <Lock className="h-6 w-6 text-[var(--brand)]" />
          )}
        </div>
        <h1 className="mb-2 font-comfortaa text-xl font-bold text-[var(--brand)]">
          {isFriends ? "Only the author's friends can read this" : 'This book is private'}
        </h1>
        <p className="mb-6 text-sm text-[var(--canvas-dark-ink)]">
          {isFriends
            ? 'The author has shared this book with their friends only.'
            : 'The author has not shared this book.'}
        </p>
        <Link
          href={`/${locale}/discover`}
          className="inline-block rounded-[var(--r-btn)] bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
        >
          Discover other books
        </Link>
      </div>
    </div>
  )
}
