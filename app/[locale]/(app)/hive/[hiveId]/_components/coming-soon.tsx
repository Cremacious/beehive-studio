type Props = { title: string; phase: string }

export function ComingSoon({ title, phase }: Props) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="p-12 text-center"
      >
        <h1
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa font-bold text-xl mb-2"
        >
          {title}
        </h1>
        <p
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="text-sm max-w-md mx-auto"
        >
          {phase}
        </p>
      </div>
    </div>
  )
}
