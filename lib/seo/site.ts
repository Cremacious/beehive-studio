import type { Metadata } from 'next'
import { locales, defaultLocale } from '@/i18n/config'

/**
 * Single source of truth for site-wide SEO copy + URL helpers (issue #52).
 *
 * Branding is "Beehive Books" everywhere (issue #51). The slogan is the app's
 * official tagline. No em-dashes in any of these user-facing strings.
 */
export const SITE_NAME = 'Beehive Books'
export const SITE_SLOGAN = 'Get buzzed about writing!'

export const SITE_DESCRIPTION =
  'Beehive Books is the writing studio and community where authors draft their books, build them with other writers in collaborative Hives, and publish to readers who care. Write, collaborate, and share your story from blank page to bookshelf.'

export const SITE_KEYWORDS = [
  'writing platform',
  'write a book',
  'book writing software',
  'online writing studio',
  'collaborative writing',
  'self publishing',
  'read free books',
  'writing community',
  'novel writing app',
  'creative writing',
  'serial fiction',
  'book club',
]

// The default social share image (1200x630). Generated from the brand logo by
// scripts/generate-og-image.mjs. Lives in public/ so it resolves against
// metadataBase as an absolute URL for OG/Twitter scrapers.
export const OG_IMAGE_PATH = '/og-default.png'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_SLOGAN}`

/**
 * Resolved site origin (no trailing slash). NEXT_PUBLIC_APP_URL must be the
 * real production domain in prod; falls back to localhost for dev.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

/** Absolute URL for a root-relative path (e.g. "/en/discover"). */
export function absoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${siteUrl()}${p}`
}

/**
 * Build canonical + hreflang alternates for a localized route.
 *
 * `pathAfterLocale` is the route WITHOUT the leading locale segment, e.g.
 * "/books/abc" or "" for the locale root. Canonical points at the current
 * locale; `languages` lists every locale (plus an x-default) so duplicate
 * per-locale content is handled correctly even once more locales are added.
 *
 * Paths are returned relative; Next resolves them against `metadataBase`.
 */
export function localeAlternates(
  currentLocale: string,
  pathAfterLocale: string,
): NonNullable<Metadata['alternates']> {
  const suffix = pathAfterLocale === '/' ? '' : pathAfterLocale
  const languages: Record<string, string> = {}
  for (const loc of locales) {
    languages[loc] = `/${loc}${suffix}`
  }
  languages['x-default'] = `/${defaultLocale}${suffix}`
  return {
    canonical: `/${currentLocale}${suffix}`,
    languages,
  }
}

/**
 * Collapse whitespace and trim a free-text field to a clean meta description.
 * Strips newlines so multi-paragraph synopses become a single tidy sentence
 * fragment. Truncates on a word boundary near `max` and appends an ellipsis.
 */
export function toMetaDescription(
  input: string | null | undefined,
  max = 160,
): string | undefined {
  if (!input) return undefined
  const clean = input.replace(/\s+/g, ' ').trim()
  if (!clean) return undefined
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${base.replace(/[.,;:!?\s]+$/, '')}...`
}
