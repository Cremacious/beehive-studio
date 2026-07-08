'use client'

import Link from 'next/link'
import { X, BookOpen, DoorOpen, Users, BookMarked, ListPlus, MessageCircle, type LucideIcon } from 'lucide-react'
import type { ClubGhostVariant } from './pick-club-ghosts'

export type ClubGhostCardProps = {
  variant: ClubGhostVariant
  locale: string
  onDismiss: (v: ClubGhostVariant) => void
  /** Optional first-trending club featured when variant === 'join-suggested' */
  trendingClub?: { id: string; name: string } | null
  /** Smallest owned club id used to deep-link manage members */
  smallestOwnedClubId?: string | null
  /** Any owned club id used to deep-link books/discussions tabs */
  anyOwnedClubId?: string | null
  /**
   * When provided for the `create-club` variant, the CTA opens the create-club
   * modal instead of navigating (create is a modal, not a route).
   */
  onCreate?: () => void
}

const COPY: Record<
  ClubGhostVariant,
  {
    labelNote: string
    eyebrow: string
    title: string
    body: string
    ctaLabel: string
    iconTint: string
    icon: LucideIcon
  }
> = {
  'create-club': {
    labelNote: 'Suggestion',
    eyebrow: 'NEW CLUB',
    title: 'Create your first club',
    body: 'Read together with friends. Pick a book, set a schedule, get discussions going.',
    ctaLabel: '+ New Club →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: BookOpen,
  },
  'join-suggested': {
    labelNote: 'From Discover',
    eyebrow: '✦ OPEN CLUB',
    title: 'Find an open club',
    body: 'Open clubs accept new members without approval.',
    ctaLabel: 'View club →',
    iconTint: 'oklch(0.55 0.18 310 / 0.18)',
    icon: DoorOpen,
  },
  'invite-members': {
    labelNote: 'Suggestion',
    eyebrow: 'BUILD YOUR CIRCLE',
    title: 'Invite members',
    body: 'Bring readers you trust into your club.',
    ctaLabel: 'Manage members →',
    iconTint: 'oklch(0.6 0.15 240 / 0.18)',
    icon: Users,
  },
  'set-current-book': {
    labelNote: 'Suggestion',
    eyebrow: 'SET THE CURRENT BOOK',
    title: 'Pick your next read',
    body: 'Clubs revolve around a current book. Set yours to kick off the next chapter.',
    ctaLabel: 'Set the book →',
    iconTint: 'oklch(0.6 0.15 150 / 0.18)',
    icon: BookMarked,
  },
  'add-to-queue': {
    labelNote: 'Suggestion',
    eyebrow: 'BUILD THE QUEUE',
    title: 'Add books to the queue',
    body: 'Queue future reads so the club always has a next-up.',
    ctaLabel: 'Open queue →',
    iconTint: 'oklch(0.55 0.18 310 / 0.18)',
    icon: ListPlus,
  },
  'start-discussion': {
    labelNote: 'Suggestion',
    eyebrow: 'SPARK A CHAT',
    title: 'Post the first discussion',
    body: 'Quick questions, chapter recaps, or open prompts to get conversation going.',
    ctaLabel: 'Start a discussion →',
    iconTint: 'rgba(255,255,255,0.06)',
    icon: MessageCircle,
  },
}

function ctaHref(
  variant: ClubGhostVariant,
  locale: string,
  opts: {
    trendingClub?: ClubGhostCardProps['trendingClub']
    smallestOwnedClubId?: string | null
    anyOwnedClubId?: string | null
  },
): string {
  switch (variant) {
    case 'create-club':
      return `/${locale}/community/clubs`
    case 'join-suggested':
      return opts.trendingClub
        ? `/${locale}/community/clubs/${opts.trendingClub.id}`
        : `/${locale}/discover?tab=clubs`
    case 'invite-members':
      return opts.smallestOwnedClubId
        ? `/${locale}/community/clubs/${opts.smallestOwnedClubId}/members`
        : `/${locale}/community/clubs`
    case 'set-current-book':
      return opts.anyOwnedClubId
        ? `/${locale}/community/clubs/${opts.anyOwnedClubId}?tab=books`
        : `/${locale}/community/clubs`
    case 'add-to-queue':
      return opts.anyOwnedClubId
        ? `/${locale}/community/clubs/${opts.anyOwnedClubId}?tab=books`
        : `/${locale}/community/clubs`
    case 'start-discussion':
      return opts.anyOwnedClubId
        ? `/${locale}/community/clubs/${opts.anyOwnedClubId}?tab=discussions`
        : `/${locale}/community/clubs`
  }
}

export function ClubGhostCard({
  variant,
  locale,
  onDismiss,
  trendingClub,
  smallestOwnedClubId,
  anyOwnedClubId,
  onCreate,
}: ClubGhostCardProps) {
  const copy = COPY[variant]
  const title =
    variant === 'join-suggested' && trendingClub ? trendingClub.name : copy.title
  const body = copy.body
  const href = ctaHref(variant, locale, {
    trendingClub,
    smallestOwnedClubId,
    anyOwnedClubId,
  })
  const opensModal = variant === 'create-club' && typeof onCreate === 'function'

  return (
    <div
      className="relative rounded-2xl p-[18px] flex flex-col justify-center gap-3 overflow-hidden"
      style={{
        width: 340,
        height: 360,
        border: '1.5px dashed rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.015)',
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

      <div
        className="inline-flex items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, background: copy.iconTint, color: 'var(--brand)' }}
        aria-hidden="true"
      >
        <copy.icon size={18} />
      </div>
      <div
        className="text-[9px] font-bold uppercase tracking-[0.1em]"
        style={{
          color: 'var(--canvas-dark-ink-faint)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {copy.eyebrow}
      </div>
      <div
        className="text-[15px] font-bold leading-tight -mt-1"
        style={{
          color: 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {title}
      </div>
      {body ? (
        <div
          className="text-[12px] leading-snug -mt-1"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {body}
        </div>
      ) : null}

      {opensModal ? (
        <button
          type="button"
          onClick={onCreate}
          className="text-[12px] font-bold inline-flex items-center mt-1 self-start"
          style={{ color: 'var(--brand)' }}
        >
          {copy.ctaLabel}
        </button>
      ) : (
        <Link
          href={href}
          className="text-[12px] font-bold inline-flex items-center mt-1 self-start"
          style={{ color: 'var(--brand)' }}
        >
          {copy.ctaLabel}
        </Link>
      )}
    </div>
  )
}
