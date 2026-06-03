/**
 * Beat type fields the migrator touches. Mirrors the relevant shape from
 * outline-board.tsx without coupling to its full Beat type — this module
 * is consumed by readContent() at read time and must stay pure.
 */
export type LegacyBeat = {
  id: string
  title: string
  description?: string
  status?: 'idea' | 'drafting' | 'done'
  color?: 'yellow' | 'orange' | 'pink' | 'purple' | 'blue' | 'mint' | 'lime' | 'slate' | null
  label?: string | null
  linkedChapterId?: string | null
  act?: string | null
}

const STATUS_TO_COLOR = {
  idea: 'yellow',
  drafting: 'orange',
  done: 'lime',
} as const

/**
 * Maps a legacy `status` field to `color`, then drops `status` from the
 * returned beat. If the beat already has an explicit `color`, the existing
 * value wins (idempotent — re-running on already-migrated content is a no-op).
 * Beats without `status` and without `color` are returned with `color` left
 * undefined (caller renders a hollow dashed dot).
 */
export function migrateBeatStatus(beat: LegacyBeat): LegacyBeat {
  const { status, ...rest } = beat
  if (rest.color !== undefined) return rest
  if (status === undefined) return rest
  return { ...rest, color: STATUS_TO_COLOR[status] }
}
