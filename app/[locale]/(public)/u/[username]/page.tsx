import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Camera, Pencil, BookOpen, List, Users, Zap, Plus } from 'lucide-react'
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
import { optimizeCloudinaryUrl, AVATAR_TRANSFORMS } from '@/lib/upload/cloudinary-url'
import { FriendButton } from '@/components/friendship/friend-button'
import { db } from '@/db'
import { friendships, userMutes, userProfiles } from '@/db/schema'
import { and, eq, or } from 'drizzle-orm'
import { isBlocked } from '@/lib/social/is-blocked'
import { getMutualFriends } from '@/lib/social/get-mutual-friends'
import { getFriendCountAction } from '@/lib/actions/friendships.actions'
import { getUserPublicListsAction } from '@/lib/actions/reading-lists.actions'
import { ListCard } from '@/app/[locale]/(app)/community/reading-lists/_components/list-card'
import { ClubCard } from '@/app/[locale]/(app)/community/clubs/_components/club-card'
import { BookGridCard } from '@/app/[locale]/(public)/discover/_components/book-grid-card'
import { SparkGridCard } from '@/app/[locale]/(public)/discover/_components/spark-grid-card'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'
import { InviteClaimedToast } from '@/components/invite-claimed-toast'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { SITE_NAME, absoluteUrl, localeAlternates, toMetaDescription } from '@/lib/seo/site'

type Props = { params: Promise<{ locale: string; username: string }> }

// ─── SEO (issue #52) ──────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username } = await params

  const [row] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      bio: userProfiles.bio,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.username, username))
    .limit(1)

  if (!row || !row.username) {
    return { title: SITE_NAME, robots: { index: false, follow: false } }
  }

  const name = row.displayName ?? row.username
  const title = `${name} (@${row.username})`
  const description =
    toMetaDescription(row.bio) ??
    `${name} is writing and sharing books on ${SITE_NAME}. Read their work, lists, and clubs.`
  const path = `/u/${row.username}`
  const ogImage = row.avatarUrl
    ? optimizeCloudinaryUrl(row.avatarUrl, AVATAR_TRANSFORMS)
    : undefined

  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: 'profile',
      title,
      description,
      url: absoluteUrl(`/${locale}${path}`),
      images: ogImage ? [{ url: ogImage, alt: name }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

// ─── Canonical chrome (matches the dark iOS design system) ────────────────────

const PANEL: CSSProperties = {
  background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
  borderRadius: 'var(--r-card)',
  borderTop: 'var(--br-card)',
  boxShadow: 'var(--sh-card)',
}

// Fluid grid for cards that fill their cell (books, sparks, lists).
const GRID_FLUID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
  gap: 14,
}

// Wrap layout for the fixed-width shared ClubCard (340px).
const CLUBS_WRAP: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 14 }

// Deterministic avatar gradient (replaces the community.css a-* accent classes).
const AVATAR_GRADIENTS = [
  'linear-gradient(140deg, oklch(0.80 0.12 165), oklch(0.62 0.12 165))',
  'linear-gradient(140deg, oklch(0.78 0.12 240), oklch(0.60 0.13 240))',
  'linear-gradient(140deg, oklch(0.80 0.13 35), oklch(0.63 0.14 35))',
  'linear-gradient(140deg, oklch(0.78 0.12 305), oklch(0.60 0.13 305))',
  'linear-gradient(140deg, oklch(0.80 0.05 256), oklch(0.62 0.04 256))',
] as const

function avatarGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
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

