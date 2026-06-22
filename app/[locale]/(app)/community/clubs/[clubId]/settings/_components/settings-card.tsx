import type { ReactNode } from 'react'

export function SettingsCard({
  title,
  icon,
  description,
  rightSlot,
  children,
  variant = 'default',
}: {
  title: string
  icon?: ReactNode
  description?: string
  rightSlot?: ReactNode
  children: ReactNode
  variant?: 'default' | 'danger'
}) {
  const isDanger = variant === 'danger'
  return (
    <section
      style={{
        background: isDanger
          ? 'linear-gradient(180deg, rgba(220,80,80,0.10), rgba(220,80,80,0.04))'
          : 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: isDanger ? '1px solid rgba(220,80,80,0.25)' : '1px solid transparent',
        padding: '20px 24px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: description ? 4 : 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            color: isDanger ? 'oklch(0.75 0.15 25)' : 'var(--canvas-dark-ink-strong)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {icon && (
            <span
              style={{
                color: isDanger ? 'oklch(0.75 0.15 25)' : 'var(--brand)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {icon}
            </span>
          )}
          {title}
        </h2>
        {rightSlot}
      </header>
      {description && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--canvas-dark-ink-muted)',
            margin: '0 0 14px',
          }}
        >
          {description}
        </p>
      )}
      {children}
    </section>
  )
}
