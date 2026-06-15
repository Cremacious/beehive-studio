'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import type { GhostVariant } from './pick-ghosts'
import type { PromptTemplate } from '@/lib/sparks/prompt-templates'

export type GhostCardProps = {
  variant: GhostVariant
  locale: string
  onDismiss: (v: GhostVariant) => void
  /** Required when variant === 'prompt-template' */
  promptTemplate?: PromptTemplate
  /** Optional first-trending spark to feature when variant === 'from-discover' */
  trendingSpark?: {
    id: string
    title: string
    entryCount: number
    deadline: Date | string | null
  } | null
}

const COPY: Record<
  GhostVariant,
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
  'from-discover': {
    labelNote: 'From Discover',
    eyebrow: '⚡ TRENDING THIS WEEK',
    title: 'See what writers are sparking now',
    body: 'Open Sparks platform-wide, pick one and enter.',
    ctaLabel: 'Browse Discover →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '⚡',
  },
  'follow-writers': {
    labelNote: 'Suggestion',
    eyebrow: '👤 FILL YOUR FEED',
    title: 'Follow writers to fill this tab',
    body: 'Your Following tab is empty. We can suggest 5 active writers whose Sparks you might like.',
    ctaLabel: 'Find writers →',
    iconTint: 'oklch(0.6 0.15 240 / 0.18)',
    icon: '👤',
  },
  'connect-friends': {
    labelNote: 'Suggestion',
    eyebrow: '🤝 BUILD YOUR CIRCLE',
    title: 'Connect with friends',
    body: "When friends accept your request, their open Sparks show up here automatically.",
    ctaLabel: 'Manage friends →',
    iconTint: 'oklch(0.55 0.18 310 / 0.18)',
    icon: '🤝',
  },
  'prompt-template': {
    labelNote: 'Prompt template',
    eyebrow: '✦ NEED INSPIRATION?',
    title: '', // overridden below from template
    body: '',
    ctaLabel: 'Use this prompt →',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '✦',
  },
  'enter-a-spark': {
    labelNote: 'Suggestion',
    eyebrow: '📝 TRACK YOUR ENTRIES',
    title: 'Enter a Spark to see it here',
    body: "Sparks you enter (yours or anyone else's) collect in the Entered tab so you can track results.",
    ctaLabel: 'Browse open Sparks →',
    iconTint: 'oklch(0.6 0.15 150 / 0.18)',
    icon: '📝',
  },
  'create-first': {
    labelNote: 'Suggestion',
    eyebrow: '⚡ START WRITING',
    title: "You haven't written a Spark yet",
    body: 'Got a prompt nagging at you?',
    ctaLabel: '+ New Spark',
    iconTint: 'oklch(from var(--brand) l c h / 0.18)',
    icon: '⚡',
  },
}

function ctaHref(
  variant: GhostVariant,
  locale: string,
  promptTemplate?: PromptTemplate,
  trendingSpark?: GhostCardProps['trendingSpark'],
): string {
  switch (variant) {
    case 'from-discover':
      return trendingSpark
        ? `/${locale}/discover/spark/${trendingSpark.id}`
        : `/${locale}/discover?tab=sparks`
    case 'follow-writers':
      return `/${locale}/discover?tab=sparks`
    case 'connect-friends':
      return `/${locale}/friends`
    case 'prompt-template': {
      if (!promptTemplate) return `/${locale}/sparks/new`
      const sp = new URLSearchParams()
      sp.set('prompt', promptTemplate.prompt)
      sp.set('wordLimit', String(promptTemplate.wordLimit))
      return `/${locale}/sparks/new?${sp.toString()}`
    }
    case 'enter-a-spark':
      return `/${locale}/discover?tab=sparks`
    case 'create-first':
      return `/${locale}/sparks/new`
  }
}

export function GhostCard({
  variant,
  locale,
  onDismiss,
  promptTemplate,
  trendingSpark,
}: GhostCardProps) {
  const copy = COPY[variant]
  const title =
    variant === 'prompt-template' && promptTemplate
      ? `"${promptTemplate.prompt}"`
      : variant === 'from-discover' && trendingSpark
        ? trendingSpark.title
        : copy.title
  const body =
    variant === 'prompt-template' && promptTemplate
      ? `${promptTemplate.wordLimit} words. Open prompt in the New Spark form.`
      : copy.body
  const href = ctaHref(variant, locale, promptTemplate, trendingSpark)

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
