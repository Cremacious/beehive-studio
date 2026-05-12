'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import type { HiveMemberRow } from '@/lib/actions/hive.actions'
import type { CommentRow } from '@/lib/actions/hive-collab.actions'
import { lockChapterAction, unlockChapterAction, getChapterCommentsAction } from '@/lib/actions/hive-collab.actions'
import { HiveChapterComments } from './hive-chapter-comments'

// BookEditorProvider / ChapterEditor do not yet exist in the studio (Phase 3).
// Using a placeholder editor view until Phase 3 integration.

type Props = {
  hiveId: string
  bookId: string
  initialBinderItems: BinderItemRow[]
  initialLocks: Record<string, { userId: string; lockedAt: Date }>
  members: HiveMemberRow[]
}

export function HiveBinder({ hiveId, bookId, initialBinderItems, initialLocks, members }: Props) {
  const [locks] = useState(initialLocks)
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])

  const memberMap = Object.fromEntries(members.map(m => [m.userId, m.user.name ?? m.user.email]))

  const chapterItems = initialBinderItems.filter(i =>
    ['chapter', 'front_matter', 'back_matter'].includes(i.type)
  )

  async function handleChapterSelect(binderItemId: string, chapterId: string) {
    if (activeChapterId) await unlockChapterAction(activeChapterId)
    setActiveChapterId(chapterId)
    await lockChapterAction(hiveId, chapterId)
    const result = await getChapterCommentsAction(chapterId)
    if (result.success) setComments(result.data)
  }

  async function refreshComments() {
    if (!activeChapterId) return
    const result = await getChapterCommentsAction(activeChapterId)
    if (result.success) setComments(result.data)
  }

  return (
    <div className="flex h-full">
      {/* Binder list with lock badges */}
      <div className="w-52 border-r border-border bg-card overflow-y-auto p-2 flex-shrink-0">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 py-1 mb-1">Chapters</div>
        {chapterItems.map(item => {
          const lock = locks[item.id]
          return (
            <button
              key={item.id}
              onClick={() => item.chapterId && handleChapterSelect(item.id, item.chapterId)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors',
                'hover:bg-surface-elevated text-foreground/70',
                activeChapterId === item.chapterId && 'bg-brand/10 text-brand',
              )}
            >
              <span className="flex-1 truncate">{item.title}</span>
              {lock && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-surface-elevated border border-border text-muted-foreground truncate max-w-16">
                  {memberMap[lock.userId] ?? 'editing'}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {/* Editor + comments */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
          {activeChapterId ? (
            <p>Chapter selected — full editor coming in Phase 3 integration.</p>
          ) : (
            <p>Select a chapter to start editing.</p>
          )}
        </div>
        {activeChapterId && (
          <HiveChapterComments
            hiveId={hiveId}
            chapterId={activeChapterId}
            comments={comments}
            onCommentAdded={refreshComments}
          />
        )}
      </div>
    </div>
  )
}
