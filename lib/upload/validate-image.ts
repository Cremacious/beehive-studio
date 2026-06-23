/**
 * Shared image-upload validation. All client-side upload paths
 * (avatars, covers, clubs, about-author) should call this helper before
 * handing the file to useCloudinaryUpload.
 *
 * Returns a human-readable error string or null when the file is valid.
 */

export const DEFAULT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const DEFAULT_MAX_SIZE_MB = 5

export type ValidateImageOptions = {
  /** Default: 5 MB. */
  maxSizeMb?: number
  /** Default: PNG, JPG, WEBP. */
  allowedTypes?: readonly string[]
  /**
   * Optional noun for the error message, e.g. "Cover image" or "Photo".
   * Falls back to "Image".
   */
  label?: string
}

export function validateImageFile(
  file: File,
  opts: ValidateImageOptions = {},
): string | null {
  const allowed = opts.allowedTypes ?? DEFAULT_ALLOWED_TYPES
  const maxMb = opts.maxSizeMb ?? DEFAULT_MAX_SIZE_MB
  const label = opts.label ?? 'Image'

  if (!allowed.includes(file.type)) {
    return 'Only PNG, JPG, and WEBP images are supported.'
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `${label} must be ${maxMb} MB or smaller.`
  }
  return null
}
