import Link from 'next/link'
import { Lock, Users } from 'lucide-react'

type Props = {
  reason: 'PRIVATE' | 'FRIENDS_ONLY'
  locale: string
}

export function AccessDenied({ reason, locale }: Props) {
  const isFriends = reason === 'FRIENDS_ONLY'
  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center mb-5">
          {isFriends ? (
            <Users className="w-6 h-6 text-[#888]" />
          ) : (
            <Lock className="w-6 h-6 text-[#888]" />
          )}
        </div>
        <h1 className="text-white text-[20px] font-semibold mb-2">
          {isFriends ? "Only the author's friends can read this" : 'This book is private'}
        </h1>
        <p className="text-[#888] text-[14px] mb-6">
          {isFriends
            ? 'The author has shared this book with their friends only.'
            : 'The author has not shared this book.'}
        </p>
        <Link
          href={`/${locale}/discover`}
          className="inline-block px-5 py-2 bg-[#FFC300] text-black font-semibold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
        >
          Discover other books
        </Link>
      </div>
    </div>
  )
}
