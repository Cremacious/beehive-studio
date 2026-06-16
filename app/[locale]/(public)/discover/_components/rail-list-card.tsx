import type { ListCard as DiscoverListCardData } from '@/lib/actions/discover-lists.actions'
import { GENRE_LABEL, isValidGenre } from '@/lib/discover/genres'
import { ListCard, type ListCardData } from '@/components/list/list-card'

type Props = {
  list: DiscoverListCardData
  locale: string
}

function adapt(list: DiscoverListCardData): ListCardData {
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    genre:
      list.genre && isValidGenre(list.genre) ? GENRE_LABEL[list.genre] : null,
    bookCount: list.bookCount,
    followerCount: list.followerCount,
    sourceTag: null,
    curator: {
      userId: list.ownerUserId,
      username: list.ownerUsername,
      displayName: list.ownerDisplayName,
      avatarUrl: list.ownerAvatarUrl,
    },
    coverPreviews: list.bookCoverPreviews
      .filter((p) => p.bookId !== null)
      .map((p) => ({
        bookId: (p.bookId as string) ?? '',
        coverUrl: p.coverUrl,
      })),
  }
}

export function RailListCard({ list, locale }: Props) {
  return (
    <ListCard
      list={adapt(list)}
      size="sm"
      showSourceTag={false}
      href={`/${locale}/reading-lists/${list.id}`}
    />
  )
}

// ─── Legacy shared sub-components — still consumed by featured-list-hero.tsx
// and discover-list-card.tsx. Preserved to avoid call-site churn.

export function BookStack({
  previews,
  bookCount,
  coverSize,
  fanDeg = 3,
  overlap = 12,
}: {
  previews: DiscoverListCardData['bookCoverPreviews']
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
