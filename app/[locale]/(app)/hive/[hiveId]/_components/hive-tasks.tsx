'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TaskRow } from '@/lib/actions/hive-content.actions'
import { createTaskAction, updateTaskAction, deleteTaskAction } from '@/lib/actions/hive-content.actions'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'

const COLUMNS = [
  { status: 'OPEN', label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
] as const

type Props = { hiveId: string; initialTasks: TaskRow[]; members: HiveMemberRow[]; currentUserId: string }

export function HiveTasks({ hiveId, initialTasks, members, currentUserId }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const result = await createTaskAction(hiveId, { title: newTitle.trim(), assigneeId: newAssignee || undefined })
    if (result.success) {
      const assigneeMember = members.find(m => m.userId === newAssignee)
      setTasks(prev => [...prev, {
        id: result.data.taskId, hiveId, title: newTitle.trim(), description: null,
        assigneeId: newAssignee || null, creatorId: currentUserId,
        status: 'OPEN', createdAt: new Date(),
        assignee: assigneeMember ? { name: assigneeMember.user.name, image: assigneeMember.user.image } : null,
      }])
      setNewTitle('')
      setNewAssignee('')
    }
  }

  async function handleStatusChange(taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') {
    await updateTaskAction(taskId, { status })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  async function handleDelete(taskId: string) {
    await deleteTaskAction(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <form onSubmit={handleCreate} className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="New task title…"
          className="flex-1 bg-surface-inset border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-brand/40"
        />
        <select
          value={newAssignee}
          onChange={e => setNewAssignee(e.target.value)}
          className="bg-surface-inset border border-border rounded px-2 py-1.5 text-sm text-muted-foreground outline-none"
        >
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>)}
        </select>
        <button type="submit" disabled={!newTitle.trim()} className="px-3 py-1.5 rounded bg-brand text-black text-sm font-medium disabled:opacity-40">
          Add Task
        </button>
      </form>

      <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
        {COLUMNS.map(col => (
          <div key={col.status} className="flex flex-col gap-2 overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{col.label}</div>
            {tasks.filter(t => t.status === col.status).map(task => (
              <div key={task.id} className={cn('bg-card border border-border rounded-lg p-3', task.status === 'DONE' && 'opacity-50')}>
                <p className={cn('text-sm text-foreground mb-2', task.status === 'DONE' && 'line-through text-muted-foreground')}>{task.title}</p>
                <div className="flex items-center gap-2">
                  {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee.name}</span>}
                  <div className="ml-auto flex gap-1">
                    {col.status !== 'OPEN' && (
                      <button onClick={() => handleStatusChange(task.id, 'OPEN')} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground">←</button>
                    )}
                    {col.status !== 'DONE' && (
                      <button onClick={() => handleStatusChange(task.id, col.status === 'OPEN' ? 'IN_PROGRESS' : 'DONE')} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground">→</button>
                    )}
                    {task.creatorId === currentUserId && (
                      <button onClick={() => handleDelete(task.id)} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-destructive">✕</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
