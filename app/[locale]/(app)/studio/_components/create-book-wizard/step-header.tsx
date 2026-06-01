import type { ReactNode } from 'react'

type Props = {
  step: 1 | 2 | 3 | 4
  total: number
  headline: string
  lede: ReactNode
}

export function StepHeader({ step, total, headline, lede }: Props) {
  return (
    <div
      style={{
        padding: '26px 36px 18px',
      }}
    >
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.12em',
          color: 'var(--canvas-dark-ink-muted)',
          marginBottom: '10px',
        }}
      >
        Step {step} of {total}
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '-0.015em',
          margin: 0,
          color: 'var(--brand)',
          textWrap: 'balance' as const,
        }}
      >
        {headline}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          lineHeight: 1.55,
          marginTop: '10px',
          maxWidth: '620px',
          color: 'var(--canvas-dark-ink-muted)',
          textWrap: 'pretty' as const,
        }}
      >
        {lede}
      </p>
    </div>
  )
}
