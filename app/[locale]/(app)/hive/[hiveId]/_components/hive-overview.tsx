'use client'

import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import type { TaskRow } from '@/lib/actions/hive-content.actions'

type Props = {
  hive: { id: string; name: string; description: string | null; visibility: string; bookId: string | null }
  members: HiveMemberRow[]
  tasks: TaskRow[]
  isOwner: boolean
  locale: string
}

export function HiveOverview({ hive, members, tasks, isOwner, locale }: Props) {
  const openTasks = tasks.filter(t => t.status !== 'DONE')

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Book info bar */}
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-foreground">{hive.name}</h1>
          {hive.description && <p className="text-xs text-muted-foreground mt-0.5">{hive.description}</p>}
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-surface-elevated text-muted-foreground border border-border">
          {hive.visibility}
        </span>
        <span className="text-xs text-muted-foreground">{members.length} members</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Members */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Members</h2>
          <div className="flex flex-col gap-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
                  {m.user.image ? <img src={m.user.image} alt="" className="w-full h-full object-cover" /> : (m.user.name?.[0] ?? '?')}
                </div>
                <span className="text-xs text-foreground flex-1">{m.user.name ?? m.user.email}</span>
                <span className="text-[10px] text-muted-foreground">{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Open tasks */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Open Tasks</h2>
          {openTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open tasks.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {openTasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-border rounded-sm flex-shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{t.title}</span>
                  {t.assignee && (
                    <span className="text-[10px] text-muted-foreground">{t.assignee.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
