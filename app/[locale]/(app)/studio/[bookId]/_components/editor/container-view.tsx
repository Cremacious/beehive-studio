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

  // Theme-aware CSS vars — same pattern as character-profile.tsx and the
  // FM/BM previews. Dark mode: lifted neutral gray canvas (less walnut, more
  // gray) so cream paper cards pop against it without clashing. Light mode:
  // darker cream canvas with lighter cream cards lifted above.
  const themeStyles = (
    <style>{`
      [data-slot="container-pane"] {
        --container-bg:        oklch(0.22 0.005 256);
        --container-ink:       var(--canvas-dark-ink);
        --container-ink-muted: var(--canvas-dark-ink-muted);
        --card-bg:             var(--paper-100);
        --card-bg-hover:       var(--paper-50);
        --card-border:         var(--paper-300);
        --card-ink:            var(--paper-ink-strong);
        --card-ink-muted:      var(--paper-ink-muted);
      }
      [data-editor-theme="light"] [data-slot="container-pane"] {
        background: var(--container-bg) !important;
        --container-bg:        var(--paper-300);
        --container-ink:       var(--paper-ink-strong);
        --container-ink-muted: var(--paper-ink-muted);
        --card-bg:             var(--paper-50);
        --card-bg-hover:       var(--paper-100);
        --card-border:         var(--paper-200);
        --card-ink:            var(--paper-ink-strong);
        --card-ink-muted:      var(--paper-ink-muted);
      }
    `}</style>
  )

  if (children.length === 0) {
    return (
      <main
        data-slot="container-pane"
        className="flex-1 flex"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
        }}
      >
        {themeStyles}
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
    <main
      data-slot="container-pane"
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--container-bg)' }}
    >
      {themeStyles}
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <span
            className="inline-flex items-center justify-center rounded-md"
            style={{
              width: 36,
              height: 36,
              background: 'oklch(from var(--color-brand) l c h / 0.14)',
              color: 'var(--color-brand)',
            }}
          >
            <HeadingIcon size={18} />
          </span>
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--container-ink-muted)',
              }}
            >
              {headingLabel} · {children.length} {children.length === 1 ? 'item' : 'items'}
            </div>
            <h1
              className="m-0 truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-0.015em',
                color: 'var(--container-ink)',
              }}
            >
              {item.title}
            </h1>
          </div>
        </div>

        {/* Children grid — paper cards on the lifted canvas */}
        <ul
          className="grid gap-3.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}
        >
          {children.map(child => {
            const meta = TYPE_META[child.type] ?? {
              label: child.type,
              Icon: FileText,
              tint: 'var(--card-ink-muted)',
            }
            const Icon = meta.Icon
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => setActiveItemId(child.id)}
                  className="group w-full text-left border transition-all px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:-translate-y-px"
                  style={{
                    background: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    borderRadius: 'var(--r-row)',
                    boxShadow: 'var(--sh-tile)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--card-bg-hover)'
                    e.currentTarget.style.borderColor = 'oklch(from var(--color-brand) l c h / 0.5)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--card-bg)'
                    e.currentTarget.style.borderColor = 'var(--card-border)'
                  }}
                >
                  <span
                    className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center"
                    style={{ color: meta.tint }}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="text-[14px] font-semibold leading-tight truncate"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--card-ink)',
                      }}
                    >
                      {child.title || 'Untitled'}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.10em] leading-tight mt-1.5"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--card-ink-muted)',
                      }}
                    >
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
