'use client'

import Link from 'next/link'
import type { HiveCard } from '@/lib/actions/discover-hives.actions'
import { relTime } from '@/lib/utils/rel-time'

type Props = {
  hive: HiveCard
  locale: string
}

export function RailHiveCard({ hive, locale }: Props) {
  return (
    <Link
      href={`/${locale}/hive/${hive.id}`}
      className="block no-underline w-[280px] shrink-0"
      aria-label={`Open Hive: ${hive.name}`}
    >
      <div
        className="relative transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-tile)',
          padding: '18px',
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
        {/* Header */}
        <div
          className="grid gap-3 mb-4"
          style={{ gridTemplateColumns: '48px 1fr' }}
        >
          <BookThumb url={hive.bookCoverUrl} alt={hive.bookTitle} />
          <div className="min-w-0 flex flex-col gap-1">
            <h3
              className="font-semibold text-[16px] truncate"
              style={{
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'var(--font-comfortaa)',
              }}
            >
              {hive.name}
            </h3>
            <p
              className="text-[10px] uppercase truncate"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
              }}
            >
              around {hive.bookTitle}
            </p>
            <div
              className="flex items-center gap-1.5 text-[11px] min-w-0"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <OwnerAvatar
                avatarUrl={hive.ownerAvatarUrl}
                username={hive.ownerUsername}
                size={14}
              />
              <span className="truncate">
                led by @{hive.ownerUsername ?? 'unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Members section */}
        <div
          className="flex items-center gap-3 mb-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <MemberStack previews={hive.memberPreviews} />
          <span
            className="text-[12px] font-semibold"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {hive.memberCount} {hive.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>

        {/* Hairline divider */}
        <div
          aria-hidden
          style={{
            height: 1,
            background: 'var(--br-card)',
          }}
        />

        {/* Activity row */}
        <div
          className="flex items-center gap-2 pt-3 text-[10px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {hive.lastActivityAt ? (
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
              <span>Active {relTime(hive.lastActivityAt)}</span>
            </>
          ) : (
            <span className="italic">No activity yet</span>
          )}
          {hive.bookGenre ? (
            <span
              className="ml-auto uppercase"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                letterSpacing: '0.1em',
              }}
            >
              {hive.bookGenre}
            </span>
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
          width: 48,
          height: 72,
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
        width: 48,
        height: 72,
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
