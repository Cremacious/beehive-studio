import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Plus } from 'lucide-react'
import { auth } from '@/lib/auth'
import { parseRadio, parseIntParam } from '@/lib/discover/url-state'
import { getCommunitySparksAction } from '@/lib/actions/sparks-hub.actions'
import { getTrendingSparksForRailAction } from '@/lib/actions/sparks-rail.actions'
import { pickPromptTemplate } from '@/lib/sparks/prompt-templates'
import { SparksTabStrip } from './_components/sparks-tab-strip'
import { SparksSortDropdown } from './_components/sparks-sort-dropdown'
import { SparksHubPagination } from './_components/sparks-hub-pagination'
import { SparksRightRail } from './_components/sparks-right-rail'
import { SparksGrid } from './_components/sparks-grid'
import { BackToCommunity } from '@/components/community/back-to-community'
import { db } from '@/db'
import { sparkLikes } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

type SP = Record<string, string | string[] | undefined>
type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SP>
}

const PAGE_SIZE = 9

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export default async function SparksHubPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/community/sparks`)}`)
  }
  const viewerId = session.user.id

  const tab = parseRadio(
    pickRaw(sp, 'tab'),
    ['all', 'yours', 'following', 'friends', 'entered'] as const,
    'all',
  )
  const sort = parseRadio(
    pickRaw(sp, 'sort'),
    ['recent', 'ending', 'entries', 'status'] as const,
    'recent',
  )
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const [result, trendingR] = await Promise.all([
    getCommunitySparksAction({ viewerId, tab, sort, page }),
    getTrendingSparksForRailAction({ limit: 1 }),
  ])
  if (!result.success) {
    return (
      <main
        className="page-x tier-wide pt-7 pb-6"
      >
        <p className="text-red-400 text-sm">Failed to load sparks.</p>
      </main>
    )
  }
  const { sparks, totalCount, bucketCounts } = result.data
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Batched viewer-liked lookup for the visible page so each card renders the
  // correct filled-heart state on first paint.
  const visibleSparkIds = sparks.map((s) => s.id)
  const likedRows = visibleSparkIds.length > 0
    ? await db
        .select({ sparkId: sparkLikes.sparkId })
        .from(sparkLikes)
        .where(
          and(
            eq(sparkLikes.userId, viewerId),
            inArray(sparkLikes.sparkId, visibleSparkIds),
          ),
        )
    : []
  const viewerLikedSparkIds = new Set(likedRows.map((r) => r.sparkId))

  const trendingSpark =
    trendingR.success && trendingR.data[0]
      ? {
          id: trendingR.data[0].id,
          title: trendingR.data[0].title,
          entryCount: trendingR.data[0].entryCount,
          deadline: trendingR.data[0].deadline,
        }
      : null
  const promptTemplate = pickPromptTemplate(viewerId)

  return (
    <main
      className="page-x tier-wide pt-7 pb-6"
    >
      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_300px] grid-cols-1 gap-8">
        <div className="min-w-0">
          <BackToCommunity href={`/${locale}/community`} />
          <header className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1
                className="text-[32px] font-bold leading-tight"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Sparks
              </h1>
              <p
                className="text-[13px] mt-1.5"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Sparks from you, your circle, and prompts you&apos;ve entered.
              </p>
            </div>
            <Link
              href={`/${locale}/community/sparks/new`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-lg"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              <Plus size={14} aria-hidden="true" />
              New Spark
            </Link>
          </header>

          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <SparksTabStrip
              locale={locale}
              current={tab}
              counts={bucketCounts}
              baseParams={{
                sort: sort !== 'recent' ? sort : undefined,
              }}
            />
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Sort
              </span>
              <SparksSortDropdown selected={sort} />
            </div>
          </div>

          <SparksGrid
            sparks={sparks}
            tab={tab}
            locale={locale}
            bucketCounts={bucketCounts}
            promptTemplate={promptTemplate}
            trendingSpark={trendingSpark}
            viewerLikedSparkIds={Array.from(viewerLikedSparkIds)}
            isAuthenticated={true}
          />

          {totalCount > PAGE_SIZE ? (
            <SparksHubPagination
              locale={locale}
              page={page}
              totalPages={totalPages}
              baseParams={{
                tab: tab !== 'all' ? tab : undefined,
                sort: sort !== 'recent' ? sort : undefined,
              }}
            />
          ) : null}
        </div>
        <SparksRightRail locale={locale} />
      </div>
    </main>
  )
}
