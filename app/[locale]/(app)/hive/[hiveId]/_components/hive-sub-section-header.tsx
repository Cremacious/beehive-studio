import type { ReactNode } from 'react'

export type HiveSubSectionHeaderProps = {
  /** Section title — Comfortaa bold 16px ink-strong. */
  title: string
  /** Optional count value (number or pre-formatted string, e.g. "1" or "1 draft"). */
  count?: string | number
  /** Optional unit label rendered after a numeric `count` (e.g. "draft" / "drafts"). Ignored when `count` is a string. */
  countLabel?: string
  /** When true, suppresses the top hairline (use on the first section in a panel). */
  hideTopBorder?: boolean
  /** Optional right-aligned content (e.g. an in-section CTA). */
  rightSlot?: ReactNode
}

/**
 * Chunky section-header bar with a darker tone than the panel body. Used to
 * separate role-scoped groups inside list pages (e.g. Submissions: My drafts /
 * My submissions / All in this hive). Background `--canvas-dark-100` so it
 * reads as the deepest tonal tier in a 3-tier list hierarchy
 * (section-header > column sub-header > content rows).
 */
export function HiveSubSectionHeader({
  title,
  count,
  countLabel,
  hideTopBorder,
  rightSlot,
}: HiveSubSectionHeaderProps) {
  const countText =
    count === undefined || count === null
      ? null
      : typeof count === 'number' && countLabel
        ? `· ${count} ${countLabel}`
        : `· ${count}`

  return (
    <header
      className="flex items-baseline justify-between gap-3 px-5 py-3.5"
      style={{
        background: 'var(--canvas-dark-100)',
        borderTop: hideTopBorder ? undefined : 'var(--br-card)',
        borderBottom: 'var(--br-card)',
      }}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span
          className="font-comfortaa text-base font-bold truncate"
          style={{ color: 'var(--canvas-dark-ink-strong)' }}
        >
          {title}
        </span>
        {countText && (
          <span
            className="font-mono text-[11px] tracking-wider shrink-0"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            {countText}
          </span>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </header>
  )
}
