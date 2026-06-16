/**
 * <StatsPanel>
 *
 * Unified right-rail stats panel used by /sparks, /hives, /reading-lists,
 * /clubs. Replaces the previously-duplicated `<RailPanel><StatTile/>` 2x2
 * grid pattern that lived in each rail.
 *
 * Layout: horizontal strip of 4 tiles separated by 1px vertical dividers.
 * The first tile (or any with `emphasize: true`) renders its value in
 * brand-yellow. All tiles share centered text alignment, 18px Comfortaa
 * value, 8px mono uppercase label.
 *
 * Picked from the 4-variant mockup at
 * .superpowers/brainstorm/33246-1781629996/content/stats-panel-variants.html
 * (Variant D — Horizontal strip).
 */

export type StatTileData = {
  value: number | string
  label: string
  /** Renders the value in brand-yellow. Convention: only the primary tile. */
  emphasize?: boolean
}

type Props = {
  /** Panel header, mono uppercase brand-yellow. e.g. "Your spark stats". */
  title: string
  /** Expected to be 4 entries. Rendered left-to-right in a single row. */
  stats: StatTileData[]
}

export function StatsPanel({ title, stats }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-200), var(--canvas-dark-150))',
        boxShadow:
          '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <h2
        className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3"
        style={{
          color: 'var(--brand)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {title}
      </h2>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              padding: '8px 6px',
              borderRight:
                i < stats.length - 1
                  ? '1px solid rgba(255,255,255,0.05)'
                  : 'none',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                lineHeight: 1,
                color: s.emphasize
                  ? 'var(--brand)'
                  : 'var(--canvas-dark-ink-strong)',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
                color: 'var(--canvas-dark-ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: 4,
                lineHeight: 1.2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
