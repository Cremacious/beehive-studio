import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Camera, Pencil } from 'lucide-react'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
  getPublicProfileAction,
  getProfileBooksAction,
  getProfileSparksAction,
  getProfileActivityAction,
  getUserPublicClubsAction,
} from '@/lib/actions/user-profile.actions'
import { FollowButton } from './_components/follow-button'
import { FriendStatusSection } from './_components/friend-status-section'
import { ProfileUnavailable } from './_components/profile-unavailable'
import { SeriesLine } from '@/components/book/series-line'
import { optimizeCloudinaryUrl, BOOK_COVER_TRANSFORMS, AVATAR_TRANSFORMS } from '@/lib/upload/cloudinary-url'
import { FriendButton } from '@/components/friendship/friend-button'
import { db } from '@/db'
import { friendships, userMutes } from '@/db/schema'
import { and, eq, or } from 'drizzle-orm'
import { isBlocked } from '@/lib/social/is-blocked'
import { getMutualFriends } from '@/lib/social/get-mutual-friends'
import { getFriendCountAction } from '@/lib/actions/friendships.actions'
import { getUserPublicListsAction } from '@/lib/actions/reading-lists.actions'
import { ListCard } from '@/app/[locale]/(app)/community/reading-lists/_components/list-card'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'
import { ClubCard } from '@/app/[locale]/(app)/community/clubs/_components/club-card'
import { InviteClaimedToast } from '@/components/invite-claimed-toast'
import { StatStrip } from '@/components/community/stat-strip'

type Props = { params: Promise<{ locale: string; username: string }> }

// Deterministic avatar accent class for the 5 a-* gradients in community.css
function pickAvatarAccent(seed: string): string {
  const accents = ['a-mint', 'a-blue', 'a-coral', 'a-lilac', 'a-slate'] as const
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return accents[Math.abs(hash) % accents.length]
}

