/**
 * Cloudinary delivery-URL optimization.
 *
 * Cloudinary stores the upload at a raw URL like
 *   https://res.cloudinary.com/<cloud>/image/upload/v1700000000/covers/abc.jpg
 * Inserting a transformation segment after `/upload/` lets Cloudinary
 * resize, reformat, and re-encode on the fly — so we serve appropriately
 * sized assets instead of full-resolution originals.
 *
 * Preset configuration reminder (Cloudinary dashboard → Settings → Upload):
 *   beehive_avatars      → unsigned, folder: avatars,      format: auto, quality: auto
 *   beehive_covers       → unsigned, folder: covers,       format: auto, quality: auto
 *   beehive_clubs        → unsigned, folder: clubs,        format: auto, quality: auto
 *   beehive_about-author → unsigned, folder: about-author, format: auto, quality: auto
 *
 * With `format: auto` + `quality: auto` on the preset, the `f_auto,q_auto`
 * delivery transforms below are belt-and-braces — they still apply when
 * the original was uploaded with a fixed format/quality (e.g. legacy uploads).
 */

const CLOUDINARY_UPLOAD_SEGMENT = '/upload/'

/**
 * Inserts a transformation string after `/upload/` in a Cloudinary URL.
 * Returns the original URL unchanged when:
 *   - it isn't a Cloudinary URL (no `/upload/` segment), or
 *   - it already contains a transformation segment (idempotent).
 */
export function optimizeCloudinaryUrl(rawUrl: string | null | undefined, transforms: string): string {
  if (!rawUrl) return ''
  const idx = rawUrl.indexOf(CLOUDINARY_UPLOAD_SEGMENT)
  if (idx === -1) return rawUrl
  const after = rawUrl.slice(idx + CLOUDINARY_UPLOAD_SEGMENT.length)
  // Idempotency: if the next segment already looks like a transformation
  // (contains `_` and ends with `/`), assume it's been optimized already.
  const firstSeg = after.split('/')[0] ?? ''
  if (/^[a-z]_/.test(firstSeg)) return rawUrl
  return `${rawUrl.slice(0, idx + CLOUDINARY_UPLOAD_SEGMENT.length)}${transforms}/${after}`
}

/** Cover delivery transforms — 16:9-ish hero (640×360 cover-fill). */
export const COVER_TRANSFORMS = 'w_640,h_360,c_fill,f_auto,q_auto'

/** Book cover delivery transforms — 5:7 portrait (400×560 cover-fill). */
export const BOOK_COVER_TRANSFORMS = 'w_400,h_560,c_fill,f_auto,q_auto'

/** Avatar delivery transforms — 200×200 square. */
export const AVATAR_TRANSFORMS = 'w_200,h_200,c_fill,f_auto,q_auto'

/** About-author photo delivery transforms — 400×400 square. */
export const ABOUT_AUTHOR_TRANSFORMS = 'w_400,h_400,c_fill,f_auto,q_auto'
