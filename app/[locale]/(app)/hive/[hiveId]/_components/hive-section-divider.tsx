import type { ReactNode } from 'react'

export type HiveSectionDividerProps = {
  /** Uppercase mono label rendered above the section content. */
  label: string
  /** Optional ID for jump-anchor or aria use. */
  id?: string
  /** Tone — defaults to muted; `danger` swaps to destructive ink (used by Settings' Danger Zone). */
  tone?: 'muted' | 'danger'
  /** When true, suppresses the top hairline. Use on the first section in a panel. */
  hideTopBorder?: boolean
  /** Section body. */
  children: ReactNode
  /** Optional extra classes on the inner content wrapper. */
  className?: string
}

const LABEL_TONE: Record<NonNullable<HiveSectionDividerProps['tone']>, string> = {
  muted: 'text-[var(--canvas-dark-ink-muted)]',
  danger: 'text-[color:oklch(0.66_0.18_25)]', /* matches --status-error */
}

export function HiveSectionDivider({
  label,
  id,
  tone = 'muted',
  hideTopBorder,
  children,
  className,
}: HiveSectionDividerProps) {
  return (
    <section
      id={id}
      className="px-6 py-5"
      style={{
        borderTop: hideTopBorder
          ? undefined
          : '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
      }}
    >
      <p
        className={`mb-3 font-mono text-[10px] uppercase tracking-wider ${LABEL_TONE[tone]}`}
      >
        {label}
      </p>
      <div className={className}>{children}</div>
    </section>
  )
}
