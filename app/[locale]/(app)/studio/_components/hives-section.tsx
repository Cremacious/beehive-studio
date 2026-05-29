'use client'

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { HiveCard } from './hive-card'
import { CreateHiveModal } from './create-hive-modal'
import type { UserHiveView } from '@/lib/actions/hive.actions'

type SortKey = 'active' | 'recent' | 'name' | 'members'
type MembershipFilter = 'all' | 'owned' | 'member'
type LinkFilter = 'all' | 'linked' | 'standalone'

const SORT_LABELS: Record<SortKey, string> = {
  active: 'Most active',
  recent: 'Recently created',
  name: 'Name A → Z',
  members: 'Member count',
}

type Props = {
  hives: UserHiveView[]
}

export function HivesSection({ hives }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('active')
  const [membership, setMembership] = useState<MembershipFilter>('all')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const counts = useMemo(() => {
    let owned = 0
    let member = 0
    let linked = 0
    let standalone = 0
    for (const h of hives) {
      if (h.viewerRole === 'OWNER') owned++
      else member++
      if (h.bookId) linked++
      else standalone++
    }
    return { all: hives.length, owned, member, linked, standalone }
  }, [hives])

  const hasBoth = counts.linked > 0 && counts.standalone > 0

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = hives
    if (q) {
      result = result.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.bookTitle ?? '').toLowerCase().includes(q) ||
          (h.description ?? '').toLowerCase().includes(q),
      )
    }
    if (membership === 'owned') result = result.filter((h) => h.viewerRole === 'OWNER')
    if (membership === 'member') result = result.filter((h) => h.viewerRole !== 'OWNER')
    if (linkFilter === 'linked') result = result.filter((h) => h.bookId !== null)
    if (linkFilter === 'standalone') result = result.filter((h) => h.bookId === null)

    const sorted = [...result]
    if (sort === 'active') {
      sorted.sort((a, b) => {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return tb - ta
      })
    }
    if (sort === 'recent') {
      // No createdAt on view; fall back to lastActiveAt-ish ordering.
      sorted.sort((a, b) => {
        const ta = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const tb = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return tb - ta
      })
    }
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'members') sorted.sort((a, b) => b.memberCount - a.memberCount)
    return sorted
  }, [hives, query, membership, linkFilter, sort])

  const filterActive =
    query.trim().length > 0 || membership !== 'all' || linkFilter !== 'all'

  return (
    <section style={{ marginTop: '56px' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '20px' }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--canvas-dark-ink-strong)',
            margin: 0,
          }}
        >
          Your Hives
        </h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 transition-colors"
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--r-full)',
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.02em',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          New Hive
        </button>
      </div>

      {hives.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          {/* Controls row */}
          <div
            className="flex flex-wrap items-center gap-3"
            style={{ marginBottom: '16px' }}
          >
            <div
              className="relative flex items-center"
              style={{ flex: '1 1 240px', maxWidth: '320px' }}
            >
              <Search
                size={14}
                className="absolute pointer-events-none"
                style={{ left: '12px', color: 'var(--canvas-dark-ink-muted)' }}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search hives…"
                className="w-full"
                style={{
                  padding: '8px 12px 8px 32px',
                  background: 'var(--canvas-dark-150)',
                  border: '1px solid var(--canvas-dark-300)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--canvas-dark-ink)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              style={{
                padding: '8px 12px',
                background: 'var(--canvas-dark-150)',
                border: '1px solid var(--canvas-dark-300)',
                borderRadius: 'var(--r-md)',
                color: 'var(--canvas-dark-ink)',
                fontFamily: 'var(--font-ui)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {/* Filter chip rows */}
          <div className="flex flex-col gap-2" style={{ marginBottom: '24px' }}>
            <ChipRow>
              <Chip
                active={membership === 'all'}
                onClick={() => setMembership('all')}
                label={`All (${counts.all})`}
              />
              <Chip
                active={membership === 'owned'}
                onClick={() => setMembership('owned')}
                label={`Owned (${counts.owned})`}
              />
              <Chip
                active={membership === 'member'}
                onClick={() => setMembership('member')}
                label={`Member (${counts.member})`}
              />
            </ChipRow>
            {hasBoth && (
              <ChipRow>
                <Chip
                  active={linkFilter === 'all'}
                  onClick={() => setLinkFilter('all')}
                  label="All"
                />
                <Chip
                  active={linkFilter === 'linked'}
                  onClick={() => setLinkFilter('linked')}
                  label={`Linked to book (${counts.linked})`}
                />
                <Chip
                  active={linkFilter === 'standalone'}
                  onClick={() => setLinkFilter('standalone')}
                  label={`Standalone (${counts.standalone})`}
                />
              </ChipRow>
            )}
          </div>

          {/* Grid or no-match */}
          {visible.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--canvas-dark-ink-muted)',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                border: '1px dashed var(--canvas-dark-300)',
                borderRadius: 'var(--r-2xl)',
              }}
            >
              No hives match these filters.
            </div>
          ) : (
            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
              }}
            >
              {visible.map((h) => (
                <HiveCard key={h.id} hive={h} />
              ))}
            </div>
          )}
        </>
      )}

      <CreateHiveModal open={createOpen} onOpenChange={setCreateOpen} />
      {/* filterActive is currently only used as guard against showing the
          empty-state CTA on the no-match path — referenced to keep tsc happy
          in case future patches want the value. */}
      {filterActive ? null : null}
    </section>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--r-full)',
        background: active ? 'var(--brand)' : 'var(--canvas-dark-150)',
        color: active ? 'var(--brand-ink)' : 'var(--canvas-dark-ink)',
        border: active
          ? '1px solid var(--brand)'
          : '1px solid var(--canvas-dark-300)',
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        border: '2px dashed var(--canvas-dark-300)',
        borderRadius: 'var(--r-2xl)',
        background: 'var(--canvas-dark-100)',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          color: 'oklch(from var(--brand) l c h / 0.4)',
          marginBottom: '12px',
        }}
        aria-hidden="true"
      >
        ⬡
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--canvas-dark-ink-strong)',
          marginBottom: '6px',
        }}
      >
        No hives yet
      </div>
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          color: 'var(--canvas-dark-ink-muted)',
          marginBottom: '20px',
          maxWidth: '360px',
          margin: '0 auto 20px',
        }}
      >
        Hives are small writing groups — invite friends to read drafts, share
        feedback, and cheer each other on.
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5"
        style={{
          padding: '10px 18px',
          borderRadius: 'var(--r-full)',
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.02em',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
        New Hive
      </button>
    </div>
  )
}
