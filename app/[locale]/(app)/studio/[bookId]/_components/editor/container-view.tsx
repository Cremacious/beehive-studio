'use client'

import { useMemo } from 'react'
import {
  FileText,
  ScrollText,
  Folder,
  StickyNote,
  User as UserIcon,
  Layout as LayoutIcon,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import type { BinderItemRow } from '@/lib/actions/binder.actions'
import { useBookEditor } from '../book-editor-provider'
import { EmptyState } from '../empty-state'

// ContainerView — renderer for binder items that are structural containers
// (Collection = `part`, Research folder = `research_folder`) rather than
// editable documents. Selecting a container in the binder lands here.
//
// Shows the container's children as a small clickable grid. Click a child →
// activates it. Empty container → friendly empty state pointing at the Add
// menu in the binder footer.

type Props = { item: BinderItemRow }

const TYPE_META: Record<
  string,
  { label: string; Icon: LucideIcon; tint: string }
> = {
  chapter:         { label: 'Chapter',         Icon: FileText,   tint: 'var(--type-chapter)' },
  part:            { label: 'Collection',      Icon: BookOpen,   tint: 'var(--type-chapter)' },
  front_matter:    { label: 'Front matter',    Icon: ScrollText, tint: 'var(--type-front-matter)' },
  back_matter:     { label: 'Back matter',     Icon: ScrollText, tint: 'var(--type-back-matter)' },
  research_folder: { label: 'Research folder', Icon: Folder,     tint: 'var(--type-research)' },
  research_note:   { label: 'Research note',   Icon: StickyNote, tint: 'var(--type-research)' },
  character:       { label: 'Character',       Icon: UserIcon,   tint: 'var(--type-character)' },
  outline:         { label: 'Outline',         Icon: LayoutIcon, tint: 'var(--type-outline)' },
}

export function ContainerView({ item }: Props) {
  const { binderItems, setActiveItemId } = useBookEditor()

  const isResearchFolder = item.type === 'research_folder'
  const HeadingIcon = isResearchFolder ? Folder : BookOpen
  const headingLabel = isResearchFolder ? 'Research folder' : 'Collection'

  const children = useMemo(
    () =>
      binderItems
        .filter(i => i.parentId === item.id)
        .sort((a, b) => a.order - b.order),
    [binderItems, item.id],
  )

  if (children.length === 0) {
    return (
      <main className="flex-1 flex">
        <EmptyState
          icon={<HeadingIcon size={20} />}
          title={
            isResearchFolder
              ? 'This research folder is empty'
              : 'This collection is empty'
          }
          body={
            isResearchFolder
              ? 'Add a research note or character into this folder from the + Add menu in the binder.'
              : 'Add a chapter into this collection from the + Add menu in the binder, or drag existing chapters in.'
          }
          onEditorCanvas
        />
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="inline-flex items-center justify-center rounded-md"
            style={{
              width: 32,
              height: 32,
              background: 'oklch(from var(--color-brand) l c h / 0.12)',
              color: 'var(--color-brand)',
            }}
          >
            <HeadingIcon size={16} />
          </span>
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.12em]"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              {headingLabel} · {children.length} {children.length === 1 ? 'item' : 'items'}
            </div>
            <h1
              className="m-0 truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.015em',
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              {item.title}
            </h1>
          </div>
        </div>

        {/* Children grid */}
        <ul
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {children.map(child => {
            const meta = TYPE_META[child.type] ?? {
              label: child.type,
              Icon: FileText,
              tint: 'var(--canvas-dark-ink-muted)',
            }
            const Icon = meta.Icon
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => setActiveItemId(child.id)}
                  className="w-full text-left rounded-lg border border-border bg-surface hover:bg-surface-elevated hover:border-brand/40 transition-colors px-3.5 py-3 flex items-start gap-3 cursor-pointer"
                >
                  <span
                    className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center"
                    style={{ color: meta.tint }}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="text-[13px] font-medium leading-tight truncate text-foreground"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {child.title || 'Untitled'}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-tight mt-1">
                      {meta.label}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
