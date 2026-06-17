import Link from 'next/link'
import type { SparksTab } from './sparks-tab-strip'

type EmptyStateCopy = {
  eyebrow: string
  title: string
  body: string
  primaryCta: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
}

const EMPTY_STATES: Record<SparksTab, EmptyStateCopy> = {
  all: {
    eyebrow: 'ALL · 0 SPARKS',
    title: 'No sparks yet.',
    body: 'Start one of your own, or follow some writers on Discover.',
    primaryCta: { href: '/community/sparks/new', label: '+ New Spark' },
    secondaryCta: { href: '/discover?tab=sparks', label: 'Browse Discover →' },
  },
  yours: {
    eyebrow: 'YOURS · 0 SPARKS',
    title: "You haven't written a Spark yet.",
    body: 'Got a prompt nagging at you?',
    primaryCta: { href: '/community/sparks/new', label: '+ New Spark' },
  },
  following: {
    eyebrow: 'FOLLOWING · 0 SPARKS',
    title: 'No active sparks from the writers you follow yet.',
    body: 'Try Discover to find more authors.',
    primaryCta: { href: '/discover?tab=sparks', label: 'Browse Discover →' },
  },
  friends: {
    eyebrow: 'FRIENDS · 0 SPARKS',
    title: 'No active sparks from friends.',
    body: '',
    primaryCta: { href: '/community/friends', label: 'Find friends →' },
  },
  entered: {
    eyebrow: 'ENTERED · 0 SPARKS',
    title: "You haven't entered any Sparks yet.",
    body: 'Browse Discover for one that catches you.',
    primaryCta: { href: '/discover?tab=sparks', label: 'Browse Discover →' },
  },
}

type Props = { tab: SparksTab; locale: string }

/**
 * Pure presentational empty state for the /sparks hub. Five distinct
 * copy + CTA branches keyed on the current tab. Hrefs are locale-prefixed
 * at render time so callers pass bare app paths.
 */
export function SparksEmptyState({ tab, locale }: Props) {
  const e = EMPTY_STATES[tab]
  const prefixed = (h: string) => `/${locale}${h}`
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div
        className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3"
        style={{
          color: 'var(--canvas-dark-ink-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {e.eyebrow}
      </div>
      <h3
        className="text-[20px] font-bold mb-2"
        style={{
          color: 'var(--canvas-dark-ink-strong)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {e.title}
      </h3>
      {e.body ? (
        <p
          className="text-[13px] mb-5"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          {e.body}
        </p>
      ) : null}
      <div className="flex items-center justify-center gap-3">
        <Link
          href={prefixed(e.primaryCta.href)}
          className="inline-flex items-center px-4 py-2 text-[12px] font-bold rounded-lg"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          {e.primaryCta.label}
        </Link>
        {e.secondaryCta ? (
          <Link
            href={prefixed(e.secondaryCta.href)}
            className="inline-flex items-center px-4 py-2 text-[12px] rounded-lg transition-colors hover:text-[var(--brand)]"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {e.secondaryCta.label}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
