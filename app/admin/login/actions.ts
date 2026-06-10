'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE_NAME, buildSessionCookie, safeCompare } from '@/lib/admin/session'
import { logAdminAction } from '@/lib/admin/log-action'

export interface LoginResult {
  ok: boolean
  error?: string
}

export async function adminLoginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const expectedEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const expectedPassword = process.env.ADMIN_PASSWORD ?? ''

  if (!expectedEmail || !expectedPassword) {
    return { ok: false, error: 'Admin credentials are not configured on the server.' }
  }
  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' }
  }

  const emailOk = safeCompare(email, expectedEmail)
  const passOk = safeCompare(password, expectedPassword)
  if (!emailOk || !passOk) {
    return { ok: false, error: 'Invalid credentials.' }
  }

  const cookieValue = await buildSessionCookie(email)
  const store = await cookies()
  store.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h
  })

  await logAdminAction({ adminEmail: email, action: 'admin.login' })
  redirect('/admin')
}

export async function adminLogoutAction(): Promise<void> {
  const store = await cookies()
  const email = store.get(ADMIN_COOKIE_NAME)?.value ? 'unknown' : 'unknown'
  store.delete(ADMIN_COOKIE_NAME)
  await logAdminAction({ adminEmail: email, action: 'admin.logout' })
  redirect('/admin/login')
}
