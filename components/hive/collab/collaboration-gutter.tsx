'use client'

import { useEffect, useMemo, useState } from 'react'
import { PanelRightClose, PanelRightOpen, MessageSquare } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import type { HiveRole } from '@/lib/hive/permissions'
import type { AnnotationRow } from '@/lib/actions/hive-annotations.actions'
import type { SuggestionRow } from '@/lib/actions/hive-suggestions.actions'
import { useCollabData } from '@/lib/hooks/use-collab-data'
import {
  GutterFilterStrip,
  defaultFilterState,
  type FilterState,
} from './gutter-filter-strip'
import { AnnotationCard } from './annotation-card'
import { SuggestionCard } from './suggestion-card'

export type Viewer = {
  id: string
  role: HiveRole
  bookOwnerId: string
}

type Props = {
  editor: Editor | null
  chapterId: string
  hiveId: string
  viewer: Viewer
  collapsed?: boolean
  onToggleCollapse?: () => void
  onAcceptedSuggestion?: () => void
  /** Bumped by the parent after creating an annotation/suggestion to force
   *  a refetch of the gutter's data. */
  refreshTrigger?: number
  /** Called whenever the gutter's live unresolved counts change. Drives the
   *  toolbar's gutter-button badge so it reflects post-resolve state. */
  onCountsChange?: (counts: { annotations: number; suggestions: number }) => void
  /** Flush pending editor autosave. Wired so the mark-strip on resolve/reject
   *  lands in DB immediately rather than racing the 2s debounce. */
  flushPendingSave?: () => Promise<void>
  /** Called after a successful resolve/reject so sibling subscribers (e.g.
   *  the always-mounted CollabCountsTracker) can refetch and update the
   *  toolbar badge in sync. */
  onMutated?: () => void
}

function stripMarkInstancesById(
  editor: Editor | null,
  markName: string,
  attrKey: string,
  id: string,
): boolean {
  if (!editor || editor.isDestroyed) return false
  const tr = editor.state.tr
  let found = false
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return
    const mark = node.marks.find(
      (m) =>
        m.type.name === markName &&
        (m.attrs as Record<string, unknown>)[attrKey] === id,
    )
    if (mark) {
      tr.removeMark(pos, pos + node.nodeSize, mark)
      found = true
    }
  })
  if (found) editor.view.dispatch(tr)
  return found
}

const EXPANDED_WIDTH = 320
const COLLAPSED_WIDTH = 32
const CARD_GAP = 10