function formatCompact(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

// ─── Presentational pieces ────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--canvas-dark-ink-strong)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {typeof count === 'number' && count > 0 && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

// Owner empty card (E1): icon + line + a single CTA. Visitor empty: a quiet line.
function EmptyCard({
  isSelf,
  icon,
  ownLine,
  visitorLine,
  cta,
}: {
  isSelf: boolean
  icon: ReactNode
  ownLine: string
  visitorLine: string
  cta?: { label: string; href: string; brand?: boolean }
}) {
  if (!isSelf) {
    return (
      <section style={{ ...PANEL, padding: '20px 24px', textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontStyle: 'italic',
            color: 'var(--canvas-dark-ink-faint)',
          }}
        >
          {visitorLine}
        </p>
      </section>
    )
  }
  return (
    <section style={{ ...PANEL, padding: '28px 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          background: 'oklch(from var(--brand) l c h / 0.10)',
          color: 'var(--brand)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        {icon}
      </div>
      <p
        style={{
          margin: '0 auto 14px',
          maxWidth: '46ch',
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--canvas-dark-ink-faint)',
        }}
      >
        {ownLine}
      </p>
      {cta && (
        <Link
          href={cta.href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontFamily: 'var(--font-display)',
            fontWeight: cta.brand ? 700 : 600,
            fontSize: 13,
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 'var(--r-pill)',
            ...(cta.brand
              ? { background: 'var(--brand)', color: 'var(--brand-ink)' }
              : {
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  color: 'var(--canvas-dark-ink)',
                  borderTop: 'var(--br-card)',
                  boxShadow: 'var(--sh-tile)',
                }),
          }}
        >
          {cta.brand && <Plus size={14} />}
          {cta.label}
        </Link>
      )}
    </section>
  )
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
    getUserPublicListsAction(profile.userId, 6),
    getUserPublicClubsAction(profile.userId, 6),
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

  const gradient = avatarGradient(profile.userId)
  const avatarInitials = initialsOf(profile.displayName, profile.username)
  const avatarSrc = profile.avatarUrl
    ? optimizeCloudinaryUrl(profile.avatarUrl, AVATAR_TRANSFORMS)
    : null

  // 4-stat strip — Followers / Following / Books / Clubs (Q3 lock).
  const statCells = [
    { value: profile.followerCount, label: 'Followers' },
    { value: profile.followingCount, label: 'Following' },
    { value: profile.bookCount, label: 'Books' },
    { value: profile.clubCount, label: 'Clubs' },
  ]

  // Single clean meta line replaces the old hidden backward-compat row.
  const metaBits: string[] = []
  if (profile.wordCount > 0) metaBits.push(`${formatCompact(profile.wordCount)} words written`)
  if (profile.sparkCount > 0) metaBits.push(`${profile.sparkCount} Sparks created`)
  if (friendsCount > 0) metaBits.push(`${friendsCount} friends`)

  const isEmpty =
    books.length === 0 &&
    lists.length === 0 &&
    clubs.length === 0 &&
    openSparks.length === 0 &&
    activity.length === 0

  const avatarBox: CSSProperties = {
    width: 88,
    height: 88,
    borderRadius: '50%',
    border: '3px solid var(--canvas-dark-300)',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 30,
    color: 'var(--brand-ink)',
    background: gradient,
  }

  // Person / ProfilePage structured data (issue #52). The profile page is
  // public for any username; block masquerade already returned above for
  // blocked viewers, so emitting here is safe.
  const profileUrl = absoluteUrl(`/${locale}/u/${profile.username}`)
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: profile.displayName ?? profile.username,
      alternateName: `@${profile.username}`,
      url: profileUrl,
      ...(avatarSrc ? { image: avatarSrc } : {}),
      ...(profile.bio ? { description: profile.bio } : {}),
    },
  }

  return (
    <main style={{ background: 'var(--canvas-dark-100)', minHeight: '100vh' }}>
      <JsonLd data={personJsonLd} />
      <div className="page-x tier-standard" style={{ paddingTop: 28, paddingBottom: 80 }}>
        <InviteClaimedToast copy={`You and @${profile.username} are now friends.`} />

        {/* ─── Header panel (flat) ─────────────────────────────────────────── */}
        <header style={{ ...PANEL, padding: '24px 24px 22px', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {isSelf ? (
              <Link
                href={`/${locale}/settings/account`}
                className="group relative inline-block"
                style={{ borderRadius: '50%', flexShrink: 0 }}
                aria-label="Change profile photo"
              >
                <span style={avatarBox}>
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
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
              <span style={avatarBox}>
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </span>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 26,
                  letterSpacing: '-0.02em',
                  color: 'var(--canvas-dark-ink-strong)',
                  margin: 0,
                  wordBreak: 'break-word',
                }}
              >
                {profile.displayName ?? profile.username}
              </h1>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--canvas-dark-ink-muted)',
                  marginTop: 4,
                }}
              >
                @{profile.username}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
            <p
              style={{
                fontFamily: 'var(--font-prose)',
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--canvas-dark-ink)',
                margin: '16px 0 0',
                maxWidth: '64ch',
              }}
            >
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

          {/* 4-stat strip */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
            }}
          >
            {statCells.map((cell, i) => (
              <div
                key={cell.label}
                style={{
                  textAlign: 'center',
                  padding: '0 4px',
                  borderLeft:
                    i === 0
                      ? undefined
                      : '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 19,
                    color: 'var(--canvas-dark-ink-strong)',
                  }}
                >
                  {cell.value}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--canvas-dark-ink-muted)',
                    marginTop: 3,
                  }}
                >
                  {cell.label}
                </div>
              </div>
            ))}
          </div>

          {/* Single clean meta line (replaces the old hidden backward-compat row) */}
          {metaBits.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              {metaBits.map((bit, i) => (
                <span key={i}>{i > 0 ? `· ${bit}` : bit}</span>
              ))}
            </div>
          )}
        </header>

        {/* ─── Content ─────────────────────────────────────────────────────── */}
        {isEmpty && !isSelf ? (
          // Visitor viewing a fully empty profile: one calm, intentional block.
          <section style={{ ...PANEL, padding: '48px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: 'oklch(1 0 0 / 0.04)',
                color: 'var(--canvas-dark-ink-faint)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <BookOpen size={24} />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--canvas-dark-ink-strong)',
                margin: '0 0 6px',
              }}
            >
              This writer hasn&apos;t shared anything yet
            </p>
            <p
              style={{
                margin: '0 auto',
                maxWidth: '46ch',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--canvas-dark-ink-faint)',
              }}
            >
              When {profile.displayName ?? `@${profile.username}`} publishes books, builds lists, or
              joins clubs, you&apos;ll see them here.
            </p>
          </section>
        ) : (
          <>
            {/* Lists */}
            <div style={{ marginTop: 4 }}>
              <SectionHeader title="Lists" count={lists.length} />
              {lists.length > 0 ? (
                <div style={GRID_FLUID}>
                  {lists.map((list) => (
                    <ListCard key={list.id} list={list} locale={locale} />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  isSelf={isSelf}
                  icon={<List size={20} />}
                  ownLine="You haven't made any reading lists yet."
                  visitorLine="No reading lists yet."
                  cta={{ label: 'New list', href: `/${locale}/community/reading-lists`, brand: true }}
                />
              )}
            </div>

            {/* Clubs */}
            <div style={{ marginTop: 30 }}>
              <SectionHeader title="Clubs" count={clubs.length} />
              {clubs.length > 0 ? (
                <div style={CLUBS_WRAP}>
                  {clubs.map((club) => (
                    <ClubCard key={club.id} club={club} locale={locale} />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  isSelf={isSelf}
                  icon={<Users size={20} />}
                  ownLine="You're not in any book clubs yet."
                  visitorLine="Not in any book clubs yet."
                  cta={{ label: 'Discover clubs', href: `/${locale}/community/clubs` }}
                />
              )}
            </div>

            {/* Published books */}
            <div style={{ marginTop: 30 }}>
              <SectionHeader title="Published books" count={books.length} />
              {books.length > 0 ? (
                <div style={GRID_FLUID}>
                  {books.map((book) => (
                    <BookGridCard key={book.id} book={book} locale={locale} />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  isSelf={isSelf}
                  icon={<BookOpen size={20} />}
                  ownLine="Nothing published yet. Books you make public will appear here."
                  visitorLine="No published books yet."
                  cta={{ label: 'Go to Studio', href: `/${locale}/studio` }}
                />
              )}
            </div>

            {/* Sparks */}
            <div style={{ marginTop: 30 }}>
              <SectionHeader title="Sparks" count={openSparks.length} />
              {openSparks.length > 0 ? (
                <div style={GRID_FLUID}>
                  {openSparks.map((spark) => (
                    <SparkGridCard
                      key={spark.id}
                      spark={spark}
                      locale={locale}
                      isAuthenticated={!!userId}
                    />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  isSelf={isSelf}
                  icon={<Zap size={20} />}
                  ownLine="No active Sparks. Enter a Spark or start your own to get going."
                  visitorLine="No active Sparks right now."
                  cta={{ label: 'Browse Sparks', href: `/${locale}/community/sparks` }}
                />
              )}
            </div>

            {/* Recent activity */}
            <div style={{ marginTop: 30 }}>
              <SectionHeader title="Recent activity" />
              {activity.length > 0 ? (
                <section style={{ ...PANEL, padding: '20px 22px' }}>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {activity.map((event, i) => (
                      <li
                        key={i}
                        style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 12 }}
                      >
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 13,
                            color: 'var(--brand-ink)',
                            background: gradient,
                          }}
                        >
                          {avatarSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                          ) : (
                            avatarInitials
                          )}
                        </span>
                        <div>
                          <div
                            style={{
                              fontSize: 13.5,
                              lineHeight: 1.5,
                              color: 'var(--canvas-dark-ink)',
                            }}
                          >
                            {event.label}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10.5,
                              color: 'var(--canvas-dark-ink-faint)',
                              marginTop: 4,
                            }}
                          >
                            {relTime(event.createdAt)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <EmptyCard
                  isSelf={isSelf}
                  icon={<Zap size={20} />}
                  ownLine="No activity yet. Enter a Spark or follow some writers to get started."
                  visitorLine="No recent activity."
                />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
