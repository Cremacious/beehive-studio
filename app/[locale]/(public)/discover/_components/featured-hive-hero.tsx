'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HiveCard } from '@/lib/actions/discover-hives.actions'

type Props = {
  hive: HiveCard
  locale: string
}

export function FeaturedHiveHero({ hive, locale }: Props) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200)), radial-gradient(circle at top right, var(--brand-soft), transparent 60%)',
        backgroundBlendMode: 'normal, screen',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
        padding: '28px',
      }}
    >
      <div
        className="grid gap-7 items-center"
        style={{ gridTemplateColumns: '160px 1fr auto' }}
      >
        {/* LEFT: book cover with brand strip */}
        <div className="relative shrink-0">
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'var(--brand)',
              borderRadius: 'var(--r-row) var(--r-row) 0 0',
              zIndex: 1,
            }}
          />
          <BookCover url={hive.bookCoverUrl} alt={hive.bookTitle} />
        </div>

        {/* CENTER: meta + description */}
        <div className="min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center px-3 py-1 text-[10px] uppercase"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.12em',
                fontWeight: 700,
              }}
            >
              Hidden gem
            </span>
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
          </div>

          <h2
            className="font-bold text-[28px] truncate"
            style={{
              color: 'var(--brand)',
              fontFamily: 'var(--font-comfortaa)',
              lineHeight: 1.15,
            }}
          >
            {hive.name}
          </h2>

          {hive.description ? (
            <p
              className="text-[14px] leading-relaxed line-clamp-3"
              style={{
                color: 'var(--canvas-dark-ink)',
                fontFamily: 'var(--font-prose)',
              }}
            >
              {hive.description}
            </p>
          ) : null}

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
              size={16}
            />
            <span className="truncate">
              led by @{hive.ownerUsername ?? 'unknown'}
            </span>
          </div>
        </div>

        {/* RIGHT: stat column + CTA */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex flex-col items-end">
            <span
              className="font-bold text-[28px] leading-none"
              style={{
                color: 'var(--brand)',
                fontFamily: 'var(--font-comfortaa)',
              }}
            >
              {hive.memberCount}
            </span>
            <span
              className="text-[10px] uppercase mt-1"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
              }}
            >
              {hive.memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>

          <div
            className="flex items-center gap-2 text-[11px]"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
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
            <span>{Math.round(hive.activityScore7d)} actions this week</span>
          </div>

          <Link
            href={`/${locale}/hive/${hive.id}`}
            className="inline-flex items-center gap-1.5 mt-1 no-underline"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              fontWeight: 700,
              fontSize: 13,
              height: 36,
              padding: '0 20px',
            }}
          >
            Visit the Hive
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

function BookCover({ url, alt }: { url: string | null; alt: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        className="object-cover"
        style={{
          width: 160,
          height: 240,
          borderRadius: 'var(--r-row)',
          boxShadow: '0 4px 12px rgb(0 0 0 / 0.4)',
        }}
      />
    )
  }
  return (
    <div
      aria-hidden
      style={{
        width: 160,
        height: 240,
        background:
          'linear-gradient(135deg, oklch(0.92 0.05 75), oklch(0.86 0.07 70))',
        borderRadius: 'var(--r-row)',
        boxShadow: '0 4px 12px rgb(0 0 0 / 0.4)',
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
