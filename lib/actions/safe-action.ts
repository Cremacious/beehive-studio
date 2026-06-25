import { AuthError } from '@/lib/require-auth'

/**
 * The shared failure shape. Compatible with every local `ActionResult<T>`
 * declaration across the action files (those are structurally identical), so
 * `toActionError` can be returned from any action without changing its type.
 */
export type ActionError = { success: false; error: string }

/**
 * Maps a thrown value to a typed `{ success: false, error }` so a server action
 * never propagates a raw error to the client (which would surface as an
 * unhandled Next server error / promise rejection instead of a graceful toast).
 *
 * Known sentinels are translated to stable error codes; the client copy mapper
 * (`lib/errors/messages.ts`) turns those into user-facing strings. Anything
 * unexpected is logged server-side and returned as `INTERNAL_ERROR` so no stack
 * trace or internal detail leaks to the user.
 *
 * Business-rule errors that actions already RETURN (NOT_FOUND, FREE_LIMIT_REACHED,
 * etc.) are unaffected — this only handles the THROW path.
 */
export function toActionError(err: unknown): ActionError {
  if (err instanceof AuthError) {
    return { success: false, error: err.statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED' }
  }

  const message = err instanceof Error ? err.message : ''

  // requirePremium throws `PREMIUM_REQUIRED:<feature>` — pass it through intact
  // so the client can show the right upgrade prompt.
  if (message.startsWith('PREMIUM_REQUIRED:')) {
    return { success: false, error: message }
  }

  // assert* helpers throw human sentences ("Book not found or access denied",
  // "Not a member of this hive", "Admin access required"). Translate to codes.
  if (/not found/i.test(message) && /access denied/i.test(message)) {
    return { success: false, error: 'FORBIDDEN' }
  }
  if (/not a member|access required|not authorized|not allowed/i.test(message)) {
    return { success: false, error: 'FORBIDDEN' }
  }
  if (/not found/i.test(message)) {
    return { success: false, error: 'NOT_FOUND' }
  }

  // Unexpected — log for debugging, return an opaque code to the user.
  console.error('[action error]', err)
  return { success: false, error: 'INTERNAL_ERROR' }
}

/**
 * Wraps a server action body so any thrown error becomes a typed failure.
 * Usage:
 *   export async function fooAction(input): Promise<ActionResult<X>> {
 *     return runAction(async () => {
 *       const userId = await requireAuth()
 *       ...
 *       return { success: true, data }
 *     })
 *   }
 *
 * Generic over the success payload; structurally compatible with each file's
 * local `ActionResult<T>` so callers keep their existing return annotations.
 */
export async function runAction<T>(
  fn: () => Promise<{ success: true; data: T } | ActionError>,
): Promise<{ success: true; data: T } | ActionError> {
  try {
    return await fn()
  } catch (err) {
    return toActionError(err)
  }
}
