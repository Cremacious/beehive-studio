'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import { createId } from '@paralleldrive/cuid2'
import { canEditWiki, type HiveRole } from '@/lib/hive/permissions'
import { CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import type { HiveWikiEntry } from '@/lib/actions/hive-content.actions'
import { toastNetworkError } from '@/lib/errors/notify'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveSectionDivider } from '../../_components/hive-section-divider'

type SortMode = 'recent-edit' | 'a-z' | 'recent-add'

const TILE_HOVER =
  'transition-transform duration-150 hover:-translate-y-px active:translate-y-0'

function relTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function HiveWikiCategoryView({
  hiveId,
  locale,
  bookId,
  category,
  entries,
  viewerRole,
}: {
  hiveId: string
  locale: string
  bookId: string
  category: WikiCategory
  entries: HiveWikiEntry[]
  viewerRole: HiveRole
}) {
  const router = useRouter()
  const template = CATEGORY_TEMPLATE_MAP[category]
  const canEdit = canEditWiki(viewerRole)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('recent-edit')
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let list = entries
    if (s) {
      list = list.filter(e =>
        e.title.toLowerCase().includes(s) || e.excerpt.toLowerCase().includes(s),
      )
    }
    const sorted = [...list]
    if (sort === 'a-z') sorted.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'recent-add') {
      // No createdAt field on HiveWikiEntry; lastEditedAt is the best proxy
      // and entries query order is asc(binderItems.order) which is creation
      // order. So reverse the input list slice for recent-add.
      sorted.sort((a, b) => entries.indexOf(b) - entries.indexOf(a))
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime(),
      )
    }
    return sorted
  }, [entries, search, sort])

  function handleCreate() {
    const seededSections = [
      {
        id: `s_${createId()}`,
        label: 'Notes',
        body: { type: 'doc', content: [{ type: 'paragraph' }] },
      },
    ]
    startTransition(async () => {
      try {
        const r = await createBinderItemAction({
          bookId,
          parentId: null,
          type: 'wiki_entry',
          title: `New ${template.label}`,
          order: entries.length + 1,
          content: {
            category,
            sections: seededSections,
            tags: [],
            hints: {},
          } as unknown as Record<string, unknown>,
        })
        if (!r.success) {
          toast.error(r.error)
          return
        }
        router.push(`/${locale}/hive/${hiveId}/wiki/entry/${r.data.id}`)
      } catch {
        toastNetworkError()
      }
    })
  }

  const headerSlot = canEdit ? (
    <button
      type="button"
      onClick={handleCreate}
      style={{
        background: 'var(--brand)',
        color: 'var(--brand-ink)',
        borderRadius: 'var(--r-pill)',
        boxShadow: 'var(--sh-tile)',
      }}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold ${TILE_HOVER}`}
    >
      <Plus size={14} /> New Entry
    </button>
  ) : undefined

  const Icon = template.icon
  const accent = template.accentColor

  return (
    <HivePageShell
      width="wide"
      back={{ href: `/${locale}/hive/${hiveId}/wiki`, label: 'wiki' }}
      title={`${template.label}s`}
      subtitle={template.blurb}
      headerSlot={headerSlot}
    >
      <HiveSectionDivider label="Filter" hideTopBorder>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${template.label.toLowerCase()}s…`}
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                border: 'var(--br-card)',
                color: 'var(--canvas-dark-ink)',
              }}
              className="w-full pl-9 pr-3 py-2 text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            style={{
              background: 'var(--canvas-dark-100)',
              borderRadius: 'var(--r-row)',
              boxShadow: 'var(--sh-inset)',
              border: 'var(--br-card)',
              color: 'var(--canvas-dark-ink)',
              width: '180px',
            }}
            className="px-3 py-2 text-sm font-geist appearance-none cursor-pointer focus:outline-none"
          >
            <option value="recent-edit">Recently edited</option>
            <option value="a-z">A – Z</option>
            <option value="recent-add">Recently added</option>
          </select>
        </div>
      </HiveSectionDivider>

      <HiveSectionDivider
        label={`${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
      >
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[10px]"
              style={{
                background: `oklch(from var(${accent}) l c h / 0.16)`,
                color: `var(${accent})`,
              }}
            >
              <Icon size={22} />
            </div>
            <p
              className="text-sm italic mb-4"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              {search.trim()
                ? 'No entries match your search.'
                : `No ${template.label.toLowerCase()} entries yet.`}
            </p>
            {canEdit && !search.trim() && (
              <button
                type="button"
                onClick={handleCreate}
                style={{
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  borderRadius: 'var(--r-pill)',
                  boxShadow: 'var(--sh-tile)',
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold ${TILE_HOVER}`}
              >
                <Plus size={14} /> Create the first {template.label.toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(entry => (
              <Link
                key={entry.id}
                href={`/${locale}/hive/${hiveId}/wiki/entry/${entry.id}`}
                style={{
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-tile)',
                  ['--pill-accent' as string]: `var(${accent})`,
                }}
                className={`flex flex-col gap-[9px] p-4 text-inherit no-underline ${TILE_HOVER}`}
              >
                <span
                  className="font-comfortaa font-bold text-[16px] leading-tight line-clamp-1"
                  style={{ color: 'var(--canvas-dark-ink-strong)' }}
                >
                  {entry.title || 'Untitled entry'}
                </span>
                {entry.excerpt && (
                  <p
                    className="text-[13.5px] leading-[1.55] line-clamp-2 m-0"
                    style={{ color: 'var(--canvas-dark-ink)' }}
                  >
                    {entry.excerpt}
                  </p>
                )}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {entry.tags.slice(0, 4).map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center text-[10px] font-mono uppercase tracking-wider px-2 py-[2px] rounded-[var(--r-pill)]"
                        style={{
                          color: `var(${accent})`,
                          background: `oklch(from var(${accent}) l c h / 0.14)`,
                          border: `1px solid oklch(from var(${accent}) l c h / 0.3)`,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 mt-[2px]">
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    {entry.authorUsername ? (
                      <>
                        edited by{' '}
                        <span style={{ color: 'var(--canvas-dark-ink)' }}>
                          @{entry.authorUsername}
                        </span>
                      </>
                    ) : (
                      'edited'
                    )}
                  </span>
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    {relTime(entry.lastEditedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </HiveSectionDivider>

      <div className="pb-6" />
    </HivePageShell>
  )
}
