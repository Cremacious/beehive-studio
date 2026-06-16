'use client'

import Link from 'next/link'
import { X, Plus, UserPlus, Tag, Sparkles, Heart, Share2 } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ListGhostVariant } from '@/lib/lists/pick-list-ghosts'

export type ListGhostCardProps = {
  variant: ListGhostVariant
  locale: string
  onDismiss: () => void
  /** Required when variant === 'trending-from-network' */
  trendingHint?: { title: string; curator: string } | null
  /** Required when variant === 'themed-list-nudge' */
  smallestOwnedListId?: string | null
  /** Required when variant === 'share-list-link' */
  highestFollowerListId?: string | null
}

type IconCmp = ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>

const COPY: Record<
  ListGhostVariant,
  {
    pill: string
    Icon: IconCmp
    title: string
    body: string
    cta: string
    iconTint: string
  }
> = {
  'create-list': {
    pill: 'NUDGE',
    Icon: Plus,
    title: 'Start your first themed list',
    body: 'Group books by mood, season, or trope. Themed lists earn 3x more followers.',
    cta: 'Start a list →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
  },
  'follow-curator': {
    pill: 'SUGGESTION',
    Icon: UserPlus,
    title: 'Follow a curator',
    body: 'Find writers whose taste matches yours and follow their reading lists.',
    cta: 'Browse curators →',
    iconTint: 'oklch(0.6 0.15 240 / 0.18)',
  },
  'themed-list-nudge': {
    pill: 'NUDGE',
    Icon: Tag,
    title: 'Tag your lists',
    body: 'Add a genre and tags so readers can find your lists in discover.',
    cta: 'Edit your smallest list →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
  },
  'trending-from-network': {
    pill: 'FROM DISCOVER',
    Icon: Sparkles,
    title: 'Trending list this week',
    body: '', // body composed dynamically from trendingHint
    cta: 'View list →',
    iconTint: 'oklch(0.55 0.18 310 / 0.18)',
  },
  'like-a-book': {
    pill: 'NUDGE',
    Icon: Heart,
    title: 'Like a book to start your Liked list',
    body: 'Your Liked list auto-fills as you like books on the platform.',
    cta: 'Browse books →',
    iconTint: 'oklch(0.6 0.15 150 / 0.18)',
  },
  'share-list-link': {
    pill: 'SUGGESTION',
    Icon: Share2,
    title: 'Your list is gaining followers',
    body: 'Share the link to keep momentum.',
    cta: 'Share your list →',
    iconTint: 'oklch(0.6 0.15 150 / 0.18)',
  },
}

function ctaHref(
  variant: ListGhostVariant,
  locale: string,
  opts: {
    smallestOwnedListId?: string | null
    highestFollowerListId?: string | null
  },
): string {
  switch (variant) {
    case 'create-list':
      return `/${locale}/reading-lists`
    case 'follow-curator':
      return `/${locale}/discover?tab=people`
    case 'themed-list-nudge':
      return `/${locale}/reading-lists/${opts.smallestOwnedListId ?? ''}`
    case 'trending-from-network':
      return `/${locale}/discover?tab=lists`
    case 'like-a-book':
      return `/${locale}/discover?tab=books`
    case 'share-list-link':
      return `/${locale}/reading-lists/${opts.highestFollowerListId ?? ''}`
  }
}

export function ListGhostCard({
  variant,
  locale,
  onDismiss,
  trendingHint,
  smallestOwnedListId,
  highestFollowerListId,
}: ListGhostCardProps) {
  // Defensive null guards for variants that need parent-threaded context.
  if (variant === 'themed-list-nudge' && !smallestOwnedListId) return null
  if (variant === 'share-list-link' && !highestFollowerListId) return null
  if (variant === 'trending-from-network' && !trendingHint) return null

  const copy = COPY[variant]
  const Icon = copy.Icon
  const href = ctaHref(variant, locale, { smallestOwnedListId, highestFollowerListId })

  return (
    <div
      className="relative flex flex-col items-center justify-between p-5 text-center"
      style={{
        border: '2px dashed rgba(255,255,255,0.12)',
        background: 'transparent',
        borderRadius: 'var(--r-card)',
        minHeight: 280,
      }}
    >
      <div
        className="absolute top-2 left-3 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]"
        style={{
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
          borderRadius: 'var(--r-pill)',
        }}
      >
        {copy.pill}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss ${copy.pill.toLowerCase()}`}
        className="absolute top-2 right-2 p-1 rounded hover:bg-white/5"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        <X size={12} aria-hidden="true" />
      </button>

      <div className="flex flex-1 flex-col items-center justify-center pt-6">
        <div
          className="inline-flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            background: copy.iconTint,
            borderRadius: 'var(--r-card)',
            color: 'var(--brand)',
          }}
          aria-hidden="true"
        >
          <Icon size={22} aria-hidden="true" />
        </div>
        <div
          className="mt-3 text-[14px] font-bold leading-tight"
          style={{
            color: 'var(--canvas-dark-ink-strong, var(--canvas-dark-ink))',
            fontFamily: 'var(--font-display)',
          }}
        >
          {copy.title}
        </div>
        <div
          className="mt-1.5 text-[12px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            lineHeight: 1.45,
            maxWidth: 200,
          }}
        >
          {variant === 'trending-from-network' && trendingHint ? (
            <>
              <em>{trendingHint.title}</em>
              {` by @${trendingHint.curator}.`}
            </>
          ) : (
            copy.body
          )}
        </div>
      </div>

      <Link
        href={href}
        className="mt-3 inline-flex items-center px-3 py-1.5 text-[12px] font-bold"
        style={{
          color: 'var(--brand)',
          background: 'oklch(from var(--brand) l c h / 0.12)',
          borderRadius: 'var(--r-pill)',
        }}
      >
        {copy.cta}
      </Link>
    </div>
  )
}

export default ListGhostCard
