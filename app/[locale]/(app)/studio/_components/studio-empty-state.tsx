import Link from 'next/link'
import { Plus, Search } from 'lucide-react'

type Props = {
  locale: string
  templates: { id: string; name: string; genre: string | null }[]
}

/**
 * 3-cell honeycomb cluster.
 * Center hex is "active" — panel-tile gradient, brand-yellow inner hex glyph
 * (mirrors the AppNav logo), soft radial brand glow, gentle float animation.
 * Side hexes are dashed "empty slots" representing future books.
 */
function HoneycombCluster() {
  // Pointy-top hex centered at (cx, cy) with width W and height H = W * 2/√3.
  const W = 130
  const H = 150
  const hex = (cx: number, cy: number) =>
    [
      [cx, cy - H / 2],
      [cx + W / 2, cy - H / 4],
      [cx + W / 2, cy + H / 4],
      [cx, cy + H / 2],
      [cx - W / 2, cy + H / 4],
      [cx - W / 2, cy - H / 4],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(' ')

  // Center hex sits slightly higher than the two flanking hexes (classic
  // honeycomb trio nest pattern).
  const left = hex(90, 114)
  const center = hex(230, 94)
  const right = hex(370, 114)

  return (
    <div className="relative" style={{ width: '460px', maxWidth: '100%' }}>
      <svg
        width="460"
        height="220"
        viewBox="0 0 460 220"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="hc-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="12"
              floodColor="oklch(0 0 0)"
              floodOpacity="0.55"
            />
          </filter>
        </defs>

        {/* Side hexes — empty / dashed */}
        <g style={{ filter: 'url(#hc-shadow)' }}>
          <polygon
            points={left}
            fill="oklch(0.230 0.003 256)"
            stroke="oklch(1 0 0 / 0.14)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <polygon
            points={right}
            fill="oklch(0.230 0.003 256)"
            stroke="oklch(1 0 0 / 0.14)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
        </g>

        {/* Side hex glyphs — small muted plus signs */}
        <g
          fill="none"
          stroke="oklch(1 0 0 / 0.22)"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M82 114 L98 114 M90 106 L90 122" />
          <path d="M362 114 L378 114 M370 106 L370 122" />
        </g>

        {/* Center hex — active */}
        <g style={{ filter: 'url(#hc-shadow)' }}>
          <polygon
            points={center}
            fill="oklch(0.270 0.003 256)"
            stroke="oklch(1 0 0 / 0.06)"
            strokeWidth="1"
          />
          {/* inner hex glyph — mirrors AppNav logo (outer stroked + inner filled) */}
          <g transform="translate(200, 64) scale(2.5)" style={{ color: 'oklch(0.85 0.18 90)' }}>
            <path
              d="M12 2 L20 6.5 L20 15.5 L12 20 L4 15.5 L4 6.5 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 9 L16 11 L16 14.5 L12 16.5 L8 14.5 L8 11 Z"
              fill="currentColor"
              fillOpacity="0.55"
            />
          </g>
        </g>
      </svg>

    </div>
  )
}

export function StudioEmptyState({ locale, templates: _templates }: Props) {
  return (
    <main
      className="relative z-[1] flex flex-col"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 32px 96px',
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      <div
        className="flex-1 grid place-items-center relative z-[1]"
        style={{ padding: '88px 0 64px' }}
      >
        <div className="flex flex-col items-center max-w-full">
          <HoneycombCluster />

          {/* Copy + CTAs */}
          <div
            className="text-center"
            style={{ marginTop: '64px', maxWidth: '540px' }}
          >
            <h2
              className="m-0 mb-4"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '36px',
                letterSpacing: '-0.025em',
                color: 'var(--canvas-dark-ink-strong)',
                lineHeight: 1.05,
                textWrap: 'balance' as const,
              }}
            >
              Your hive{' '}
              <em
                style={{
                  fontStyle: 'italic',
                  fontFamily: 'var(--font-prose)',
                  fontWeight: 400,
                  color: 'var(--brand)',
                  letterSpacing: '-0.01em',
                }}
              >
                starts here.
              </em>
            </h2>
            <p
              className="mx-auto mb-7"
              style={{
                fontFamily: 'var(--font-prose)',
                fontSize: '17px',
                lineHeight: 1.5,
                color: 'var(--canvas-dark-ink-muted)',
                textWrap: 'pretty' as const,
              }}
            >
              Every story begins with a single buzz. Drop your first chapter —
              your library will fill itself.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href={`/${locale}/studio/new`}
                className="inline-flex items-center gap-2 no-underline whitespace-nowrap"
                style={{
                  height: '40px',
                  padding: '0 22px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} />
                Start Writing
              </Link>
              <Link
                href={`/${locale}/discover`}
                className="inline-flex items-center gap-2 no-underline whitespace-nowrap"
                style={{
                  height: '40px',
                  padding: '0 22px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--canvas-dark-300)',
                  border: 'var(--br-card)',
                  boxShadow: 'var(--sh-tile)',
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Search size={14} />
                Explore books
              </Link>
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}
