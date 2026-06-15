import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Plus } from 'lucide-react'
import { auth } from '@/lib/auth'
import { parseRadio, parseIntParam } from '@/lib/discover/url-state'
import {
  getCommunitySparksAction,
  type CommunitySparkRow,
} from '@/lib/actions/sparks-hub.actions'
import { SparksTabStrip } from './_components/sparks-tab-strip'
import { SparksSortDropdown } from './_components/sparks-sort-dropdown'
import { SparksEmptyState } from './_components/sparks-empty-state'
import { SparksHubPagination } from './_components/sparks-hub-pagination'
import { SparkCard } from '../discover/_components/spark-card'

type SP = Record<string, string | string[] | undefined>
type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SP>
}

const PAGE_SIZE = 12

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export default async function SparksHubPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/sparks`)}`)
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

  const result = await getCommunitySparksAction({ viewerId, tab, sort, page })
  if (!result.success) {
    return (
      <main
        className="mx-auto w-full px-6 pt-7 pb-6"
        style={{ maxWidth: '1920px' }}
      >
        <p className="text-red-400 text-sm">Failed to load sparks.</p>
      </main>
    )
  }
  const { sparks, totalCount, bucketCounts } = result.data
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <main
      className="mx-auto w-full px-6 pt-7 pb-6"
      style={{ maxWidth: '1920px' }}
    >
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
          href={`/${locale}/sparks/new`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-lg"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          <Plus size={14} aria-hidden="true" />
          New Spark
        </Link>
      </header>

      <div className="mb-4">
        <SparksTabStrip
          locale={locale}
          current={tab}
          counts={bucketCounts}
          baseParams={{
            sort: sort !== 'recent' ? sort : undefined,
          }}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[12px]"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <strong style={{ color: 'var(--canvas-dark-ink)' }}>
            {totalCount.toLocaleString()}
          </strong>{' '}
          sparks
        </div>
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

      {sparks.length === 0 ? (
        <SparksEmptyState tab={tab} locale={locale} />
      ) : (
        <>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              justifyItems: 'start',
            }}
          >
            {sparks.map((spark: CommunitySparkRow) => (
              <SparkCard
                key={spark.id}
                spark={spark}
                locale={locale}
                sourceTag={spark.source}
                size="md"
              />
            ))}
          </div>

          <SparksHubPagination
            locale={locale}
            page={page}
            totalPages={totalPages}
            baseParams={{
              tab: tab !== 'all' ? tab : undefined,
              sort: sort !== 'recent' ? sort : undefined,
            }}
          />
        </>
      )}
    </main>
  )
}
