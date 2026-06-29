import type { MetadataRoute } from 'next'
import { and, eq, ne, isNotNull, desc } from 'drizzle-orm'
import { db } from '@/db'
import { books, userProfiles } from '@/db/schema'
import { locales, defaultLocale } from '@/i18n/config'
import { absoluteUrl } from '@/lib/seo/site'

/**
 * Dynamic sitemap (issue #52).
 *
 * Includes only anonymously-reachable, indexable content: marketing + legal
 * pages, /discover, every PUBLIC discoverable published book, and every author
 * profile that has at least one such book. Auth-gated surfaces (studio,
 * settings, community, hive, admin, auth) are excluded by construction and
 * blocked in robots.ts.
 *
 * Each entry carries per-locale `alternates.languages` so duplicate-locale
 * content is handled correctly. The DB reads are wrapped so a transient DB
 * outage degrades to the static page set rather than failing the build/route.
 */

const BOOK_LIMIT = 5000
const PROFILE_LIMIT = 5000

type Entry = MetadataRoute.Sitemap[number]

function localizedEntry(
  pathAfterLocale: string,
  opts: {
    lastModified?: Date
    changeFrequency?: Entry['changeFrequency']
    priority?: number
  } = {},
): Entry {
  const suffix = pathAfterLocale === '/' ? '' : pathAfterLocale
  const languages: Record<string, string> = {}
  for (const loc of locales) languages[loc] = absoluteUrl(`/${loc}${suffix}`)
  languages['x-default'] = absoluteUrl(`/${defaultLocale}${suffix}`)
  return {
    url: absoluteUrl(`/${defaultLocale}${suffix}`),
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: { languages },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    localizedEntry('/', { changeFrequency: 'weekly', priority: 1 }),
    localizedEntry('/discover', { changeFrequency: 'daily', priority: 0.9 }),
    localizedEntry('/pricing', { changeFrequency: 'monthly', priority: 0.7 }),
    localizedEntry('/privacy', { changeFrequency: 'yearly', priority: 0.3 }),
    localizedEntry('/terms', { changeFrequency: 'yearly', priority: 0.3 }),
    localizedEntry('/cookies', { changeFrequency: 'yearly', priority: 0.3 }),
    localizedEntry('/dmca', { changeFrequency: 'yearly', priority: 0.3 }),
  ]

  try {
    const publicBookFilters = and(
      eq(books.visibility, 'PUBLIC'),
      eq(books.discoverable, true),
      eq(books.status, 'PUBLISHED'),
      ne(books.status, 'STANDALONE_HIVE_SHADOW'),
    )

    const [bookRows, profileRows] = await Promise.all([
      db
        .select({ id: books.id, updatedAt: books.updatedAt })
        .from(books)
        .where(publicBookFilters)
        .orderBy(desc(books.updatedAt))
        .limit(BOOK_LIMIT),
      db
        .selectDistinct({
          username: userProfiles.username,
          updatedAt: userProfiles.updatedAt,
        })
        .from(userProfiles)
        .innerJoin(books, eq(books.userId, userProfiles.userId))
        .where(and(isNotNull(userProfiles.username), publicBookFilters))
        .limit(PROFILE_LIMIT),
    ])

    for (const b of bookRows) {
      entries.push(
        localizedEntry(`/books/${b.id}`, {
          lastModified: b.updatedAt ?? undefined,
          changeFrequency: 'weekly',
          priority: 0.8,
        }),
      )
    }

    for (const p of profileRows) {
      if (!p.username) continue
      entries.push(
        localizedEntry(`/u/${p.username}`, {
          lastModified: p.updatedAt ?? undefined,
          changeFrequency: 'weekly',
          priority: 0.6,
        }),
      )
    }
  } catch (err) {
    console.error('[sitemap] failed to load dynamic entries', err)
  }

  return entries
}
