import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export type RequestsSample = {
  userId: string
  username: string | null
  avatarUrl: string | null
}

export function RequestsCard({
  locale,
  count,
  samples,
}: {
  locale: string
  count: number
  samples: RequestsSample[]
}) {
  if (count === 0) return null

  const visible = samples.slice(0, 3)
  const label = count === 1 ? '1 pending request' : `${count} pending requests`

  return (
    <section
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="flex flex-col gap-3 p-4"
    >
      <header className="flex items-center justify-between">
        <h3
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa text-sm font-bold"
        >
          Friend requests
        </h3>
      </header>

      <div className="flex items-center gap-3">
        {visible.length > 0 ? (
          <div className="flex -space-x-2">
            {visible.map((s) => {
              const initial = (s.username ?? '?')[0]?.toUpperCase() ?? '?'
              return s.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s.userId}
                  src={s.avatarUrl}
                  alt=""
                  style={{ border: '2px solid var(--canvas-dark-200)' }}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span
                  key={s.userId}
                  style={{
                    background: 'oklch(from var(--brand) l c h / 0.18)',
                    border: '2px solid var(--canvas-dark-200)',
                    color: 'var(--brand)',
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                >
                  {initial}
                </span>
              )
            })}
          </div>
        ) : null}
        <span
          style={{ color: 'var(--canvas-dark-ink)' }}
          className="text-xs"
        >
          {label}
        </span>
      </div>

      <Link
        href={`/${locale}/friends?tab=requests`}
        style={{ color: 'var(--brand)' }}
        className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
      >
        Manage <ArrowRight size={12} />
      </Link>
    </section>
  )
}
