import type { ModeId } from './url-state'

/**
 * Resolves the default mode for /discover when no `?mode=` URL param is set.
 * Always 'all' — the discovery surface defaults to the broadest view so users
 * see the full catalog first. For You / Trending / Popular are opt-in via the
 * mode toggle. (Was: 'for-you' for authed-with-signal users, 'trending' else.)
 */
export function resolveDefaultMode(_opts: {
  isAuthed: boolean
  hasSignal: boolean
}): ModeId {
  return 'all'
}
