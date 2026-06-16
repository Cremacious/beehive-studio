import Link from 'next/link'

export type ListCardData = {
  id: string
  title: string
  description: string | null
  genre: string | null
  bookCount: number
  followerCount: number
  sourceTag: 'yours' | 'following' | 'liked' | null
  curator: {
    userId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  }
  coverPreviews: Array<{ bookId: string; coverUrl: string | null }>
}

type Props = {
  list: ListCardData
  size?: 'sm' | 'md'
  showSourceTag?: boolean
  href: string
}

type SourceTagStyle = { bg: string; color: string; label: string }

function sourceTagStyle(tag: 'yours' | 'following' | 'liked'): SourceTagStyle {
  if (tag === 'yours') {
    return {
      bg: 'rgba(255,195,0,0.15)',
      color: 'var(--brand)',
      label: 'YOURS',
    }
  }
  if (tag === 'liked') {
    return {
      bg: 'rgba(168,85,247,0.15)',
      color: 'oklch(0.72 0.18 300)',
      label: 'LIKED',
    }
  }
  return {
    bg: 'rgba(56,189,248,0.15)',
    color: 'oklch(0.74 0.14 240)',
    label: 'FOLLOWING',
  }
}

// Deterministic placeholder gradient per userId — stable across renders.
function placeholderGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  return `linear-gradient(135deg, oklch(0.55 0.12 ${hue}), oklch(0.4 0.1 ${(hue + 40) % 360}))`
}

function CoverThumb({
  coverUrl,
  seed,
  width,
  height,
  rotate,
  translateX,
  zIndex,
}: {
  coverUrl: string | null
  seed: string
  width: number
  height: number
  rotate: number
  translateX: number
  zIndex: number
}) {
  const style: React.CSSProperties = {
    width,
    height,
    borderRadius: 4,
    transform: `rotate(${rotate}deg) translateX(${translateX}px)`,
    zIndex,
    boxShadow:
      '0 12px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.5)',
    flexShrink: 0,
  }
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        style={{ ...style, objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      aria-hidden
      style={{ ...style, background: placeholderGradient(seed) }}
    />
  )
}

function CuratorAvatar({
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
        style={{
          width: size,
          height: size,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
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
        fontFamily: 'var(--font-display, var(--font-comfortaa))',
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {initial}
    </span>
  )
}

export function ListCard({
  list,
  size = 'md',
  showSourceTag = false,
  href,
}: Props) {
  const heroHeight = size === 'md' ? 170 : 130
  const coverW = size === 'md' ? 70 : 50
  const coverH = size === 'md' ? 105 : 75
  const translate = 20

  const covers = list.coverPreviews.slice(0, 3)
  while (covers.length < 3) {
    covers.push({ bookId: `placeholder-${covers.length}`, coverUrl: null })
  }

  const handle = list.curator.username ?? 'unknown'
  const blurb =
    list.description && list.description.trim().length > 0
      ? list.description
      : `${list.bookCount} books curated by @${handle}.`

  const sourceTag =
    showSourceTag && list.sourceTag ? sourceTagStyle(list.sourceTag) : null

  return (
    <Link
      href={href}
      className="block no-underline w-full h-full group"
      aria-label={`Open list: ${list.title}`}
    >
      <div
        className="h-full flex flex-col overflow-hidden transition-all duration-150 group-hover:-translate-y-0.5"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card, 20px)',
          border: 'var(--br-card, 1px solid rgba(255,255,255,0.05))',
          boxShadow: 'var(--sh-card)',
          minHeight: 280,
        }}
      >
        {/* Hero band — flat, no gradient */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            height: heroHeight,
            background: 'var(--canvas-dark-300)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* 3-cover stack */}
          <div
            className="flex relative"
            style={{ paddingTop: 18, zIndex: 2 }}
          >
            <CoverThumb
              coverUrl={covers[0].coverUrl}
              seed={covers[0].bookId}
              width={coverW}
              height={coverH}
              rotate={-8}
              translateX={translate}
              zIndex={1}
            />
            <CoverThumb
              coverUrl={covers[1].coverUrl}
              seed={covers[1].bookId}
              width={coverW}
              height={coverH}
              rotate={0}
              translateX={0}
              zIndex={3}
            />
            <CoverThumb
              coverUrl={covers[2].coverUrl}
              seed={covers[2].bookId}
              width={coverW}
              height={coverH}
              rotate={8}
              translateX={-translate}
              zIndex={2}
            />
          </div>

          {/* Genre pill top-right */}
          {list.genre && (
            <span
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '3px 8px',
                borderRadius: 'var(--r-pill, 999px)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--canvas-dark-ink-muted)',
                fontWeight: 600,
                zIndex: 4,
              }}
            >
              {list.genre}
            </span>
          )}

          {/* Source-tag pill top-left */}
          {sourceTag && (
            <span
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '3px 8px',
                borderRadius: 'var(--r-pill, 999px)',
                background: sourceTag.bg,
                color: sourceTag.color,
                fontWeight: 700,
                zIndex: 4,
              }}
            >
              {sourceTag.label}
            </span>
          )}
        </div>

        {/* Body */}
        <div
          className="flex flex-col flex-1"
          style={{ padding: '14px 18px 18px' }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-comfortaa)',
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--canvas-dark-ink-strong)',
              lineHeight: 1.2,
              margin: '0 0 6px',
            }}
          >
            {list.title}
          </h3>

          {/* Curator row */}
          <div
            className="flex items-center"
            style={{ gap: 6, marginBottom: 10 }}
          >
            <CuratorAvatar
              avatarUrl={list.curator.avatarUrl}
              username={list.curator.username}
              size={18}
            />
            <span
              style={{
                fontSize: 11,
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              @{handle}
            </span>
          </div>

          {/* Blurb */}
          <p
            style={{
              fontFamily: 'var(--font-newsreader, var(--font-prose))',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--canvas-dark-ink-muted)',
              lineHeight: 1.4,
              margin: '0 0 12px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {blurb}
          </p>

          {/* Footer */}
          <div
            className="mt-auto flex justify-between items-center"
            style={{
              paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--canvas-dark-ink-muted)',
              fontWeight: 600,
            }}
          >
            <span>
              <strong
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-comfortaa)',
                  fontSize: 12,
                  letterSpacing: 0,
                  textTransform: 'none',
                  marginRight: 4,
                }}
              >
                {list.bookCount}
              </strong>
              BOOKS
            </span>
            <span>
              <strong
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-comfortaa)',
                  fontSize: 12,
                  letterSpacing: 0,
                  textTransform: 'none',
                  marginRight: 4,
                }}
              >
                {list.followerCount}
              </strong>
              FOLLOWERS
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
