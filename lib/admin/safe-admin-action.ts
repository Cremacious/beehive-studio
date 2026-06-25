/**
 * Wraps the DB-write portion of an admin server action so an unexpected failure
 * returns a clean `{ ok: false, error }` instead of an unhandled throw.
 *
 * IMPORTANT: call `requireAdmin()` (which uses `redirect()`) and any input
 * guards BEFORE invoking this. `redirect()` throws a control-flow error that
 * must propagate, so it must never run inside this try/catch.
 */
export async function runAdminWrite(
  fn: () => Promise<void>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await fn()
    return { ok: true }
  } catch (err) {
    console.error('[admin action]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
