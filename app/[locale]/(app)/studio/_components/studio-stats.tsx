import type { StudioStats } from '@/lib/actions/book.actions'

const FORMATTER = new Intl.NumberFormat('en-US')

type Tone = 'books' | 'words' | 'chapters'

const ACCENT_FOR: Record<Tone, string> = {
  books: 'var(--status-first-draft)',
  words: 'var(--status-revised)',
  chapters: 'var(--status-final)',
}

function StatShell({
  tone,
  label,
  children,
  viz,
}: {
  tone: Tone
  label: string
  children: React.ReactNode
  viz: React.ReactNode
}) {
  const accent = ACCENT_FOR[tone]
  return (
    <div
      className="relative flex-1 grid items-center overflow-hidden"
      style={{
        background: 'var(--canvas-dark-100)',
        border: '1px solid var(--canvas-dark-300)',
        borderRadius: 'var(--r-xl)',
        padding: '18px 22px',
        gridTemplateColumns: '1fr auto',
        gap: '18px',
        boxShadow: 'var(--el-1)',
        // Expose accent locally so children can `var(--accent)` it.
        ['--accent' as string]: accent,
      } as React.CSSProperties}
    >
      <div>
        <div
          className="uppercase inline-flex items-center gap-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            color: 'var(--canvas-dark-ink-muted)',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 0 2px oklch(from ${accent} l c h / 0.20)`,
            }}
          />
          {label}
        </div>
        {children}
      </div>
      <div aria-hidden="true">{viz}</div>
    </div>
  )
}

function Value({ value, unit }: { value: number | string; unit?: string }) {
  return (
    <div
      className="flex items-baseline"
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '34px',
        letterSpacing: '-0.025em',
        color: 'var(--canvas-dark-ink-strong)',
        lineHeight: 1,
        gap: '8px',
      }}
    >
      {typeof value === 'number' ? FORMATTER.format(value) : value}
      {unit && (
        <span
          style={{
            fontSize: '14px',
            color: 'var(--canvas-dark-ink-muted)',
            fontWeight: 500,
            letterSpacing: '0.02em',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {unit}
        </span>
      )}
    </div>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '13px',
        color: 'var(--canvas-dark-ink-muted)',
        marginTop: '6px',
      }}
    >
      {children}
    </div>
  )
}

// ── Visualizations ──────────────────────────────────────────────────

/** Mini stacked spines — books tile. */
function VizSpines() {
  return (
    <div className="relative z-[1] flex items-end gap-1" style={{ height: '58px' }}>
      <span style={{ width: '10px', borderRadius: '2px', height: '38px', background: 'var(--paper-300)' }} />
      <span style={{ width: '10px', borderRadius: '2px', height: '50px', background: 'var(--paper-200)' }} />
      <span
        style={{
          width: '10px',
          borderRadius: '2px',
          height: '58px',
          background: 'var(--paper-100)',
          boxShadow: '0 0 0 1.5px oklch(from var(--status-first-draft) l c h / 0.45)',
        }}
      />
      <span style={{ width: '10px', borderRadius: '2px', height: '42px', background: 'var(--paper-300)' }} />
    </div>
  )
}

/** Sparkline — words tile. We don't track day-by-day deltas so render a
 *  deterministic shape; today (rightmost) is the full-tint bar. */
function VizSpark({ pattern }: { pattern: ReadonlyArray<number> }) {
  return (
    <div className="relative z-[1] flex items-end gap-1" style={{ height: '58px', width: '120px' }}>
      {pattern.map((h, i) => {
        const isLast = i === pattern.length - 1
        const isZero = h === 0
        const style: React.CSSProperties = isZero
          ? {
              flex: 1,
              borderRadius: '2px',
              background: 'var(--canvas-dark-200)',
              height: '4px',
              minHeight: '4px',
            }
          : {
              flex: 1,
              borderRadius: '2px',
              background: isLast
                ? 'var(--status-revised)'
                : 'oklch(from var(--status-revised) l c h / 0.30)',
              height: `${h}px`,
            }
        return <span key={i} style={style} />
      })}
    </div>
  )
}

/** Ring — chapters tile. */
function VizRing({ pct }: { pct: number }) {
  const r = 23
  const circumference = 2 * Math.PI * r
  const fill = circumference * (pct / 100)
  return (
    <div className="relative z-[1]" style={{ width: '58px', height: '58px' }}>
      <svg width="58" height="58" viewBox="0 0 58 58">
        <circle cx="29" cy="29" r={r} fill="none" stroke="var(--canvas-dark-200)" strokeWidth="5" />
        <circle
          cx="29"
          cy="29"
          r={r}
          fill="none"
          stroke="var(--status-final)"
          strokeWidth="5"
          strokeDasharray={`${fill.toFixed(1)} ${circumference.toFixed(1)}`}
          strokeLinecap="round"
          transform="rotate(-90 29 29)"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '13px',
          color: 'var(--canvas-dark-ink-strong)',
        }}
      >
        {pct}%
      </span>
    </div>
  )
}

// Fixed deterministic sparkline shape — we don't track daily word deltas
// yet, so the visualization is decorative. Today (rightmost) is the full-
// tint bar.
const SPARK_PATTERN: ReadonlyArray<number> = [18, 34, 0, 28, 46, 22, 54]

export function StudioStats({ stats }: { stats: StudioStats }) {
  // Ring percentage — chaptersPublished is the only signal we have; we don't
  // know a "total chapters" without another query. Use a soft scale: cap at
  // 100% and assume 12 chapters as the "first book" benchmark when there's
  // anything to show. With 0 published, ring is empty (0%).
  // TODO(library-v2): wire to an actual total-chapters-across-books figure.
  const ringTotal = 12
  const ringPct = Math.min(100, Math.round((stats.chaptersPublished / ringTotal) * 100))

  return (
    <aside className="flex flex-col gap-3">
      <StatShell tone="books" label="Books in progress" viz={<VizSpines />}>
        <Value value={stats.booksInProgress} />
        <Sub>
          <b style={{ color: 'var(--canvas-dark-ink)', fontWeight: 500 }}>
            {stats.booksInProgress} {stats.booksInProgress === 1 ? 'active' : 'active'}
          </b>
        </Sub>
      </StatShell>

      <StatShell tone="words" label="Words this week" viz={<VizSpark pattern={SPARK_PATTERN} />}>
        <Value value={stats.wordsThisWeek} />
        <Sub>this week</Sub>
      </StatShell>

      <StatShell tone="chapters" label="Chapters published" viz={<VizRing pct={ringPct} />}>
        <Value value={stats.chaptersPublished} unit={`of ${ringTotal}`} />
        <Sub>
          {stats.chaptersPublished === 0 ? 'No chapters published yet' : 'Keep going'}
        </Sub>
      </StatShell>
    </aside>
  )
}
