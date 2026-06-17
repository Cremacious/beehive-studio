'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ListCard } from '@/lib/actions/discover-lists.actions'
import { BookStack, OwnerAvatar } from './rail-list-card'

type Props = {
  list: ListCard
  locale: string
}

export function FeaturedListHero({ list, locale }: Props) {
  const tags = list.tags.slice(0, 2)
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
        style={{ gridTemplateColumns: '200px 1fr auto' }}
      >
        {/* LEFT: enlarged book stack */}
        <div className="shrink-0">
          <BookStack
            previews={list.bookCoverPreviews}
            bookCount={list.bookCount}
            coverSize={100}
            fanDeg={5}
            overlap={20}
          />
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
              Rising curator
            </span>
          </div>

          <h2
            className="font-bold text-[28px] truncate"
            style={{
              color: 'var(--brand)',
              fontFamily: 'var(--font-comfortaa)',
              lineHeight: 1.15,
            }}
          >
            {list.title}
          </h2>

          <div
            className="flex items-center gap-1.5 text-[11px] min-w-0"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <OwnerAvatar
              avatarUrl={list.ownerAvatarUrl}
              username={list.ownerUsername}
              size={16}
            />
            <span className="truncate">
              curated by @{list.ownerUsername ?? 'unknown'}
            </span>
          </div>

          {list.description ? (
            <p
              className="text-[14px] leading-relaxed line-clamp-3"
              style={{
                color: 'var(--canvas-dark-ink)',
                fontFamily: 'var(--font-prose)',
              }}
            >
              {list.description}
            </p>
          ) : null}
        </div>

        {/* RIGHT: follower count + tags + CTA */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex flex-col items-end">
            <span
              className="font-bold text-[28px] leading-none"
              style={{
                color: 'var(--brand)',
                fontFamily: 'var(--font-comfortaa)',
              }}
            >
              {list.followerCount}
            </span>
            <span
              className="text-[10px] uppercase mt-1"
              style={{
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.1em',
              }}
            >
              {list.followerCount === 1 ? 'follower' : 'followers'}
            </span>
          </div>

          {tags.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
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

          <Link
            href={`/${locale}/community/reading-lists/${list.id}`}
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
            View the list
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
