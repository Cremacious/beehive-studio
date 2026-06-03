'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getChapterAnnotationsAction,
  replyToAnnotationAction,
  resolveAnnotationAction,
  unresolveAnnotationAction,
  type AnnotationRow,
} from '@/lib/actions/hive-annotations.actions'
import {
  getChapterSuggestionsAction,
  replyToSuggestionAction,
  acceptSuggestionAction,
  rejectSuggestionAction,
  type SuggestionRow,
} from '@/lib/actions/hive-suggestions.actions'

export type UseCollabDataArgs = {
  chapterId: string
  hiveId: string
  enabled?: boolean
  /** Bump this from the parent (e.g., after creating an annotation) to force
   *  a refetch. Useful when the parent owns the create-flow callback. */
  refreshTrigger?: number
}

export type CollabMutations = {
  replyToAnnotation: (input: { parentId: string; body: string }) => Promise<
    Awaited<ReturnType<typeof replyToAnnotationAction>>
  >
  resolveAnnotation: (
    annotationId: string,
  ) => Promise<Awaited<ReturnType<typeof resolveAnnotationAction>>>
  unresolveAnnotation: (
    annotationId: string,
  ) => Promise<Awaited<ReturnType<typeof unresolveAnnotationAction>>>
  replyToSuggestion: (input: { parentId: string; body: string }) => Promise<
    Awaited<ReturnType<typeof replyToSuggestionAction>>
  >
  acceptSuggestion: (
    suggestionId: string,
  ) => Promise<Awaited<ReturnType<typeof acceptSuggestionAction>>>
  rejectSuggestion: (
    id: string,
    note?: string,
  ) => Promise<Awaited<ReturnType<typeof rejectSuggestionAction>>>
}

export type UseCollabDataResult = {
  annotations: AnnotationRow[]
  suggestions: SuggestionRow[]
  orphanAnnotationIds: string[]
  orphanSuggestionIds: string[]
  loading: boolean
  refresh: () => Promise<void>
  mutate: CollabMutations
}

export function useCollabData({
  chapterId,
  hiveId,
  enabled = true,
  refreshTrigger = 0,
}: UseCollabDataArgs): UseCollabDataResult {
  const [annotations, setAnnotations] = useState<AnnotationRow[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [orphanAnnotationIds, setOrphanAnnotationIds] = useState<string[]>([])
  const [orphanSuggestionIds, setOrphanSuggestionIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(enabled)

  const refresh = useCallback(async () => {
    if (!enabled || !chapterId || !hiveId) return
    setLoading(true)
    try {
      const [aRes, sRes] = await Promise.all([
        getChapterAnnotationsAction(chapterId, hiveId),
        getChapterSuggestionsAction({ chapterId, hiveId }),
      ])
      if (aRes.success) {
        setAnnotations(aRes.data.annotations)
        setOrphanAnnotationIds(aRes.data.orphanRowIds)
      } else {
        setAnnotations([])
        setOrphanAnnotationIds([])
      }
      if (sRes.success) {
        setSuggestions(sRes.data.suggestions)
        setOrphanSuggestionIds(sRes.data.orphanRowIds)
      } else {
        setSuggestions([])
        setOrphanSuggestionIds([])
      }
    } finally {
      setLoading(false)
    }
  }, [chapterId, hiveId, enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    // refreshTrigger is intentionally in deps — parents bump it after
    // mutations like annotation create so the gutter re-fetches.
  }, [refresh, enabled, refreshTrigger])

  const mutate: CollabMutations = {
    replyToAnnotation: async (input) => {
      const res = await replyToAnnotationAction(input)
      if (res.success) await refresh()
      return res
    },
    resolveAnnotation: async (annotationId) => {
      const res = await resolveAnnotationAction(annotationId)
      if (res.success) await refresh()
      return res
    },
    unresolveAnnotation: async (annotationId) => {
      const res = await unresolveAnnotationAction(annotationId)
      if (res.success) await refresh()
      return res
    },
    replyToSuggestion: async (input) => {
      const res = await replyToSuggestionAction(input)
      if (res.success) await refresh()
      return res
    },
    acceptSuggestion: async (suggestionId) => {
      const res = await acceptSuggestionAction(suggestionId)
      if (res.success) await refresh()
      return res
    },
    rejectSuggestion: async (id, note) => {
      const res = await rejectSuggestionAction({ id, note })
      if (res.success) await refresh()
      return res
    },
  }

  return {
    annotations,
    suggestions,
    orphanAnnotationIds,
    orphanSuggestionIds,
    loading,
    refresh,
    mutate,
  }
}
