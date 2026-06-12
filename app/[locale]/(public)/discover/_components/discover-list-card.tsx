'use client'

import Link from 'next/link'
import { ArrowRight, Globe, Lock, Users } from 'lucide-react'
import type { ListCard } from '@/lib/actions/discover-lists.actions'
import { BookStack, OwnerAvatar } from './rail-list-card'

function relTime(d: Date | string | null): string {
  if (!d) return 'never'
  const date = typeof d === 'string' ? new Date(d) : d
  const ms = Date.now() - date.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 30) return `${d2}d ago`
  const mo = Math.floor(d2 / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

const VIS_META = {
  PUBLIC: { label: 'Public', Icon: Globe },
  FRIENDS: { label: 'Friends', Icon: Users },
  PRIVATE: { label: 'Private', Icon: Lock },
} as const

type Variant = 'rail' | 'grid' | 'row'

type Props = {
  list: ListCard
  locale: string
  variant?: Variant
}

export function DiscoverListCard({ list, locale, variant = 'grid' }: Props) {
  const vis = VIS_META[list.visibility]
  const VisIcon = vis.Icon
  const widthClass = variant === 'rail' ? 'w-[320px] shrink-0' : 'w-full'
  const coverSize = variant === 'grid' ? 72 : 60
  const tags = list.tags.slice(0, 2)

  return (
    <Link
      href={`/${locale}/reading-lists/${list.id}`}
      className={`block no-underline ${widthClass}`}
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
        <BookStack
          previews={list.bookCoverPreviews}
          bookCount={list.bookCount}
          coverSize={coverSize}
          fanDeg={3}
          overlap={Math.round(coverSize * 0.2)}
        />

        <div style={{ padding: '20px' }}>
          <div
            className="grid gap-5 items-start"
            style={{
              gridTemplateColumns: variant === 'grid' ? '1fr auto' : '1fr',
            }}
          >
            <div className="min-w-0">
              <h3
                className="font-semibold text-[18px] truncate mb-1.5"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-comfortaa)',
                }}
              >
                {list.title}
              </h3>

              <div
                className="flex items-center gap-1.5 text-[11px] min-w-0 mb-3"
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

              {list.description ? (
                <p
                  className="text-[13px] leading-relaxed line-clamp-2 mb-3"
                  style={{
                    color: 'var(--canvas-dark-ink)',
                    fontFamily: 'var(--font-prose)',
                  }}
                >
                  {list.description}
                </p>
              ) : null}

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

              <div
                aria-hidden
                style={{ height: 1, background: 'var(--br-card)' }}
              />

              <div
                className="flex items-center gap-2 flex-wrap pt-3 text-[10px]"
                style={{
                  color: 'var(--canvas-dark-ink-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span>📚 {list.bookCount}</span>
                <span>👥 {list.followerCount}</span>

                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 uppercase"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--r-pill)',
                    letterSpacing: '0.1em',
                  }}
                >
                  <VisIcon size={9} aria-hidden />
                  {vis.label}
                </span>

                {list.genre ? (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 uppercase"
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 'var(--r-pill)',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {list.genre}
                  </span>
                ) : null}

                <span className="ml-auto">{relTime(list.lastUpdatedAt)}</span>
              </div>
            </div>

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
                View list
                <ArrowRight size={13} aria-hidden />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
