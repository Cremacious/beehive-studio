import { toast } from 'sonner'
import { errorToMessage } from './messages'

/**
 * Shows a branded error toast from a server-action failure code.
 * Use when an action returns `{ success: false, error }`.
 *   const res = await fooAction(...)
 *   if (!res.success) { toastActionError(res.error); return }
 */
export function toastActionError(error: string | null | undefined): void {
  toast.error(errorToMessage(error))
}

/**
 * Shows the generic transport/network error toast. Use in a `catch` block so a
 * thrown action (offline, server crash) never becomes an unhandled rejection.
 *   try { ... } catch { toastNetworkError() }
 */
export function toastNetworkError(): void {
  toast.error(errorToMessage('NETWORK_ERROR'))
}

/**
 * Convenience for the common shape: await an action, toast on failure, and
 * return whether it succeeded. Catches thrown errors too.
 *   if (!(await runWithToast(() => fooAction(x)))) return
 */
export async function runWithToast<T extends { success: boolean; error?: string }>(
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    const res = await fn()
    if (!res.success) {
      toastActionError(res.error)
      return null
    }
    return res
  } catch {
    toastNetworkError()
    return null
  }
}
