'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { promoCodes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/lib/admin/log-action'
import { runAdminWrite } from '@/lib/admin/safe-admin-action'

export type PromoKind = 'DAYS_30' | 'DAYS_90' | 'DAYS_365' | 'LIFETIME'

const KIND_VALUES: PromoKind[] = ['DAYS_30', 'DAYS_90', 'DAYS_365', 'LIFETIME']

function normalizeCode(input: string): string {
  // Uppercase, strip whitespace, allow only A-Z 0-9 - _
  return input.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '')
}

export async function createPromoCodeAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()

  const rawCode = String(formData.get('code') ?? '')
  const code = normalizeCode(rawCode)
  const kind = String(formData.get('kind') ?? '') as PromoKind
  const note = String(formData.get('note') ?? '').trim() || null
  const maxUsesRaw = String(formData.get('maxUses') ?? '').trim()
  const maxUses = maxUsesRaw === '' ? null : Number(maxUsesRaw)

  if (!code || code.length < 4) return { ok: false, error: 'Code must be at least 4 characters.' }
  if (!KIND_VALUES.includes(kind)) return { ok: false, error: 'Invalid kind.' }
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return { ok: false, error: 'Max uses must be a positive integer or empty.' }
  }

  try {
    await db.insert(promoCodes).values({
      code,
      kind,
      note,
      maxUses,
      createdBy: admin.email,
    })
  } catch (e) {
    // unique violation
    return { ok: false, error: 'That code already exists.' }
  }

  await logAdminAction({
    adminEmail: admin.email,
    action: 'promo.create',
    targetType: 'promo_code',
    targetId: code,
    metadata: { kind, maxUses, note },
  })
  revalidatePath('/admin/promo-codes')
  return { ok: true }
}

export async function setPromoActiveAction(
  id: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  return runAdminWrite(async () => {
    await db.update(promoCodes).set({ isActive: active ? 'true' : 'false' }).where(eq(promoCodes.id, id))
    await logAdminAction({
      adminEmail: admin.email,
      action: active ? 'promo.enable' : 'promo.disable',
      targetType: 'promo_code',
      targetId: id,
    })
    revalidatePath('/admin/promo-codes')
  })
}

export async function deletePromoCodeAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  return runAdminWrite(async () => {
    await db.delete(promoCodes).where(eq(promoCodes.id, id))
    await logAdminAction({
      adminEmail: admin.email,
      action: 'promo.delete',
      targetType: 'promo_code',
      targetId: id,
    })
    revalidatePath('/admin/promo-codes')
  })
}