export function CollaborationGutter({
  editor,
  chapterId,
  hiveId,
  viewer,
  collapsed = false,
  onToggleCollapse,
  onAcceptedSuggestion,
  refreshTrigger,
  onCountsChange,
  flushPendingSave,
  onMutated,
}: Props) {
  const {
    annotations,
    suggestions,
    refresh,
    mutate,
  } = useCollabData({ chapterId, hiveId, refreshTrigger })

  const [filter, setFilter] = useState<FilterState>(defaultFilterState)

  // Wrap mutate so resolve/reject side-effect-strip the highlight from the
  // editor. Acceptance already replaces the text run that carried the mark,
  // so the mark is gone naturally there — only resolve + reject paths need
  // explicit stripping.
  const wrappedMutate = useMemo(() => {
    return {
      ...mutate,
      resolveAnnotation: async (id: string) => {
        const res = await mutate.resolveAnnotation(id)
        if (res.success) {
          const stripped = stripMarkInstancesById(
            editor,
            'hiveAnnotation',
            'annotationId',
            id,
          )
          if (stripped && flushPendingSave) {
            try { await flushPendingSave() } catch { /* already toasted */ }
          }
          onMutated?.()
        }
        return res
      },
      unresolveAnnotation: async (id: string) => {
        const res = await mutate.unresolveAnnotation(id)
        if (res.success) onMutated?.()
        return res
      },
      rejectSuggestion: async (id: string, note?: string) => {
        const res = await mutate.rejectSuggestion(id, note)
        if (res.success) {
          const stripped = stripMarkInstancesById(
            editor,
            'hiveSuggestion',
            'suggestionId',
            id,
          )
          if (stripped && flushPendingSave) {
            try { await flushPendingSave() } catch { /* already toasted */ }
          }
          onMutated?.()
        }
        return res
      },
      acceptSuggestion: async (id: string) => {
        const res = await mutate.acceptSuggestion(id)
        if (res.success) onMutated?.()
        return res
      },
    }
  }, [mutate, editor, flushPendingSave, onMutated])

  // Group replies by parentId.
  const annotationReplies = useMemo(() => {
    const map = new Map<string, AnnotationRow[]>()
    for (const a of annotations) {
      if (a.parentId) {
        const arr = map.get(a.parentId) ?? []
        arr.push(a)
        map.set(a.parentId, arr)
      }
    }
    return map
  }, [annotations])

  const suggestionReplies = useMemo(() => {
    const map = new Map<string, SuggestionRow[]>()
    for (const s of suggestions) {
      if (s.parentId) {
        const arr = map.get(s.parentId) ?? []
        arr.push(s)
        map.set(s.parentId, arr)
      }
    }
    return map
  }, [suggestions])

  // Top-level only, filtered. Orphan filtering removed — every annotation
  // stays in the main list until manually resolved/rejected, even if its
  // anchor mark is missing from the doc. (The Orphaned section was too noisy
  // and incorrectly classified freshly-created rows under some edit races.)
  const visibleAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      if (a.parentId) return false
      if (filter.layers.size > 0 && !filter.layers.has(a.layer)) return false
      // Resolved is a view mode, not an add-on. When ON show ONLY resolved;
      // when OFF show ONLY unresolved. Mixing the two confused users — the
      // active list should never mingle resolved + unresolved items.
      if (filter.showResolved ? !a.resolved : a.resolved) return false
      return true
    })
  }, [annotations, filter])

  const visibleSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (s.parentId) return false
      if (!filter.showSuggestions) return false
      if (filter.showResolved ? !s.resolved : s.resolved) return false
      return true
    })
  }, [suggestions, filter])

  // Live unresolved counts — reported up so the toolbar's gutter-button badge
  // reflects the current state (not the stale server-fetched count). These
  // ignore the filter; the badge is "unread/pending across all layers".
  const liveAnnotationCount = useMemo(
    () => annotations.filter((a) => !a.parentId && !a.resolved).length,
    [annotations],
  )
  const liveSuggestionCount = useMemo(
    () => suggestions.filter((s) => !s.parentId && !s.resolved).length,
    [suggestions],
  )
  useEffect(() => {
    onCountsChange?.({
      annotations: liveAnnotationCount,
      suggestions: liveSuggestionCount,
    })
  }, [liveAnnotationCount, liveSuggestionCount, onCountsChange])

  if (collapsed) {
    const badgeCount = visibleAnnotations.length + visibleSuggestions.length
    return (
      <aside
        style={{ width: COLLAPSED_WIDTH }}
        className="flex h-full shrink-0 flex-col items-center border-l border-border bg-card py-2"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Open collaboration gutter"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        {badgeCount > 0 ? (
          <div className="mt-2 flex flex-col items-center gap-0.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-mono text-muted-foreground">
              {badgeCount}
            </span>
          </div>
        ) : null}
      </aside>
    )
  }

  function handleAccepted() {
    onAcceptedSuggestion?.()
    void refresh()
  }

  return (
    <aside
      style={{
        width: EXPANDED_WIDTH,
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ borderBottom: 'var(--br-card)' }}
      >
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Collaboration
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse collaboration gutter"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <GutterFilterStrip
        chapterId={chapterId}
        value={filter}
        onChange={setFilter}
      />

      <div className="relative flex-1 overflow-y-auto">
        {visibleAnnotations.length === 0 && visibleSuggestions.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">
            No annotations or suggestions yet.
          </div>
        ) : (
          <div
            className="flex flex-col p-2"
            style={{ gap: CARD_GAP }}
          >
            {visibleAnnotations.map((a) => (
              <AnnotationCard
                key={a.id}
                annotation={a}
                replies={annotationReplies.get(a.id) ?? []}
                viewer={viewer}
                mutate={wrappedMutate}
              />
            ))}
            {visibleSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                replies={suggestionReplies.get(s.id) ?? []}
                viewer={{ id: viewer.id, role: viewer.role }}
                mutate={wrappedMutate}
                onAccepted={handleAccepted}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

