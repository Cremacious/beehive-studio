'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { db } from '@/db'
import { supportMessages } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { getOptionalUserId } from '@/lib/require-auth'
import { requireAdmin } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/lib/admin/log-action'
import { runAdminWrite } from '@/lib/admin/safe-admin-action'
import { supportLimiter } from '@/lib/rate-limit'
import {
  sendSupportNotificationEmail,
  sendSupportResponseEmail,
} from '@/lib/email'
import { runAction } from '@/lib/actions/safe-action'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

const SUPPORT_INBOX = process.env.SUPPORT_INBOX_EMAIL ?? 'codemackcreations@gmail.com'

// ─── Public: submit a support message ────────────────────────────────────────

const submitSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  category: z.enum(['general', 'technical', 'feedback']),
  subject: z.string().min(3, 'Subject must be at least 3 characters.').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters.').max(5000),
})

export async function submitSupportMessageAction(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult<{ id: string }>> {
  // Rate limit by IP
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'
  const { success: rateLimitOk } = await supportLimiter.limit(ip)
  if (!rateLimitOk) {
    return { success: false, error: 'Too many requests. Please wait before submitting again.' }
  }

  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  return runAction(async () => {
    const userId = await getOptionalUserId()
    const { email, category, subject, message } = parsed.data

    const [row] = await db
      .insert(supportMessages)
      .values({ userId, email, category, subject, message })
      .returning({ id: supportMessages.id })

    // Best-effort notification to inbox
    await sendSupportNotificationEmail({
      to: SUPPORT_INBOX,
      fromEmail: email,
      category,
      subject,
      message,
      userId,
    })

    return { success: true, data: { id: row.id } }
  })
}

// ─── Admin: list messages ─────────────────────────────────────────────────────

export type SupportMessageRow = {
  id: string
  email: string
  category: 'general' | 'technical' | 'feedback'
  subject: string
  status: 'new' | 'in_progress' | 'resolved'
  userId: string | null
  createdAt: Date
}

export async function listSupportMessagesAction(opts?: {
  status?: 'new' | 'in_progress' | 'resolved'
  category?: 'general' | 'technical' | 'feedback'
}): Promise<{ ok: boolean; data?: SupportMessageRow[]; error?: string }> {
  await requireAdmin()

  try {
    const conditions = []
    if (opts?.status) conditions.push(eq(supportMessages.status, opts.status))
    if (opts?.category) conditions.push(eq(supportMessages.category, opts.category))

    const rows = await db
      .select({
        id: supportMessages.id,
        email: supportMessages.email,
        category: supportMessages.category,
        subject: supportMessages.subject,
        status: supportMessages.status,
        userId: supportMessages.userId,
        createdAt: supportMessages.createdAt,
      })
      .from(supportMessages)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(supportMessages.createdAt))
      .limit(200)

    return { ok: true, data: rows as SupportMessageRow[] }
  } catch (err) {
    console.error('[admin support] listSupportMessages:', err)
    return { ok: false, error: 'Failed to load messages.' }
  }
}

// ─── Admin: get single message ────────────────────────────────────────────────

export type SupportMessageDetail = {
  id: string
  email: string
  category: 'general' | 'technical' | 'feedback'
  subject: string
  message: string
  status: 'new' | 'in_progress' | 'resolved'
  userId: string | null
  adminResponse: string | null
  respondedAt: Date | null
  respondedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export async function getSupportMessageAction(
  id: string,
): Promise<{ ok: boolean; data?: SupportMessageDetail; error?: string }> {
  await requireAdmin()

  try {
    const rows = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.id, id))
      .limit(1)

    if (!rows[0]) return { ok: false, error: 'Message not found.' }
    return { ok: true, data: rows[0] as SupportMessageDetail }
  } catch (err) {
    console.error('[admin support] getSupportMessage:', err)
    return { ok: false, error: 'Failed to load message.' }
  }
}

// ─── Admin: update status ─────────────────────────────────────────────────────

export async function updateSupportStatusAction(
  id: string,
  status: 'new' | 'in_progress' | 'resolved',
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()

  return runAdminWrite(async () => {
    await db
      .update(supportMessages)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportMessages.id, id))

    await logAdminAction({ adminEmail: admin.email, action: 'UPDATE_SUPPORT_STATUS', metadata: { id, status } })
  })
}

// ─── Admin: respond to message ────────────────────────────────────────────────

const respondSchema = z.object({
  id: z.string().min(1),
  adminResponse: z.string().min(1, 'Response cannot be empty.').max(5000),
})

export async function respondToSupportMessageAction(input: {
  id: string
  adminResponse: string
}): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()

  const parsed = respondSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { id, adminResponse } = parsed.data

  const result = await runAdminWrite(async () => {
    const rows = await db
      .select({ email: supportMessages.email, subject: supportMessages.subject })
      .from(supportMessages)
      .where(eq(supportMessages.id, id))
      .limit(1)

    if (!rows[0]) throw new Error('Message not found.')

    await db
      .update(supportMessages)
      .set({
        adminResponse,
        respondedAt: new Date(),
        respondedBy: admin.email,
        status: 'resolved',
        updatedAt: new Date(),
      })
      .where(eq(supportMessages.id, id))

    await logAdminAction({ adminEmail: admin.email, action: 'RESPOND_TO_SUPPORT', metadata: { id } })

    // Best-effort — send after DB write so we never lose the response
    await sendSupportResponseEmail({
      to: rows[0].email,
      subject: rows[0].subject,
      adminResponse,
    })
  })

  return result
}

// ─── Admin: delete message ────────────────────────────────────────────────────

export async function deleteSupportMessageAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()

  return runAdminWrite(async () => {
    await db.delete(supportMessages).where(eq(supportMessages.id, id))
    await logAdminAction({ adminEmail: admin.email, action: 'DELETE_SUPPORT_MESSAGE', metadata: { id } })
  })
}
