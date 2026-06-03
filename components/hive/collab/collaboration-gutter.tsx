'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { OrphanSection } from './orphan-section'

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
}

const EXPANDED_WIDTH = 320
const COLLAPSED_WIDTH = 32
const CARD_GAP = 12
const VERTICAL_OFFSET = 8

type AnchoredItem =
  | { kind: 'annotation'; row: AnnotationRow }
  | { kind: 'suggestion'; row: SuggestionRow }

export function CollaborationGutter({
  editor,
  chapterId,
  hiveId,
  viewer,
  collapsed = false,
  onToggleCollapse,
  onAcceptedSuggestion,
  refreshTrigger,
}: Props) {
  const {
    annotations,
    suggestions,
    orphanAnnotationIds,
    orphanSuggestionIds,
    refresh,
    mutate,
  } = useCollabData({ chapterId, hiveId, refreshTrigger })

  const [filter, setFilter] = useState<FilterState>(defaultFilterState)
  const gutterRef = useRef<HTMLDivElement | null>(null)
  const [positions, setPositions] = useState<Record<string, number>>({})

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

  // Top-level only, filtered.
  const visibleAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      if (a.parentId) return false
      if (orphanAnnotationIds.includes(a.id)) return false
      if (filter.layers.size > 0 && !filter.layers.has(a.layer)) return false
      if (a.resolved && !filter.showResolved) return false
      return true
    })
  }, [annotations, orphanAnnotationIds, filter])

  const visibleSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (s.parentId) return false
      if (orphanSuggestionIds.includes(s.id)) return false
      if (!filter.showSuggestions) return false
      if (s.resolved && !filter.showResolved) return false
      return true
    })
  }, [suggestions, orphanSuggestionIds, filter])

  // Orphans (top-level only).
  const orphanedAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) => !a.parentId && orphanAnnotationIds.includes(a.id),
      ),
    [annotations, orphanAnnotationIds],
  )
  const orphanedSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) => !s.parentId && orphanSuggestionIds.includes(s.id),
      ),
    [suggestions, orphanSuggestionIds],
  )

  // Compute anchor positions for cards via editor.view.coordsAtPos.
  useLayoutEffect(() => {
    if (collapsed) return
    if (!editor || editor.isDestroyed) {
      setPositions({})
      return
    }
    const gutter = gutterRef.current
    if (!gutter) return

    function compute() {
      if (!editor || editor.isDestroyed) return
      const gutterRect = gutter!.getBoundingClientRect()
      const docSize = editor.state.doc.content.size
      const next: Record<string, number> = {}
      const items: AnchoredItem[] = [
        ...visibleAnnotations.map(
          (a): AnchoredItem => ({ kind: 'annotation', row: a }),
        ),
        ...visibleSuggestions.map(
          (s): AnchoredItem => ({ kind: 'suggestion', row: s }),
        ),
      ]
      for (const item of items) {
        const start =
          item.kind === 'annotation'
            ? item.row.selectionStart
            : item.row.selectionStart
        if (start === null || start === undefined) continue
        if (start < 0 || start > docSize) continue
        try {
          const coords = editor.view.coordsAtPos(start)
          next[item.row.id] = coords.top - gutterRect.top
        } catch {
          // ignore — position invalid for current doc state
        }
      }
      setPositions(next)
    }

    compute()
    // Recompute on common editor mutations.
    const handler = () => compute()
    editor.on('update', handler)
    editor.on('selectionUpdate', handler)
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      editor.off('update', handler)
      editor.off('selectionUpdate', handler)
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [editor, visibleAnnotations, visibleSuggestions, collapsed])

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

  // Determine layout: prefer anchored when editor + at least one position resolved.
  const canAnchor =
    editor !== null &&
    !editor.isDestroyed &&
    (visibleAnnotations.length + visibleSuggestions.length === 0 ||
      Object.keys(positions).length > 0)

  // For absolute layout: sort items by top, then collision-resolve so cards don't overlap.
  const allAnchored: AnchoredItem[] = [
    ...visibleAnnotations.map(
      (a): AnchoredItem => ({ kind: 'annotation', row: a }),
    ),
    ...visibleSuggestions.map(
      (s): AnchoredItem => ({ kind: 'suggestion', row: s }),
    ),
  ]
  if (canAnchor) {
    allAnchored.sort((a, b) => {
      const ta = positions[a.row.id] ?? Number.POSITIVE_INFINITY
      const tb = positions[b.row.id] ?? Number.POSITIVE_INFINITY
      return ta - tb
    })
  }

  // Estimated card height (only used for collision avoidance — actual height
  // varies). 72px = compact card.
  const ESTIMATED_HEIGHT = 84

  const resolvedTops: Record<string, number> = {}
  if (canAnchor) {
    let lastBottom = 0
    for (const item of allAnchored) {
      const raw = positions[item.row.id]
      if (raw === undefined) continue
      const top = Math.max(raw, lastBottom + VERTICAL_OFFSET)
      resolvedTops[item.row.id] = top
      lastBottom = top + ESTIMATED_HEIGHT
    }
  }

  function handleAccepted() {
    onAcceptedSuggestion?.()
    void refresh()
  }

  return (
    <aside
      ref={gutterRef}
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
        ) : canAnchor ? (
          <div
            className="relative"
            style={{
              minHeight:
                Object.values(resolvedTops).reduce(
                  (max, t) => Math.max(max, t),
                  0,
                ) + ESTIMATED_HEIGHT,
            }}
          >
            {allAnchored.map((item) => {
              const top = resolvedTops[item.row.id]
              if (top === undefined) return null
              return (
                <div
                  key={item.row.id}
                  className="absolute left-2 right-2"
                  style={{ top }}
                >
                  {item.kind === 'annotation' ? (
                    <AnnotationCard
                      annotation={item.row as AnnotationRow}
                      replies={
                        annotationReplies.get(item.row.id) ?? []
                      }
                      viewer={viewer}
                      mutate={mutate}
                    />
                  ) : (
                    <SuggestionCard
                      suggestion={item.row as SuggestionRow}
                      replies={
                        suggestionReplies.get(item.row.id) ?? []
                      }
                      viewer={{ id: viewer.id, role: viewer.role }}
                      mutate={mutate}
                      onAccepted={handleAccepted}
                    />
                  )}
                </div>
              )
            })}
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
                mutate={mutate}
              />
            ))}
            {visibleSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                replies={suggestionReplies.get(s.id) ?? []}
                viewer={{ id: viewer.id, role: viewer.role }}
                mutate={mutate}
                onAccepted={handleAccepted}
              />
            ))}
          </div>
        )}
      </div>

      <OrphanSection
        orphanedAnnotations={orphanedAnnotations}
        orphanedSuggestions={orphanedSuggestions}
        mutate={mutate}
      />
    </aside>
  )
}