function initialsOf(displayName: string | null, username: string): string {
  const src = (displayName ?? username).trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || src.charAt(0).toUpperCase()
}

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export default async function AuthorProfilePage({ params }: Props) {
  const { locale, username } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const profileResult = await getPublicProfileAction(username)
  if (!profileResult.success) notFound()
  const profile = profileResult.data

  // Block-aware masquerade MUST run before any other data fetch — NEVER reveal
  // block existence. (C1 T11 / B14 pattern.)
  if (userId && (await isBlocked(userId, profile.userId))) {
    return <ProfileUnavailable locale={locale} />
  }

  const [
    booksResult,
    sparksResult,
    activityResult,
    friendCountResult,
    listsResult,
    clubsResult,
  ] = await Promise.all([
    getProfileBooksAction(profile.userId),
    getProfileSparksAction(profile.userId),
    getProfileActivityAction(profile.userId),
    getFriendCountAction(profile.userId),
    getUserPublicListsAction(profile.userId, 5),
    getUserPublicClubsAction(profile.userId, 5),
  ])

  const books = booksResult.success ? booksResult.data : []
  const openSparks = sparksResult.success ? sparksResult.data : []
  const activity = activityResult.success ? activityResult.data : []
  const friendsCount = friendCountResult.success ? friendCountResult.data : 0
  const lists = listsResult.success ? listsResult.data : []
  const clubs = clubsResult.success ? clubsResult.data : []

  // Resolve friendship status for the FriendButton initial render.
  let friendshipStatus: 'NONE' | 'PENDING_OUTGOING' | 'PENDING_INCOMING' | 'ACCEPTED' = 'NONE'
  let friendshipId: string | null = null
  const isSelf = !!userId && userId === profile.userId
  if (userId && !isSelf) {
    const [row] = await db
      .select({ id: friendships.id, requesterId: friendships.requesterId, recipientId: friendships.recipientId, status: friendships.status })
      .from(friendships)
      .where(or(
        and(eq(friendships.requesterId, userId), eq(friendships.recipientId, profile.userId)),
        and(eq(friendships.requesterId, profile.userId), eq(friendships.recipientId, userId)),
      ))
      .limit(1)
    if (row) {
      friendshipId = row.id
      if (row.status === 'ACCEPTED') friendshipStatus = 'ACCEPTED'
      else if (row.requesterId === userId) friendshipStatus = 'PENDING_OUTGOING'
      else friendshipStatus = 'PENDING_INCOMING'
    }
  }

  const mutuals = userId && !isSelf
    ? await getMutualFriends(userId, profile.userId, 9)
    : { mutuals: [], total: 0 }

  let initialMuted = false
  if (userId && !isSelf && friendshipStatus === 'ACCEPTED') {
    const [row] = await db
      .select({ mutedId: userMutes.mutedId })
      .from(userMutes)
      .where(and(eq(userMutes.muterId, userId), eq(userMutes.mutedId, profile.userId)))
      .limit(1)
    initialMuted = !!row
  }

  const avatarAccent = pickAvatarAccent(profile.userId)
  const avatarInitials = initialsOf(profile.displayName, profile.username)

  // Q3 4-stat strip — Followers / Following / Books / Clubs (Lists + Sparks get
  // dedicated sections below; wordCount preserved on the projection but no
  // longer shown in the strip).
  const statCells = [
    { value: profile.followerCount, label: 'Followers' },
    { value: profile.followingCount, label: 'Following' },
    { value: profile.bookCount, label: 'Books' },
    { value: profile.clubCount, label: 'Clubs' },
  ]

  return (
    <main className="cm-main" style={{ background: 'var(--canvas-dark-100)', minHeight: '100vh' }}>
      <div className="cm-wrap w-5xl">
        <InviteClaimedToast copy={`You and @${profile.username} are now friends.`} />

        {/* Header panel: avatar + name/handle + friendship cluster + bio + stat-strip */}
        <header className="panel" style={{ overflow: 'hidden', marginBottom: 26 }}>
          <div style={{ padding: '0 28px 22px' }}>
            {/* Top row: avatar + identity + follow/friend CTAs */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: 28, position: 'relative', zIndex: 2 }}>
              {isSelf ? (
                <Link
                  href={`/${locale}/settings/account`}
                  className="group relative inline-block"
                  style={{ borderRadius: '50%', flexShrink: 0 }}
                  aria-label="Change profile photo"
                >
                  <span
                    className={`avatar s80 ${avatarAccent}`}
                    style={{ border: '3px solid var(--canvas-dark-200)', overflow: 'hidden', display: 'block' }}
                  >
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      avatarInitials
                    )}
                  </span>
                  <span
                    className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{ background: 'oklch(0 0 0 / 0.50)' }}
                    aria-hidden
                  >
                    <Camera size={22} color="white" />
                  </span>
                </Link>
              ) : (
                <span
                  className={`avatar s80 ${avatarAccent}`}
                  style={{ border: '3px solid var(--canvas-dark-200)', overflow: 'hidden' }}
                >
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatarInitials
                  )}
                </span>
              )}
              <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                <h1 className="font-display" style={{
                  fontWeight: 700,
                  fontSize: 26,
                  letterSpacing: '-0.02em',
                  color: 'var(--canvas-dark-ink-strong)',
                  margin: 0,
                }}>
                  {profile.displayName ?? profile.username}
                </h1>
                <div className="meta-mono" style={{ marginTop: 3 }}>@{profile.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6, flexWrap: 'wrap' }}>
                {isSelf ? (
                  <Link
                    href={`/${locale}/settings/account`}
                    className="btn-tile btn-sm flex items-center gap-1.5 no-underline"
                  >
                    <Pencil size={13} />
                    Edit profile
                  </Link>
                ) : (
                  <>
                    <FollowButton
                      targetUserId={profile.userId}
                      locale={locale}
                      initialFollowing={profile.isFollowing}
                      isAuthenticated={!!userId}
                    />
                    <FriendButton
                      targetUserId={profile.userId}
                      locale={locale}
                      initialStatus={friendshipStatus}
                      initialFriendshipId={friendshipId}
                      isAuthenticated={!!userId}
                      isSelf={isSelf}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p style={{
                fontFamily: 'var(--font-prose)',
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--canvas-dark-ink)',
                margin: '16px 0 0',
                maxWidth: '64ch',
              }}>
                <RenderMentionsInText text={profile.bio} />
              </p>
            )}

            {/* Friendship UI: status pill + mutuals + kebab */}
            <div style={{ marginTop: 16 }}>
              <FriendStatusSection
                status={friendshipStatus}
                targetUserId={profile.userId}
                targetUsername={profile.username}
                mutuals={mutuals}
                initialMuted={initialMuted}
                viewerIsSelf={isSelf}
                isAuthenticated={!!userId}
                locale={locale}
              />
            </div>

            {/* 4-stat strip — Q3 lock */}
            <div style={{
              marginTop: 18,
              borderTop: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
            }}>
              <StatStrip cells={statCells} />
            </div>

            {/* Hidden meta surface for backward-compat with friends count + words */}
            <div className="meta-mono" style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span>{friendsCount} friends</span>
              <span>· {profile.wordCount >= 1000 ? `${Math.round(profile.wordCount / 1000)}k` : profile.wordCount} words written</span>
              <span>· {profile.sparkCount} Sparks created</span>
            </div>
          </div>
        </header>

        {/* (1) Lists */}
        {lists.length > 0 && (
          <div className="sec" style={{ marginBottom: 30 }}>
            <div className="sec-label" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16, color: 'var(--canvas-dark-ink-strong)', margin: 0 }}>Lists</h2>
              <span className="meta-mono">{lists.length}</span>
            </div>
            <div className="grid-3">
              {lists.map((list) => (
                <ListCard key={list.id} list={list} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {/* (2) Clubs */}
        {clubs.length > 0 && (
          <div className="sec" style={{ marginBottom: 30 }}>
            <div className="sec-label" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16, color: 'var(--canvas-dark-ink-strong)', margin: 0 }}>Clubs</h2>
              <span className="meta-mono">{clubs.length}</span>
            </div>
            <div className="grid-3">
              {clubs.map((club) => (
                <ClubCard key={club.id} club={club} locale={locale} />
              ))}
            </div>
          </div>
        )}

        {/* (3) Published books */}
        {books.length > 0 && (
          <div className="sec" style={{ marginBottom: 30 }}>
            <div className="sec-label" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16, color: 'var(--canvas-dark-ink-strong)', margin: 0 }}>Published books</h2>
              <span className="meta-mono">{books.length}</span>
            </div>
            <div className="grid-3">
              {books.map((book) => (
                <Link key={book.id} href={`/${locale}/books/${book.id}`} className="ccard">
                  <div
                    className="cc-cover cover-paper tall"
                    style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}
                  >
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={optimizeCloudinaryUrl(book.coverUrl, BOOK_COVER_TRANSFORMS)}
                        alt={book.title}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: 12 }}>
                        <div style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 17,
                          color: 'oklch(0.265 0.020 55)',
                        }}>{book.title}</div>
                      </div>
                    )}
                  </div>
                  <div className="cc-body" style={{ padding: '13px 16px' }}>
                    <div className="cc-title" title={book.title}>{book.title}</div>
                    {book.seriesName && (
                      <SeriesLine seriesName={book.seriesName} seriesNumber={book.seriesNumber} />
                    )}
                    <div className="cc-foot">
                      {book.genre && <span className="cc-stat">{book.genre}</span>}
                      <span className="cc-stat">♥ {book.likeCount}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* (4) Sparks + activity merged into ONE panel — Sparks above, divider,
            Recent activity below. Mirrors mockup 12-profile.html lines 90-107. */}
        {(openSparks.length > 0 || activity.length > 0) && (
          <div className="sec" style={{ marginBottom: 0 }}>
            <div className="sec-label" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="font-display" style={{ fontWeight: 700, fontSize: 16, color: 'var(--canvas-dark-ink-strong)', margin: 0 }}>Sparks &amp; activity</h2>
            </div>
            <section className="panel panel-pad">
              {openSparks.length > 0 && (
                <>
                  <div className="eyebrow-mono" style={{ marginBottom: 12 }}>Sparks</div>
                  <ul className="cstack" style={{ marginBottom: activity.length > 0 ? 20 : 0 }}>
                    {openSparks.map((spark) => {
                      const isVoting = spark.status === 'VOTING'
                      const isClosed = spark.status === 'CLOSED'
                      const pillClass = isClosed ? 'pill spark-closed' : isVoting ? 'pill spark-voting' : 'pill spark-open'
                      const pillLabel = isClosed ? 'Closed' : isVoting ? 'Voting' : 'Open'
                      return (
                        <li key={spark.id} className="tile tile-pad is-interactive">
                          <Link href={`/${locale}/community/sparks/${spark.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                            <span className={pillClass}><span className="dot" />{pillLabel}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="font-display" style={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: 'var(--canvas-dark-ink-strong)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>{spark.prompt}</div>
                              <div className="meta-mono" style={{ marginTop: 2 }}>{spark.entryCount} entries</div>
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              {openSparks.length > 0 && activity.length > 0 && (
                <hr className="divider" style={{ margin: '0 0 18px' }} />
              )}

              {activity.length > 0 && (
                <>
                  <div className="eyebrow-mono" style={{ marginBottom: 14 }}>Recent activity</div>
                  <ul className="cstack" style={{ gap: 16 }}>
                    {activity.map((event, i) => (
                      <li key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12 }}>
                        <span className={`avatar s32 ${avatarAccent}`}>{avatarInitials}</span>
                        <div>
                          <div style={{
                            fontSize: 13.5,
                            lineHeight: 1.5,
                            color: 'var(--canvas-dark-ink)',
                          }}>{event.label}</div>
                          <div className="meta-mono" style={{ marginTop: 4 }}>{relTime(event.createdAt)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
