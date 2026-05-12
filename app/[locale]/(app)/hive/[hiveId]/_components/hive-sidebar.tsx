'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  locale: string
  hiveName: string
  isOwner: boolean
  isEditor: boolean
}

const NAV_ITEMS = [
  { label: 'Overview', icon: '📋', segment: '' },
  { label: 'Binder', icon: '📄', segment: '/binder' },
  { label: 'Outline', icon: '📝', segment: '/outline' },
  { label: 'Wiki', icon: '🌍', segment: '/wiki' },
  { label: 'Discussion', icon: '💬', segment: '/discussion' },
  { label: 'Tasks', icon: '✅', segment: '/tasks' },
  { label: 'Members', icon: '👥', segment: '/members' },
]

export function HiveSidebar({ hiveId, locale, hiveName, isOwner, isEditor }: Props) {
  const pathname = usePathname()
  const base = `/${locale}/hive/${hiveId}`

  function isActive(segment: string) {
    if (segment === '') return pathname === base
    return pathname.startsWith(base + segment)
  }

  return (
    <aside className="w-44 flex-shrink-0 flex flex-col bg-card border-r border-border">
      <div className="px-3 py-4 border-b border-border">
        <span className="text-xs font-bold text-brand truncate block">🐝 {hiveName}</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(({ label, icon, segment }) => (
          <Link
            key={segment}
            href={base + segment}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
              isActive(segment)
                ? 'bg-brand/10 text-brand'
                : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
            )}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {(isOwner || isEditor) && (
        <div className="p-2 border-t border-border">
          <Link
            href={`${base}/settings`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-foreground/40 hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <span>⚙</span>
            <span>Settings</span>
          </Link>
        </div>
      )}
    </aside>
  )
}
