'use server'

import { requireAuth } from '@/lib/require-auth'
import { deleteCloudinaryImage, getCloudinaryPublicId } from '@/lib/cloudinary'

/**
 * Client-driven Cloudinary asset cleanup.
 *
 * Used by surfaces where the asset URL lives inside generic content
 * (e.g. binder JSON for about-author photo) and can't be cleaned up
 * server-side from the dedicated write action.
 *
 * Auth-gated and folder-whitelisted so a malicious caller can't delete
 * arbitrary public IDs (e.g. another user's avatar).
 *
 * Best-effort: a failure to delete the Cloudinary asset must never
 * surface to the user as a hard error — the worst case is one orphan
 * asset, which is acceptable storage-bloat vs. failed UX.
 */

const ALLOWED_FOLDER_PREFIXES = ['about-author/', 'covers/'] as const
export type CleanupFolder = (typeof ALLOWED_FOLDER_PREFIXES)[number]

export async function deleteCloudinaryAssetAction(
  url: string,
  expectedFolder: CleanupFolder,
): Promise<{ success: boolean }> {
  try {
    await requireAuth()
  } catch {
    return { success: false }
  }

  const publicId = getCloudinaryPublicId(url)
  if (!publicId) return { success: false }
  if (!publicId.startsWith(expectedFolder)) return { success: false }

  try {
    await deleteCloudinaryImage(publicId)
    return { success: true }
  } catch {
    return { success: false }
  }
}
