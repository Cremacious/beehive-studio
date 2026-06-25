'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { createBinderItemAction } from '@/lib/actions/binder.actions'
import { canEditWiki, type HiveRole } from '@/lib/hive/permissions'
import { CATEGORY_TEMPLATES, CATEGORY_TEMPLATE_MAP, type WikiCategory } from '@/lib/wiki/category-templates'
import { createId } from '@paralleldrive/cuid2'
import { WikiCategoryPicker } from '@/app/[locale]/(app)/studio/[bookId]/_components/binder/wiki-category-picker'
import { HivePageShell } from '../../_components/hive-page-shell'
import { HiveSectionDivider } from '../../_components/hive-section-divider'
import { toastNetworkError } from '@/lib/errors/notify'

const TILE_HOVER =
  'transition-transform duration-150 hover:-translate-y-px active:translate-y-0'

export function HiveWikiShell({
  hiveId,
  locale,
  bookId,
  counts,
  viewerRole,
}: {
  hiveId: string
  locale: string
  bookId: string
  counts: Record<WikiCategory, number>
  viewerRole: HiveRole
}) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [, startTransition] = useTransition()
  const canEdit = canEditWiki(viewerRole)

  const totalEntries = Object.values(counts).reduce((a, b) => a + b, 0)
  const subtitle = `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} across your story bible`

  function handlePickCategory(category: WikiCategory) {
    const template = CATEGORY_TEMPLATE_MAP[category]
    // Seed one empty "Notes" section — matches the studio binder-add-menu shape.
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
          order: totalEntries + 1,
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
      onClick={() => setPickerOpen(true)}
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

  return (
    <>
      <HivePageShell width="wide" title="Wiki" subtitle={subtitle} headerSlot={headerSlot}>
        <HiveSectionDivider label="Search" hideTopBorder>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            />
            <input
              type="text"
              placeholder={`Search ${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'}…`}
              style={{
                background: 'var(--canvas-dark-100)',
                borderRadius: 'var(--r-row)',
                boxShadow: 'var(--sh-inset)',
                border: 'var(--br-card)',
                color: 'var(--canvas-dark-ink)',
              }}
              className="w-full pl-9 pr-3 py-2 text-sm font-geist placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none"
              // Decorative for v1 — global wiki search is a future epic.
              readOnly
              aria-label="Search wiki entries (not yet wired)"
            />
          </div>
        </HiveSectionDivider>

        <HiveSectionDivider label="Categories" className="grid grid-cols-2 gap-3">
          {CATEGORY_TEMPLATES.map(template => {
            const count = counts[template.category] ?? 0
            const isZero = count === 0
            const Icon = template.icon
            const accent = template.accentColor
            return (
              <Link
                key={template.category}
                href={`/${locale}/hive/${hiveId}/wiki/category/${template.category}`}
                style={{
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
                  borderRadius: 'var(--r-row)',
                  boxShadow: 'var(--sh-tile)',
                  ['--pill-accent' as string]: `var(${accent})`,
                }}
                className={`relative flex items-start gap-[14px] p-[14px_16px] text-inherit no-underline overflow-hidden ${TILE_HOVER}`}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                  style={{
                    background: `oklch(from var(${accent}) l c h / 0.16)`,
                    color: `var(${accent})`,
                  }}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1 pr-9">
                  <span
                    className="font-comfortaa font-semibold text-[15px] leading-tight block"
                    style={{ color: 'var(--canvas-dark-ink-strong)' }}
                  >
                    {template.label}
                  </span>
                  <span
                    className="mt-[3px] block text-[12.5px] leading-snug line-clamp-2"
                    style={{ color: 'var(--canvas-dark-ink-muted)' }}
                  >
                    {template.blurb}
                  </span>
                </span>
                <span
                  className="absolute top-3 right-3 font-mono text-[11px] px-2 py-[1px] rounded-[var(--r-pill)]"
                  style={{
                    background: 'var(--canvas-dark-100)',
                    boxShadow: 'var(--sh-inset)',
                    color: isZero
                      ? 'var(--canvas-dark-ink-muted)'
                      : `var(${accent})`,
                  }}
                >
                  {count}
                </span>
              </Link>
            )
          })}
        </HiveSectionDivider>

        <div className="pb-6" />
      </HivePageShell>
      <WikiCategoryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={c => {
          setPickerOpen(false)
          handlePickCategory(c)
        }}
      />
    </>
  )
}
