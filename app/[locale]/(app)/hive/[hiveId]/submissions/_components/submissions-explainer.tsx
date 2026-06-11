import Link from 'next/link'
import type { HiveRole } from '@/lib/hive/permissions'

type Props = {
  viewerRole: HiveRole
  locale: string
}

/**
 * Persona-aware explainer mounted at the top of /hive/[hiveId]/submissions
 * on every viewer's view. Base copy explains the feature; role-specific
 * tails give owners and beta readers a clear "why this page looks like this
 * for you" line.
 */
export function SubmissionsExplainer({ viewerRole, locale }: Props) {
  return (
    <section
      className="mx-6 mt-5 mb-8 p-4"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        border: 'var(--br-card)',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <p
        className="mb-2 font-mono text-[10px] uppercase tracking-wider"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        How submissions work
      </p>
      <p
        className="text-[13.5px] leading-relaxed"
        style={{ color: 'var(--canvas-dark-ink)' }}
      >
        Submissions are how contributors propose new chapters. When a
        contributor submits, owners and moderators review it. Approving
        creates a new chapter in the book, written by the contributor.
        Rejecting sends it back with a note.
      </p>

      {viewerRole === 'OWNER' && (
        <p
          className="mt-2 text-[13.5px] leading-relaxed"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          You&apos;re the hive owner. You don&apos;t submit chapters here.
          Write directly in the studio editor. Submissions are for the
          contributors you&apos;ve invited.
        </p>
      )}

      {viewerRole === 'BETA_READER' && (
        <p
          className="mt-2 text-[13.5px] leading-relaxed"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          As a beta reader, you don&apos;t draft or review submissions. Your
          role is annotations and suggestions on existing chapters.
        </p>
      )}

      <Link
        href={`/${locale}/docs/submissions`}
        className="mt-3 inline-block text-[12.5px] font-medium"
        style={{ color: 'var(--brand)' }}
      >
        Learn more →
      </Link>
    </section>
  )
}
