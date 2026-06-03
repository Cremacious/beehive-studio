import type { ReactNode } from 'react'

export type HivePillProps = {
  /**
   * CSS custom-property name (without `var()` wrapping) whose value drives
   * the pill's tint, ink, and border. Examples: `--status-idea`,
   * `--role-owner`, `--goal-daily`, `--topic-general`, `--layer-grammar`.
   *
   * The component composes `oklch(from var(<token>) l c h / 0.14)` for the
   * background and `oklch(from var(<token>) l c h / 0.3)` for the border,
   * with the token itself as the text color.
   */
  token: string
  /** Pill label — typically uppercase, but caller decides. */
  children: ReactNode
  /** Optional extra classes (e.g. positioning, gap). */
  className?: string
}

export function HivePill({ token, children, className }: HivePillProps) {
  const accent = `var(${token})`
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${className ?? ''}`}
      style={{
        background: `oklch(from ${accent} l c h / 0.14)`,
        color: accent,
        border: `1px solid oklch(from ${accent} l c h / 0.3)`,
      }}
    >
      {children}
    </span>
  )
}
