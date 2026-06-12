'use client'

import Link from 'next/link'
import type { ListCard } from '@/lib/actions/discover-lists.actions'
import { relTime } from '@/lib/utils/rel-time'

type Props = {
  list: ListCard
  locale: string
}

export function RailListCard({ list, locale }: Props) {
  const tags = list.tags.slice(0, 2)
  return (
    <Link
      href={`/${locale}/reading-lists/${list.id}`}
      className="block no-underline w-[280px] shrink-0"
      aria-label={`Open List: ${list.title}`}
    >
      <div
        className="relative transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-tile)',
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
        {/* Book stack at top */}
        <BookStack
          previews={list.bookCoverPreviews}
          bookCount={list.bookCount}
          coverSize={60}
        />

        {/* Body */}
        <div style={{ padding: '18px' }}>
          <h3
            className="font-semibold text-[16px] truncate mb-1.5"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-comfortaa)',
            }}
          >
            {list.title}
          </h3>

          <div
            className="flex items-center gap-1.5 text-[11px] min-w-0 mb-2.5"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <OwnerAvatar
              avatarUrl={list.ownerAvatarUrl}
              username={list.ownerUsername}
              size={14}
            />
            <span className="truncate">
              curated by @{list.ownerUsername ?? 'unknown'}
            </span>
          </div>

          {tags.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase"
                  style={{
                    background: 'oklch(from var(--brand) l c h / 0.12)',
                    color: 'var(--brand)',
                    borderRadius: 'var(--r-pill)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {/* Hairline divider */}
          <div
            aria-hidden
            style={{ height: 1, background: 'var(--br-card)' }}
          />

          {/* Meta row */}
          <div
            className="flex items-center gap-2 pt-3 text-[10px]"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>📚 {list.bookCount}</span>
            <span>👥 {list.followerCount}</span>
            <span className="ml-auto">{relTime(list.lastUpdatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Shared sub-components (also used by discover-list-card + featured-list-hero) ─

export function BookStack({
  previews,
  bookCount,
  coverSize,
  fanDeg = 3,
  overlap = 12,
}: {
  previews: ListCard['bookCoverPreviews']
  bookCount: number
  coverSize: number
  fanDeg?: number
  overlap?: number
}) {
  const stackHeight = Math.round(coverSize * 1.5) + 24
  const containerStyle: React.CSSProperties = {
    height: stackHeight,
    paddingTop: 14,
  }
  if (bookCount === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={containerStyle}
      >
        <span
          className="italic text-[12px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Empty list
        </span>
      </div>
    )
  }
  const shown = previews.slice(0, 3)
  const rotations = [-fanDeg, 0, fanDeg]
  const zIndexes = [1, 3, 2]
  return (
    <div className="flex items-center justify-center" style={containerStyle}>
      <div className="flex items-center">
        {shown.map((p, i) => {
          const rot = rotations[i] ?? 0
          const z = zIndexes[i] ?? 1
          return (
            <BookCoverThumb
              key={p.bookId ?? `cover-${i}`}
              coverUrl={p.coverUrl}
              alt={p.title}
              size={coverSize}
              rotateDeg={rot}
              marginLeft={i === 0 ? 0 : -overlap}
              zIndex={z}
            />
          )
        })}
      </div>
    </div>
  )
}

function BookCoverThumb({
  coverUrl,
  alt,
  size,
  rotateDeg,
  marginLeft,
  zIndex,
}: {
  coverUrl: string | null
  alt: string
  size: number
  rotateDeg: number
  marginLeft: number
  zIndex: number
}) {
  const height = Math.round(size * 1.5)
  const style: React.CSSProperties = {
    width: size,
    height,
    marginLeft,
    transform: `rotate(${rotateDeg}deg)`,
    zIndex,
    borderRadius: 'var(--r-row)',
    boxShadow: '0 2px 6px rgb(0 0 0 / 0.4)',
  }
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={alt}
        className="object-cover shrink-0"
        style={style}
      />
    )
  }
  return (
    <div
      aria-hidden
      className="shrink-0"
      style={{
        ...style,
        background:
          'linear-gradient(135deg, oklch(0.92 0.05 75), oklch(0.86 0.07 70))',
      }}
    />
  )
}

export function OwnerAvatar({
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
