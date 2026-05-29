'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListOrdered,
  BookOpen,
  StickyNote,
  MessagesSquare,
  Send,
  FileEdit,
  Target,
  Megaphone,
  Users,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  hiveId: string
  locale: string
  hiveName: string
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, segment: '' },
  { label: 'Outline', icon: ListOrdered, segment: '/outline' },
  { label: 'Wiki', icon: BookOpen, segment: '/wiki' },
  { label: 'Annotations', icon: StickyNote, segment: '/annotations' },
  { label: 'Discussions', icon: MessagesSquare, segment: '/discussions' },
  { label: 'Submit Chapter', icon: Send, segment: '/submissions' },
  { label: 'Edit Suggestions', icon: FileEdit, segment: '/suggestions' },
  { label: 'Word Goals', icon: Target, segment: '/word-goals' },
  { label: 'Buzz Board', icon: Megaphone, segment: '/buzz' },
  { label: 'Members', icon: Users, segment: '/members' },
  { label: 'Settings', icon: Settings, segment: '/settings' },
] as const

export function HiveSidebar({ hiveId, locale, hiveName }: Props) {
  const pathname = usePathname()
  const base = `/${locale}/hive/${hiveId}`

  function isActive(segment: string) {
    if (segment === '') return pathname === base
    return pathname.startsWith(base + segment)
  }

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col bg-card border-r border-border">
      <div className="px-3 py-4 border-b border-border">
        <span className="text-xs font-bold text-brand truncate block">🐝 {hiveName}</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, segment }) => {
          const active = isActive(segment)
          return (
            <Link
              key={segment}
              href={base + segment}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors relative',
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-foreground/60 hover:text-foreground hover:bg-surface-elevated',
              )}
            >
              {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-brand" />}
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
