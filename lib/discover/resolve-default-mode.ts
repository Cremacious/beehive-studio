import type { ModeId } from './url-state'

/**
 * Resolves the default mode for /discover when no `?mode=` URL param is set.
 * - Authed + has any discovery signal (≥1 follow, like, or own book) → 'for-you'
 * - Authed + zero signals (new account) → 'trending'
 * - Guest → 'trending'
 */
export function resolveDefaultMode(opts: {
  isAuthed: boolean
  hasSignal: boolean
}): ModeId {
  if (!opts.isAuthed) return 'trending'
  if (!opts.hasSignal) return 'trending'
  return 'for-you'
}
