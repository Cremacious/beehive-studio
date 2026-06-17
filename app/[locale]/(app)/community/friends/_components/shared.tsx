export function relTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const ms = Date.now() - date.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 30) return `${d2}d ago`
  const mo = Math.floor(d2 / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export function Avatar({
  url,
  label,
  size = 40,
}: {
  url: string | null
  label: string
  size?: number
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        background: 'var(--brand-soft)',
        color: 'var(--brand)',
        fontSize: Math.max(11, Math.floor(size / 3)),
      }}
    >
      {label[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="rounded-[var(--r-card)] border border-dashed py-12 px-6 text-center"
      style={{ borderColor: 'var(--br-card)' }}
    >
      <p
        className="text-[14px] mb-1.5"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: 'var(--canvas-dark-ink-strong)',
        }}
      >
        {title}
      </p>
      <p
        className="text-[12px] mb-3"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {body}
      </p>
      {action}
    </div>
  )
}

export const cardStyle = {
  background:
    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
  boxShadow: 'var(--sh-tile)',
  borderRadius: 'var(--r-row)',
}
