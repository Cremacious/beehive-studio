export default function ClubsPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
        className="p-12 text-center"
      >
        <h1
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa text-xl font-bold mb-2"
        >
          Book Clubs
        </h1>
        <p
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="mx-auto max-w-md text-sm"
        >
          Coming in C4.
        </p>
      </div>
    </div>
  )
}
