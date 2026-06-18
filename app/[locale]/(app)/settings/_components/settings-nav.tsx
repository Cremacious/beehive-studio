'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { User, Bell, Shield, Sliders, CreditCard } from 'lucide-react'

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

  return (
    <nav aria-label="Settings sections">
      <div
        className="text-[10px] font-mono uppercase tracking-widest mb-3 px-3"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        Settings
      </div>
      <ul className="flex flex-col gap-1 list-none m-0 p-0">
        {NAV_ITEMS.map(({ slug, label, Icon }) => {
          const href = `/${locale}/settings/${slug}`
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={slug}>
              <Link
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-[13px] no-underline transition-all"
                style={
                  isActive
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
                  style={{ color: isActive ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)' }}
                />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
