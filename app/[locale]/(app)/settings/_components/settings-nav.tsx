'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { User, Bell, Shield, Sliders, CreditCard, ChevronDown } from 'lucide-react'

const NAV_ITEMS = [
  { slug: 'account', label: 'Account', Icon: User },
  { slug: 'notifications', label: 'Notifications', Icon: Bell },
  { slug: 'privacy', label: 'Privacy', Icon: Shield },
  { slug: 'preferences', label: 'Preferences', Icon: Sliders },
  { slug: 'billing', label: 'Billing', Icon: CreditCard },
] as const

export function SettingsNav() {
  const { locale } = useParams<{ locale: string }>()
  const pathname = usePathname()

  const isActive = (slug: string) => {
    const href = `/${locale}/settings/${slug}`
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // Mobile (issue #50): the vertical nav collapses to a dropdown selector.
  const [open, setOpen] = useState(false)
  const current = NAV_ITEMS.find((i) => isActive(i.slug)) ?? NAV_ITEMS[0]
  const CurrentIcon = current.Icon
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile: current-section selector → dropdown */}
      <div className="md:hidden relative w-full mb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-3.5 min-h-[46px] rounded-[var(--r-row)]"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            border: 'var(--br-card)',
          }}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <CurrentIcon size={16} style={{ color: 'var(--brand)' }} className="shrink-0" />
            <span
              className="truncate"
              style={{
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {current.label}
            </span>
          </span>
          <ChevronDown
            size={16}
            className="shrink-0"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              role="listbox"
              className="absolute left-0 right-0 z-50 overflow-hidden"
              style={{
                top: 'calc(100% + 6px)',
                borderRadius: 'var(--r-card)',
                background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                boxShadow: 'var(--sh-card)',
                border: 'var(--br-card)',
              }}
            >
              <div className="py-1.5 px-1.5 flex flex-col gap-0.5">
                {NAV_ITEMS.map(({ slug, label, Icon }) => {
                  const active = isActive(slug)
                  return (
                    <Link
                      key={slug}
                      href={`/${locale}/settings/${slug}`}
                      role="option"
                      aria-selected={active}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 min-h-[44px] rounded-[var(--r-row)] no-underline"
                      style={{
                        background: active
                          ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                          : undefined,
                        boxShadow: active ? 'var(--sh-tile)' : undefined,
                      }}
                    >
                      <Icon
                        size={16}
                        className="shrink-0"
                        style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
                      />
                      <span
                        className="truncate"
                        style={{
                          color: active ? 'var(--canvas-dark-ink-strong)' : 'var(--canvas-dark-ink)',
                          fontSize: 14,
                        }}
                      >
                        {label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop: vertical nav */}
      <nav aria-label="Settings sections" className="max-md:hidden">
        <div
          className="text-[10px] font-mono uppercase tracking-widest mb-3 px-3"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Settings
        </div>
        <ul className="flex flex-col gap-1 list-none m-0 p-0">
          {NAV_ITEMS.map(({ slug, label, Icon }) => {
            const href = `/${locale}/settings/${slug}`
            const active = isActive(slug)
            return (
              <li key={slug}>
                <Link
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-[13px] no-underline transition-all"
                  style={
                    active
                      ? {
                          background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                          boxShadow: 'var(--sh-tile)',
                          color: 'var(--brand)',
                          fontWeight: 600,
                          fontFamily: 'var(--font-display)',
                        }
                      : {
                          color: 'var(--canvas-dark-ink)',
                          fontFamily: 'var(--font-display)',
                        }
                  }
                >
                  <Icon
                    size={14}
                    style={{ color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
                  />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
