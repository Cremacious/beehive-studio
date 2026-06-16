'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import type { HiveGhostVariant } from './pick-hive-ghosts'

export type HiveGhostCardProps = {
  variant: HiveGhostVariant
  locale: string
  onDismiss: (v: HiveGhostVariant) => void
  /** Optional first-trending hive featured when variant === 'join-open' */
  trendingHive?: { id: string; name: string } | null
  /** Smallest owned hive id used to deep-link manage/word-goals/buzz pages */
  hiveId?: string | null
}

const COPY: Record<
  HiveGhostVariant,
  {
    labelNote: string
    eyebrow: string
    title: string
    body: string
    ctaLabel: string
    iconTint: string
    icon: string
  }
> = {
  'create-hive': {
    labelNote: 'Suggestion',
    eyebrow: '⚡ NEW HIVE',
    title: 'Create your second hive',
    body: 'Hives are great for collaborative books, beta-reader pools, or accountability groups.',
    ctaLabel: '+ New Hive →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '🐝',
  },
  'join-open': {
    labelNote: 'From Discover',
    eyebrow: '⚡ OPEN HIVE',
    title: 'Find an open hive',
    body: 'Open hives accept new members without approval.',
    ctaLabel: 'View hive →',
    iconTint: 'oklch(0.55 0.18 310 / 0.18)',
    icon: '🚪',
  },
  'invite-collaborators': {
    labelNote: 'Suggestion',
    eyebrow: '👥 BUILD YOUR CIRCLE',
    title: 'Invite collaborators',
    body: 'Bring writers you trust into your existing hive.',
    ctaLabel: 'Manage members →',
    iconTint: 'oklch(0.6 0.15 240 / 0.18)',
    icon: '👥',
  },
  'set-word-goal': {
    labelNote: 'Suggestion',
    eyebrow: '📈 SHARED ACCOUNTABILITY',
    title: 'Set a hive word goal',
    body: "Word goals track every member's contribution to a shared target.",
    ctaLabel: 'Set a goal →',
    iconTint: 'oklch(0.6 0.15 150 / 0.18)',
    icon: '📈',
  },
  'try-standalone': {
    labelNote: 'Suggestion',
    eyebrow: '✦ NO BOOK NEEDED',
    title: 'Try a standalone hive',
    body: 'Standalone hives are great for writing groups not tied to one book.',
    ctaLabel: '+ Standalone hive →',
    iconTint: 'rgba(255,255,255,0.06)',
    icon: '✦',
  },
  'set-buzz-up': {
    labelNote: 'Suggestion',
    eyebrow: '💬 STIR THE BUZZ',
    title: 'Post to the buzz board',
    body: 'Quick updates, link drops, and feedback prompts keep your hive alive.',
    ctaLabel: 'Open buzz board →',
    iconTint: 'rgba(255,255,255,0.06)',
    icon: '💬',
  },
}

function ctaHref(
  variant: HiveGhostVariant,
  locale: string,
  opts: { trendingHive?: HiveGhostCardProps['trendingHive']; hiveId?: string | null },
): string {
  switch (variant) {
    case 'create-hive':
      return `/${locale}/hives`
    case 'join-open':
      // NOTE: /discover/hive/[id] route does not exist; always fall back to discover tab.
      return `/${locale}/discover?tab=hives`
    case 'invite-collaborators':
      return opts.hiveId ? `/${locale}/hive/${opts.hiveId}/members` : `/${locale}/hives`
    case 'set-word-goal':
      return opts.hiveId ? `/${locale}/hive/${opts.hiveId}/word-goals` : `/${locale}/hives`
    case 'try-standalone':
      return `/${locale}/hives`
    case 'set-buzz-up':
      return opts.hiveId ? `/${locale}/hive/${opts.hiveId}/buzz` : `/${locale}/hives`
  }
}

export function HiveGhostCard({
  variant,
  locale,
  onDismiss,
  trendingHive,
  hiveId,
}: HiveGhostCardProps) {
  const copy = COPY[variant]
  const title =
    variant === 'join-open' && trendingHive ? trendingHive.name : copy.title
  const body = copy.body
  const href = ctaHref(variant, locale, { trendingHive, hiveId })

  return (
    <div
      className="relative rounded-2xl p-[18px] flex flex-col gap-3 justify-between"
      style={{
        border: '1.5px dashed rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.015)',
        minHeight: 200,
      }}
    >
      <button
        type="button"
        onClick={() => onDismiss(variant)}
        aria-label={`Dismiss ${copy.labelNote}`}
        className="absolute top-2 right-2 p-1 rounded hover:bg-white/5"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        <X size={12} aria-hidden="true" />
      </button>

      <div
        className="absolute top-2 left-3 px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-[0.08em]"
        style={{
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {copy.labelNote}
      </div>

      <div className="pt-5">
        <div
          className="inline-flex items-center justify-center rounded-xl text-lg"
          style={{ width: 36, height: 36, background: copy.iconTint }}
          aria-hidden="true"
        >
          {copy.icon}
        </div>
        <div
          className="text-[9px] font-bold uppercase tracking-[0.1em] mt-3"
          style={{
            color: 'var(--canvas-dark-ink-faint)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {copy.eyebrow}
        </div>
        <div
          className="text-[15px] font-bold mt-2 leading-tight"
          style={{
            color: 'var(--canvas-dark-ink-strong)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {title}
        </div>
        {body ? (
          <div
            className="text-[12px] mt-1.5 leading-snug"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {body}
          </div>
        ) : null}
      </div>

      <Link
        href={href}
        className="text-[12px] font-bold inline-flex items-center"
        style={{ color: 'var(--brand)' }}
      >
        {copy.ctaLabel}
      </Link>
    </div>
  )
}
