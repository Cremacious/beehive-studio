'use client'

import { useMemo } from 'react'
import { LayoutGrid, Plus, X } from 'lucide-react'
import { useBookEditor } from './book-editor-provider'
import { EmptyState } from './empty-state'
import { createBinderItemAction } from '@/lib/actions/binder.actions'

type ChapterMeta = {
  synopsis?: string
}

const CHAPTER_TYPES = new Set(['chapter', 'front_matter', 'back_matter'])

export function CorkboardView() {
  const { binderItems, setActiveItemId, activeItemId, toggleCorkboardMode, addBinderItem, bookId } =
    useBookEditor()

  const chapters = useMemo(
    () =>
      binderItems
        .filter(item => CHAPTER_TYPES.has(item.type))
        .sort((a, b) => a.order - b.order),
    [binderItems],
  )

  function openChapter(id: string) {
    setActiveItemId(id)
    toggleCorkboardMode()
  }

  async function createFirstChapter() {
    // Mirrors chapter-editor.tsx's empty-book CTA — server returns just
    // { id, chapterId }, so we hydrate the rest of BinderItemRow client-side.
    const rootItems = binderItems.filter(i => i.parentId === null)
    const order = rootItems.length > 0 ? Math.max(...rootItems.map(i => i.order)) + 1 : 0
    const result = await createBinderItemAction({
      bookId,
      parentId: null,
      type: 'chapter',
      title: 'Untitled Chapter',
      order,
    })
    if (result.success) {
      addBinderItem({
        id: result.data.id,
        bookId,
        parentId: null,
        type: 'chapter',
        title: 'Untitled Chapter',
        order,
        content: null,
        chapterId: result.data.chapterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      openChapter(result.data.id)
    }
  }

  return (
    <div
      className="flex-1 overflow-y-auto relative"
      style={{
        // Desk-surface — warm coffee that pulls slightly warmer than the
        // chrome canvas. Matches the cork-surface treatment from the mockup
        // (radial dotted ground over a warm dark base). Theme-agnostic:
        // corkboard cards are paper regardless of editor mode, so the desk
        // can stay dark to make the cream cards pop.
        background:
          'radial-gradient(ellipse at 50% 0%, oklch(0.85 0.18 90 / 0.06), transparent 50%),' +
          'radial-gradient(circle at 18px 24px, oklch(0.30 0.020 50) 1.2px, transparent 1.6px),' +
          'radial-gradient(circle at 6px 8px, oklch(0.20 0.014 55) 1.2px, transparent 1.6px),' +
          'linear-gradient(180deg, oklch(0.26 0.018 50), oklch(0.22 0.018 50))',
        backgroundSize: 'auto, 30px 30px, 30px 30px, auto',
        backgroundPosition: '0 0, 0 0, 15px 15px, 0 0',
      }}
    >
      {/* Header strip — sticky over the desk surface */}
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 backdrop-blur"
        style={{
          background:
            'linear-gradient(180deg, oklch(0.18 0.014 50 / 0.85), oklch(0.18 0.014 50 / 0))',
          borderBottom: '1px solid oklch(0.30 0.020 50)',
        }}
      >
        <LayoutGrid size={16} style={{ color: 'oklch(0.96 0.018 80)' }} />
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'oklch(0.96 0.018 80)',
          }}
        >
          Corkboard
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'oklch(0.66 0.02 60)',
          }}
        >
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
        </div>
        <div className="flex-1" />
        <button
          onClick={toggleCorkboardMode}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-display)',
            boxShadow: 'var(--el-2)',
          }}
        >
          <X size={14} />
          Exit corkboard
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="px-8 py-12">
          <EmptyState
            icon={<Plus size={20} />}
            title="No chapters yet"
            body="Pin your first chapter to the board. You can rearrange and rename anytime."
            cta={{ label: '+ Create first chapter', onClick: createFirstChapter }}
          />
        </div>
      ) : (
        <div
          className="grid mx-auto"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '30px 24px',
            padding: '40px 32px 56px',
            maxWidth: 1240,
          }}
        >
          {chapters.map((item, idx) => {
            const meta: ChapterMeta =
              item.content && typeof item.content === 'object' && !Array.isArray(item.content)
                ? (item.content as ChapterMeta)
                : {}

            const isActive = item.id === activeItemId
            // Deterministic alternating tilt: even idx = +1°, odd idx = -1°.
            // Hover handler corrects to 0° for the lift.
            const tilt = idx % 2 === 0 ? '1deg' : '-1deg'
            const label =
              item.type === 'front_matter'
                ? 'Front matter'
                : item.type === 'back_matter'
                  ? 'Back matter'
                  : `Chapter ${idx + 1}`

            return (
              <button
                key={item.id}
                onClick={() => openChapter(item.id)}
                className="cb-card-btn group relative text-left"
                style={{
                  background: 'var(--paper-100)',
                  color: 'var(--paper-ink)',
                  borderRadius: 4,
                  padding: '24px 18px 16px',
                  minHeight: 220,
                  fontFamily: 'var(--font-prose)',
                  transform: `rotate(${tilt})`,
                  transition: 'transform 200ms ease, box-shadow 200ms ease',
                  boxShadow:
                    '0 1px 0 var(--paper-50) inset, 0 2px 4px rgba(0,0,0,0.35), 0 18px 36px -12px rgba(0,0,0,0.55)' +
                    (isActive ? ', 0 0 0 2px var(--color-brand)' : ''),
                  outline: isActive ? '2px solid var(--color-brand)' : 'none',
                  outlineOffset: 4,
                  backgroundImage:
                    'repeating-linear-gradient(180deg, transparent 0 27px, oklch(0.78 0.04 60 / 0.30) 27px 28px)',
                  backgroundPosition: '0 60px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'rotate(0deg) translateY(-4px)'
                  e.currentTarget.style.boxShadow =
                    '0 1px 0 var(--paper-50) inset, 0 2px 4px rgba(0,0,0,0.35), 0 28px 50px -10px rgba(0,0,0,0.65)' +
                    (isActive ? ', 0 0 0 2px var(--color-brand)' : '')
                  e.currentTarget.style.zIndex = '2'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = `rotate(${tilt})`
                  e.currentTarget.style.boxShadow =
                    '0 1px 0 var(--paper-50) inset, 0 2px 4px rgba(0,0,0,0.35), 0 18px 36px -12px rgba(0,0,0,0.55)' +
                    (isActive ? ', 0 0 0 2px var(--color-brand)' : '')
                  e.currentTarget.style.zIndex = ''
                }}
              >
                {/* Active ribbon — top-left "Editing" tag */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: 12,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      background: 'var(--color-brand)',
                      color: 'var(--brand-ink)',
                      padding: '2px 7px',
                      borderRadius: 'var(--r-xs)',
                      boxShadow: 'var(--el-2)',
                      fontWeight: 700,
                    }}
                  >
                    Editing
                  </span>
                )}

                {/* Pin (decorative) */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle at 35% 30%, oklch(0.92 0.18 90), var(--color-brand) 45%, var(--brand-active))',
                    boxShadow:
                      '0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.7) inset',
                  }}
                />

                {/* Chapter number / type label */}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--paper-400)',
                    marginBottom: 6,
                  }}
                >
                  {label}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: '-0.005em',
                    color: 'var(--paper-ink-strong)',
                    lineHeight: 1.2,
                    margin: '0 0 10px',
                  }}
                >
                  {item.title}
                </h3>

                {/* Synopsis (3-line clamp) */}
                {meta.synopsis ? (
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--paper-ink)',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {meta.synopsis}
                  </p>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--paper-ink-muted)',
                      fontStyle: 'italic',
                      opacity: 0.7,
                    }}
                  >
                    No synopsis yet.
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
