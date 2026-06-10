import { requireAdmin } from '@/lib/admin/require-admin'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { DeleteContentButton } from './delete-content-button'
import type { ContentKind } from './actions'

export const dynamic = 'force-dynamic'

const TABS: { id: ContentKind; label: string }[] = [
  { id: 'book', label: 'Books' },
  { id: 'spark', label: 'Sparks' },
  { id: 'book_comment', label: 'Book comments' },
  { id: 'chapter_comment', label: 'Chapter comments' },
  { id: 'buzz_post', label: 'Buzz posts' },
  { id: 'club_discussion', label: 'Club discussions' },
]

interface ContentRow {
  id: string
  title: string
  authorEmail: string | null
  authorUsername: string | null
  createdAt: Date | string
  excerpt: string | null
}

async function exec(query: ReturnType<typeof sql>): Promise<ContentRow[]> {
  const r = await db.execute(query)
  // neon-serverless returns { rows }, pg-style.
  return ((r as { rows?: unknown }).rows ?? r) as ContentRow[]
}

async function fetchByKind(kind: ContentKind): Promise<ContentRow[]> {
  switch (kind) {
    case 'book': {
      return exec(sql`
        SELECT
          b.id,
          b.title,
          b.created_at AS "createdAt",
          left(coalesce(b.synopsis, ''), 160) AS excerpt,
          u.email AS "authorEmail",
          p.username AS "authorUsername"
        FROM books b
        LEFT JOIN users u ON u.id = b.user_id
        LEFT JOIN user_profiles p ON p.user_id = b.user_id
        WHERE b.status != 'STANDALONE_HIVE_SHADOW'
        ORDER BY b.created_at DESC
        LIMIT 100
      `)
    }
    case 'spark': {
      return exec(sql`
        SELECT
          s.id,
          s.title,
          s.created_at AS "createdAt",
          left(coalesce(s.description, ''), 160) AS excerpt,
          u.email AS "authorEmail",
          p.username AS "authorUsername"
        FROM sparks s
        LEFT JOIN users u ON u.id = s.creator_id
        LEFT JOIN user_profiles p ON p.user_id = s.creator_id
        ORDER BY s.created_at DESC
        LIMIT 100
      `)
    }
    case 'book_comment': {
      return exec(sql`
        SELECT
          c.id,
          coalesce(b.title, 'on (deleted book)') AS title,
          c.created_at AS "createdAt",
          left(c.content, 200) AS excerpt,
          u.email AS "authorEmail",
          p.username AS "authorUsername"
        FROM book_comments c
        LEFT JOIN books b ON b.id = c.book_id
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN user_profiles p ON p.user_id = c.user_id
        ORDER BY c.created_at DESC
        LIMIT 100
      `)
    }
    case 'chapter_comment': {
      return exec(sql`
        SELECT
          c.id,
          coalesce(bi.title || ' in ' || b.title, 'on (deleted chapter)') AS title,
          c.created_at AS "createdAt",
          left(c.content, 200) AS excerpt,
          u.email AS "authorEmail",
          p.username AS "authorUsername"
        FROM chapter_comments c
        LEFT JOIN chapters ch ON ch.id = c.chapter_id
        LEFT JOIN binder_items bi ON bi.id = ch.binder_item_id
        LEFT JOIN books b ON b.id = ch.book_id
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN user_profiles p ON p.user_id = c.user_id
        ORDER BY c.created_at DESC
        LIMIT 100
      `)
    }
    case 'buzz_post': {
      return exec(sql`
        SELECT
          bp.id,
          h.name AS title,
          bp.created_at AS "createdAt",
          left(bp.body, 200) AS excerpt,
          u.email AS "authorEmail",
          p.username AS "authorUsername"
        FROM hive_buzz_posts bp
        LEFT JOIN hives h ON h.id = bp.hive_id
        LEFT JOIN users u ON u.id = bp.author_id
        LEFT JOIN user_profiles p ON p.user_id = bp.author_id
        ORDER BY bp.created_at DESC
        LIMIT 100
      `)
    }
    case 'club_discussion': {
      return exec(sql`
        SELECT
          d.id,
          d.title,
          d.created_at AS "createdAt",
          left(d.content, 200) AS excerpt,
          u.email AS "authorEmail",
          p.username AS "authorUsername"
        FROM book_club_discussions d
        LEFT JOIN users u ON u.id = d.author_id
        LEFT JOIN user_profiles p ON p.user_id = d.author_id
        ORDER BY d.created_at DESC
        LIMIT 100
      `)
    }
  }
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const kindParam = (params.kind ?? 'book') as ContentKind
  const kind = TABS.find((t) => t.id === kindParam)?.id ?? 'book'

  const rows = await fetchByKind(kind)

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1
          className="font-bold text-3xl"
          style={{ fontFamily: 'var(--font-display, Comfortaa)', color: 'var(--brand)' }}
        >
          Content moderation
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          Most recent 100 of each type. Deletes are permanent and cascade to children.
        </p>
      </header>

      <nav
        className="flex gap-1 p-1 rounded-[var(--r-pill)] w-fit"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
        }}
      >
        {TABS.map((t) => {
          const active = t.id === kind
          return (
            <Link
              key={t.id}
              href={`/admin/content?kind=${t.id}`}
              className="px-3.5 py-1.5 text-xs rounded-[var(--r-pill)]"
              style={{
                background: active
                  ? 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))'
                  : 'transparent',
                boxShadow: active ? 'var(--sh-tile)' : 'none',
                color: active ? 'var(--brand)' : 'var(--canvas-dark-ink-muted)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      <div
        className="rounded-[var(--r-card)] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          borderTop: 'var(--br-card)',
        }}
      >
        {rows.length === 0 ? (
          <p
            className="px-5 py-6 text-sm italic"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Nothing here.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--canvas-dark-300)' }}>
            {rows.map((r) => (
              <li
                key={r.id}
                className="px-5 py-3 grid gap-3 items-start"
                style={{
                  gridTemplateColumns: '1fr 200px 120px',
                  color: 'var(--canvas-dark-ink)',
                }}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--canvas-dark-ink-strong)' }}>
                    {r.title}
                  </div>
                  {r.excerpt && (
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: 'var(--canvas-dark-ink-muted)' }}
                    >
                      {r.excerpt}
                    </p>
                  )}
                </div>
                <div className="text-xs">
                  <div style={{ color: 'var(--canvas-dark-ink)' }}>
                    {r.authorUsername ? `@${r.authorUsername}` : '–'}
                  </div>
                  <div style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    {r.authorEmail ?? ''}
                  </div>
                  <div style={{ color: 'var(--canvas-dark-ink-muted)' }}>
                    {new Date(r.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <DeleteContentButton kind={kind} id={r.id} title={r.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
