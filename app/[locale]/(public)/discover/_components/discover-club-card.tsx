'use client'

import Link from 'next/link'
import { ArrowRight, Globe, Lock, Users } from 'lucide-react'
import type { ClubCard } from '@/lib/actions/discover-clubs.actions'
import { relTime } from '@/lib/utils/rel-time'

const VIS_META = {
  PUBLIC: { label: 'Public', Icon: Globe },
  FRIENDS: { label: 'Friends', Icon: Users },
  PRIVATE: { label: 'Private', Icon: Lock },
} as const

type Variant = 'rail' | 'grid' | 'row'

type Props = {
  club: ClubCard
  locale: string
  variant?: Variant
}

export function DiscoverClubCard({ club, locale, variant = 'grid' }: Props) {
  const vis = VIS_META[club.visibility]
  const VisIcon = vis.Icon
  const widthClass =
    variant === 'rail' ? 'w-[320px] shrink-0' : 'w-full'

  return (
    <Link
      href={`/${locale}/clubs/${club.id}`}
      className={`block no-underline ${widthClass}`}
      aria-label={`Open Club: ${club.name}`}
    >
      <div
        className="relative transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-tile)',
          padding: '22px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow =
            '0 6px 18px rgb(0 0 0 / 0.35), 0 2px 4px rgb(0 0 0 / 0.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = 'var(--sh-tile)'
        }}
      >
        <div
          className="grid gap-5 items-center"
          style={{ gridTemplateColumns: variant === 'grid' ? '1fr auto' : '1fr' }}
        >
          {/* Main column */}
          <div className="min-w-0">
            {/* Header */}
            <div
              className="grid gap-3 mb-4"
              style={{ gridTemplateColumns: '56px 1fr' }}
            >
              <BookThumb
                url={club.currentBookCoverUrl}
                alt={club.currentBookTitle ?? ''}
              />
              <div className="min-w-0 flex flex-col gap-1">
                <h3
                  className="font-semibold text-[18px] truncate"
                  style={{
                    color: 'var(--canvas-dark-ink-strong)',
                    fontFamily: 'var(--font-comfortaa)',
                  }}
                >
                  {club.name}
                </h3>
                {club.currentBookTitle ? (
                  <p
                    className="text-[10px] uppercase truncate"
                    style={{
                      color: 'var(--canvas-dark-ink-muted)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    currently reading {club.currentBookTitle}
                  </p>
                ) : (
                  <p
                    className="text-[10px] italic truncate"
                    style={{
                      color: 'var(--canvas-dark-ink-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    No current book
                  </p>
                )}
                <div
                  className="flex items-center gap-1.5 text-[11px] min-w-0"
                  style={{
                    color: 'var(--canvas-dark-ink-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <OwnerAvatar
                    avatarUrl={club.ownerAvatarUrl}
                    username={club.ownerUsername}
                    size={14}
                  />
                  <span className="truncate">
                    led by @{club.ownerUsername ?? 'unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {club.description ? (
              <p
                className="text-[13px] leading-relaxed line-clamp-2 mb-4"
                style={{
                  color: 'var(--canvas-dark-ink)',
                  fontFamily: 'var(--font-prose)',
                }}
              >
                {club.description}
              </p>
            ) : null}

            {/* Members section */}
            <div
              className="flex items-center gap-3 mb-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <MemberStack previews={club.memberPreviews} />
              <span
                className="text-[12px] font-semibold"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {club.memberCount}{' '}
                {club.memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>

            {/* Hairline divider */}
            <div
              aria-hidden
              style={{ height: 1, background: 'var(--br-card)' }}
            />

            {/* Activity + pills row */}
            <div
              className="flex items-center gap-2 flex-wrap pt-3 text-[10px]"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {club.lastActivityAt ? (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#4ade80',
                      boxShadow: '0 0 6px rgba(74,222,128,0.7)',
                      display: 'inline-block',
                    }}
                  />
                  <span>Active {relTime(club.lastActivityAt)}</span>
                </>
              ) : (
                <span className="italic">No activity yet</span>
              )}

              {club.openJoin ? (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 uppercase tracking-wider"
                  style={{
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    borderRadius: 'var(--r-pill)',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                  }}
                >
                  Open
                </span>
              ) : null}

              <span
                className="inline-flex items-center gap-1 ml-auto px-1.5 py-0.5 uppercase"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 'var(--r-pill)',
                  letterSpacing: '0.1em',
                }}
              >
                <VisIcon size={9} aria-hidden />
                {vis.label}
              </span>

              {club.genre ? (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 uppercase"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--r-pill)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {club.genre}
                </span>
              ) : null}
            </div>
          </div>

          {/* Grid variant: brand-pill CTA on right */}
          {variant === 'grid' ? (
            <div
              className="inline-flex items-center gap-1.5 shrink-0 self-start text-[12px] uppercase"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                fontWeight: 700,
                padding: '7px 14px',
              }}
            >
              Visit
              <ArrowRight size={13} aria-hidden />
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function BookThumb({ url, alt }: { url: string | null; alt: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        className="object-cover shrink-0"
        style={{
          width: 56,
          height: 84,
          borderRadius: 'var(--r-row)',
          boxShadow: '0 1px 3px rgb(0 0 0 / 0.3)',
        }}
      />
    )
  }
  return (
    <div
      aria-hidden
      className="shrink-0"
      style={{
        width: 56,
        height: 84,
        background:
          'linear-gradient(135deg, oklch(0.92 0.05 75), oklch(0.86 0.07 70))',
        borderRadius: 'var(--r-row)',
        boxShadow: '0 1px 3px rgb(0 0 0 / 0.3)',
      }}
    />
  )
}

function OwnerAvatar({
  avatarUrl,
  username,
  size,
}: {
  avatarUrl: string | null
  username: string | null
  size: number
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const initial = (username ?? '?').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background:
          'linear-gradient(135deg, var(--brand), oklch(0.78 0.13 70))',
        color: 'var(--brand-ink)',
        fontFamily: 'var(--font-display)',
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
      }}
    >
      {initial}
    </span>
  )
}

function MemberStack({
  previews,
}: {
  previews: Array<{ userId: string; avatarUrl: string | null }>
}) {
  const shown = previews.slice(0, 4)
  return (
    <div className="flex items-center shrink-0">
      {shown.map((p, i) => (
        <MemberAvatar
          key={p.userId}
          avatarUrl={p.avatarUrl}
          first={i === 0}
        />
      ))}
    </div>
  )
}

function MemberAvatar({
  avatarUrl,
  first,
}: {
  avatarUrl: string | null
  first: boolean
}) {
  const size = 22
  const ringStyle: React.CSSProperties = {
    width: size,
    height: size,
    marginLeft: first ? 0 : -6,
    border: '2px solid var(--canvas-dark-300)',
    borderRadius: '50%',
  }
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="object-cover shrink-0"
        style={ringStyle}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center shrink-0"
      style={{
        ...ringStyle,
        background:
          'linear-gradient(135deg, var(--brand), oklch(0.78 0.13 70))',
      }}
    />
  )
}
