import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE_NAME, verifySessionCookie, type AdminSession } from './session'

/**
 * Server-side guard for admin pages and server actions.
 * Throws via redirect() to /admin/login if the session cookie is missing/invalid.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const store = await cookies()
  const cookie = store.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifySessionCookie(cookie)
  if (!session) {
    redirect('/admin/login')
  }
  return session
}

/**
 * Non-throwing variant: returns null if not signed in.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies()
  const cookie = store.get(ADMIN_COOKIE_NAME)?.value
  return verifySessionCookie(cookie)
}
