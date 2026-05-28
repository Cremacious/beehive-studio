import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
  getPublicProfileAction,
  getProfileBooksAction,
  getProfileSparksAction,
  getProfileActivityAction,
} from '@/lib/actions/user-profile.actions'
import { FollowButton } from './_components/follow-button'
import { SeriesLine } from '@/components/book/series-line'

type Props = { params: Promise<{ locale: string; username: string }> }

export default async function AuthorProfilePage({ params }: Props) {
  const { locale, username } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const profileResult = await getPublicProfileAction(username)
  if (!profileResult.success) notFound()
  const profile = profileResult.data

  const [booksResult, sparksResult, activityResult] = await Promise.all([
    getProfileBooksAction(profile.userId),
    getProfileSparksAction(profile.userId),
    getProfileActivityAction(profile.userId),
  ])

  const books = booksResult.success ? booksResult.data : []
  const openSparks = sparksResult.success ? sparksResult.data : []
  const activity = activityResult.success ? activityResult.data : []

  const ACTIVITY_ICONS: Record<string, string> = {
    chapter_published: '📖',
    spark_created: '⚡',
    entry_commented: '💬',
    creator_choice: '⭐',
  }

  function fmtWords(n: number): string {
    return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Profile header */}
      <div className="px-6 pt-7 pb-6 border-b border-[#2a2a2a]">
        <div className="flex gap-5 items-start max-w-3xl">
          {/* Avatar */}
          <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#3a2a1a] to-[#1a1a3a] shrink-0 flex items-center justify-center text-3xl overflow-hidden">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              : <span>✍</span>
            }
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="text-white text-[22px] font-bold">{profile.displayName ?? profile.username}</h1>
              <FollowButton
                targetUserId={profile.userId}
                locale={locale}
                initialFollowing={profile.isFollowing}
                isAuthenticated={!!userId}
              />
            </div>
            {profile.bio && (
              <p className="text-[#888] text-[13px] leading-relaxed max-w-md mb-3">{profile.bio}</p>
            )}
            {/* Stats row */}
            <div className="flex gap-4 flex-wrap text-[12px]">
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.followerCount}</strong> followers</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.followingCount}</strong> following</span>
              <span className="text-[#333]">·</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{fmtWords(profile.wordCount)}</strong> words written</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.bookCount}</strong> books published</span>
              <span className="text-[#888]"><strong className="text-[#ddd]">{profile.sparkCount}</strong> Sparks created</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">

        {/* Published Books */}
        {books.length > 0 && (
          <section className="mb-8">
            <p className="text-[#555] text-[11px] uppercase tracking-widest mb-3">Published Books</p>
            <div className="grid grid-cols-4 gap-3">
              {books.map(book => (
                <Link key={book.id} href={`/${locale}/books/${book.id}`} className="block group">
                  <div className="relative rounded-md mb-2 overflow-hidden bg-[#2a2a2a]" style={{ aspectRatio: '2/3' }}>
                    {book.coverUrl && (
                      <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="text-[#ddd] text-[12px] font-semibold leading-tight mb-0.5 group-hover:text-white transition-colors">{book.title}</p>
                  {book.seriesName && (
                    <p className="text-[#777] mb-0.5 truncate">
                      <SeriesLine seriesName={book.seriesName} seriesNumber={book.seriesNumber} />
                    </p>
                  )}
                  <p className="text-[#555] text-[10px]">{fmtWords(book.wordCount)} words · ♥ {book.likeCount}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Open Sparks */}
        {openSparks.length > 0 && (
          <section className="mb-8">
            <p className="text-[#555] text-[11px] uppercase tracking-widest mb-3">Open Sparks</p>
            <div className="flex flex-col gap-2">
              {openSparks.map(spark => (
                <Link key={spark.id} href={`/${locale}/discover/spark/${spark.id}`}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 flex items-center gap-3 hover:border-[#3a3a3a] transition-colors">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    spark.status === 'VOTING' ? 'bg-[#1a1a3a] text-[#8888ff]' : 'bg-[#2a1a00] text-[#FFC300]'
                  }`}>
                    {spark.status === 'VOTING' ? '🗳 voting' : '⚡ open'}
                  </span>
                  <p className="text-[#aaa] text-[13px] flex-1 truncate">&ldquo;{spark.prompt}&rdquo;</p>
                  <span className="text-[#555] text-[11px] shrink-0">{spark.entryCount} entries →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        {activity.length > 0 && (
          <section>
            <p className="text-[#555] text-[11px] uppercase tracking-widest mb-3">Recent Activity</p>
            <div className="flex flex-col gap-3">
              {activity.map((event, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-[16px] mt-0.5">{ACTIVITY_ICONS[event.type] ?? '•'}</span>
                  <div>
                    <p className="text-[#777] text-[12px] leading-relaxed">{event.label}</p>
                    <p className="text-[#444] text-[11px]">{new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
